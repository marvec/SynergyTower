; Small kit shared by the mini-game overlays (assembled into each one, like src/engine/mgkit.js in the
; browser game): text macros, the timer bar, the footer line, number keys.

.macro text col, row, str, color
        lda #color
        sta COLOR
        lda #<(str)
        sta PTR
        lda #>(str)
        sta PTR+1
        ldx #col
        ldy #row
        jsr API_PRINT
.endmacro

.macro center row, str, color
        lda #color
        sta COLOR
        lda #<(str)
        ldx #>(str)
        ldy #row
        jsr API_CENTER
.endmacro

.zeropage
tm_step:  .res 2                ; frames per bar cell
tm_acc:   .res 2
tm_cells: .res 1                ; cells left, 0 = time is up
k_y:      .res 1

.code
; A/X = total frames: full timer bar, counting down to 0 cells.
timer_start:
        sta tm_acc
        stx tm_acc+1
        lda #0                  ; step = total / 38
        sta tm_step
        sta tm_step+1
@div:   lda tm_acc
        sec
        sbc #38
        tay
        lda tm_acc+1
        sbc #0
        bcc @done
        sta tm_acc+1
        sty tm_acc
        inc tm_step
        bne @div
        inc tm_step+1
        bne @div
@done:  lda tm_step
        sta tm_acc
        lda tm_step+1
        sta tm_acc+1
        lda #38
        sta tm_cells
        ; fall through

; Redraw the bar: green, yellow under a third, red under a sixth.
timer_draw:
        lda #5
        ldx tm_cells
        cpx #13
        bcs :+
        lda #7
        cpx #7
        bcs :+
        lda #2
:       sta COLOR
        lda tm_cells
        jmp API_BAR

; One frame. C=1 once the time is up.
timer_tick:
        lda tm_cells
        beq @up
        lda tm_acc
        bne :+
        dec tm_acc+1
:       dec tm_acc
        lda tm_acc
        ora tm_acc+1
        bne @run
        lda tm_step
        sta tm_acc
        lda tm_step+1
        sta tm_acc+1
        dec tm_cells
        jsr timer_draw
        lda tm_cells
        beq @up
@run:   clc
        rts
@up:    sec
        rts

; A/X = string: centred on the bottom row in yellow.
footer:
        pha
        txa
        pha
        lda #24
        ldx #1
        jsr clear_rows
        pla
        tax
        pla
        ldy #24
        jmp API_CENTER

; A = first row, X = number of rows: cleared to spaces.
clear_rows:
        stx FILL_H
        tay
        lda #40
        sta FILL_W
        lda #7
        sta COLOR
        ldx #0
        lda #' '
        jmp API_FILL

; Keys 1-4 (KERNAL key matrix code in $cb): A = 0..3, or $ff.
number_key:
        lda $cb
        ldx #3
:       cmp key_codes,x
        beq :+
        dex
        bpl :-
:       txa
        rts
key_codes: .byte 56, 59, 8, 11

; API_PUTC / API_FILL that keep Y.
kputc:  sty k_y
        jsr API_PUTC
        ldy k_y
        rts
kfill:  sty k_y
        jsr API_FILL
        ldy k_y
        rts

; Face of a colleague at X, Y (2 × 2 chars): A = hair colour.
face:   sta COLOR
        lda #CH_HAIRL
        jsr kputc
        inx
        lda #CH_HAIRR
        jsr kputc
        iny
        lda #7
        sta COLOR
        lda #CH_FACER
        jsr kputc
        dex
        lda #CH_FACEL
        jmp kputc
