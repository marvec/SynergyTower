; Server Rack Sequence (src/minigames/simon.js) as a disk-loaded overlay at $4000.
; Watch the rack's LEDs blink a sequence, then repeat it; each round adds one more light. A wrong light or 6 s
; of idling is a strike; the round is then shown again. Score = rounds completed / rounds.
; Difficulty d = MG_DIFF / 255 (JS byDiff(d, a, b) = a + (b - a) × d):
;   d = 0: 4 LEDs, sequences of 3..5 (3 rounds), each light 0.55 s, 3 strikes allowed
;   d = 1: 6 LEDs (5 from d 0.34, 6 from d 0.67), sequences of 3..9 (7 rounds), each light 0.3 s,
;          2 strikes from d 0.5
; Gap between lights 0.45 × the light, 0.6 s pause before a show, 90 s in all. No department content.

.include "api.inc"
.include "gen/chars.inc"

TOTAL_T   = 90 * 50
PAUSE_T   = 30                  ; 0.6 s before the first light of a show
IDLE_T    = 6 * 50              ; a strike after 6 s without a key
PRESS_T   = 10                  ; a pressed LED stays lit 0.2 s
NICE_T    = 35                  ; 0.7 s after a completed round
AGAIN_T   = 45                  ; 0.9 s after a strike
MSG_T     = 50                  ; floaters fade after 1 s
MAX_LEN   = 9
NO_LED    = $ff
BOT_T     = 12                  ; the test bot presses every 12 frames

; layout
RACK_X    = 3                   ; cabinet: columns 3-36, rows 2-22
RACK_W    = 34
RACK_Y    = 2
RACK_H    = 21
PANEL_Y   = 8                   ; LED panel box: rows 8-17
STATUS_Y  = 9
LED_Y     = 11                  ; LEDs: 3 × 3 cells, a frame around a lit one
NUM_Y     = 15                  ; key numbers
ARROW_Y   = 16                  ; the joystick cursor
PIPS_Y    = 18                  ; progress while repeating
MSG_Y     = 19
STRIKES_X = 27
STRIKES_Y = 23
LED_STEP  = 5                   ; 3 wide + 2 between (room for the frames)
NUM_COL   = 6                   ; key numbers blue, the cursor's yellow

PH_SHOW   = 0
PH_INPUT  = 1
PH_PAUSE  = 2

.zeropage
n:        .res 1                ; LEDs
maxlen:   .res 1
rounds:   .res 1
flash:    .res 1                ; frames a light stays on in a show
gap:      .res 1
strikes_max: .res 1
len:      .res 1                ; current sequence length
completed: .res 1
strikes:  .res 1
phase:    .res 1
cnt:      .res 1                ; frames left in the current show / pause step
k:        .res 1                ; show: the light being shown; input: lights repeated so far
sh_on:    .res 1                ; show: a light is on
idle:     .res 2                ; input: frames left before "Timed out!"
lit:      .res 1                ; LED drawn lit, NO_LED = none
press_t:  .res 1
msg_t:    .res 1
cursor:   .res 1
lastkey:  .res 1
done:     .res 1
anim:     .res 1
t0:       .res 1
t1:       .res 1
x0:       .res 1                ; first LED column
m_lo:     .res 1                ; status / message text, colour, row
m_hi:     .res 1
m_col:    .res 1
m_row:    .res 1
bd_a:     .res 2                ; bydiff
bd_b:     .res 2
bd_m:     .res 2
bd_p:     .res 3
bd_t:     .res 1
bd_h:     .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A/X = byDiff(a, b), rounded (16 bit).
.macro bydiff_w aa, bb
        lda #<(aa)
        sta bd_a
        lda #>(aa)
        sta bd_a+1
        lda #<(bb)
        sta bd_b
        lda #>(bb)
        sta bd_b+1
        jsr bydiff
.endmacro

; ---- setup

init:
        sta MG_DIFF
        ldx #<(bd_a - n)        ; zero page state (BSS too: the overlay stays loaded between plays)
        lda #0
:       sta n,x
        dex
        bpl :-
        lda #NO_LED
        sta lit
        lda #64
        sta lastkey
        ; n = 4 / 5 from d 0.34 / 6 from d 0.67; 3 strikes, 2 from d 0.5
        lda MG_DIFF
        ldx #4
        cmp #87
        bcc :+
        inx
        cmp #171
        bcc :+
        inx
:       stx n
        ldx #3
        cmp #128
        bcc :+
        dex
:       stx strikes_max
        bydiff_w 5, 9
        sta maxlen
        sec
        sbc #2
        sta rounds
        bydiff_w 28, 15         ; 0.55 s .. 0.3 s
        sta flash
        sta t1                  ; gap = 0.45 × flash
        lda #115
        jsr mul8
        sta gap
        lda #3
        sta len
        lda n                   ; cursor on the middle LED, LEDs centred
        lsr
        sta cursor
        lda n
        asl
        asl
        adc n                   ; 5n - 2 columns
        sec
        sbc #2
        lsr
        eor #$ff
        sec
        adc #20
        sta x0
        ; the sequence
        ldx #0
:       stx t0
        lda n
        jsr API_RMOD
        ldx t0
        sta seq,x
        inx
        cpx #MAX_LEN
        bne :-
        lda n                   ; "Keys 1-n" in the footer
        ora #'0'
        sta s_keys + 7
        jsr draw_scene
        jsr start_show
        lda #<TOTAL_T
        ldx #>TOTAL_T
        jmp timer_start

; ---- scenery

draw_scene:
        text 1, 0, s_name, 7
        jsr draw_round
        ; cabinet: dark grey frame, mid grey rails
        lda #8
        sta COLOR
        lda #RACK_W
        sta FILL_W
        lda #RACK_H
        sta FILL_H
        ldx #RACK_X
        ldy #RACK_Y
        lda #MC_A
        jsr API_FILL
        lda #RACK_W - 2
        sta FILL_W
        lda #RACK_H - 2
        sta FILL_H
        ldx #RACK_X + 1
        ldy #RACK_Y + 1
        lda #MC_B
        jsr API_FILL
        lda #RACK_W - 4
        sta FILL_W
        ldx #RACK_X + 2
        ldy #RACK_Y + 1
        lda #' '
        jsr API_FILL
        ; rack units with their status pips
        ldx #UNITS - 1
:       stx t0
        lda unit_y,x
        tay
        lda #8
        sta COLOR
        lda #RACK_W - 6
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #RACK_X + 3
        lda #MC_B
        jsr API_FILL
        ldx t0
        lda unit_y,x
        tay
        lda #3
        sta FILL_W
        ldx #RACK_X + RACK_W - 9
        lda #' '
        jsr API_FILL
        ldx t0
        lda unit_y,x
        tay
        lda #5
        sta COLOR
        lda #6
        sta FILL_W
        ldx #RACK_X + 4
        lda #CH_PIP
        jsr API_FILL
        ldx t0
        dex
        bpl :-
        ; the LED panel
        lda #6
        sta COLOR
        lda #RACK_W - 2
        sta FILL_W
        lda #NUM_Y - PANEL_Y + 3
        sta FILL_H
        ldx #RACK_X + 1
        ldy #PANEL_Y
        jsr API_BOX
        lda #0
        sta t0
:       lda t0
        jsr draw_led
        jsr draw_num
        inc t0
        lda t0
        cmp n
        bne :-
        jsr draw_arrow
        jsr draw_strikes
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; "Round r/rounds" right-aligned on row 0 (r = completed + 1, at most rounds).
draw_round:
        text 31, 0, s_round, 1
        lda completed
        cmp rounds
        bcs :+
        adc #1
:       ldx #37
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        lda rounds
        ldx #39
        ldy #0
        jmp API_NUM

; X = LED: A = its column.
led_x:  stx t1
        txa
        asl
        asl
        adc t1
        adc x0
        rts

; A = LED: drawn on (lit) or off (dim checker), with or without its white frame.
draw_led:
        tax
        lda led_col,x
        sta COLOR
        jsr led_x
        tax
        dex
        stx t1                  ; frame column
        lda #3
        sta FILL_W
        sta FILL_H
        lda #CH_CHECKER
        ldy t0                  ; (draw_led keeps t0)
        cpy lit
        bne :+
        lda #CH_BLOCK
:       inx
        ldy #LED_Y
        jsr API_FILL
        lda #0                  ; the frame: white when lit, black (invisible) otherwise
        ldy t0
        cpy lit
        bne :+
        lda #1
:       sta COLOR
        lda #5
        sta FILL_W
        sta FILL_H
        ldx t1
        ldy #LED_Y - 1
        jmp API_BOX

; LED t0's key number, yellow under the cursor.
draw_num:
        lda #NUM_COL
        ldx t0
        cpx cursor
        bne :+
        lda #7
:       sta COLOR
        jsr led_x
        tax
        inx
        lda t0
        clc
        adc #'1'
        ldy #NUM_Y
        jmp API_PUTC

; The cursor arrow under its LED (the row cleared first).
draw_arrow:
        lda #ARROW_Y
        jsr clear_rack_row
        lda #7
        sta COLOR
        ldx cursor
        jsr led_x
        tax
        inx
        lda #CH_UP
        ldy #ARROW_Y
        jmp API_PUTC

; Row A of the cabinet after clear_rows: the dark frame and the grey rails again.
draw_rack_row:
        sta t1
        lda #8
        sta COLOR
        ldx #RACK_X
        ldy t1
        lda #MC_A
        jsr API_PUTC
        ldx #RACK_X + RACK_W - 1
        ldy t1
        lda #MC_A
        jsr API_PUTC
        ldx #RACK_X + 1
        ldy t1
        lda #MC_B
        jsr API_PUTC
        ldx #RACK_X + RACK_W - 2
        ldy t1
        lda #MC_B
        jsr API_PUTC
        lda #6                  ; the panel's sides over the rails (rows inside the box)
        sta COLOR
        lda t1
        cmp #PANEL_Y + 1
        bcc @out
        cmp #NUM_Y + 2
        bcs @out
        tay
        ldx #RACK_X + 1
        lda #CH_L
        jsr API_PUTC
        ldx #RACK_X + RACK_W - 2
        ldy t1
        lda #CH_R
        jmp API_PUTC
@out:   rts

; A = row: cleared, the cabinet edges redrawn.
clear_rack_row:
        pha
        ldx #1
        jsr clear_rows
        pla
        jmp draw_rack_row

; A/X = text, Y = colour: centred on the status row inside the panel.
status:
        jsr set_text
        lda #STATUS_Y
        ; fall through
; A = row: cleared, then m_lo/m_hi centred on it in m_col.
row_text:
        sta m_row
        jsr clear_rack_row
        lda m_col
        sta COLOR
        lda m_lo
        ldx m_hi
        ldy m_row
        jmp API_CENTER

set_text:
        sta m_lo
        stx m_hi
        sty m_col
        rts

; A/X = text, Y = colour: a floater on the message row for a second.
message:
        jsr set_text
        lda #MSG_T
        sta msg_t
        lda #MSG_Y
        jmp row_text

; Progress pips (input phase): one per light, green once repeated. Cleared outside the input phase.
draw_pips:
        lda #PIPS_Y
        jsr clear_rack_row
        lda phase
        cmp #PH_INPUT
        bne @out
        lda len
        lsr
        eor #$ff
        sec
        adc #20
        sta t1
        ldx #0
@p:     stx t0
        lda #5
        ldy #CH_PIP
        cpx k
        bcc :+
        lda #1
        ldy #CH_PIPOFF
:       sta COLOR
        tya
        pha
        txa
        clc
        adc t1
        tax
        ldy #PIPS_Y
        pla
        jsr API_PUTC
        ldx t0
        inx
        cpx len
        bne @p
@out:   rts

; "Strikes: XXX", red for the strikes taken.
draw_strikes:
        text STRIKES_X, STRIKES_Y, s_strikes, 1
        ldx #0
:       stx t0
        lda #2
        cpx strikes
        bcc :+
        lda #6
:       sta COLOR
        txa
        clc
        adc #STRIKES_X + 9
        tax
        lda #'X'
        ldy #STRIKES_Y
        jsr API_PUTC
        ldx t0
        inx
        cpx strikes_max
        bne :--
        rts

; A = LED to show lit (NO_LED = none): the old one dimmed, the new one lit.
set_lit:
        cmp lit
        beq @out
        pha
        lda lit
        ldx #NO_LED
        stx lit
        cmp #NO_LED
        beq :+
        sta t0
        jsr draw_led
:       pla
        sta lit
        cmp #NO_LED
        beq @out
        sta t0
        jsr draw_led
@out:   rts

; ---- phases

start_show:
        lda #PH_SHOW
        sta phase
        lda #0
        sta k
        sta sh_on
        sta press_t
        lda #PAUSE_T
        sta cnt
        lda #NO_LED
        jsr set_lit
        jsr draw_pips
        lda #<s_watch
        ldx #>s_watch
        ldy #1
        jmp status

start_input:
        lda #PH_INPUT
        sta phase
        lda #0
        sta k
        lda #<IDLE_T
        sta idle
        lda #>IDLE_T
        sta idle+1
.if .defined(AUTOPLAY)
        lda #BOT_T
        sta bot_t
.endif
        jsr draw_pips
        lda #<s_turn
        ldx #>s_turn
        ldy #7
        jmp status

; A = frames, X/Y = status text: a breather, then the show again.
start_pause:
        sta cnt
        lda #PH_PAUSE
        sta phase
        txa
        stx t0
        tya
        tax
        lda t0
        ldy #1
        jsr set_text
        jsr draw_pips
        lda #STATUS_Y
        jmp row_text

; A = LED pressed (input phase).
press:
        sta t0
        lda #PRESS_T
        sta press_t
        lda t0
        jsr set_lit
        lda #<IDLE_T
        sta idle
        lda #>IDLE_T
        sta idle+1
        ldx k
        lda seq,x
        cmp t0
        bne @wrong
        lda #SFX_BLIP
        jsr API_SFX
        inc k
        jsr draw_pips
        lda k
        cmp len
        bcs :+
        rts
:       inc completed
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_ok
        ldx #>s_ok
        ldy #5
        jsr message
        inc len
        lda maxlen
        cmp len
        bcs :+
        lda #255                ; every round done
        jmp finish_a
:       jsr draw_round
        lda #NICE_T
        ldx #<s_nice
        ldy #>s_nice
        jmp start_pause
@wrong: lda #<s_wrong
        ldx #>s_wrong
        ; fall through

; A/X = message: a strike.
fail:
        ldy #2
        jsr message
        inc strikes
        jsr draw_strikes
        lda #SFX_BAD
        jsr API_SFX
        lda strikes
        cmp strikes_max
        bcc :+
        jmp finish
:       lda #AGAIN_T
        ldx #<s_again
        ldy #>s_again
        jmp start_pause

; ---- one frame

frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr blink
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        jsr clear_rack_row
:       jsr timer_tick
        bcc :+
        jmp finish
:       jsr joystick
        lda phase
        cmp #PH_SHOW
        beq @show
        ; a pressed LED goes dark after PRESS_T
        lda press_t
        beq :+
        dec press_t
        bne :+
        lda #NO_LED
        jsr set_lit
:       lda phase
        cmp #PH_INPUT
        beq @input
        dec cnt                 ; pause
        bne @out
        jsr start_show
@out:   clc
        rts
@show:  dec cnt
        bne @out
        lda sh_on
        bne @off
        ldx k                   ; next light, or the player's turn
        cpx len
        bcc :+
        jsr start_input
        clc
        rts
:       lda seq,x
        jsr set_lit
        lda #SFX_BLIP
        jsr API_SFX
        lda #1
        sta sh_on
        lda flash
        sta cnt
        clc
        rts
@off:   lda #NO_LED
        jsr set_lit
        lda #0
        sta sh_on
        inc k
        lda gap
        sta cnt
        clc
        rts
@input: lda idle                ; 6 s idle: a strike
        bne :+
        dec idle+1
:       dec idle
        lda idle
        ora idle+1
        bne :+
        lda #<s_slow
        ldx #>s_slow
        jsr fail
        clc
        rts
:
.if .defined(AUTOPLAY)
        dec bot_t               ; perfect player: the next light every BOT_T frames
        bne :+
        lda #BOT_T
        sta bot_t
        ldx k
        lda seq,x
        jsr move_cursor
        lda cursor
        jsr press
        clc
        rts
:
.endif
        ; keys 1-n (edge-detected)
        lda $cb
        cmp lastkey
        beq @fire
        sta lastkey
        ldx #5
:       cmp key_codes6,x
        beq :+
        dex
        bpl :-
        bmi @fire
:       cpx n
        bcs @fire
        txa
        jsr move_cursor
        lda cursor
        jsr press
        clc
        rts
@fire:  lda JOYP
        and #J_FIRE
        beq :+
        lda cursor
        jsr press
:       clc
        rts

; Left/right move the cursor (any phase).
joystick:
        lda JOYP
        and #J_LEFT
        beq :+
        lda cursor
        beq :+
        sec
        sbc #1
        jmp move_cursor
:       lda JOYP
        and #J_RIGHT
        beq @no
        ldx cursor
        inx
        cpx n
        bcs @no
        txa
        jmp move_cursor
@no:    rts

; A = LED: the cursor moves there.
move_cursor:
        cmp cursor
        beq @out
        pha
        lda cursor
        sta t0
        pla
        sta cursor
        jsr draw_num            ; the old number back to blue
        lda cursor
        sta t0
        jsr draw_num
        jmp draw_arrow
@out:   rts

; The rack units' pips flicker: every 4 frames one of them turns on or off at random.
blink:
        lda anim
        and #3
        bne @out
        lda #UNITS
        jsr API_RMOD
        tax
        lda unit_y,x
        sta t1
        lda #6
        jsr API_RMOD
        clc
        adc #RACK_X + 4
        sta t0
        jsr API_RAND
        and #1                  ; green or black
        beq :+
        lda #5
:       sta COLOR
        ldx t0
        ldy t1
        lda #CH_PIP
        jmp API_PUTC
@out:   rts

; score = completed / rounds
finish:
        lda completed           ; completed × 255 / rounds
        beq finish_a
        sta bd_m+1
        lda #0
        sec
        sbc completed
        sta bd_m
        dec bd_m+1
        lda #0
        sta t0
        ldx #16
@d:     asl bd_m
        rol bd_m+1
        rol t0
        lda t0
        cmp rounds
        bcc :+
        sbc rounds
        sta t0
        inc bd_m
:       dex
        bne @d
        lda bd_m
finish_a:
        sta MG_SCORE
        lda #1
        sta done
        lda #NO_LED
        jsr set_lit
        sec
        rts

; A × t1 / 256 -> A.
mul8:
        sta t0
        lda #0
        ldy #8
@l:     lsr t0
        bcc :+
        clc
        adc t1
:       ror
        dey
        bne @l
        rts

; A/X = round(bd_a + (bd_b - bd_a) × MG_DIFF / 255), 16 bit.
bydiff:
        lda bd_b
        sec
        sbc bd_a
        sta bd_m
        lda bd_b+1
        sbc bd_a+1
        sta bd_m+1
        php                     ; N: b < a
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda MG_DIFF             ; p = |b - a| × diff (24 bit)
        sta bd_t
        lda #0
        sta bd_p+1
        sta bd_p+2
        ldy #8
@l:     lsr bd_t
        bcc :+
        lda bd_p+1
        clc
        adc bd_m
        sta bd_p+1
        lda bd_p+2
        adc bd_m+1
        sta bd_p+2
:       ror bd_p+2
        ror bd_p+1
        ror bd_p
        dey
        bne @l
        ; p / 255 ~ (p + p / 256 + 128) / 256 = p2:(p1 + p2) + carry of (p0 + p1 + 128)
        lda #0
        sta bd_h
        lda bd_p
        clc
        adc #$80
        bcc :+
        inc bd_h
        clc
:       adc bd_p+1
        bcc :+
        inc bd_h
:       lda bd_p+1
        clc
        adc bd_p+2
        sta bd_m
        lda bd_p+2
        adc #0
        sta bd_m+1
        lda bd_m
        clc
        adc bd_h
        sta bd_m
        bcc :+
        inc bd_m+1
:       plp
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda bd_m
        clc
        adc bd_a
        pha
        lda bd_m+1
        adc bd_a+1
        tax
        pla
        rts

.rodata
s_name:    .byte "Server Rack Sequence", 0
s_help:    .byte "Watch the lights, then repeat them.", 0
s_keys:    .byte "Keys 1-6, or left/right + FIRE", 0
s_round:   .byte "Round", 0
s_strikes: .byte "Strikes:", 0
s_watch:   .byte "WATCH...", 0
s_turn:    .byte "YOUR TURN", 0
s_nice:    .byte "NICE!", 0
s_again:   .byte "AGAIN...", 0
s_ok:      .byte "Rack OK!", 0
s_wrong:   .byte "Wrong light!", 0
s_slow:    .byte "Timed out!", 0
led_col:   .byte 2, 5, 6, 7, 4, 3   ; red, green, blue, yellow, purple, cyan (the JS orange: no hires orange)
key_codes6: .byte 56, 59, 8, 11, 16, 19 ; KERNAL matrix codes of 1-6
unit_y:    .byte 3, 5, 7, 21
UNITS = * - unit_y

.bss
seq:       .res MAX_LEN
