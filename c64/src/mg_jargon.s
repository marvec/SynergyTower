; Jargon Decoder (src/minigames/jargon.js) as a disk-loaded overlay at $4000.
; The boss drops a buzzword; pick what it REALLY means. Difficulty 0 (floor 1): 5 questions, 3 options,
; 11 s each. Score = correct / questions. Content: src/data/mg-jargon.js (gen/mg_jargon_data.s).

.include "api.inc"

QUESTIONS = 5
OPTIONS   = 3
PER_Q     = 11 * 50
REVEAL_T  = 70                  ; 1.4 s
SKIP_T    = REVEAL_T - 15       ; FIRE moves on after 0.3 s
OPT_Y     = 10                  ; first option box row

.zeropage
qi:       .res 1                ; current question
correct:  .res 1
streak:   .res 1
focus:    .res 1
right:    .res 1                ; option index of the honest meaning
chosen:   .res 1
reveal:   .res 1                ; frames left on the answer screen, 0 = asking
done:     .res 1
t0:       .res 1
t1:       .res 1
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

init:
        lda #0
        sta qi
        sta correct
        sta streak
        sta done
        ; pick QUESTIONS distinct entries: partial Fisher-Yates over 0..J_COUNT-1
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
        cpx #QUESTIONS
        bne @pick
        jsr API_RAND
        and #7
        tax
        lda hair_tab,x
        sta boss_hair
        ; header
        text 1, 0, s_name, 7
        jmp ask

; Set up and draw question qi.
ask:
        lda #0
        sta reveal
        sta focus
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; options: the answer (string 2) and two of the three decoys (strings 3-5), shuffled
        lda #3
        jsr API_RMOD            ; the decoy left out
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
        lda #2
        sta opt_str,x           ; X = 2
        ldx #OPTIONS-1          ; shuffle
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
        ldx #OPTIONS-1
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
        text 0, 6, s_speaker, 7
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
        text 1, 8, s_means, 3
        jsr draw_options
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<PER_Q
        ldx #>PER_Q
        jmp timer_start

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
        lda #38
        sta FILL_W
        lda #3
        sta FILL_H
        lda t1
        asl
        adc t1
        adc #OPT_Y
        tay
        ldx #1
        jsr API_BOX
        lda t1
        asl
        adc t1
        adc #OPT_Y+1
        tay
        lda t1
        clc
        adc #'1'
        ldx #3
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
        ldx #5
        ldy row
        jsr API_PRINT
        inc t1
        lda t1
        cmp #OPTIONS
        bne @o
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
        jsr API_NUM
        text 1, 22, s_decoded, 1
        ldx #10
        ldy #22
        lda correct
        jsr API_NUM
        lda streak
        cmp #2
        bcc :+
        text 28, 22, s_streak, 7
        ldx #37
        ldy #22
        lda streak
        jmp API_NUM
:       lda #12
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #28
        ldy #22
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
        cmp #QUESTIONS
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
:       lda focus
        sta t1
        lda JOYP
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
        cmp right
        bne @wrong
        inc correct
        inc streak
        lda #SFX_GOOD
        jsr API_SFX
        lda streak
        cmp #3
        bcc :+
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
        lda #20
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #20
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

; score = correct × 255 / 5
finish:
        lda correct
        asl
        asl
        asl
        asl
        asl
        sta t0                  ; × 32
        lda correct
        asl
        asl
        asl
        asl                     ; × 16
        clc
        adc t0
        sta t0
        lda correct
        asl                     ; × 2
        adc t0
        adc correct             ; × 51
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Jargon Decoder", 0
s_help:    .byte "Pick what the buzzword REALLY means.", 0
s_speaker: .byte "Office Mgr", 0
s_means:   .byte "What it REALLY means:", 0
s_keys:    .byte "Up/down + FIRE, or keys 1-3", 0
s_next:    .byte "FIRE: next", 0
s_decoded: .byte "Decoded:", 0
s_streak:  .byte "Streak x", 0
s_good:    .byte "Synergised!", 0
s_fluent:  .byte "Fluent in corporate!", 0
s_bad:     .byte "Needs more buzzwords", 0
s_timeup:  .byte "Time's up!", 0
hair_tab:  .byte 2, 7, 1, 4, 3, 5, 2, 1

.include "gen/mg_jargon_data.s"

.bss
pool:      .res J_COUNT
opt_str:   .res OPTIONS
boss_hair: .res 1
