; Corporate Quiz (src/minigames/quiz.js) as a disk-loaded overlay at $4000.
; A colleague asks a multiple-choice question; pick the best answer before the time runs out.
; ~65 % of the questions come from the department's bank, the rest is water-cooler small talk.
; Score = correct / questions.
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   questions         round(5 + 3d)          5          8   (3 / 4 / 5 / 5 of them from the department)
;   time per question 12 - 6d s              12 s       6 s
;   options           3 below d = 0.3, else 4 (the right answer + all three wrong ones)
; Content: src/data/mg-quiz.js, the department's bank + the general one (gen/mg_quiz_data.s).

.include "api.inc"

MAX_Q     = 8
MAX_OPT   = 4
Q_ALL     = Q_DEPT + Q_GEN
REVEAL_T  = 45                  ; 0.9 s (no skipping, as in the JS)
OPT_Y     = 8                   ; first option box row (boxes of 3 rows)
MSG_Y     = 20
COUNT_Y   = 22
BUBBLE_X  = 6                   ; speech bubble: columns 6-39, rows 2-6, 3 lines of 32
.if .defined(AUTOPLAY)
BOT_T     = 75                  ; the bot answers after 1.5 s
.endif

.zeropage
diff:     .res 1
nq:       .res 1                ; questions
nopt:     .res 1                ; options per question
perq:     .res 2                ; frames per question
qi:       .res 1                ; current question
correct:  .res 1
streak:   .res 1
focus:    .res 1
right:    .res 1                ; option index of the right answer
chosen:   .res 1
reveal:   .res 1                ; frames left on the answer screen, 0 = asking
done:     .res 1
last_key: .res 1                ; number_key of the last frame ($ff = none)
t0:       .res 1
t1:       .res 1
t2:       .res 1
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
sp:       .res 2                ; string pointer while walking an entry
row:      .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department (the content is the department's anyway)
init:
        sta diff
        lda #$ff
        sta last_key
        lda #0
        sta qi
        sta correct
        sta streak
        sta done
        ; questions = 5 + round(3d)
        lda diff
        ldy #3
        jsr mulr
        clc
        adc #5
        sta nq
        ; options: 3 below d = 0.3 (76.5 / 255)
        ldx #3
        lda diff
        cmp #77
        bcc :+
        inx
:       stx nopt
        ; frames per question = 600 - 300d
        lda diff
        ldy #150
        jsr mulr
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda #<600
        sec
        sbc t0
        sta perq
        lda #>600
        sbc t1
        sta perq+1
        ; pick round(0.65 × nq) department questions and the rest from the general bank (partial Fisher-Yates
        ; over each part of the pool), then shuffle them together
        ldx #Q_ALL-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx nq
        lda n_dept-5,x
        sta t2                  ; department questions
        ldx #0                  ; department part: pool[0..Q_DEPT-1]
@pd:    stx t0
        lda #Q_DEPT
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        jsr pick                ; qlist[X] = pool[A], swapped into pool[X]
        cpx t2
        bne @pd
        ldx #Q_DEPT             ; general part: pool[Q_DEPT..]
@pg:    stx t0
        lda #Q_ALL
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        jsr pick
        txa                     ; X - Q_DEPT + department questions = questions picked
        sec
        sbc #Q_DEPT
        clc
        adc t2
        cmp nq
        bne @pg
        ldx nq                  ; qlist: the department ones first, then the general ones -> shuffle
        dex
@sq:    stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda qlist,x
        pha
        lda qlist,y
        sta qlist,x
        pla
        sta qlist,y
        dex
        bne @sq
        ; header
        text 1, 0, s_name, 7
        jmp ask

; t0 = slot X, A = pool index >= X: swap pool[A] into pool[X], append it to qlist. X = next slot.
pick:   tay
        ldx t0
        lda pool,y
        pha
        lda pool,x
        sta pool,y
        pla
        sta pool,x
        sta t1
        txa                     ; qlist slot: X for the department part, X - Q_DEPT + t2 for the general one
        cpx #Q_DEPT
        bcc :+
        sbc #Q_DEPT
        clc
        adc t2
:       tay
        lda t1
        sta qlist,y
        inx
        rts

; A × Y -> A = round(A × Y / 256)
mulr:   jsr mul8
        ldx m_lo
        cpx #$80
        adc #0
        rts

; A × Y -> A = high byte, m_lo = low byte (X = 0)
mul8:   sta m_a
        sty m_b
        lda #0
        ldx #8
@l:     lsr m_a
        bcc :+
        clc
        adc m_b
:       ror
        ror m_lo
        dex
        bne @l
        rts

; Set up and draw question qi.
ask:
        lda #0
        sta reveal
        sta focus
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; options: the right answer (string 3) and nopt - 1 of the three wrong ones (strings 4-6), shuffled
        ldx #3
:       txa
        clc
        adc #3
        sta opt_str,x
        dex
        bpl :-                  ; opt_str = 3, 4, 5, 6
        ldx #3                  ; shuffle the wrong ones (1..3): the first nopt - 1 are a random sample
@d:     stx t1
        txa
        jsr API_RMOD            ; 0..x-1
        tay
        iny                     ; 1..x
        ldx t1
        jsr swap_opt
        dex
        cpx #1
        bne @d
        ldx nopt                ; shuffle the nopt options
        dex
@shuf:  stx t1
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t1
        jsr swap_opt
        dex
        bne @shuf
        ldx nopt
        dex
:       lda opt_str,x
        cmp #3
        beq :+
        dex
        bpl :-
:       stx right
        ; screen: the colleague (a new face each question) and the speech bubble
        lda #2
        ldx #22
        jsr clear_rows
        jsr draw_counter
        jsr API_RAND
        and #7
        tax
        lda hair_tab,x
        ldx #2
        ldy #3
        jsr face
        lda #1
        sta COLOR
        lda #40 - BUBBLE_X
        sta FILL_W
        lda #5
        sta FILL_H
        ldx #BUBBLE_X
        ldy #2
        jsr API_BOX
        lda #'<'
        ldx #BUBBLE_X
        ldy #3
        jsr API_PUTC            ; bubble tail
        lda #0
        sta t2
:       lda t2
        clc
        adc #3
        tay
        lda t2
        jsr print_bubble
        inc t2
        lda t2
        cmp #3
        bne :-
        jsr draw_options
        lda #<s_keys3
        ldx #>s_keys3
        ldy nopt
        cpy #4
        bne :+
        lda #<s_keys4
        ldx #>s_keys4
:       jsr footer
        lda perq
        ldx perq+1
        jmp timer_start

; X, Y = option slots to swap (keeps X)
swap_opt:
        lda opt_str,x
        pha
        lda opt_str,y
        sta opt_str,x
        pla
        sta opt_str,y
        rts

; Line A (0-2) of the question, centred in the bubble on row Y.
print_bubble:
        sty t1
        jsr entry_str
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #38 - BUBBLE_X
        lsr
        clc
        adc #BUBBLE_X + 1
        tax
        ldy t1
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        jmp API_PRINT

; sp = string A of the current question's entry (0-2 question lines, 3 right answer, 4-6 wrong ones).
entry_str:
        sta t0
        ldx qi
        ldy qlist,x
        lda quiz_lo,y
        sta sp
        lda quiz_hi,y
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

; Option boxes across the screen: idle blue, focus yellow; after the answer the right one green, a wrong pick red.
draw_options:
        lda #0
        sta t1
@o:     ldx t1
        lda #6                  ; idle: blue
        cpx focus
        bne :+
        ldy reveal
        bne :+
        lda #7                  ; focus: yellow
:       ldy reveal
        beq @col
        lda #6
        cpx right
        bne :+
        lda #5                  ; the right answer: green
        bne @col
:       cpx chosen
        bne @col
        lda #2                  ; wrong pick: red
@col:   sta COLOR
        lda #40
        sta FILL_W
        lda #3
        sta FILL_H
        lda t1
        asl
        adc t1
        adc #OPT_Y
        tay
        ldx #0
        jsr API_BOX
        lda t1
        asl
        adc t1
        adc #OPT_Y+1
        tay
        lda t1
        clc
        adc #'1'
        ldx #2
        jsr kputc
        sty row
        ldx t1
        lda opt_str,x
        jsr entry_str
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        ldx #4
        ldy row
        jsr API_PRINT
        inc t1
        lda t1
        cmp nopt
        bne @o
        rts

; "q/n" top right, "Correct: n" and the streak on the bottom row.
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
        lda nq
        jsr API_NUM
        text 1, COUNT_Y, s_correct, 1
        ldx #10
        ldy #COUNT_Y
        lda correct
        jsr API_NUM
        lda streak
        cmp #2
        bcc :+
        text 30, COUNT_Y, s_streak, 7
        ldx #38
        ldy #COUNT_Y
        lda streak
        jmp API_NUM
:       lda #12
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #28
        ldy #COUNT_Y
        lda #' '
        jmp API_FILL

; One frame. C=1 when the game is over.
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
        lda qi
        cmp nq
        bne :+
        jmp finish
:       jsr ask
@wait:  clc
        rts
@ask:   jsr timer_tick
        bcc :+
        lda #$ff                ; time's up
        jmp answer
:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #BOT_T
        bne :+
        lda right
        jmp answer
:
.endif
        jsr number_key          ; keys 1-4, on the press only
        cmp last_key
        sta last_key
        beq :+
        cmp nopt
        bcs :+
        jmp answer
:       lda JOYP
        and #J_DOWN
        beq :+
        inc focus
        lda focus
        cmp nopt
        bcc @moved
        lda #0
        sta focus
        beq @moved
:       lda JOYP
        and #J_UP
        beq :+
        dec focus
        bpl @moved
        ldx nopt
        dex
        stx focus
        jmp @moved
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
        cmp right
        bne @wrong
        inc correct
        inc streak
        lda #SFX_GOOD
        jsr API_SFX
        lda streak
        cmp #3
        bcc :+
        ora #'0'                ; "Streak xN!" (N <= 8)
        sta s_streak_n
        lda #<s_streak2
        ldx #>s_streak2
        ldy #5
        bne @msg
:       lda #<s_good
        ldx #>s_good
        ldy #5
        bne @msg
@wrong: lda #0
        sta streak
        lda #SFX_BAD
        jsr API_SFX
        ldy #2
        lda chosen
        bmi :+
        lda #<s_bad
        ldx #>s_bad
        bne @msg
:       lda #<s_timeup
        ldx #>s_timeup
@msg:   sty t0
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
        lda #REVEAL_T
        sta reveal
        jsr draw_options
        jsr draw_counter
        clc
        rts

; score = correct × 255 / nq
finish:
        lda correct
        ldy #255
        jsr mul8                ; A:m_lo = correct × 255
        ldx #8                  ; 16 / 8 division, quotient in m_lo
@div:   asl m_lo
        rol
        bcs @sub
        cmp nq
        bcc :+
@sub:   sbc nq
        inc m_lo
:       dex
        bne @div
        lda m_lo
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Corporate Quiz", 0
s_help:    .byte "Pick the best answer before time runs out.", 0
s_keys3:   .byte "Up/down + FIRE, or keys 1-3", 0
s_keys4:   .byte "Up/down + FIRE, or keys 1-4", 0
s_correct: .byte "Correct:", 0
s_streak:  .byte "Streak x", 0
s_good:    .byte "Correct!", 0
s_bad:     .byte "Awkward...", 0
s_timeup:  .byte "Out of time!", 0
hair_tab:  .byte 2, 7, 1, 4, 3, 5, 2, 1
n_dept:    .byte 3, 4, 5, 5     ; min(bank, round(0.65 × questions)) for 5-8 questions (every bank has >= 5)

.include "gen/mg_quiz_data.s"

.data
s_streak2: .byte "Streak x"
s_streak_n: .byte "3!", 0

.bss
pool:      .res Q_ALL
qlist:     .res MAX_Q
opt_str:   .res MAX_OPT
