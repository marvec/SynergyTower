; Slide Deck Order (src/minigames/order.js) as a disk-loaded overlay at $4000.
; Pick the steps of a process in the right order to build the deck: every correct pick fills the next slide,
; a wrong one counts as a mistake. Slides are listed down the left, the shuffled steps are boxes on the right.
; Difficulty curve (d = MG_DIFF / 255):
;   d = 0: 2 decks of up to 4 steps, 22 s per deck (44 s)
;   d = 1: 4 decks of up to 6 steps (the decks have at most 5), 13 s per deck (52 s); never over 90 s
; Score = average over the decks of max(0, 1 - 0.25 × mistakes) × placed / steps (a deck cut short by the
; timer counts what was placed). Content: src/data/mg-order.js, the department's decks (gen/mg_order_data.s).
; Differs from the JS: the slides are a column of two-line cards instead of a row (40 columns).

.include "api.inc"

MAX_STEPS = 6
MAX_ROUNDS = 4
BETWEEN_T = 45                  ; 0.9 s between decks
WRONG_T   = 18                  ; 0.35 s red flash on a wrong pick
MSG_T     = 45                  ; feedback text, 0.9 s
TIME_MAX  = 90 * 50
DECK_T    = 22 * 50             ; per deck at d = 0, minus 9 s × d

SLIDE_Y   = 5                   ; slot / option i: rows SLIDE_Y + 3i ..
SLIDE_TX  = 2                   ; slide text column (15 wide)
OPT_X     = 18                  ; option boxes: columns 18-39
OPT_W     = 22
MSG_Y     = 23

.zeropage
rounds:   .res 1
round:    .res 1
nsteps:   .res 1
maxsteps: .res 1
placed:   .res 1
mistakes: .res 1
focus:    .res 1
wrong_t:  .res 1
wrong_i:  .res 1
between:  .res 1
msg_t:    .res 1
last_key: .res 1
done:     .res 1
sum:      .res 2                ; deck scores 0-255 added up
dp:       .res 2                ; walks the deck data
t0:       .res 1
t1:       .res 1
t2:       .res 1
row:      .res 1
dv_n:     .res 2                ; div8 / mul8
dv_d:     .res 1
m_b:      .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- setup

; A = difficulty, X = department (the content is this department's anyway)
init:
        sta diff
        lda #0
        sta round
        sta done
        sta sum
        sta sum+1
        sta between
        sta msg_t
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        lda #$ff
        sta last_key
        ; rounds = round(byDiff(d, 2, 4)), max steps = round(byDiff(d, 4, 6)): +1 from d 0.25, +2 from 0.75
        ldx #2
        lda diff
        cmp #64
        bcc :+
        inx
        cmp #192
        bcc :+
        inx
:       stx rounds
        txa
        clc
        adc #2
        sta maxsteps
        ; time = min(90 s, rounds × (22 - 9d) s): 9 s × d = diff × 225 / 128 frames
        lda diff
        ldx #225
        jsr mul8                ; A:dv_n = diff × 225
        asl dv_n                ; / 128 = × 2 / 256
        rol
        sta t0
        lda #<DECK_T
        sec
        sbc t0
        sta t1
        lda #>DECK_T
        sbc #0
        sta t2                  ; t2:t1 = per deck
        lda #0
        sta dv_n
        sta dv_n+1
        ldx rounds
:       lda dv_n
        clc
        adc t1
        sta dv_n
        lda dv_n+1
        adc t2
        sta dv_n+1
        dex
        bne :-
        lda dv_n+1
        cmp #>TIME_MAX
        bcc :+
        lda #<TIME_MAX
        sta dv_n
        lda #>TIME_MAX
        sta dv_n+1
:       ; decks: a shuffled pick of the department's
        ldx #D_COUNT - 1
:       txa
        sta pool,x
        dex
        bpl :-
        lda #D_COUNT
        ldx rounds
        jsr pick
        text 1, 0, s_name, 7
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda dv_n
        ldx dv_n+1
        jsr timer_start
        jmp start_round

; The first X entries of pool[0..A-1] become a random pick (partial Fisher-Yates).
pick:
        sta t1
        stx t2
        ldx #0
@p:     stx t0
        lda t1
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda pool,x
        pha
        lda pool,y
        sta pool,x
        pla
        sta pool,y
        inx
        cpx t2
        bne @p
        rts

; Deck `round`: read its steps, shuffle them into the option boxes, draw the screen.
start_round:
        lda #0
        sta placed
        sta mistakes
        sta focus
        sta wrong_t
        ldx round
        ldy pool,x
        lda deck_lo,y
        sta dp
        sta title_lo
        lda deck_hi,y
        sta dp+1
        sta title_hi
        jsr skip_str            ; past the title
        ldy #0
        lda (dp),y              ; step count, at most maxsteps
        cmp maxsteps
        bcc :+
        lda maxsteps
:       sta nsteps
        inc dp
        bne :+
        inc dp+1
:       ldx #0
@s:     lda dp
        sta opt_lo,x
        lda dp+1
        sta opt_hi,x
        jsr skip_str
        lda dp
        sta l1_lo,x
        lda dp+1
        sta l1_hi,x
        jsr skip_str
        lda dp
        sta l2_lo,x
        lda dp+1
        sta l2_hi,x
        jsr skip_str
        inx
        cpx nsteps
        bne @s
        ; options: the steps shuffled
        ldx #MAX_STEPS - 1
:       txa
        sta opt_step,x
        lda #0
        sta opt_done,x
        dex
        bpl :-
        ldx nsteps
        dex
        beq @draw
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda opt_step,x
        pha
        lda opt_step,y
        sta opt_step,x
        pla
        sta opt_step,y
        dex
        bne @shuf
@draw:  lda #2
        ldx #21
        jsr clear_rows
        ; header: "Deck n/R"
        text 31, 0, s_deck, 7
        lda #7
        sta COLOR
        lda round
        clc
        adc #1
        ldx #36
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        lda rounds
        ldx #38
        ldy #0
        jsr API_NUM
        ; "Deck: <title>" centred on row 2
        ldx #0
        lda #<s_deck_t
        ldy #>s_deck_t
        jsr buf_str
        lda title_lo
        ldy title_hi
        jsr buf_str
        lda #7
        sta COLOR
        lda #<line_buf
        ldx #>line_buf
        ldy #2
        jsr API_CENTER
        text OPT_X, SLIDE_Y - 1, s_next, 1
        lda #0
        sta t2
:       lda t2
        jsr draw_slot
        inc t2
        lda t2
        cmp nsteps
        bne :-
        jmp draw_opts

; dp = past the 0-terminated string at dp (X kept).
skip_str:
        ldy #0
:       lda (dp),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc dp
        sta dp
        bcc :+
        inc dp+1
:       rts

; ---------------------------------------------------------------- frame

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
        jsr clear_msg
:       jsr timer_tick
        bcc @run
        lda between             ; time's up: a deck in progress counts what was placed
        bne :+
        jsr add_round
:       jmp finish
@run:   lda between
        beq @play
        dec between
        bne @out
        inc round
        lda round
        cmp rounds
        bne :+
        jmp finish
:       jsr start_round
@out:   clc
        rts
@play:  lda wrong_t
        beq :+
        dec wrong_t
        bne :+
        jsr draw_opts
:
.if .defined(AUTOPLAY)
        inc bot_t               ; perfect player: every 20 frames the option that comes next
        lda bot_t
        cmp #20
        bcc @keys
        lda #0
        sta bot_t
        ldx nsteps
        dex
:       lda opt_step,x
        cmp placed
        beq :+
        dex
        bpl :-
:       stx focus
        txa
        jmp choose
@keys:
.endif
        jsr num_key             ; keys 1-6, on the press only
        cmp last_key
        beq @joy
        sta last_key
        cmp nsteps
        bcs @joy
        jmp choose
@joy:   lda JOYP
        and #J_DOWN | J_RIGHT
        beq :+
        lda #1
        bne @move
:       lda JOYP
        and #J_UP | J_LEFT
        beq :+
        lda #$ff
        bne @move
:       lda JOYP
        and #J_FIRE
        beq @none
        lda focus
        jmp choose
@move:  jsr move_focus
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_opts
@none:  clc
        rts

; A = +1 / -1: the focus moves to the next option still open, wrapping around.
move_focus:
        sta t0
        ldx nsteps
@m:     lda focus
        clc
        adc t0
        bpl :+
        lda nsteps
        sec
        sbc #1
:       cmp nsteps
        bcc :+
        lda #0
:       sta focus
        tay
        lda opt_done,y
        beq @out
        dex
        bne @m
@out:   rts

; A = option box: the next slide if it is the next step, else a mistake.
choose:
        sta t2
        tax
        lda opt_done,x
        beq :+
        clc                     ; already placed
        rts
:       lda opt_step,x
        cmp placed
        beq :+
        jmp @wrong
:       lda #1
        sta opt_done,x
        lda placed
        jsr draw_slot_full
        inc placed
        lda #SFX_GOOD
        jsr API_SFX
        ldx #0                  ; "Slide n"
        lda #<s_slide
        ldy #>s_slide
        jsr buf_str
        lda placed
        jsr buf_num
        ldy #5
        jsr message
        lda placed
        cmp nsteps
        bne @more
        jsr add_round           ; deck complete
        lda #BETWEEN_T
        sta between
        lda #OPT_W              ; clear the options, say how it went
        sta FILL_W
        lda #MAX_STEPS * 3 + 1
        sta FILL_H
        lda #' '
        ldx #OPT_X
        ldy #SLIDE_Y - 1
        jsr API_FILL
        lda mistakes
        bne :+
        ldx #0
        lda #<s_flawless
        ldy #>s_flawless
        jsr buf_str
        ldy #5
        jsr message
        clc
        rts
:       ldx #0                  ; "Deck done (n oops)"
        lda #<s_done
        ldy #>s_done
        jsr buf_str
        lda mistakes
        jsr buf_num
        lda #<s_oops
        ldy #>s_oops
        jsr buf_str
        ldy #7
        jsr message
        clc
        rts
@more:  lda focus               ; off the placed box
        tax
        lda opt_done,x
        beq :+
        lda #1
        jsr move_focus
:       jsr draw_opts
        clc
        rts
@wrong: inc mistakes
        lda #SFX_BAD
        jsr API_SFX
        lda t2
        sta wrong_i
        lda #WRONG_T
        sta wrong_t
        ldx #0
        lda #<s_notyet
        ldy #>s_notyet
        jsr buf_str
        ldy #2
        jsr message
        jsr draw_opts
        clc
        rts

; sum += this deck's score: (4 - min(mistakes, 4)) × placed × 255 / (4 × steps)
add_round:
        lda mistakes
        cmp #4
        bcc :+
        lda #4
:       eor #$ff
        sec
        adc #4                  ; 4 - m
        ldx placed
        jsr mul8                ; (≤ 24, so the high byte is 0)
        lda dv_n
        ldx #255
        jsr mul8
        sta dv_n+1
        lda nsteps
        asl
        asl
        jsr div8
        lda dv_n
        clc
        adc sum
        sta sum
        bcc :+
        inc sum+1
:       rts

; MG_SCORE = sum / rounds
finish:
        lda sum
        sta dv_n
        lda sum+1
        sta dv_n+1
        lda rounds
        jsr div8
        lda dv_n
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; ---------------------------------------------------------------- drawing

; Slide A, empty: its number and a "?".
draw_slot:
        jsr slot_clear
        lda #6
        sta COLOR
        lda #'?'
        ldx #SLIDE_TX
        ldy row
        jmp API_PUTC

; Slide A, filled with its step (the step with that index).
draw_slot_full:
        sta t1
        jsr slot_clear
        lda #1
        sta COLOR
        ldx t1
        lda l1_lo,x
        sta PTR
        lda l1_hi,x
        sta PTR+1
        ldx #SLIDE_TX
        ldy row
        jsr API_PRINT
        ldx t1
        lda l2_lo,x
        sta PTR
        lda l2_hi,x
        sta PTR+1
        ldx #SLIDE_TX
        ldy row
        iny
        jsr API_PRINT
        lda #7
        ldx t1
        bpl slot_num            ; (always)

; Slide A: cleared, number and bar in blue (empty) or yellow / white (filled, see draw_slot_full).
slot_clear:
        sta t1
        asl
        adc t1
        adc #SLIDE_Y
        sta row
        lda #15
        sta FILL_W
        lda #2
        sta FILL_H
        lda #' '
        ldx #SLIDE_TX
        ldy row
        jsr API_FILL
        lda #6
        ldx t1
slot_num:
        sta COLOR
        txa
        clc
        adc #'1'
        ldx #0
        ldy row
        jsr API_PUTC
        lda COLOR
        cmp #6
        beq :+
        lda #1
        sta COLOR
:       lda #2
        sta FILL_H
        lda #1
        sta FILL_W
        lda #CH_L
        ldx #1
        ldy row
        jmp API_FILL

; The option boxes: wrong flash red, focus yellow, others blue; placed ones are gone.
draw_opts:
        lda #0
        sta t1
@o:     lda t1
        asl
        adc t1
        adc #SLIDE_Y
        sta row
        lda #OPT_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldx t1
        lda opt_done,x
        beq :+
        lda #' '
        ldx #OPT_X
        ldy row
        jsr API_FILL
        jmp @next
:       lda #6
        cpx focus
        bne :+
        lda #7
:       ldy wrong_t
        beq :+
        cpx wrong_i
        bne :+
        lda #2
:       sta COLOR
        ldx #OPT_X
        ldy row
        jsr API_BOX
        inc row
        lda t1
        clc
        adc #'1'
        ldx #OPT_X + 1
        ldy row
        jsr API_PUTC
        lda #1
        sta COLOR
        ldx t1
        ldy opt_step,x
        lda opt_lo,y
        sta PTR
        lda opt_hi,y
        sta PTR+1
        ldx #OPT_X + 3
        ldy row
        jsr API_PRINT
@next:  inc t1
        lda t1
        cmp nsteps
        bne @o
        rts

; line_buf, Y = colour: centred on row MSG_Y for 0.9 s.
message:
        sty COLOR
        jsr clear_msg
        lda #MSG_T
        sta msg_t
        lda #<line_buf
        ldx #>line_buf
        ldy #MSG_Y
        jmp API_CENTER

; A/Y = string: appended to line_buf at X (X = its new end, the buffer stays 0-terminated).
buf_str:
        sta PTR
        sty PTR+1
        ldy #0
:       lda (PTR),y
        sta line_buf,x
        beq :+
        inx
        iny
        bne :-
:       rts

; A = number 0-99: appended in decimal to line_buf at X.
buf_num:
        ldy #'0'
:       cmp #10
        bcc :+
        sbc #10
        iny
        bne :-
:       cpy #'0'
        beq :+
        pha
        tya
        sta line_buf,x
        inx
        pla
:       ora #'0'
        sta line_buf,x
        inx
        lda #0
        sta line_buf,x
        rts

clear_msg:
        lda #MSG_Y
        ldx #1
        jmp clear_rows

; Keys 1-6 (key matrix code in $cb): A = 0..5, or $ff.
num_key:
        lda $cb
        ldx #MAX_STEPS - 1
:       cmp num_codes,x
        beq :+
        dex
        bpl :-
:       txa
        rts

; ---------------------------------------------------------------- arithmetic

; A × X -> A (high byte), dv_n (low byte; dv_n+1 untouched).
mul8:
        stx m_b
        sta dv_d
        lda #0
        ldx #8
@m:     lsr m_b
        bcc :+
        clc
        adc dv_d
:       ror
        ror dv_n
        dex
        bne @m
        rts

; dv_n (16 bit) / A -> dv_n, A = remainder.
div8:
        sta dv_d
        lda #0
        ldx #16
@d:     asl dv_n
        rol dv_n+1
        rol
        bcs @sub
        cmp dv_d
        bcc :+
@sub:   sbc dv_d
        inc dv_n
:       dex
        bne @d
        rts

.rodata
s_name:     .byte "Slide Deck Order", 0
s_help:     .byte "Pick the steps in the correct order.", 0
s_keys:     .byte "Keys 1-6, or up/down + FIRE", 0
s_deck:     .byte "Deck", 0
s_deck_t:   .byte "Deck: ", 0
s_next:     .byte "What comes next?", 0
s_slide:    .byte "Slide ", 0
s_notyet:   .byte "Not yet!", 0
s_flawless: .byte "Flawless deck!", 0
s_done:     .byte "Deck done (", 0
s_oops:     .byte " oops)", 0
num_codes:  .byte 56, 59, 8, 11, 16, 19

.include "gen/mg_order_data.s"

.bss
diff:     .res 1
title_lo: .res 1
title_hi: .res 1
pool:     .res D_COUNT
opt_step: .res MAX_STEPS        ; option box -> step
opt_done: .res MAX_STEPS
opt_lo:   .res MAX_STEPS        ; per step: option text, slide lines 1 and 2
opt_hi:   .res MAX_STEPS
l1_lo:    .res MAX_STEPS
l1_hi:    .res MAX_STEPS
l2_lo:    .res MAX_STEPS
l2_hi:    .res MAX_STEPS
line_buf: .res 40
