; Jargon Decoder (src/minigames/jargon.js) as a disk-loaded overlay at $4000.
; The boss drops a buzzword; pick what it REALLY means. Score = correct / questions.
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   questions         round(5 + 3d)          5          8
;   time per question 11 - 5d s              11 s       6 s
;   options           3 below d = 0.3, else 4 (the honest meaning + all three decoys)
; The speaker's title follows the department (X at init). Content: src/data/mg-jargon.js (gen/mg_jargon_data.s:
; the entries that fit the screen, in pool order, as many as fit the overlay).

.include "api.inc"

MAX_Q     = 8
MAX_OPT   = 4
REVEAL_T  = 70                  ; 1.4 s
SKIP_T    = REVEAL_T - 15       ; FIRE moves on after 0.3 s
OPT_Y     = 8                   ; first option box row (boxes of 3 rows)
MSG_Y     = 20
COUNT_Y   = 22
.if .defined(AUTOPLAY)
BOT_T     = 75                  ; the bot answers after 1.5 s
.endif

.zeropage
diff:     .res 1
dept:     .res 1
nq:       .res 1                ; questions
nopt:     .res 1                ; options per question
perq:     .res 2                ; frames per question
qi:       .res 1                ; current question
correct:  .res 1
streak:   .res 1
focus:    .res 1
right:    .res 1                ; option index of the honest meaning
chosen:   .res 1
reveal:   .res 1                ; frames left on the answer screen, 0 = asking
done:     .res 1
last_key: .res 1                ; number_key of the last frame ($ff = none)
t0:       .res 1
t1:       .res 1
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

; A = difficulty, X = department
init:
        sta diff
        lda #$ff
        sta last_key
        cpx #8
        bcc :+
        ldx #0
:       stx dept
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
        ; frames per question = 550 - 250d
        lda diff
        ldy #250
        jsr mulr
        sta t0
        lda #<550
        sec
        sbc t0
        sta perq
        lda #>550
        sbc #0
        sta perq+1
        ; pick nq distinct entries: partial Fisher-Yates over 0..J_COUNT-1
        ldx #J_COUNT-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
@pick:  stx t0
        lda #J_COUNT
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
        cpx nq
        bne @pick
        jsr API_RAND
        and #7
        tax
        lda hair_tab,x
        sta boss_hair
        ; header
        text 1, 0, s_name, 7
        jmp ask

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
        ; options: the answer (string 2) and nopt - 1 of the three decoys (strings 3-5), shuffled
        ldx #3
:       txa
        clc
        adc #2
        sta opt_str,x
        dex
        bpl :-                  ; opt_str = 2, 3, 4, 5
        ldx #3                  ; shuffle the decoys (1..3): the first nopt - 1 are a random sample
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
        cmp #2
        beq :+
        dex
        bpl :-
:       stx right
        ; screen
        lda #2
        ldx #22
        jsr clear_rows
        jsr draw_counter
        ldx #3
        ldy #3
        lda boss_hair
        jsr face
        ldx dept                ; the speaker's title
        lda spk_lo,x
        sta PTR
        lda spk_hi,x
        sta PTR+1
        lda #7
        sta COLOR
        ldx #1
        ldy #6
        jsr API_PRINT
        lda #1
        sta COLOR
        lda #32
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #8
        ldy #2
        jsr API_BOX
        lda #'<'
        ldx #8
        ldy #3
        jsr API_PUTC            ; bubble tail
        lda #0
        ldy #3
        jsr print_bubble
        lda #1
        ldy #4
        jsr print_bubble
        text 1, 7, s_means, 3
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

; Line A (0/1) of the buzzword, centred in the bubble on row Y.
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
        adc #30
        lsr
        clc
        adc #9
        tax
        ldy t1
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        jmp API_PRINT

; sp = string A of the current question's entry (0-1 buzzword lines, 2 answer, 3-5 decoys).
entry_str:
        sta t0
        ldx qi
        ldy pool,x
        lda jargon_lo,y
        sta sp
        lda jargon_hi,y
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

; Option boxes across the screen: idle blue, focus yellow; after the answer the honest one green, a wrong pick red.
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
        lda #5                  ; the honest meaning: green
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

; "q/n" top right, "Decoded: n" and the streak bottom row.
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
        text 1, COUNT_Y, s_decoded, 1
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
        beq @next
        lda reveal
        cmp #SKIP_T
        bcs @wait
        lda JOYP
        and #J_FIRE
        beq @wait
@next:  inc qi
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
        ora #'0'                ; "Fluent in corporate xN!" (N <= 8)
        sta s_fluent_n
        lda #<s_fluent
        ldx #>s_fluent
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
        lda #<s_next
        ldx #>s_next
        jsr footer
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
s_name:    .byte "Jargon Decoder", 0
s_help:    .byte "Pick what the buzzword REALLY means.", 0
s_means:   .byte "What it REALLY means:", 0
s_keys3:   .byte "Up/down + FIRE, or keys 1-3", 0
s_keys4:   .byte "Up/down + FIRE, or keys 1-4", 0
s_next:    .byte "FIRE: next", 0
s_decoded: .byte "Decoded:", 0
s_streak:  .byte "Streak x", 0
s_good:    .byte "Synergised!", 0
s_bad:     .byte "Needs more buzzwords", 0
s_timeup:  .byte "Time's up!", 0
hair_tab:  .byte 2, 7, 1, 4, 3, 5, 2, 1
; SPEAKERS in jargon.js, by department (DEPARTMENTS order)
spk0:      .byte "Office Manager", 0
spk1:      .byte "Team Lead", 0
spk2:      .byte "Sales VP", 0
spk3:      .byte "Brand Director", 0
spk4:      .byte "Architect", 0
spk5:      .byte "CFO", 0
spk6:      .byte "HR Partner", 0
spk7:      .byte "The CEO", 0
spk_lo:    .byte <spk0, <spk1, <spk2, <spk3, <spk4, <spk5, <spk6, <spk7
spk_hi:    .byte >spk0, >spk1, >spk2, >spk3, >spk4, >spk5, >spk6, >spk7

.include "gen/mg_jargon_data.s"

.data
s_fluent:  .byte "Fluent in corporate x"
s_fluent_n: .byte "3!", 0

.bss
pool:      .res J_COUNT
opt_str:   .res MAX_OPT
boss_hair: .res 1
