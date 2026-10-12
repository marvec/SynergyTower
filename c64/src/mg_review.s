; HR Performance Review (src/minigames/review.js) as a disk-loaded overlay at $4000: the gate before every
; promotion. Tell HR what they want to hear; one question is about your own track record (MG_FLOORNO,
; MG_STARS). Floors 1-2: 5 questions, 3 options, 13 s each. Score = correct / questions; 60% passes.

.include "api.inc"

QUESTIONS = 5
OPTIONS   = 3
PER_Q     = 13 * 50
REVEAL_T  = 55                  ; 1.1 s
OPT_Y     = 9                   ; first option box row

.zeropage
qi:       .res 1
correct:  .res 1
focus:    .res 1
right:    .res 1
chosen:   .res 1
reveal:   .res 1
done:     .res 1
personal: .res 1                ; which question is the personal one
pkind:    .res 1                ; 0 stars, 1 title, 2 department
t0:       .res 1
t1:       .res 1
t2:       .res 1
sp:       .res 2
row:      .res 1
pv:       .res 4                ; personal answers: [0] right, [1..3] wrong (stars: numbers; title/dept: indexes)
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

init:
        lda #0
        sta qi
        sta correct
        sta done
        ldx #R_COUNT-1          ; pick QUESTIONS distinct questions (partial Fisher-Yates)
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
@pick:  stx t0
        lda #R_COUNT
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda pool,y
        pha
        lda pool,x
        sta pool,y
        pla
        sta pool,x
        inx
        cpx #QUESTIONS
        bne @pick
        lda #QUESTIONS - 1      ; the personal question replaces one of questions 2..5
        jsr API_RMOD
        clc
        adc #1
        sta personal
        lda #3
        jsr API_RMOD
        sta pkind
        jsr make_personal
        jsr API_RAND
        and #7
        tax
        lda hair_tab,x
        sta rep_hair
        text 1, 0, s_title, 7
        jsr draw_form
        jmp ask

; The personal question's answers.
make_personal:
        lda pkind
        bne @title
        lda MG_STARS            ; stars: the real number and three others (stars + -7..8, at least 0, distinct)
        sta pv
        ldx #1
@w:     stx t2
@again: lda #8
        jsr API_RMOD
        tay
        lda MG_STARS
        clc
        adc offs,y
        bpl :+
        lda #0
:       ldy #0                  ; distinct from the ones so far
:       cmp pv,y
        beq @again
        iny
        cpy t2
        bne :-
        ldx t2
        sta pv,x
        inx
        cpx #4
        bne @w
        rts
@title: cmp #1
        bne @dept
        ldx MG_FLOORNO          ; titles: yours, and three other floors' (different titles)
        dex
        stx pv
        ldx #1
@tw:    stx t2
@tagain:
        lda #40
        jsr API_RMOD
        ldx #0
:       cmp pv,x
        beq @tagain
        inx
        cpx t2
        bne :-
        ldx t2
        sta pv,x
        inx
        cpx #4
        bne @tw
        rts
@dept:  lda MG_FLOORNO          ; departments: yours ((floor - 1) / 5) and three others
        sec
        sbc #1
        ldx #0
:       cmp #5
        bcc :+
        sbc #5
        inx
        bne :-
:       stx pv
        ldx #1
@dw:    stx t2
@dagain:
        lda #8
        jsr API_RMOD
        ldx #0
:       cmp pv,x
        beq @dagain
        inx
        cpx t2
        bne :-
        ldx t2
        sta pv,x
        inx
        cpx #4
        bne @dw
        rts

; Set up and draw question qi.
ask:
        lda #0
        sta reveal
        sta focus
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; options: the answer (0) and two of the three wrong ones (1-3), shuffled
        lda #3
        jsr API_RMOD
        sta t0                  ; the wrong one left out
        ldx #0
        ldy #1
@d:     cpy t0
        beq :+
        cpy #4
        beq @dd
        tya
        sta opt,x
        inx
:       iny
        cpy #4
        bne @d
@dd:    lda #0
        sta opt,x
        ldx #OPTIONS-1
@shuf:  stx t1
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t1
        lda opt,x
        pha
        lda opt,y
        sta opt,x
        pla
        sta opt,y
        dex
        bne @shuf
        ldx #OPTIONS-1
:       lda opt,x
        beq :+
        dex
        bpl :-
:       stx right
        lda #2
        ldx #7
        jsr clear_rows
        jsr draw_counter
        ldx #1                  ; the HR rep
        ldy #3
        lda rep_hair
        jsr face
        text 1, 5, s_hr, 7
        lda #1                  ; question bubble
        sta COLOR
        lda #35
        sta FILL_W
        lda #5
        sta FILL_H
        ldx #4
        ldy #2
        jsr API_BOX
        lda #'<'
        ldx #4
        ldy #3
        jsr API_PUTC
        jsr print_question
        jsr draw_options
        lda #19
        ldx #1
        jsr clear_rows
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<PER_Q
        ldx #>PER_Q
        jmp timer_start

; The question in the bubble (rows 3-5, columns 6-37).
print_question:
        lda qi
        cmp personal
        bne @std
        ldx pkind
        lda pq_lo,x
        sta PTR
        lda pq_hi,x
        sta PTR+1
        lda #1
        sta COLOR
        ldx #6
        ldy #3
        jsr API_PRINT
        lda pkind
        bne @done
        text 6, 4, s_onfloor, 1 ; "on floor N?"
        lda MG_FLOORNO
        ldx #15
        ldy #4
        jsr API_NUM
        lda #'?'
        ldx #16
        ldy MG_FLOORNO
        cpy #10
        bcc :+
        inx
:       ldy #4
        jsr API_PUTC
@done:  rts
@std:   lda #0
        sta t2
:       lda t2
        jsr entry_str
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        lda t2
        clc
        adc #3
        tay
        ldx #6
        jsr API_PRINT
        inc t2
        lda t2
        cmp #3
        bne :-
        rts

; sp = string A of the current question (0-2 question lines, 3 answer, 4-6 honest ones).
entry_str:
        sta t0
        ldx qi
        ldy pool,x
        lda rev_lo,y
        sta sp
        lda rev_hi,y
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

draw_options:
        lda #0
        sta t1
@o:     ldx t1
        lda #6
        cpx focus
        bne :+
        ldy reveal
        bne :+
        lda #7
:       ldy reveal
        beq @col
        lda #6
        cpx right
        bne :+
        lda #5
        bne @col
:       cpx chosen
        bne @col
        lda #2
@col:   sta COLOR
        lda #40
        sta FILL_W
        lda #3
        sta FILL_H
        lda t1
        asl
        adc t1
        adc #OPT_Y
        sta row
        tay
        ldx #0
        jsr API_BOX
        inc row
        lda #34                 ; clear the inside
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #4
        ldy row
        jsr API_FILL
        lda t1
        clc
        adc #'1'
        ldx #2
        ldy row
        jsr kputc
        lda #1
        sta COLOR
        ldx t1
        lda opt,x               ; 0 = the answer HR wants, 1-3 honest ones
        jsr option_text
        ldx #4
        ldy row
        jsr API_PRINT
        inc t1
        lda t1
        cmp #OPTIONS
        bne @o
        rts

; A = option (0 right, 1-3 wrong) -> PTR = its text (personal: a number, a title or a department).
option_text:
        tax
        lda qi
        cmp personal
        beq @pers
        txa
        clc
        adc #3
        jsr entry_str
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        rts
@pers:  lda pv,x
        ldy pkind
        bne @named
        jsr num_str             ; stars: the number as text
        lda #<numbuf
        sta PTR
        lda #>numbuf
        sta PTR+1
        rts
@named: tax
        cpy #1
        bne @dp
        lda ttl_lo,x
        sta PTR
        lda ttl_hi,x
        sta PTR+1
        rts
@dp:    lda dept_lo,x
        sta PTR
        lda dept_hi,x
        sta PTR+1
        rts

; A = 0..255 -> numbuf (decimal).
num_str:
        ldy #0
        ldx #0
:       cmp #100
        bcc :+
        sbc #100
        inx
        bne :-
:       pha
        txa
        beq :+
        ora #'0'
        sta numbuf,y
        iny
:       pla
        ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        bne :+
        cpy #0
        beq :++
:       ora #'0'
        sta numbuf,y
        iny
:       pla
        ora #'0'
        sta numbuf,y
        iny
        lda #0
        sta numbuf,y
        rts

draw_counter:
        lda #1
        sta COLOR
        ldx #36
        ldy #0
        lda qi
        clc
        adc #1
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        ldx #38
        ldy #0
        lda #QUESTIONS
        jmp API_NUM

; The review form, filling up with ticks: rows 21-23.
draw_form:
        text 1, 21, s_form, 3
        ldx #0
@q:     stx t0
        txa                     ; "Q1 + " at 1 + 6 × i
        asl
        adc t0
        asl
        adc #1
        sta t1
        lda #15 & 7
        sta COLOR
        lda #'Q'
        ldx t1
        ldy #22
        jsr API_PUTC
        lda t0
        clc
        adc #'1'
        ldx t1
        inx
        ldy #22
        jsr API_PUTC
        lda #'.'                ; result: + / x / .
        ldx #3
        ldy t0
        cpy qi
        bcs :++
        lda result,y
        beq :+
        lda #'+'
        ldx #5
        bne :++
:       lda #'x'
        ldx #2
:       stx COLOR
        ldx t1
        inx
        inx
        inx
        ldy #22
        jsr API_PUTC
        ldx t0
        inx
        cpx #QUESTIONS
        bne @q
        text 1, 23, s_pass, 1
        text 20, 23, s_yours, 1
        lda correct
        ldx #27
        ldy #23
        jmp API_NUM

; One frame. C=1 when the review is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda reveal
        beq @ask
        dec reveal
        bne @wait
        inc qi
        jsr draw_form
        lda qi
        cmp #QUESTIONS
        bne :+
        jmp finish
:       jsr ask
@wait:  clc
        rts
@ask:   jsr timer_tick
        bcc :+
        lda #$ff                ; silence noted
        jmp answer
:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #2
        bne :+
        lda right
        jmp answer
:
.endif
        jsr number_key
        cmp #OPTIONS
        bcs :+
        jmp answer
:       lda JOYP
        and #J_DOWN
        beq :+
        inc focus
        lda focus
        cmp #OPTIONS
        bcc @moved
        lda #0
        sta focus
        beq @moved
:       lda JOYP
        and #J_UP
        beq :+
        dec focus
        bpl @moved
        lda #OPTIONS-1
        sta focus
        bne @moved
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp answer
@moved: lda #SFX_BLIP
        jsr API_SFX
        jsr draw_options
@out:   clc
        rts

; A = picked option, $ff = timed out.
answer:
        sta chosen
        ldx qi
        cmp right
        bne @wrong
        inc correct
        lda #1
        sta result,x
        lda #SFX_GOOD
        jsr API_SFX
        lda #4
        jsr API_RMOD
        tax
        lda good_lo,x
        ldy good_hi,x
        ldx #5
        bne @msg
@wrong: lda #0
        sta result,x
        lda #SFX_BAD
        jsr API_SFX
        lda chosen
        bpl :+
        lda #<s_silence
        ldy #>s_silence
        ldx #2
        bne @msg
:       lda #3
        jsr API_RMOD
        tax
        lda bad_lo,x
        ldy bad_hi,x
        ldx #2
@msg:   stx COLOR
        sta PTR
        sty PTR+1
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #0
        ldy #19
        jsr API_FILL
        lda PTR
        ldx PTR+1
        ldy #19
        jsr API_CENTER
        lda #REVEAL_T
        sta reveal
        jsr draw_options
        clc
        rts

; score = correct × 255 / 5 = correct × 51
finish:
        lda correct
        asl
        asl
        asl
        asl
        asl
        sta t0
        lda correct
        asl
        asl
        asl
        asl
        clc
        adc t0
        sta t0
        lda correct
        asl
        adc t0
        adc correct
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Performance Review", 0
s_help:    .byte "Tell HR what they want to hear.", 0
s_title:   .byte "Performance Review", 0
s_hr:      .byte "HR", 0
s_keys:    .byte "Up/down + FIRE, or keys 1-3", 0
s_form:    .byte "PERFORMANCE REVIEW  F-27B", 0
s_pass:    .byte "Pass: 3/5", 0
s_yours:   .byte "Yours:", 0
s_onfloor: .byte "on floor ", 0
s_pq0:     .byte "How many KPI stars did you earn", 0
s_pq1:     .byte "Remind me, what is your job title?", 0
s_pq2:     .byte "Which department are you in, again?", 0
pq_lo:     .byte <s_pq0, <s_pq1, <s_pq2
pq_hi:     .byte >s_pq0, >s_pq1, >s_pq2
s_g0:      .byte "*scribbles*", 0
s_g1:      .byte "Excellent.", 0
s_g2:      .byte "Noted!", 0
s_g3:      .byte "Very aligned.", 0
good_lo:   .byte <s_g0, <s_g1, <s_g2, <s_g3
good_hi:   .byte >s_g0, >s_g1, >s_g2, >s_g3
s_b0:      .byte "Hmm...", 0
s_b1:      .byte "Concerning.", 0
s_b2:      .byte "*frowns*", 0
bad_lo:    .byte <s_b0, <s_b1, <s_b2
bad_hi:    .byte >s_b0, >s_b1, >s_b2
s_silence: .byte "Silence noted.", 0
offs:      .byte $f9, $fb, $fd, $fe, 2, 3, 5, 8    ; -7, -5, -3, -2, 2, 3, 5, 8
hair_tab:  .byte 2, 7, 1, 4, 3, 5, 2, 1

.include "gen/mg_review_data.s"

.bss
pool:      .res R_COUNT
opt:       .res OPTIONS
result:    .res QUESTIONS
rep_hair:  .res 1
numbuf:    .res 4
