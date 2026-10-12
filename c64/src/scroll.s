; ---- smooth vertical scrolling ------------------------------------------------------------------------
; The playfield (screen rows 3-24) shows 22 of the floor's 28 map rows; the camera moves by single pixels.
; Fine scroll: the split IRQ sets YSCROLL just below the HUD, which delays the playfield's first bad line
; by g = (-CAMPY) & 7 lines (the gap stays black), so map row CROW = (CAMPY + 7) / 8 starts g lines down.
; Coarse scroll: the chars of the new rows are drawn into the hidden screen, then the screens swap in the
; same frame as the colour RAM, which is copied right after the beam leaves the playfield and stays ahead
; of it all the way down.

; A = camera for the player: centred, clamped to 0..48.
camera_target:
        lda ay
        sec
        sbc #88
        bcs :+
        lda #0
:       cmp #CAM_MAX + 1
        bcc :+
        lda #CAM_MAX
:       rts

; A = camera -> A = map row at the top of the playfield.
coarse_row:
        clc
        adc #7
        lsr
        lsr
        lsr
        rts

; NEXT_S = YSCROLL for CAMPY.
set_fine:
        lda #0
        sec
        sbc CAMPY
        clc
        adc #3
        and #7
        sta NEXT_S
        rts

; Move the camera towards the player. A new map row means drawing the hidden screen now and swapping
; next frame (camera_swap); within a row only the fine scroll changes.
camera_step:
        lda PEND
        bne @done
        jsr camera_target
        cmp CAMPY
        beq @done
        sta T0
        jsr coarse_row
        cmp CROW
        bne @coarse
        lda T0
        sta CAMPY
        jmp set_fine
@coarse:
        sta PEND_C
        lda T0
        sta PEND_Y
        ldx #4                  ; hidden screen: $c400 when $c000 is shown, else $c000
        lda FRONT
        beq :+
        ldx #0
:       lda PEND_C
        jsr scroll_patch
        jsr draw_chars
        lda #1
        sta PEND
@done:  rts

; Right after the frame: take the screen drawn last frame (sprites follow before the colour copy).
camera_swap:
        lda PEND
        beq @done
        lda FRONT
        eor #1
        sta FRONT
        beq :+
        lda #$12                ; screen $c400
        .byte $2c
:       lda #$02                ; screen $c000
        sta NEXT_D018
        lda PEND_C
        sta CROW
        lda PEND_Y
        sta CAMPY
        jsr set_fine
@done:  rts

camera_colours:
        lda PEND
        beq @done
        lda #0
        sta PEND
        jmp copy_colours
@done:  rts

; HUD rows of the second screen follow the first one (the HUD is printed to $c000).
hud_sync:
        lda FRONT
        beq @done
        ldx #HUD_ROWS * 40 - 1
:       lda SCREEN,x
        sta SCREEN2,x
        dex
        bpl :-
@done:  rts

; Point the unrolled copy loops at map row A.. and, for the chars, at screen $c000 (X = 0) or $c400 (X = 4).
; Unrolled too: ~1.3k cycles.
scroll_patch:
        stx T2
        tay
        lda mrow_lo,y
        sta T0
        lda mrow_hi,y
        sta T1
        clc
.repeat PF_ROWS, i
        ldx T1
        lda T0
        sta .ident(.sprintf("dcs%d", i))       ; chars: lda map,x
        stx .ident(.sprintf("dcs%d", i)) + 1
        adc #<(FL_COL - FL_MAP)
        sta .ident(.sprintf("ccs%d", i))       ; colours: lda mapcol,x
        txa
        adc #>(FL_COL - FL_MAP)
        sta .ident(.sprintf("ccs%d", i)) + 1
        lda #>(SCREEN + (i + HUD_ROWS) * 40)   ; chars: sta screen,x
        ora T2
        sta .ident(.sprintf("dcs%d", i)) + 4
        lda T0
        adc #40                                 ; C = 0 from the adds above (no page wraps past $ffff)
        sta T0
        bcc :+
        inc T1
        clc
:
.endrep
        rts

; 22 rows of chars, column by column (the target screen is hidden, so order doesn't matter): ~8.6k cycles.
draw_chars:
        ldx #39
dc_col:
.repeat PF_ROWS, i
.ident(.sprintf("dcs%d", i)) = * + 1
        lda FL_MAP,x
        sta SCREEN + (i + HUD_ROWS) * 40,x
.endrep
        dex
        bmi :+
        jmp dc_col
:       rts

; 22 rows of colour RAM in groups of 4 rows (~1.6k cycles a group, faster than the beam): ~9.4k cycles.
copy_colours:
.repeat 6, g
        ldx #39
:
.repeat 4, k
.if g * 4 + k < PF_ROWS
.ident(.sprintf("ccs%d", g * 4 + k)) = * + 1
        lda FL_COL,x
        sta COLRAM + (g * 4 + k + HUD_ROWS) * 40,x
.endif
.endrep
        dex
        bpl :-
.endrep
        rts


