; ---- actors -----------------------------------------------------------------------------------------
init_actors:
        jsr place_player
        lda #PLAYER_SHIRT
        sta acol
        lda #SPRBASE
        sta abase
        lda #0
        sta aanim
        sta astill
        sta asteps
        sta apause
        sta akind
        ldx FL_HDR + HDR_NPCS
        inx
        stx nact
        ldx #1
        ldy #0
@npc:   cpx nact
        bcs @done
        lda FL_HDR + HDR_NPC,y
        sta ax_lo,x
        lda FL_HDR + HDR_NPC + 1,y
        sta ax_hi,x
        lda FL_HDR + HDR_NPC + 2,y
        sta ay,x
        lda FL_HDR + HDR_NPC + 3,y
        cmp #$ff                ; the receptionist wears the corp colour
        bne :+
        sty T0
        ldy st_color
        lda corp_c64,y
        ldy T0
:       sta acol,x
        lda FL_HDR + HDR_NPC + 4,y
        sta astill,x
        lda FL_HDR + HDR_NPC + 5,y
        sta akind,x
        lda #SPRBASE
        sta abase,x
        lda #0
        sta adir,x
        sta aanim,x
        sta asteps,x
        sta apause,x
        tya
        clc
        adc #HDR_NPC_SIZE
        tay
        inx
        bne @npc
@done:  rts

; ---- sprite multiplexer -------------------------------------------------------------------------------
; Up to MAX_ACT actors share the 8 hardware sprites. mux_build (after the frame's game logic) sorts the
; visible actors by screen y into a display list. Entry k uses hardware sprite 7 - (k & 7), so actors lower
; on the screen get the higher priority and stand in front. Entry k >= 8 reuses the sprite of entry k - 8:
; a raster IRQ on the line where that one ends rewrites the registers (mux_irq). An actor too close below
; its predecessor on the same sprite is left out for that frame.
; mux_show (right after the frame) writes entries 0-7 directly and hands entries 8+ to the IRQ.
SPR_H    = 21
MUX_GAP  = 24                   ; entry k must start this many lines below entry k - 8
MUX_LAST = 242                  ; last line for a multiplex IRQ (the music IRQ follows at 250)

update_sprites:
        jsr mux_build
mux_show:
        ldx #0
        stx T1                  ; $d010
        stx T2                  ; $d015
@d:     cpx dn
        bcs @fin
        cpx #8
        bcs @fin
        ldy d_hw,x
        lda d_col,x
        sta $d027,y
        lda d_ptr,x
        sta SCREEN + $3f8,y     ; sprite pointers of both screens
        sta SCREEN2 + $3f8,y
        lda bit_tab,y
        ora T2
        sta T2
        lda d_msb,x
        beq :+
        lda bit_tab,y
        ora T1
        sta T1
:       tya
        asl
        tay
        lda d_x,x
        sta $d000,y
        lda d_y,x
        sta $d001,y
        inx
        bne @d
@fin:   lda T1
        sta $d010
        lda T2
        sta $d015
        ldy #0                  ; entries 8+ for the IRQ
@m:     cpx dn
        bcs @mdone
        lda d_line,x
        sta m_line,y
        lda d_hw,x
        sta m_hw,y
        asl
        sta m_hw2,y
        lda d_x,x
        sta m_x,y
        lda d_y,x
        sta m_y,y
        lda d_msb,x
        sta m_msb,y
        lda d_col,x
        sta m_col,y
        lda d_ptr,x
        sta m_ptr,y
        inx
        iny
        bne @m
@mdone: sty MUXN
        rts

mux_build:
        lda CAMPY               ; the camera of the coming frame
        ldx PEND
        beq :+
        lda PEND_Y
:       sta T0
        ldx #0
        stx nvis
@vis:   cpx nact
        bcs @sort
        lda ay,x
        sec
        sbc T0
        bcc @nv                 ; above the screen
        cmp #20
        bcc @nv                 ; would cover the HUD
        cmp #PF_ROWS * 8 + 1
        bcs @nv
        adc #54                 ; 50 (top) + 24 (HUD) - 20 (feet row in the sprite)
        sta ssy,x
        ldy nvis
        txa
        sta vis,y
        inc nvis
@nv:    inx
        bne @vis
@sort:  ldx #1                  ; insertion sort of vis by ssy
@s1:    cpx nvis
        bcs @assign
        stx T2
        lda vis,x
        sta T0
        tay
        lda ssy,y
        sta T1
        ldy T2
@s2:    lda vis-1,y
        tax
        lda ssy,x
        cmp T1
        bcc @put
        beq @put
        txa
        sta vis,y
        dey
        bne @s2
@put:   lda T0
        sta vis,y
        ldx T2
        inx
        bne @s1
@assign:
        lda #0
        sta dn
        tax
@a:     cpx nvis
        bcs @done
        stx T2
        ldy vis,x               ; Y = actor
        ldx dn                  ; X = display entry
        cpx #8
        bcc @ok
        lda d_y-8,x             ; reusing a sprite: far enough below the one before it?
        clc
        adc #MUX_GAP
        bcs @skip
        cmp ssy,y
        beq :+
        bcs @skip
:       lda d_y-8,x
        clc
        adc #SPR_H              ; the IRQ comes on the line where the previous sprite ends
        cmp #MUX_LAST
        bcs @skip
        sta d_line,x
@ok:    lda ssy,y
        sta d_y,x
        txa
        and #7
        eor #7
        sta d_hw,x
        lda ax_lo,y
        clc
        adc #12                 ; 24 (left) - 12 (half sprite)
        sta d_x,x
        lda ax_hi,y
        adc #0
        sta d_msb,x
        lda acol,y
        sta d_col,x
        lda adir,y              ; frame: dir * 3 + (moving ? 1 + (anim / 8 & 1) : 0)
        sta T1
        asl
        adc T1
        sta T1
        lda aanim,y
        beq :+
        lsr
        lsr
        lsr
        and #1
        clc
        adc #1
:       clc
        adc T1
        adc abase,y
        sta d_ptr,x
        inc dn
@skip:  ldx T2
        inx
        bne @a
@done:  rts

; Raster IRQ inside the playfield: next multiplexed sprite(s). Entered from irq with X, Y free.
mux_irq:
        ldx MUXI
@next:  ldy m_hw2,x
        lda m_y,x
        sta $d001,y
        lda m_x,x
        sta $d000,y
        ldy m_hw,x
        lda m_col,x
        sta $d027,y
        lda m_ptr,x
        sta SCREEN + $3f8,y
        sta SCREEN2 + $3f8,y
        lda m_msb,x
        beq @lo
        lda $d010
        ora bit_tab,y
        bne @msb
@lo:    lda $d010
        and bit_inv,y
@msb:   sta $d010
        inx
        cpx MUXN
        bcs @last
        lda $d012               ; next one close? Then now, the IRQ would come too late
        clc
        adc #2
        cmp m_line,x
        bcs @next
        lda m_line,x
        sta $d012
        stx MUXI
        jmp $febc
@last:  stx MUXI
        lda #MUSIC_LINE
        sta $d012
        jmp $febc

move_player:
        lda #0
        sta MDX
        sta MDY
        lda JOY
        lsr
        bcc :+
        dec MDY
:       lsr
        bcc :+
        inc MDY
:       lsr
        bcc :+
        dec MDX
:       lsr
        bcc :+
        inc MDX
:       lda MDY                 ; facing: vertical wins on diagonals
        beq @horiz
        bmi :+
        lda #0
        beq @face
:       lda #1
        bne @face
@horiz: lda MDX
        beq @still
        bmi :+
        lda #3
        bne @face
:       lda #2
@face:  sta adir
        ldx #0
        jsr move_actor
        lda MOVED
        beq @still
        inc aanim
        bne :+
        inc aanim
:       rts
@still: lda #0
        sta aanim
        rts

; Colleagues wander: pick a direction and a number of steps, stop at walls, pause now and then.
move_npcs:
        ldx #1
@loop:  cpx nact
        bcs @done
        lda astill,x
        bne @next
        lda apause,x            ; talking: stands still
        beq :+
        dec apause,x
        jmp @next
:       lda FRAME
        and #1
        bne @next               ; half speed
        lda asteps,x
        bne @walk
        jsr rand
        sta T2
        and #3
        sta adir,x
        lda T2
        lsr
        lsr
        and #$1f
        adc #10
        sta asteps,x
        lda T2
        and #$c0
        sta amode,x             ; nonzero = walking, zero (1 in 4) = standing still
@walk:  dec asteps,x
        lda amode,x
        beq @idle
        ldy adir,x
        lda dir_dx,y
        sta MDX
        lda dir_dy,y
        sta MDY
        jsr move_actor
        lda MOVED
        beq @blocked
        inc aanim,x
        bne @next
        inc aanim,x
        bne @next
@blocked:
        lda #0
        sta asteps,x
@idle:  lda #0
        sta aanim,x
@next:  inx
        bne @loop
@done:  rts

; X = actor, MDX/MDY = -1..1. Moves one axis at a time so actors slide along walls. MOVED = 0 if stuck.
move_actor:
        lda #0
        sta MOVED
        stx SAVEX
        lda MDX
        beq @y
        clc
        adc ax_lo,x
        sta CX
        lda MDX
        bpl @pos
        lda #$ff
        .byte $2c               ; BIT abs: skips the next 2-byte instruction
@pos:   lda #0
        adc ax_hi,x
        sta CX+1
        lda ay,x
        sta CY
        jsr try_pos
        ldx SAVEX
        bcc @y
        lda CX
        sta ax_lo,x
        lda CX+1
        sta ax_hi,x
        inc MOVED
@y:     lda MDY
        beq @done
        clc
        adc ay,x
        sta CY
        lda ax_lo,x
        sta CX
        lda ax_hi,x
        sta CX+1
        jsr try_pos
        ldx SAVEX
        bcc @done
        lda CY
        sta ay,x
        inc MOVED
@done:  rts

; Can feet at (CX, CY) stand there? Checks the corners of a 6 × 3 px box. C=1 if free.
try_pos:
        lda CX
        sec
        sbc #3
        sta T0
        lda CX+1
        sbc #0
        sta T1
        jsr @column
        bcc @no
        lda CX
        clc
        adc #2
        sta T0
        lda CX+1
        adc #0
        sta T1
@column:
        lda CY
        sec
        sbc #1
        jsr info_at
        cmp #1
        bne @no
        lda CY
        sec
        sbc #3
        jsr info_at
        cmp #1
        bne @no
        sec
        rts
@no:    clc
        rts

; A = y pixel, T0/T1 = x pixel. Returns A = INFO byte of that tile (uses Y, PT, T3).
info_at:
        lsr
        lsr
        lsr
        tay
        lda T1
        sta T3
        lda T0
        lsr T3
        ror
        lsr T3
        ror
        lsr T3
        ror
        clc
        adc irow_lo,y
        sta PT
        lda irow_hi,y
        adc #0
        sta PT+1
        ldy #0
        lda (PT),y
        rts

