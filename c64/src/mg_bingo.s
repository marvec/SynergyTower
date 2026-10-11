; Meeting Buzzword Bingo (src/minigames/bingo.js) as a disk-loaded overlay at $4000.
; Colleagues blurt buzzwords; press FIRE while one on your card is being said. Difficulty 0 (floor 1):
; 3 × 3 card, one line wins, 2.6 s per word. Every word of one line is said, plus 1-2 more card words and
; ~70 % distractors. Score = 0.6 × line done + 0.4 × hits / (hits + misses + wrong presses).
; Content: src/data/mg-bingo.js, lobby + shared words (gen/mg_bingo_data.s).

.include "api.inc"

SIZE     = 3
CELLS    = SIZE * SIZE
LINES    = 8
DUR      = 130                  ; 2.6 s per word
GAP      = 15                   ; 0.3 s of silence
WARN     = 45                   ; the word turns red for its last 0.9 s
CELL_W   = 13
CELL_H   = 4
CARD_Y   = 12
MAX_SEQ  = 16

.zeropage
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

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

init:
        lda #0
        sta hits
        sta misses
        sta wrong
        sta lines
        sta speaker
        sta done
        sta msg_t
        sta word_t
        sta seq_len
        lda #1
        sta gap_t
        lda #$ff
        sta idx
        ; shuffle all words: the card is the first 9, the rest are distractors
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
        ldx #CELLS-1
        lda #0
:       sta marked,x
        sta spoken,x
        dex
        bpl :-
        ; one random line is said in full, plus 1-2 random cells
        lda #LINES
        jsr API_RMOD
        sta t0
        asl
        adc t0
        tax                     ; × 3: offset into line_tab
        ldy #SIZE
:       lda line_tab,x
        sta t1
        stx t2
        ldx t1
        lda #1
        sta spoken,x
        ldx t2
        inx
        dey
        bne :-
        lda #2
        jsr API_RMOD
        tay
        iny                     ; 1-2 extras
:       lda #CELLS
        jsr API_RMOD
        tax
        lda #1
        sta spoken,x
        dey
        bne :-
        ; seq = the spoken card words + round(0.7 × count) distractors
        ldx #0
        ldy #0
:       lda spoken,x
        beq :+
        lda pool,x
        sta seq,y
        iny
:       inx
        cpx #CELLS
        bne :--
        lda dis_tab,y           ; round(0.7 × card words said)
        tax
        beq @nodis
@dis:   lda #W_COUNT - CELLS
        jsr API_RMOD
        clc
        adc #CELLS
        stx t1
        tax
        lda pool,x
        ldx t1
        sta seq,y
        iny
        dex
        bne @dis
@nodis: sty seq_len
        dey                     ; shuffle seq
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
        ldx #CELLS-1
:       stx ci
        txa
        jsr draw_cell
        ldx ci
        dex
        bpl :-
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        ; total time = words × 2.9 s + 3 s
        lda #150
        sta tot
        lda #0
        sta tot+1
        ldx seq_len
:       lda tot
        clc
        adc #DUR + GAP
        sta tot
        bcc :+
        inc tot+1
:       dex
        bne :--
        lda tot
        ldx tot+1
        jmp timer_start

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

; A = cell: frame and the word in 2 lines; green once marked.
draw_cell:
        sta t1
        tax
        lda cell_x,x
        sta cx
        lda cell_y,x
        sta cy
        ldy #6
        lda marked,x
        beq :+
        ldy #5
:       sty COLOR
        lda #CELL_W
        sta FILL_W
        lda #CELL_H
        sta FILL_H
        ldx cx
        ldy cy
        jsr API_BOX
        ldx t1
        lda pool,x
        tax
        lda words_lo,x
        sta sp
        lda words_hi,x
        sta sp+1
        jsr next_str            ; skip the full word
        lda #1
        sta t2
@line:  ldx t1
        lda marked,x
        beq :+
        lda #5
        .byte $2c
:       lda #1
        sta COLOR
        ldy #0                  ; centre in the 11 inner columns
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #CELL_W - 2
        lsr
        sec
        adc cx
        tax
        lda cy
        clc
        adc t2
        tay
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        jsr API_PRINT
        jsr next_str
        inc t2
        lda t2
        cmp #3
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

draw_lines:
        text 30, 0, s_lines, 1
        ldx #36
        ldy #0
        lda lines
        jsr API_NUM
        rts

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
:       sty t0                  ; length
        tya
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
        cpx #WARN
        bcs :+
        lda #2
:       sta COLOR
        lda sp
        ldx sp+1
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
        cmp #WARN
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
:       lda #DUR
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
        ldx #CELLS-1
:       cmp pool,x
        beq :+
        dex
        bpl :-
:       stx cur_cell
        jsr draw_bubble
@input:
.if .defined(AUTOPLAY)
        lda word_t              ; perfect player: mark card words half a second in
        cmp #DUR - 25
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
        jsr count_lines
        lda lines
        beq @out                ; target: 1 line
        lda #<s_bingo2
        ldx #>s_bingo2
        ldy #7
        jsr message
        jsr draw_lines
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

count_lines:
        lda #0
        sta lines
        ldx #0
@l:     ldy #SIZE
        stx t1
:       lda line_tab,x
        sty t0
        tay
        lda marked,y
        ldy t0
        cmp #0
        beq @no
        inx
        dey
        bne :-
        inc lines
@no:    lda t1
        clc
        adc #SIZE
        tax
        cpx #LINES * SIZE
        bne @l
        rts

; score = 153 × (line done) + 102 × hits / (hits + misses + wrong)
finish:
        lda #0
        sta t2
        lda lines
        beq :+
        lda #153
        sta t2
:       lda hits
        clc
        adc misses
        adc wrong
        beq @store
        sta t0                  ; divisor
        lda #0                  ; t1:A = 102 × hits
        sta t1
        ldx hits
        beq @store
        lda #0
:       clc
        adc #102
        bcc :+
        inc t1
:       dex
        bne :--
        ldx #0                  ; divide by repeated subtraction
@div:   sec
        sbc t0
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        tya
        inx
        bne @div
@q:     txa
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
s_lines:   .byte "Lines  /1", 0
s_bingo:   .byte "B  I  N  G  O", 0
s_dots:    .byte "...", 0
s_marked:  .byte "Marked!", 0
s_missed:  .byte "Missed!", 0
s_notcard: .byte "Not on card!", 0
s_bingo2:  .byte "BINGO!", 0
face_x:    .byte 4, 14, 24, 34
hair_tab:  .byte 2, 1, 4, 7
cell_x:    .byte 1, 14, 27, 1, 14, 27, 1, 14, 27
cell_y:    .byte CARD_Y, CARD_Y, CARD_Y, CARD_Y + 4, CARD_Y + 4, CARD_Y + 4, CARD_Y + 8, CARD_Y + 8, CARD_Y + 8
dis_tab:   .byte 0, 1, 1, 2, 3, 4, 4
line_tab:  .byte 0, 1, 2,  3, 4, 5,  6, 7, 8,  0, 3, 6,  1, 4, 7,  2, 5, 8,  0, 4, 8,  2, 4, 6

.include "gen/mg_bingo_data.s"

.bss
pool:      .res W_COUNT          ; shuffled word indexes, the card is pool[0..8]
marked:    .res CELLS
spoken:    .res CELLS
seq:       .res MAX_SEQ
tot:       .res 2
