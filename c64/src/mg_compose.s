; Write the Email (src/minigames/compose.js) as a disk-loaded overlay at $4000.
; Fill each blank in the email with the right corporate phrase. Half the sentences (rounded up) come from the
; department's pool, the rest from the general one, shuffled. Score = correct / sentences; the timer runs for
; the whole email (the 0.6 s reveal after each pick included).
;   d = 0: 5 sentences, 3 options, 60 s        d = 1: 9 sentences, 4 options (from d = 0.4), 42 s
; Content: src/data/mg-compose.js (gen/mg_compose_data.s).

.include "api.inc"

MAX_ITEMS = 9
REVEAL_T  = 30                  ; 0.6 s
OPT4_DIFF = 102                 ; 4 options from d = 0.4
TOTAL_T   = 60 * 50             ; minus 18 s × d
; window rows 2-15: header lines 3-5, a rule on 6, the body on 7-14 (columns 2-37)
WIN_Y     = 2
BODY_Y    = 7
BODY_ROWS = 8
LINE_W    = 36
BODY_X    = 2
MSG_Y     = 16                  ; "Nice!" / "Unprofessional!"
OPT_Y     = 17                  ; option boxes: 2 × 2 of 19 × 3 on rows 17-22
OPT_W     = 19
SCORE_Y   = 23
BLANK_LEN = 5                   ; "_____"

; colours
C_DIM     = 3                   ; earlier sentences, the header lines
C_TEXT    = 1
C_BLANK   = 7
C_RIGHT   = 5
C_WRONG   = 2

.zeropage
zp_start:
cur:      .res 1                ; sentence being filled
correct:  .res 1
focus:    .res 1
reveal:   .res 1                ; frames left showing the answer, 0 = asking
done:     .res 1
bot_t:    .res 1
zp_end:
count:    .res 1                ; sentences (5-9)
nopt:     .res 1                ; options (3-4)
right:    .res 1
chosen:   .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
sp:       .res 2                ; string pointer
dst:      .res 2                ; screen / colour pointers
dcl:      .res 2
llen:     .res 1                ; built line length
lbrk:      .res 1                ; end of its first screen line (= llen if it fits on one)
lcol:     .res 1
row:      .res 1
first:    .res 1
k:        .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- setup

init:
        ldx #zp_end - zp_start - 1
        lda #0
:       sta zp_start,x
        dex
        bpl :-
        ; sentences: round(5 + 4 d) = 5 + (4 × MG_DIFF + 128) / 256
        lda MG_DIFF
        asl
        sta t0
        lda #0
        rol
        sta t1
        asl t0
        rol t1
        lda t0
        clc
        adc #128
        lda t1
        adc #0
        clc
        adc #5
        sta count
        lda #3
        ldx MG_DIFF
        cpx #OPT4_DIFF
        bcc :+
        lda #4
:       sta nopt
        ; pool = 0..I_COUNT-1; draw ceil(count / 2) (at most D_COUNT) from the department part, the rest
        ; from the general part
        ldx #I_COUNT - 1
:       txa
        sta pool,x
        dex
        bpl :-
        lda count
        lsr
        adc #0
        cmp #D_COUNT
        bcc :+
        lda #D_COUNT
:       sta t2                  ; from the department
        ldx #0
        ldy #D_COUNT
        jsr pick
        lda count
        sec
        sbc t2
        ldx #D_COUNT
        ldy #G_COUNT
        jsr pick_more
        ; items = the drawn ones, shuffled; nothing filled yet
        ldx count
        dex
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda items,x
        pha
        lda items,y
        sta items,x
        pla
        sta items,y
        dex
        bne @shuf
        ldx #MAX_ITEMS - 1
        lda #$ff
:       sta fill,x
        dex
        bpl :-
        ; screen: title, the mail window
        text 1, 0, s_name, 7
        lda #6
        sta COLOR
        lda #38
        sta FILL_W
        lda #14
        sta FILL_H
        ldx #1
        ldy #WIN_Y
        jsr API_BOX
        text 3, 3, s_new, 3
        text 34, 3, s_send, 7
        text 3, 4, s_to, C_DIM
        text 3, 5, s_subj, C_DIM
        lda #<s_subject
        sta PTR
        lda #>s_subject
        sta PTR+1
        ldx #12
        ldy #5
        jsr API_PRINT
        lda #6
        sta COLOR
        lda #LINE_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #BODY_X
        ldy #6
        lda #CH_T
        jsr API_FILL
        lda #<s_keys3
        ldx #>s_keys3
        ldy nopt
        cpy #4
        bne :+
        lda #<s_keys4
        ldx #>s_keys4
:       jsr footer
        ; timer: 60 s - 18 s × d = 3000 - MG_DIFF × (3 + 1/2 + 1/32) frames
        lda MG_DIFF
        sta t0
        lda #0
        sta t1
        asl t0
        rol t1
        lda t0
        clc
        adc MG_DIFF
        sta t0
        lda t1
        adc #0
        sta t1                  ; × 3
        lda MG_DIFF
        lsr
        pha
        clc
        adc t0
        sta t0
        bcc :+
        inc t1
:       pla
        lsr
        lsr
        lsr
        lsr
        clc
        adc t0
        sta t0
        bcc :+
        inc t1
:       lda #<TOTAL_T
        sec
        sbc t0
        pha
        lda #>TOTAL_T
        sbc t1
        tax
        pla
        jsr timer_start
        jmp ask

; Partial Fisher-Yates: A entries drawn from pool[X .. X+Y-1] go to items[] after the ones drawn so far.
pick:   lda #0
        sta k
        lda t2
pick_more:
        sta t0                  ; how many
        stx t1                  ; base
        sty first               ; size of the part
        lda #0
        sta row                 ; j
@j:     lda row
        cmp t0
        beq @out
        lda first
        sec
        sbc row
        jsr API_RMOD
        clc
        adc row
        adc t1
        tay                     ; pool index of the pick
        lda row
        clc
        adc t1
        tax
        lda pool,y              ; swap pool[base + j] and the pick
        pha
        lda pool,x
        sta pool,y
        pla
        sta pool,x
        ldx k
        sta items,x
        inc k
        inc row
        bne @j
@out:   rts

; Set up and draw sentence cur.
ask:
        lda #0
        sta reveal
        sta focus
        sta bot_t
        ; options: the right phrase (string 2) and nopt - 1 of the wrong ones (strings 3-5), shuffled
        ldx #0
        lda nopt
        cmp #4
        beq @all
        lda #3
        jsr API_RMOD            ; the wrong phrase left out
        sta t0
        ldx #0
        ldy #0
@d:     cpy t0
        beq @skip
        tya
        clc
        adc #3
        sta opt_str,x
        inx
@skip:  iny
        cpy #3
        bne @d
        beq @add
@all:   lda #3
        sta opt_str
        lda #4
        sta opt_str+1
        lda #5
        sta opt_str+2
        ldx #3
@add:   lda #2
        sta opt_str,x
        ldx nopt
        dex
@shuf:  stx t1
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t1
        lda opt_str,x
        pha
        lda opt_str,y
        sta opt_str,x
        pla
        sta opt_str,y
        dex
        bne @shuf
        ldx nopt
        dex
:       lda opt_str,x
        cmp #2
        beq :+
        dex
        bpl :-
:       stx right
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        jsr draw_body
        jsr draw_options
        jmp draw_counter

; ---------------------------------------------------------------- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       jsr timer_tick
        bcc :+
        jmp finish
:       lda reveal
        beq @ask
        dec reveal
        bne @wait
        inc cur
        lda cur
        cmp count
        bne :+
        jmp finish
:       jsr ask
@wait:  clc
        rts
@ask:
.if .defined(AUTOPLAY)
        inc bot_t               ; a perfect player who reads for 0.4 s
        lda bot_t
        cmp #20
        bne :+
        lda right
        jmp answer
:
.endif
        jsr number_key
        cmp nopt
        bcs :+
        jmp answer
:       ldx focus
        lda JOYP
        and #J_RIGHT
        beq :+
        inx
        cpx nopt
        bcc @moved
        ldx #0
        beq @moved
:       lda JOYP
        and #J_LEFT
        beq :+
        dex
        bpl @moved
        ldx nopt
        dex
        bpl @moved
:       lda JOYP
        and #J_DOWN
        beq :+
        inx
        inx
        cpx nopt
        bcc @moved
        clc
        rts
:       lda JOYP
        and #J_UP
        beq :+
        dex
        dex
        bpl @moved
        clc
        rts
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp answer
@moved: stx focus
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_options
@out:   clc
        rts

; A = picked option.
answer:
        sta chosen
        tax
        lda opt_str,x
        ldx cur
        sta fill,x
        lda chosen
        cmp right
        bne @wrong
        inc correct
        lda #SFX_GOOD
        jsr API_SFX
        lda #C_RIGHT
        sta COLOR
        lda #<s_nice
        ldx #>s_nice
        bne @msg
@wrong: lda #SFX_BAD
        jsr API_SFX
        lda #C_WRONG
        sta COLOR
        lda #<s_unprof
        ldx #>s_unprof
@msg:   ldy #MSG_Y
        jsr API_CENTER
        lda #REVEAL_T
        sta reveal
        jsr draw_body
        jsr draw_options
        jsr draw_counter
        clc
        rts

; score = correct × 255 / count
finish:
        lda correct
        sta t0
        lda #0
        sta t1
        ldx #8                  ; × 256 - × 1
:       asl t0
        rol t1
        dex
        bne :-
        lda t0
        sec
        sbc correct
        sta t0
        lda t1
        sbc #0
        sta t1
        ldx #0                  ; / count by subtraction (at most 255 steps)
:       lda t0
        sec
        sbc count
        tay
        lda t1
        sbc #0
        bcc :+
        sta t1
        sty t0
        inx
        bne :-
:       stx MG_SCORE
        lda #1
        sta done
        sec
        rts

; ---------------------------------------------------------------- drawing

; "n/count" top right, "Correct: n" bottom left.
draw_counter:
        lda #1
        sta COLOR
        lda cur
        cmp count
        bcc :+
        lda count
        sbc #1
:       clc
        adc #1
        ldx #36
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        ldx #38
        ldy #0
        lda count
        jsr API_NUM
        text 1, SCORE_Y, s_correct, 1
        ldx #10
        ldy #SCORE_Y
        lda correct
        jmp API_NUM

; The option boxes: focused yellow, others blue; while revealing the right one green, a wrong pick red.
draw_options:
        lda #0
        sta k
@o:     ldx k
        lda #6
        ldy reveal
        bne @rev
        cpx focus
        bne @col
        lda #7
        bne @col
@rev:   cpx right
        bne :+
        lda #5
        bne @col
:       cpx chosen
        bne @col
        lda #2
@col:   sta COLOR
        lda #OPT_W
        sta FILL_W
        lda #3
        sta FILL_H
        txa
        and #1
        tay
        lda box_x,y
        sta t2
        tax
        lda k
        lsr
        tay
        lda box_y,y
        sta row
        tay
        jsr API_BOX
        ldx t2                  ; clear the inside, number, phrase
        inx
        ldy row
        iny
        sty row
        lda #OPT_W - 2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        jsr API_FILL
        lda #3
        sta COLOR
        lda k
        clc
        adc #'1'
        ldx t2
        inx
        ldy row
        jsr API_PUTC
        ldx k
        lda opt_str,x
        ldx cur
        jsr item_str
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        lda t2
        clc
        adc #3
        tax
        ldy row
        jsr API_PRINT
        inc k
        lda k
        cmp nopt
        beq :+
        jmp @o
:       rts

; The email body: the current sentence and up to 5 before it, as many as fit on the 8 rows.
draw_body:
        lda cur                 ; first = the earliest sentence that still fits
        sta first
        sta k
        lda #0
        sta row
@fit:   jsr build
        ldx #1
        lda lbrk
        cmp llen
        beq :+
        inx
:       txa
        clc
        adc row
        cmp #BODY_ROWS + 1
        bcs @draw
        sta row
        lda k
        sta first
        beq @draw
        lda cur
        sec
        sbc k
        cmp #5
        beq @draw
        dec k
        bpl @fit
@draw:  lda #BODY_Y
        ldx #BODY_ROWS
        jsr clear_rows
        lda #6                  ; the window's sides again
        sta COLOR
        lda #1
        sta FILL_W
        lda #BODY_ROWS
        sta FILL_H
        lda #CH_L
        ldx #1
        ldy #BODY_Y
        jsr API_FILL
        lda #CH_R
        ldx #38
        ldy #BODY_Y
        jsr API_FILL
        lda #BODY_Y
        sta row
        lda first
        sta k
@s:     jsr build
        lda #0
        ldx lbrk
        jsr put_line
        lda lbrk
        cmp llen
        beq :+
        clc
        adc #1                  ; (skip the space at the break)
        ldx llen
        jsr put_line
:       lda k
        cmp cur
        beq :+
        inc k
        bne @s
:       rts

; Characters A .. X-1 of the built line on body row `row` (then row + 1).
put_line:
        sta t0
        stx t1
        ldx row
        lda row_lo,x
        clc
        adc #BODY_X
        sta dst
        sta dcl
        lda row_hi,x
        adc #0
        sta dst+1
        clc
        adc #>(COLRAM - SCREEN)
        sta dcl+1
        ldx t0
        ldy #0
:       cpx t1
        beq :+
        lda lbuf,x
        sta (dst),y
        lda cbuf,x
        sta (dcl),y
        inx
        iny
        bne :-
:       inc row
        rts

; Sentence k into lbuf/cbuf (characters and colours): before + the filled phrase (or the blank) + after.
; llen = its length, lbrk = where the first screen line ends.
build:
        lda #0
        sta llen
        ldy #C_DIM              ; earlier sentences dim, the current one bright
        lda k
        cmp cur
        bne :+
        ldy #C_TEXT
:       sty lcol
        lda #0
        ldx k
        jsr item_str
        jsr copy_str
        ldx k
        lda fill,x
        bmi @blank
        pha
        ldy #C_WRONG
        cmp #2
        bne :+
        ldy #C_RIGHT
:       sty lcol
        pla
        ldx k
        jsr item_str
        jsr copy_str
        jmp @post
@blank: ldx llen
        ldy #BLANK_LEN
:       lda #'_'
        sta lbuf,x
        lda #C_BLANK
        sta cbuf,x
        inx
        dey
        bne :-
        stx llen
@post:  ldy #C_DIM
        lda k
        cmp cur
        bne :+
        ldy #C_TEXT
:       sty lcol
        lda #1
        ldx k
        jsr item_str
        jsr copy_str
        ; break: the whole line if it fits, else at the last space at or before LINE_W
        lda llen
        sta lbrk
        cmp #LINE_W + 1
        bcc @out
        ldx #LINE_W
:       lda lbuf,x
        cmp #' '
        beq :+
        dex
        bne :-
:       stx lbrk
@out:   rts

; Append string sp to lbuf in colour lcol.
copy_str:
        ldx llen
        ldy #0
:       lda (sp),y
        beq :+
        sta lbuf,x
        lda lcol
        sta cbuf,x
        inx
        iny
        bne :-
:       stx llen
        rts

; sp = string A of item slot X (0 before the blank, 1 after it, 2 the right phrase, 3-5 the wrong ones).
item_str:
        sta t0
        ldy items,x
        lda item_lo,y
        sta sp
        lda item_hi,y
        sta sp+1
@skip:  lda t0
        beq @done
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc sp
        sta sp
        bcc :+
        inc sp+1
:       dec t0
        jmp @skip
@done:  rts

.rodata
s_name:    .byte "Write the Email", 0
s_help:    .byte "Fill each blank with the right phrase.", 0
s_keys3:   .byte "Keys 1-3, or joystick + FIRE", 0
s_keys4:   .byte "Keys 1-4, or joystick + FIRE", 0
s_new:     .byte "New Message", 0
s_send:    .byte "Send", 0
s_to:      .byte "To: team@synergy.corp", 0
s_subj:    .byte "Subject:", 0
s_correct: .byte "Correct:", 0
s_nice:    .byte "Nice!", 0
s_unprof:  .byte "Unprofessional!", 0
box_x:     .byte 1, 1 + OPT_W
box_y:     .byte OPT_Y, OPT_Y + 3
row_lo:    .repeat 25, I
           .byte <(SCREEN + I * 40)
           .endrepeat
row_hi:    .repeat 25, I
           .byte >(SCREEN + I * 40)
           .endrepeat

.include "gen/mg_compose_data.s"

.bss
pool:      .res I_COUNT
items:     .res MAX_ITEMS       ; pool index of each sentence
fill:      .res MAX_ITEMS       ; string picked for it (2 = right), $ff = still blank
opt_str:   .res 4
lbuf:      .res 80
cbuf:      .res 80
