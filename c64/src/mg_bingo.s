; Meeting Buzzword Bingo (src/minigames/bingo.js) as a disk-loaded overlay at $4000.
; Colleagues blurt buzzwords; press FIRE while one on your card is being said (the JS keyboard rule: Space marks
; the current word). Every word of `target` random lines is said, plus 1-2 more card words and distractors from
; the rest of the pool; the sequence is trimmed to fit 85 s (distractors first).
; Score = 0.6 × min(1, lines / target) + 0.4 × hits / (hits + misses + wrong presses).
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   card           3 × 3 below d = 0.5, else 4 × 4
;   lines to win   1 below d = 0.34, 2 below d = 0.67, else 3
;   word time      2.6 - 1.45d s (+ 0.3 s gap) 2.6 s    1.15 s
;   distractors    round(card words said × (0.7 + 0.8d))
;   time limit     words × (word time + gap) + 3 s
; Content: src/data/mg-bingo.js, the department's words + the shared ones (gen/mg_bingo_data.s).

.include "api.inc"

MAX_CELLS = 16
MAX_LINES = 10
MAX_SEQ   = 40                  ; 16 card words + round(16 × 1.5) distractors
GAP       = 15                  ; 0.3 s of silence
LIMIT     = 85 * 50             ; the word sequence fits 85 s
CARD_Y    = 12
.if .defined(AUTOPLAY)
BOT_T     = 20                  ; the bot marks a card word 0.4 s in
.endif

.zeropage
diff:     .res 1
size:     .res 1                ; 3 or 4
cells:    .res 1
nlines:   .res 1                ; lines on the card (8 or 10)
target:   .res 1                ; lines to win
dur:      .res 1                ; frames per word
warn:     .res 1                ; the word turns red for its last 35 %
seq_len:  .res 1
idx:      .res 1                ; current word in seq, $ff before the first
word_t:   .res 1                ; frames left of the word, 0 = gap
gap_t:    .res 1
handled:  .res 1
hits:     .res 1
misses:   .res 1
wrong:    .res 1
lines:    .res 1
speaker:  .res 1
done:     .res 1
msg_t:    .res 1
cur_cell: .res 1                ; card cell of the current word, $ff = not on the card
t0:       .res 1
t1:       .res 1
t2:       .res 1
ci:       .res 1
cx:       .res 1
cy:       .res 1
sp:       .res 2
tot:      .res 2
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
divisor:  .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department (the content is the department's anyway)
init:
        sta diff
        lda #0
        sta hits
        sta misses
        sta wrong
        sta lines
        sta speaker
        sta done
        sta msg_t
        sta word_t
        lda #1
        sta gap_t
        lda #$ff
        sta idx
        ; card: 3 × 3 (8 lines) below d = 0.5, else 4 × 4 (10 lines)
        ldx #3
        ldy #9
        lda #8
        sta nlines
        lda diff
        cmp #128
        bcc :+
        inx
        ldy #16
        lda #10
        sta nlines
:       stx size
        sty cells
        ; lines to win: 1, 2 from d = 0.34 (D 87), 3 from 0.67 (171)
        ldx #1
        lda diff
        cmp #87
        bcc :+
        inx
        cmp #171
        bcc :+
        inx
:       stx target
        ; word time = 130 - 72.5d frames, red for the last 35 %
        lda diff
        ldy #72
        jsr mulr
        eor #$ff
        sec
        adc #130
        sta dur
        ldy #90
        jsr mulr
        sta warn
        ; shuffle all words: the card is the first cells, the rest are distractors
        ldx #W_COUNT-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #W_COUNT-1
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda pool,x
        pha
        lda pool,y
        sta pool,x
        pla
        sta pool,y
        dex
        bne @shuf
        ldx #MAX_CELLS-1
        lda #0
:       sta marked,x
        sta spoken,x
        dex
        bpl :-
        ; `target` distinct random lines are said in full (partial Fisher-Yates over the lines)
        ldx #MAX_LINES-1
:       txa
        sta lpool,x
        dex
        bpl :-
        ldx #0
@line:  stx t0
        lda nlines
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda lpool,y
        pha
        lda lpool,x
        sta lpool,y
        pla
        sta lpool,x
        jsr line_ptr            ; sp -> the line's cells
        ldy size
        dey
:       lda (sp),y
        tax
        lda #1
        sta spoken,x
        dey
        bpl :-
        ldx t0
        inx
        cpx target
        bne @line
        ; plus 1-2 random cells
        lda #2
        jsr API_RMOD
        sta t1
        inc t1
:       lda cells
        jsr API_RMOD
        tax
        lda #1
        sta spoken,x
        dec t1
        bne :-
        ; seq = the spoken card words + round(count × (0.7 + 0.8d)) distractors
        ldx #0
        ldy #0
:       lda spoken,x
        beq :+
        lda pool,x
        sta seq,y
        iny
:       inx
        cpx cells
        bne :--
        sty seq_len
        lda diff                ; factor × 256 = 179 + 205d (t1:t0)
        ldy #205
        jsr mulr
        clc
        adc #179
        sta t0
        lda #0
        adc #0
        sta t1
        lda #128                ; count × factor + 128, high byte = the rounded distractor count
        sta m_lo
        lda #0
        ldx seq_len
:       pha
        lda m_lo
        clc
        adc t0
        sta m_lo
        pla
        adc t1
        dex
        bne :-
        sta t2                  ; distractors
        ; trim: at most 4250 / (dur + gap) words in all, the card words kept
        lda dur
        clc
        adc #GAP
        sta divisor
        lda #<LIMIT
        sta m_lo
        lda #>LIMIT
        jsr udiv                ; A = most words
        sec
        sbc seq_len
        bcs :+
        lda #0
:       cmp t2
        bcs :+
        sta t2
:       lda t2
        beq @nodis
@dis:   lda #W_COUNT            ; a random distractor (repeats allowed, as rng.pick)
        sec
        sbc cells
        jsr API_RMOD
        clc
        adc cells
        tax
        lda pool,x
        ldy seq_len
        sta seq,y
        inc seq_len
        dec t2
        bne @dis
@nodis: ldy seq_len             ; shuffle seq
        dey
        beq @screen
@sq:    sty t0
        tya
        clc
        adc #1
        jsr API_RMOD
        tax
        ldy t0
        lda seq,y
        pha
        lda seq,x
        sta seq,y
        pla
        sta seq,x
        dey
        bne @sq
@screen:
        text 1, 0, s_name, 7
        jsr draw_lines
        ; speakers: faces and names
        ldx #3
:       stx t0
        lda hair_tab,x
        pha
        lda face_x,x
        tax
        ldy #3
        pla
        jsr face
        ldx t0
        dex
        bpl :-
        jsr draw_speakers
        center 11, s_bingo, 7
        ldx cells
        dex
:       stx ci
        txa
        jsr draw_cell
        ldx ci
        dex
        bpl :-
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        ; total time = words × (word time + gap) + 3 s
        lda #150
        sta tot
        lda #0
        sta tot+1
        ldx seq_len
:       lda tot
        clc
        adc divisor
        sta tot
        bcc :+
        inc tot+1
:       dex
        bne :--
        lda tot
        ldx tot+1
        jmp timer_start

; A = line: sp -> its cells (size bytes)
line_ptr:
        ldy size
        cpy #4
        beq :+
        sta m_a
        asl                     ; × 3
        adc m_a
        adc #<line3
        sta sp
        lda #>line3
        adc #0
        sta sp+1
        rts
:       asl                     ; × 4
        asl
        adc #<line4
        sta sp
        lda #>line4
        adc #0
        sta sp+1
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

; A:m_lo / divisor -> A (A < divisor)
udiv:   ldx #8
@div:   asl m_lo
        rol
        bcs @sub
        cmp divisor
        bcc :+
@sub:   sbc divisor
        inc m_lo
:       dex
        bne @div
        lda m_lo
        rts

draw_speakers:
        ldx #3
:       stx t1
        jsr draw_speaker
        ldx t1
        dex
        bpl :-
        rts

; X = speaker 0..3: name under the face, yellow while talking.
draw_speaker:
        lda #6
        cpx speaker
        bne :+
        ldy word_t
        beq :+
        lda #7
:       sta COLOR
        lda speakers_lo,x
        sta PTR
        lda speakers_hi,x
        sta PTR+1
        lda speakers_len,x
        lsr
        eor #$ff
        sec
        adc face_x,x            ; centred under the 2-char face
        tax
        inx
        ldy #5
        jmp API_PRINT

; A = cell: 3 × 3: a framed 13 × 4 cell, the word in 2 lines of 11; 4 × 4: a 10 × 3 cell without a frame, 2 lines
; of 9 in a checkerboard of white and yellow. Green once marked.
draw_cell:
        sta t1
        tax
        ldy size
        cpy #4
        beq @small
        lda cell3_x,x
        sta cx
        lda cell3_y,x
        sta cy
        ldy #6
        lda marked,x
        beq :+
        ldy #5
:       sty COLOR
        lda #13
        sta FILL_W
        lda #4
        sta FILL_H
        ldx cx
        ldy cy
        jsr API_BOX
        inc cy                  ; text rows inside the frame
        lda #1                  ; strings 1-2
        ldx #11
        bne @text
@small: txa
        and #3
        tay
        lda cell4_x,y
        sta cx
        txa
        lsr
        lsr
        tay
        lda cell4_y,y
        sta cy
        lda #3                  ; strings 3-4 (up to 9 wide), centred in the 10 columns
        ldx #10
@text:  sta t0                  ; first string
        stx t2                  ; columns to centre in (3 × 3: the 11 inside the frame)
        ldx t1
        lda pool,x
        tax
        lda words_lo,x
        sta sp
        lda words_hi,x
        sta sp+1
:       jsr next_str
        dec t0
        bne :-
        ldx #1                  ; colour: green marked, else white (4 × 4: yellow on every other cell)
        ldy t1
        lda marked,y
        beq :+
        ldx #5
        bne @col
:       lda size
        cmp #4
        bne @col
        tya
        lsr
        lsr
        eor t1
        lsr
        bcc @col
        ldx #7
@col:   stx COLOR
        lda #2
        sta t0                  ; lines left
@line:  ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc t2
        lsr
        clc
        adc cx
        tax
        lda size
        cmp #4
        beq :+
        inx                     ; 3 × 3: inside the frame
:       ldy cy
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        jsr API_PRINT
        jsr next_str
        inc cy
        dec t0
        bne @line
        rts

; sp -> the string after the current one.
next_str:
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
:       rts

; "Lines n/t" top right
draw_lines:
        text 31, 0, s_lines, 1
        ldx #37
        ldy #0
        lda lines
        jsr API_NUM
        ldx #39
        ldy #0
        lda target
        jmp API_NUM

; The speech bubble with the current word (or "...").
draw_bubble:
        lda #7
        ldx #3
        jsr clear_rows
        jsr draw_speakers
        lda word_t
        bne :+
        center 8, s_dots, 6
        rts
:       ldx idx
        lda seq,x
        tax
        lda words_lo,x
        sta sp
        lda words_hi,x
        sta sp+1
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #4
        sta FILL_W
        lda #3
        sta FILL_H
        lda #1
        sta COLOR
        lda #40
        sec
        sbc FILL_W
        lsr
        tax
        ldy #7
        jsr API_BOX
        ; fall through
draw_word:
        lda #1
        ldx word_t
        cpx warn
        bcs :+
        lda #2
:       sta COLOR
        ldx idx
        ldy seq,x
        ldx words_hi,y
        lda words_lo,y
        ldy #8
        jmp API_CENTER

; A/X = message, Y = colour: row 10 for a second.
message:
        sty t0
        pha
        txa
        pha
        lda #10
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #10
        jsr API_CENTER
        lda #50
        sta msg_t
        rts

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
        lda #10
        ldx #1
        jsr clear_rows
:       jsr timer_tick
        bcc :+
        jmp finish
:       lda word_t
        beq @gap
        dec word_t
        beq @expired
        lda word_t
        cmp warn
        bne @input
        jsr draw_word           ; turns red
        jmp @input
@expired:
        ldx cur_cell            ; a card word nobody marked
        bmi :+
        lda marked,x
        bne :+
        lda handled
        bne :+
        inc misses
        lda #<s_missed
        ldx #>s_missed
        ldy #7
        jsr message
:       lda #GAP
        sta gap_t
        jsr draw_bubble
        jmp @input
@gap:   dec gap_t
        bne @input
        inc idx                 ; next word
        lda idx
        cmp seq_len
        bcc :+
        jmp finish
:       lda dur
        sta word_t
        lda #0
        sta handled
        lda #3
        jsr API_RMOD
        sec
        adc speaker
        and #3
        sta speaker
        ldx idx                 ; which cell holds it?
        lda seq,x
        ldx cells
        dex
:       cmp pool,x
        beq :+
        dex
        bpl :-
:       stx cur_cell
        jsr draw_bubble
@input:
.if .defined(AUTOPLAY)
        lda dur                 ; perfect player: mark card words 0.4 s in
        sec
        sbc #BOT_T
        cmp word_t
        bne :+
        ldx cur_cell
        bmi :+
        lda #J_FIRE
        sta JOYP
:
.endif
        lda JOYP
        and #J_FIRE
        beq @out
        lda word_t
        beq @out
        ldx cur_cell
        bmi @notcard
        lda marked,x
        bne @out
        lda #1
        sta marked,x
        sta handled
        inc hits
        txa
        jsr draw_cell
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_marked
        ldx #>s_marked
        ldy #5
        jsr message
        lda lines
        sta t2
        jsr count_lines
        lda lines
        cmp t2
        beq @out
        jsr draw_lines          ; a new line
        lda lines
        cmp target
        bcs @bingo
        lda #<s_line
        ldx #>s_line
        ldy #7
        jsr message
        jmp @out
@bingo: lda #<s_bingo2
        ldx #>s_bingo2
        ldy #7
        jsr message
        jmp finish
@notcard:
        inc wrong
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_notcard
        ldx #>s_notcard
        ldy #2
        jsr message
@out:   clc
        rts

; lines = complete lines on the card
count_lines:
        lda #0
        sta lines
        sta ci
@l:     lda ci
        jsr line_ptr
        ldy size
        dey
:       lda (sp),y
        tax
        lda marked,x
        beq @no
        dey
        bpl :-
        inc lines
@no:    inc ci
        lda ci
        cmp nlines
        bne @l
        rts

; score = 153 × min(lines, target) / target + 102 × hits / (hits + misses + wrong)
finish:
        lda target
        sta divisor
        lda lines
        cmp target
        bcc :+
        lda target
:       ldy #153
        jsr mul8
        jsr udiv
        sta t2
        lda hits
        clc
        adc misses
        adc wrong
        beq @store
        sta divisor
        lda hits
        ldy #102
        jsr mul8
        jsr udiv
        clc
        adc t2
        sta t2
@store: lda t2
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Meeting Buzzword Bingo", 0
s_help:    .byte "FIRE when a word on your card is said.", 0
s_keys:    .byte "FIRE = mark the word on your card", 0
s_lines:   .byte "Lines  /", 0
s_bingo:   .byte "B  I  N  G  O", 0
s_dots:    .byte "...", 0
s_marked:  .byte "Marked!", 0
s_missed:  .byte "Missed!", 0
s_notcard: .byte "Not on card!", 0
s_line:    .byte "Line!", 0
s_bingo2:  .byte "BINGO!", 0
face_x:    .byte 4, 14, 24, 34
hair_tab:  .byte 2, 1, 4, 7
cell3_x:   .byte 1, 14, 27, 1, 14, 27, 1, 14, 27
cell3_y:   .byte CARD_Y, CARD_Y, CARD_Y, CARD_Y + 4, CARD_Y + 4, CARD_Y + 4, CARD_Y + 8, CARD_Y + 8, CARD_Y + 8
cell4_x:   .byte 0, 10, 20, 30
cell4_y:   .byte CARD_Y, CARD_Y + 3, CARD_Y + 6, CARD_Y + 9
; rows, columns, diagonals
line3:     .byte 0, 1, 2,  3, 4, 5,  6, 7, 8,  0, 3, 6,  1, 4, 7,  2, 5, 8,  0, 4, 8,  2, 4, 6
line4:     .byte 0, 1, 2, 3,  4, 5, 6, 7,  8, 9, 10, 11,  12, 13, 14, 15
           .byte 0, 4, 8, 12,  1, 5, 9, 13,  2, 6, 10, 14,  3, 7, 11, 15
           .byte 0, 5, 10, 15,  3, 6, 9, 12

.include "gen/mg_bingo_data.s"

.bss
pool:      .res W_COUNT          ; shuffled word indexes, the card is pool[0..cells-1]
marked:    .res MAX_CELLS
spoken:    .res MAX_CELLS
lpool:     .res MAX_LINES        ; line indexes, for picking the lines that are said
seq:       .res MAX_SEQ
