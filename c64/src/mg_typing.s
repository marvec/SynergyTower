; Rapid Reply (src/minigames/typing.js) as a disk-loaded overlay at $4000.
; Type corporate phrases into the team chat against one clock for the whole round. A wrong key is a typo (it
; costs accuracy, the cursor stays). Without a keyboard: pick the next letter from 4 tiles with the joystick
; (the first pick grants extra time once: + 80 % of the total, as the JS does for the mouse).
; Score = typed / all characters × accuracy^1.5, accuracy = typed / (typed + typos).
; Difficulty (d = MG_DIFF / 255), d=0 -> d=1: phrases 3 -> 5 (round(3 + 2 d)), short ones (<= 22 chars) only
; below d 0.5; speed needed 1.6 -> 3.2 chars per s: time = characters / speed + 4 s (at most 90 s).
; Keys: the KERNAL's matrix code in $cb, edge-detected (a new key held = one keypress); SHIFT+7 types the
; apostrophe. WASD, SPACE, RETURN and the cursor keys are also the host's joystick: a frame with a typing key
; held ignores the stick, so only RETURN, the cursor keys and a real joystick work the tiles.
; Content: the department's phrases + the general ones (src/minigames/typing.js PHRASES), gen/mg_typing_data.s.
; Differences from the JS: no screen shake (the input box flashes red); a key typed while another is still held
; counts once the held key changes (the KERNAL reports one key at a time).

.include "api.inc"

MAX_N     = 5                   ; phrases per round
SHORT_D   = 128                 ; short phrases only below d 0.5
EXTRA_T   = 4 * 50              ; + 4 s
MAX_T     = 90 * 50
TILES     = 4
FLASH_T   = 8                   ; 0.15 s red input box
MSG_T     = 40
KEY_NONE  = 64                  ; $cb with no key held
KEY_7     = 24                  ; SHIFT+7 = apostrophe

WIN_Y     = 2                   ; the chat window: rows 2-14
WIN_H     = 13
SENT_Y    = 4                   ; the last 3 sent phrases: rows 4-6, right-aligned
INPUT_Y   = 8                   ; the input box: rows 8-13, columns 1-38
INPUT_H   = 6
PHRASE_Y  = 11
MARK_Y    = 12                  ; the cursor mark under the current char
TILE_LBL  = 16
TILE_Y    = 17                  ; tiles: rows 17-19, 7 wide
TILE_W    = 7
MSG_Y     = 21

C_WIN     = 6
C_SENT    = 3
C_INPUT   = 1
C_DONE    = 5                   ; typed chars
C_CUR     = 7                   ; the current char and its mark
C_TODO    = 1
C_DIM     = 3

.zeropage
n:        .res 1                ; phrases this round
pi:       .res 1                ; current phrase
ci:       .res 1                ; current char in it
plen:     .res 1
pp:       .res 2                ; the current phrase
chars:    .res 1                ; characters in the round
typed:    .res 1
errors:   .res 1
total:    .res 2                ; frames of the whole round (grows in joystick mode)
left:     .res 2
mouse:    .res 1                ; 1: joystick mode (extra time granted)
flash_t:  .res 1
msg_t:    .res 1
done:     .res 1
prevcb:   .res 1
tsel:     .res 1                ; selected tile
sent:     .res 1                ; phrases sent (for the bubbles)
ch:       .res 1                ; the key typed this frame, 0 = none
pcol:     .res 1                ; first column of the phrase
bar:      .res 1                ; timer cells shown
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
sp:       .res 2
bufi:     .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
bot_cb:   .res 1
bot_sh:   .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- set-up

; A = difficulty
init:
        sta t0
        ldx #3                  ; round(3 + 2 d): 4 from d 0.25, 5 from d 0.75
        cmp #64
        bcc :+
        inx
        cmp #192
        bcc :+
        inx
:       stx n
        ; the pool: only the short phrases below d 0.5 (if there are enough)
        ldy #0                  ; use_short in t1
        cmp #SHORT_D
        bcs :+
        lda #P_SHORT
        cmp n
        bcc :+
        iny
:       sty t1
        ldx #0                  ; candidates
        ldy #0
@f:     lda t1
        beq :+
        lda ph_short,y
        beq @skip
:       tya
        sta cand,x
        inx
@skip:  iny
        cpy #P_COUNT
        bne @f
        stx t2                  ; candidates
        ; n distinct ones: partial Fisher-Yates
        ldx #0
@pick:  stx t3
        lda t2
        sec
        sbc t3
        jsr API_RMOD
        clc
        adc t3
        tay
        ldx t3
        lda cand,y
        pha
        lda cand,x
        sta cand,y
        pla
        sta cand,x
        inx
        cpx n
        bne @pick
        ; characters in the round
        lda #0
        sta chars
        ldx #0
:       ldy cand,x
        lda ph_len,y
        clc
        adc chars
        sta chars
        inx
        cpx n
        bne :-
        ; time = chars × frames per char + 4 s, at most 90 s
        lda t0
        lsr
        lsr
        lsr
        tax
        lda fpc_lo,x
        sta t1
        lda fpc_hi,x
        sta t2
        lda #0                  ; t3:left = chars × fpc / 256 (8 × 16 -> 24 bits, the top 16 kept)
        sta t3
        sta left
        sta left+1
        ldx #8
        lda chars
        sta t0
@mul:   lsr t0
        bcc :+
        lda left
        clc
        adc t1
        sta left
        lda left+1
        adc t2
        sta left+1
:       ror left+1
        ror left
        ror t3
        dex
        bne @mul
        lda left
        clc
        adc #<EXTRA_T
        sta left
        lda left+1
        adc #>EXTRA_T
        sta left+1
        cmp #>MAX_T
        bcc @t
        bne :+
        lda left
        cmp #<MAX_T
        bcc @t
:       lda #<MAX_T
        sta left
        lda #>MAX_T
        sta left+1
@t:     lda left
        sta total
        lda left+1
        sta total+1
        lda #0
        sta pi
        sta ci
        sta typed
        sta errors
        sta mouse
        sta flash_t
        sta msg_t
        sta done
        sta tsel
        sta sent
        lda #KEY_NONE
        sta prevcb
.if .defined(AUTOPLAY)
        lda #0
        sta bot_t
.endif
        ; screen
        text 1, 0, s_name, 7
        lda #C_WIN
        sta COLOR
        lda #40
        sta FILL_W
        lda #WIN_H
        sta FILL_H
        ldx #0
        ldy #WIN_Y
        jsr API_BOX
        text 2, WIN_Y, s_chat, C_SENT
        lda #C_INPUT
        jsr draw_input
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #38
        sta bar
        jsr draw_bar
        jsr draw_label
        jsr phrase_start
        jmp draw_header

; Phrase pi: its pointer and length, drawn, fresh tiles.
phrase_start:
        ldx pi
        ldy cand,x
        lda ph_lo,y
        sta pp
        lda ph_hi,y
        sta pp+1
        lda ph_len,y
        sta plen
        eor #$ff                ; centred
        sec
        adc #40
        lsr
        sta pcol
        lda #PHRASE_Y
        ldx #2
        jsr clear_in_box
        jsr draw_phrase
        jmp make_tiles

; ---------------------------------------------------------------- drawing

; A = row, X = rows: the input box's inside cleared.
clear_in_box:
        stx FILL_H
        tay
        lda #36
        sta FILL_W
        lda #' '
        ldx #2
        jmp API_FILL

; A = colour: the input box and its label.
draw_input:
        sta COLOR
        lda #38
        sta FILL_W
        lda #INPUT_H
        sta FILL_H
        ldx #1
        ldy #INPUT_Y
        jsr API_BOX
        text 3, INPUT_Y + 1, s_type, C_DIM
        rts

; The phrase: typed chars green, the current one yellow with a mark under it, the rest white.
draw_phrase:
        ldy #0
@c:     cpy plen
        beq @mark
        lda #C_DONE
        cpy ci
        bcc :+
        lda #C_TODO
        bne :+
:       cpy ci
        bne :+
        lda #C_CUR
:       sta COLOR
        sty t3
        tya
        clc
        adc pcol
        tax
        lda (pp),y
        ldy #PHRASE_Y
        jsr API_PUTC
        ldy t3
        iny
        bne @c
@mark:  lda #36                 ; the mark row: one ^ under the current char
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #2
        ldy #MARK_Y
        jsr API_FILL
        lda ci
        cmp plen
        bcs :+
        clc
        adc pcol
        tax
        lda #C_CUR
        sta COLOR
        lda #CH_UP
        ldy #MARK_Y
        jsr API_PUTC
:       rts

; "N/M  acc NN%" right-aligned on the title row.
draw_header:
        jsr buf_reset
        lda #' '
        jsr buf_c
        lda pi
        clc
        adc #1
        cmp n
        bcc :+
        lda n
:       jsr buf_n
        lda #'/'
        jsr buf_c
        lda n
        jsr buf_n
        lda #<s_acc
        ldx #>s_acc
        jsr buf_s
        jsr accuracy
        jsr buf_n3
        lda #'%'
        jsr buf_c
        jsr buf_end
        lda #1
        sta COLOR
        lda #40
        sec
        sbc bufi
        tax
        inx                     ; (bufi counts the 0)
        ldy #0
        jmp API_PRINT

; A = accuracy in % (100 before the first key): round(typed × 100 / (typed + errors))
accuracy:
        lda typed
        clc
        adc errors
        bcc :+
        lda #255                ; (saturate)
:       sta t2
        bne :+
        lda #100
        rts
:       lda typed               ; t1:t0 = typed × 100 + (typed + errors) / 2
        sta t0
        lda #0
        sta t1
        jsr mul100
        lda t2                  ; + half the divisor (rounding)
        lsr
        clc
        adc t0
        sta t0
        bcc :+
        inc t1
:       ldx #0                  ; / (typed + errors)
@d:     lda t0
        sec
        sbc t2
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        sty t0
        inx
        bne @d
@q:     txa
        rts

; t1:t0 (t0 < 256, t1 = 0) × 100
mul100: lda t0
        sta t3                  ; × 1
        lda #0
        sta sp
        asl t0
        rol t1
        asl t0
        rol t1                  ; × 4
        lda t0
        clc
        adc t3
        sta t0
        bcc :+
        inc t1
:       lda t0                  ; × 5 -> keep, × 20 = × 5 × 4
        sta t3
        lda t1
        sta sp
        asl t0
        rol t1
        asl t0
        rol t1                  ; × 20
        lda t0
        clc
        adc t3
        sta t0
        lda t1
        adc sp
        sta t1                  ; × 25
        asl t0
        rol t1
        asl t0
        rol t1                  ; × 100
        rts

; The last 3 sent phrases, the newest at the bottom, right-aligned.
draw_sent:
        lda #SENT_Y
        ldx #3
        jsr clear_in_win
        lda sent
        cmp #3
        bcc :+
        lda #3
:       sta t2                  ; bubbles shown
        lda #0
        sta t1
@b:     lda t1
        cmp t2
        bcs @out
        lda sent                ; phrase index: sent - shown + t1
        sec
        sbc t2
        clc
        adc t1
        tax
        ldy cand,x
        lda ph_lo,y
        sta PTR
        lda ph_hi,y
        sta PTR+1
        lda #38
        sec
        sbc ph_len,y
        tax
        lda #3                  ; row: SENT_Y + 3 - shown + t1
        sec
        sbc t2
        clc
        adc t1
        adc #SENT_Y
        tay
        lda #C_SENT
        sta COLOR
        jsr API_PRINT
        inc t1
        bne @b
@out:   rts

; A = row, X = rows: the chat window's inside cleared.
clear_in_win:
        stx FILL_H
        tay
        lda #38
        sta FILL_W
        lda #' '
        ldx #1
        jmp API_FILL

; The label over the tiles.
draw_label:
        lda #TILE_LBL
        ldx #1
        jsr clear_rows
        lda mouse
        bne :+
        center TILE_LBL, s_orpick, C_DIM
        rts
:       center TILE_LBL, s_mouse, C_DIM
        rts

; The 4 tiles, the selected one yellow.
draw_tiles:
        ldx #0
@t:     stx t1
        lda #1
        cpx tsel
        bne :+
        lda #7
:       sta COLOR
        lda #TILE_W
        sta FILL_W
        lda #3
        sta FILL_H
        lda tile_x,x
        tax
        ldy #TILE_Y
        jsr API_BOX
        ldx t1
        lda tile_x,x
        clc
        adc #1
        tax
        lda #5
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldy #TILE_Y + 1
        jsr API_FILL
        ldx t1
        lda tiles,x
        cmp #' '
        bne @ch
        lda #<s_spc             ; space: "spc"
        sta PTR
        lda #>s_spc
        sta PTR+1
        lda tile_x,x
        clc
        adc #2
        tax
        lda #1
        sta COLOR
        ldy #TILE_Y + 1
        jsr API_PRINT
        jmp @n
@ch:    pha
        lda tile_x,x
        clc
        adc #3
        tax
        lda #1
        sta COLOR
        pla
        ldy #TILE_Y + 1
        jsr API_PUTC
@n:     ldx t1
        inx
        cpx #TILES
        bne @t
        rts

; Timer: cells = left × 38 / total, redrawn when it changes (green, yellow under a third, red under a sixth).
update_bar:
        lda left                ; t2:t1:t0 = left × 38 = left × 32 + left × 4 + left × 2
        sta t0
        lda left+1
        sta t1
        lda #0
        sta t2
        asl t0
        rol t1
        rol t2                  ; × 2
        lda t0
        sta sp
        lda t1
        sta sp+1
        lda t2
        sta t3                  ; keep × 2
        asl t0
        rol t1
        rol t2                  ; × 4
        lda t0
        clc
        adc sp
        sta sp
        lda t1
        adc sp+1
        sta sp+1
        lda t2
        adc t3
        sta t3                  ; × 6 in t3:sp
        ldx #3
:       asl t0
        rol t1
        rol t2
        dex
        bne :-                  ; × 32
        lda t0
        clc
        adc sp
        sta t0
        lda t1
        adc sp+1
        sta t1
        lda t2
        adc t3
        sta t2                  ; × 38
        ldx #0                  ; / total
@d:     lda t0
        sec
        sbc total
        tay
        lda t1
        sbc total+1
        sta t3
        lda t2
        sbc #0
        bcc @q
        sta t2
        lda t3
        sta t1
        sty t0
        inx
        cpx #38
        bne @d
@q:     cpx bar
        bne :+
        rts
:       stx bar
        ; fall through
draw_bar:
        lda #5
        ldx bar
        cpx #13
        bcs :+
        lda #7
        cpx #7
        bcs :+
        lda #2
:       sta COLOR
        lda bar
        jmp API_BAR

; A/X = message, Y = colour: centred on the message row for a moment.
message:
        sty t0
        pha
        txa
        pha
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #MSG_Y
        jsr API_CENTER
        lda #MSG_T
        sta msg_t
        rts

; ---------------------------------------------------------------- the tiles

; The next char + 3 other distinct ones from a-z and space, shuffled.
make_tiles:
        ldy ci
        lda (pp),y
        sta tiles
        ldx #1
@add:   stx t1
        lda #27
        jsr API_RMOD
        tay
        lda alpha,y
        ldx t1
        ldy #0                  ; already there?
:       cmp tiles,y
        beq @add2
        iny
        cpy t1
        bne :-
        sta tiles,x
        inx
        cpx #TILES
        bne @add
        ldx #TILES - 1          ; shuffle
@sh:    stx t1
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t1
        lda tiles,x
        pha
        lda tiles,y
        sta tiles,x
        pla
        sta tiles,y
        dex
        bne @sh
        jmp draw_tiles
@add2:  ldx t1
        jmp @add

; ---------------------------------------------------------------- per frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jsr clear_rows
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #C_INPUT
        jsr draw_input
:       lda left                ; the clock
        bne :+
        dec left+1
:       dec left
        lda left
        ora left+1
        bne :+
        jmp finish
:       lda FRAME
        and #3
        bne :+
        jsr update_bar
:       ; the keyboard: a new key held, mapped to a char (0 = not a typing key)
        lda #0
        sta ch
.if .defined(AUTOPLAY)
        jsr bot
        ldx bot_cb
.else
        ldx $cb
.endif
        cpx prevcb
        beq @held
        stx prevcb
        cpx #KEY_NONE
        beq @stick
        lda key_ascii,x
        cpx #KEY_7
        bne :+
.if .defined(AUTOPLAY)
        lda bot_sh
.else
        lda $028d               ; SHIFT+7: the apostrophe
.endif
        lsr
        lda #'7'
        bcc :+
        lda #39
:       sta ch
        jmp @got
@held:  cpx #KEY_NONE           ; a typing key held: the stick is that key, ignore it
        beq @stick
        lda key_ascii,x
        bne @out0
@stick: lda JOYP
        and #J_LEFT
        beq :+
        dec tsel
        bpl @moved
        lda #TILES - 1
        sta tsel
        bne @moved
:       lda JOYP
        and #J_RIGHT
        beq :+
        inc tsel
        lda tsel
        cmp #TILES
        bcc @moved
        lda #0
        sta tsel
        beq @moved
:       lda JOYP
        and #J_FIRE
        beq @bot
        lda mouse               ; the first tile pick: extra time, once
        bne :+
        jsr grant_time
:       ldx tsel
        lda tiles,x
        jmp enter
@moved: lda #SFX_BLIP
        jsr API_SFX
        jsr draw_tiles
@out0:  clc
        rts
@got:   lda ch
        beq @stick              ; RETURN, the cursor keys: the stick
        jmp enter
@bot:   clc
        rts

.if .defined(AUTOPLAY)
; Perfect typist (test builds): through the keyboard path, the next char's key held for 2 frames, then 2 frames
; with no key (bot_cb / bot_sh stand in for $cb / $028d).
bot:    inc bot_t
        lda #KEY_NONE
        sta bot_cb
        lda #0
        sta bot_sh
        lda bot_t
        and #2
        beq @out
        ldy ci
        lda (pp),y
        cmp #39
        bne :+
        ldx #KEY_7              ; the apostrophe: SHIFT+7
        inc bot_sh
        bne @set
:       ldx #63
:       cmp key_ascii,x
        beq @set
        dex
        bpl :-
        rts
@set:   stx bot_cb
@out:   rts
.endif

; Joystick mode: left += total × 0.8, total × 1.8.
grant_time:
        lda #1
        sta mouse
        lda total               ; t1:t0 = total × 0.8 = total × 205 / 256
        sta t2
        lda total+1
        sta t3
        lda #0
        sta t0
        sta t1
        sta sp
        ldx #8
        lda #205
        sta sp+1
@m:     lsr sp+1
        bcc :+
        lda t0
        clc
        adc t2
        sta t0
        lda t1
        adc t3
        sta t1
:       ror t1
        ror t0
        ror sp
        dex
        bne @m
        lda left
        clc
        adc t0
        sta left
        lda left+1
        adc t1
        sta left+1
        lda total
        clc
        adc t0
        sta total
        lda total+1
        adc t1
        sta total+1
        jsr draw_label
        lda #0
        sta bar                 ; (forces a redraw)
        jmp update_bar

; A = the char entered: right -> next char, wrong -> a typo.
enter:
        ldy ci
        ora #$20                ; (lower case; space, comma and the apostrophe stay)
        sta t0
        lda (pp),y
        ora #$20
        cmp t0
        beq @right
        inc errors
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        jsr draw_input
        lda #FLASH_T
        sta flash_t
        jsr draw_header
        clc
        rts
@right: inc typed
        inc ci
        lda ci
        cmp plen
        bcs @sent
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_phrase
        jsr make_tiles
        jsr draw_header
        clc
        rts
@sent:  inc sent
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_sent
        ldx #>s_sent
        ldy #5
        jsr message
        jsr draw_sent
        inc pi
        lda #0
        sta ci
        lda pi
        cmp n
        bcc :+
        jsr draw_header
        lda #PHRASE_Y
        ldx #2
        jsr clear_in_box
        jmp finish
:       jsr phrase_start
        jsr draw_header
        clc
        rts

; score = typed / chars × acc^1.5 = progress × pow15[accuracy], both 0-255
finish:
        lda #0
        sta t1
        lda typed               ; progress = typed × 255 / chars
        beq @zero
        sta t0
        lda #0
        sec
        sbc t0
        pha
        lda t0
        sbc #0
        sta t1
        pla
        jsr div_chars
        sta t3                  ; progress
        lda typed               ; accuracy = typed × 255 / (typed + errors)
        clc
        adc errors
        bcc :+
        lda #255
:       sta t2
        lda typed
        sta t0
        lda #0
        sec
        sbc t0
        pha
        lda t0
        sbc #0
        sta t1
        pla
        ldx #0
@d:     sec
        sbc t2
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        tya
        inx
        bne @d
        dex
@q:     lda pow15,x
        tax                     ; × progress / 255 (255 × 255 -> 255)
        lda t3
        jsr mul8
        sta MG_SCORE
        jmp @end
@zero:  lda #0
        sta MG_SCORE
@end:   lda #1
        sta done
        sec
        rts

; t1:A / chars -> A (capped at 255)
div_chars:
        ldx #0
@d:     sec
        sbc chars
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        tya
        inx
        bne @d
        dex
@q:     txa
        rts

; A × X / 255 -> A (rounded: (A × X + 255) / 256 is exact enough at the ends: 255 × 255 -> 255, 0 -> 0)
mul8:   sta t0
        stx t1
        lda #0
        sta t2
        ldx #8
@l:     lsr t1
        bcc :+
        clc
        adc t0
:       ror
        ror t2
        dex
        bne @l
        ldx t2                  ; + 1 if the low byte is not 0 (round up)
        beq :+
        clc
        adc #1
:       rts

; ---- a small string builder
buf_reset:
        lda #0
        sta bufi
        rts
buf_c:  stx t3
        ldx bufi
        sta buf,x
        inc bufi
        ldx t3
        rts
; A/X = string: appended (without its 0)
buf_s:  sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        beq :+
        jsr buf_c
        iny
        bne :-
:       rts
; A = 0..99 in decimal
buf_n:  ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        beq :+
        ora #'0'
        jsr buf_c
:       pla
        ora #'0'
        jmp buf_c
; A = 0..255 in decimal
buf_n3: cmp #100
        bcc buf_n
        ldx #0
:       cmp #100
        bcc :+
        sbc #100
        inx
        bne :-
:       pha
        txa
        ora #'0'
        jsr buf_c
        pla
        ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        ora #'0'
        jsr buf_c
        pla
        ora #'0'
        jmp buf_c
buf_end:
        lda #0
        jsr buf_c
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        rts

.rodata
s_name:     .byte "Rapid Reply", 0
s_help:     .byte "Type each phrase exactly.", 0
s_keys:     .byte "Type the phrase. No keys? Joystick + FIRE", 0
s_chat:     .byte " Chat - #general ", 0
s_type:     .byte "Type:", 0
s_acc:      .byte "  acc ", 0
s_spc:      .byte "spc", 0
s_sent:     .byte "Sent!", 0
s_orpick:   .byte "or pick the next letter:", 0
s_mouse:    .byte "Joystick mode: extra time granted", 0
alpha:      .byte "abcdefghijklmnopqrstuvwxyz "
tile_x:     .byte 5, 13, 21, 29
; frames per char × 256 at speed 1.6 + 1.6 d chars per s, for A = 0, 8, 16, ... (index A / 8)
fpc_lo:     .repeat 32, I
            .byte <(256 * 50 * 255 * 10 / (16 * (255 + I * 8 + 4)))
            .endrepeat
fpc_hi:     .repeat 32, I
            .byte >(256 * 50 * 255 * 10 / (16 * (255 + I * 8 + 4)))
            .endrepeat
; KERNAL key matrix code ($cb) -> the char it types, 0 = not a typing key
key_ascii:  .byte 0, 0, 0, 0, 0, 0, 0, 0                         ; DEL RETURN CRSR F7 F1 F3 F5 CRSR
            .byte "3", "w", "a", "4", "z", "s", "e", 0           ; .. LSHIFT
            .byte "5", "r", "d", "6", "c", "f", "t", "x"
            .byte "7", "y", "g", "8", "b", "h", "u", "v"
            .byte "9", "i", "j", "0", "m", "k", "o", "n"
            .byte "+", "p", "l", "-", ".", ":", "@", ","
            .byte 0, "*", ";", 0, 0, "=", 0, "/"                 ; pound, HOME, RSHIFT, up arrow
            .byte "1", 0, 0, "2", " ", 0, "q", 0                 ; back arrow, CTRL, C=, RUN/STOP

.include "gen/mg_typing_data.s"

.bss
cand:       .res P_COUNT
tiles:      .res TILES
buf:        .res 48
