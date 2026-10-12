; Whack-a-Bug (src/minigames/whack.js) as a disk-loaded overlay at $4000.
; Targets pop out of a 3 × 3 grid on a monitor; hit each one before it ducks away, but spare the decoys.
; Themes (gen/mg_whack_data.s): popups / boss mail (default), bugs / features (it), troll / fan comments
; (marketing), tickets / thank-yous (support).
; Difficulty d = MG_DIFF / 255:
;   d = 0: 25 s, a popup every ~0.95 s (× 0.7-1.3) that stays ~1.7 s (× 0.85-1.15), no decoys
;   d = 1: 32 s, every ~0.45 s, stays ~0.8 s; decoys from d 0.2, 10% .. 30% of the popups
; Score = (hits - 0.6 × decoys hit - 0.15 × misses) / targets. Popups are sprites that rise from behind the
; cell's shelf (sprite-behind-foreground priority does the clipping).

.include "api.inc"
.include "gen/chars.inc"

SLOTS     = 9
CELL_W    = 7                   ; cell: 3 black rows + the shelf
GRID_X    = 9                   ; first cell column (cells at 9, 17, 25)
GRID_Y    = 5                   ; first cell row (5, 10, 15)
MON_X     = 7                   ; monitor bezel: columns 7-33, rows 2-20
MON_Y     = 2
MON_W     = 27
MON_H     = 19
HIT_T     = 17                  ; a whacked popup stays 0.35 s
FLOAT_T   = 45                  ; floaters fade after 0.9 s
POP_T     = 6                   ; frames to pop up / duck (1/8 s)
START_T   = 30                  ; the first popup after 0.6 s
LAST_T    = 50                  ; no new popups in the last second
POP_PTR   = ($e300 - $c000) / 64        ; popup, popup hit
SHELF_COL = 6                   ; shelf colour (blue); yellow under the cursor

.zeropage
left:     .res 2                ; frames to go
spawn_t:  .res 1
iv:       .res 1                ; spawn interval, frames
life:     .res 1                ; popup life, frames
targets:  .res 1
hits:     .res 1
whiffs:   .res 1
cursor:   .res 1
lastkey:  .res 1
done:     .res 1
nfree:    .res 1
spr:      .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
si:       .res 1                ; slot being worked on
dv:       .res 3                ; div24 dividend -> quotient
bad:      .res 1                ; decoys hit
dch:      .res 1                ; decoy chance / 256
flash_t:  .res 1                ; border flash after hitting a decoy
rem:      .res 1
dsr:      .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup

; A = difficulty 0-255 (d = A / 255)
init:
        tay
        ldx #<(dsr - left)
        lda #0
:       sta left,x
        dex
        bpl :-
        sty t0
        ldx #SLOTS-1
:       sta s_on,x
        sta s_fl,x
        sta s_kind,x
        dex
        bpl :-
        lda #4
        sta cursor
        lda #64
        sta lastkey
        lda #START_T
        sta spawn_t
        ; byDiff: duration 25-32 s, life 1.7-0.8 s, interval 0.95-0.45 s
        lda t0
        lsr
        lsr
        lsr
        sta t1                  ; A / 8
        lsr
        sta t2                  ; A / 16
        lsr                     ; A / 32
        pha
        lda #85
        sec
        sbc t1
        sec
        sbc t2
        sta life                ; 85 - 0.19 A frames
        pla
        clc
        adc t2
        eor #$ff
        sec
        adc #47
        sta iv                  ; 47 - 0.09 A frames
        lda t0                  ; 1250 + 1.375 A frames
        lsr
        lsr
        sta t2
        lsr
        clc
        adc t2
        adc t0
        sta left
        lda #0
        adc #0
        sta left+1
        lda left
        clc
        adc #<1250
        sta left
        lda left+1
        adc #>1250
        sta left+1
        ; decoys from d 0.2: chance 0.1 + 0.2 × d = (26 + A / 5) / 256
        lda #0
        ldx t0
        cpx #51
        bcc :+
        lda #51
        sta t1
        txa
        jsr mul8
        clc
        adc #26
:       sta dch
        ; the four popup frames (target, target hit, decoy, decoy hit) into the sprite area
        ldx #0
        txa
:       sta $e300,x
        inx
        bne :-
        ldx #POP_BYTES-1
:       lda pop_frames,x
        sta $e300,x
        lda pop_frames + POP_BYTES,x
        sta $e340,x
        lda pop_frames + 2 * POP_BYTES,x
        sta $e380,x
        lda pop_frames + 3 * POP_BYTES,x
        sta $e3c0,x
        dex
        bpl :-
        ; sprites: multicolour, normal size, behind the shelves; white and yellow shared
        lda #$ff
        sta $d01c
        sta $d01b
        lda #0
        sta $d017
        sta $d01d
        sta $d015
        sta $d010
        lda #POP_MC1
        sta $d025
        lda #POP_MC2
        sta $d026
        jsr draw_scene
        lda left
        ldx left+1
        jmp timer_start

; ---- scenery

draw_scene:
        text 1, 0, s_name, 7
        jsr draw_header
        ; monitor: dark bezel, grey screen, title row
        lda #8
        sta COLOR
        lda #MON_W
        sta FILL_W
        lda #MON_H
        sta FILL_H
        ldx #MON_X
        ldy #MON_Y
        lda #MC_A
        jsr API_FILL
        lda #MON_W - 2
        sta FILL_W
        lda #MON_H - 2
        sta FILL_H
        ldx #MON_X + 1
        ldy #MON_Y + 1
        lda #MON_CHAR           ; (the bug theme's screen is dark)
        jsr API_FILL
        lda #1
        sta FILL_H
        ldx #MON_X + 1
        ldy #MON_Y + 1
        lda #' '
        jsr API_FILL
        text MON_X + 2, MON_Y + 1, s_title, 1
        ; stand
        lda #8
        sta COLOR
        lda #5
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #18
        ldy #MON_Y + MON_H
        lda #MC_A
        jsr API_FILL
        ; cells
        ldx #SLOTS-1
:       stx si
        jsr draw_cell
        ldx si
        dex
        bpl :-
        lda cursor
        ldx #1
        jsr draw_cursor
        lda #6                  ; "Spare the ...", "(none today)" without decoys
        sta COLOR
        lda dch
        bne :+
        lda #<s_spare0
        ldx #>s_spare0
        bne :++
:       lda #<s_spare
        ldx #>s_spare
:       ldy #22
        jsr API_CENTER
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; X = slot: t0 = its left column, t1 = its top row. Keeps X.
cell_pos:
        lda col_tab,x
        sta t0
        lda row_tab,x
        sta t1
        rts

; X = slot: black inside, the key label, the shelf.
draw_cell:
        jsr cell_pos
        lda #CELL_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldx t0
        ldy t1
        lda #' '
        jsr API_FILL
        jsr draw_label
        ldx si
        lda #SHELF_COL
        ; fall through
; X = slot, A = colour: the shelf under the cell.
draw_shelf:
        ora #8
        sta COLOR
        jsr cell_pos
        lda #CELL_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldy t1
        iny
        iny
        iny
        ldx t0
        lda #MC_C
        jmp API_FILL

; Slot si: its key label in the top left corner (dim).
draw_label:
        ldx si
        jsr cell_pos
        lda #6
        sta COLOR
        lda key_label,x
        ldx t0
        ldy t1
        jmp API_PUTC

; A = slot, X = 1 on / 0 off: the cursor frame (top, sides and corners in the gaps; the shelf turns yellow).
; The gap below the shelf stays grey: popups hide behind it while they rise.
draw_cursor:
        stx t2
        sta si
        tax
        jsr cell_pos
        dec t0                  ; frame: one column / row outside the cell
        dec t1
        lda t2
        beq @off
        lda #7
        sta COLOR
        lda #CELL_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t0
        inx
        ldy t1
        lda #CH_T
        jsr API_FILL
        lda #4
        sta FILL_H
        lda #1
        sta FILL_W
        ldx t0
        ldy t1
        iny
        lda #CH_L
        jsr API_FILL
        lda t0
        clc
        adc #CELL_W + 1
        tax
        ldy t1
        iny
        lda #CH_R
        jsr API_FILL
        ldx t0
        ldy t1
        lda #CH_TL
        jsr API_PUTC
        lda t0
        clc
        adc #CELL_W + 1
        tax
        ldy t1
        lda #CH_TR
        jsr API_PUTC
        ldx si
        lda #7
        jmp draw_shelf
@off:   lda #8                  ; back to the grey gaps
        sta COLOR
        lda #CELL_W + 2
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t0
        ldy t1
        lda #MON_CHAR
        jsr API_FILL
        lda #1
        sta FILL_W
        lda #5
        sta FILL_H
        ldx t0
        ldy t1
        iny
        lda #MON_CHAR
        jsr API_FILL
        lda t0
        clc
        adc #CELL_W + 1
        tax
        ldy t1
        iny
        lda #MON_CHAR
        jsr API_FILL
        ldx si
        lda #SHELF_COL
        jmp draw_shelf

; "Hit h/t", right-aligned on row 0.
draw_header:
        ldy #0
        lda #' '
        sta buf,y
        iny
        ldx #0
:       lda s_hitcnt,x
        beq :+
        sta buf,y
        iny
        inx
        bne :-
:       lda hits
        jsr bnum
        lda #'/'
        sta buf,y
        iny
        lda targets
        jsr bnum
        lda #0
        sta buf,y
        tya
        eor #$ff
        sec
        adc #39                 ; column 39 - length
        tax
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        lda #1
        sta COLOR
        ldy #0
        jmp API_PRINT

; A = 0..99 appended to buf at Y (no leading zero). Returns Y past it.
bnum:
        ldx #'0' - 1
        sec
:       inx
        sbc #10
        bcs :-
        adc #'0' + 10
        cpx #'0'
        beq :+
        pha
        txa
        sta buf,y
        iny
        pla
:       sta buf,y
        iny
        rts

; A/X = text, Y = colour: a floater on the top row of slot si's cell, centred.
floater:
        sta PTR
        stx PTR+1
        sty t2
        ldx si
        lda #FLOAT_T
        sta s_fl,x
        jsr clear_top           ; (t0, t1 = the cell's column and row)
        lda t2
        sta COLOR
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #CELL_W             ; (7 - length) / 2
        lsr
        clc
        adc t0
        tax
        ldy t1
        jmp API_PRINT

; The top row of slot si's cell blanked (the label comes back when the floater goes).
clear_top:
        ldx si
        jsr cell_pos
        lda #CELL_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t0
        ldy t1
        lda #' '
        jmp API_FILL

; ---- one frame

frame:
        lda done
        beq :+
        sec
        rts
:       lda left
        bne :+
        dec left+1
:       dec left
        jsr timer_tick
        bcc :+
        jmp finish
:       jsr spawn
        jsr age
        jsr floaters
        lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:
        ; number keys 1-9 (edge-detected), laid out like a numpad
        lda $cb
        cmp lastkey
        beq @joy
        sta lastkey
        ldx #SLOTS-1
:       cmp key_codes9,x
        beq :+
        dex
        bpl :-
        bmi @joy
:       txa
        jsr whack
@joy:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda cursor
        sta t2
        lda JOYP
        lsr                     ; up
        bcc :+
        ldx cursor
        cpx #3
        bcc :+
        lda cursor
        sbc #3
        sta cursor
:       lda JOYP
        and #J_DOWN
        beq :+
        lda cursor
        cmp #6
        bcs :+
        adc #3
        sta cursor
:       lda JOYP
        and #J_LEFT
        beq :+
        ldx cursor
        lda col_of_slot,x
        beq :+
        dec cursor
:       lda JOYP
        and #J_RIGHT
        beq :+
        ldx cursor
        lda col_of_slot,x
        cmp #2
        beq :+
        inc cursor
:       lda cursor
        cmp t2
        beq :+
        lda t2
        ldx #0
        jsr draw_cursor
        lda cursor
        ldx #1
        jsr draw_cursor
:       lda JOYP
        and #J_FIRE
        beq :+
        lda cursor
        jsr whack
:       jsr place_sprites
        clc
        rts

; A new popup every interval × (0.7 .. 1.3) in a free cell, until the last second.
spawn:
        lda spawn_t
        beq @due
        dec spawn_t
        beq @due
@ret:   rts
@due:   lda left+1
        bne :+
        lda left
        cmp #LAST_T + 1
        bcc @ret
:       lda #154                ; interval × 179 / 256 + interval × (0..153) / 256
        jsr API_RMOD
        sta t1
        lda iv
        jsr mul8
        sta t2
        lda #179
        sta t1
        lda iv
        jsr mul8
        clc
        adc t2
        sta spawn_t
        ; pick a free cell
        ldx #SLOTS-1
        lda #0
        sta nfree
:       lda s_on,x
        bne :+
        inc nfree
:       dex
        bpl :--
        lda nfree
        beq @out
        jsr API_RMOD
        sta t2                  ; the t2-th free cell
        ldx #0
:       lda s_on,x
        bne :+
        dec t2
        bmi @got
:       inx
        bne :--
@got:   stx si
        lda #1
        sta s_on,x
        lda #0
        sta s_hit,x
        sta s_age,x
        sta s_kind,x
        jsr API_RAND            ; a decoy?
        cmp dch
        ldx si
        bcs :+
        lda #2
        sta s_kind,x            ; (2: the decoy frames)
        bne :++
:       inc targets
:
        lda #77                 ; life × 218 / 256 + life × (0..76) / 256
        jsr API_RMOD
        sta t1
        lda life
        jsr mul8
        sta t2
        lda #218
        sta t1
        lda life
        jsr mul8
        clc
        adc t2
        ldx si
        sta s_life,x
        jsr draw_header
@out:   rts

; Popups age; whacked ones vanish after HIT_T, the others duck away at the end of their life.
age:
        ldx #SLOTS-1
@s:     lda s_on,x
        beq @next
        lda s_hit,x
        beq @up
        dec s_hit,x
        bne @next
        lda #0
        sta s_on,x
        beq @next
@up:    inc s_age,x
        lda s_age,x
        cmp s_life,x
        bcc @next
        lda #0
        sta s_on,x
        lda s_kind,x            ; decoys just leave
        bne @next
        stx si
        lda #<s_escaped
        ldx #>s_escaped
        ldy #7
        jsr floater
        ldx si
@next:  dex
        bpl @s
        rts

; Floaters time out: the cell's top row and label come back.
floaters:
        ldx #SLOTS-1
:       lda s_fl,x
        beq :+
        dec s_fl,x
        bne :+
        stx si
        jsr clear_top
        jsr draw_label
        ldx si
:       dex
        bpl :--
        rts

; A = slot: whack it.
whack:
        sta si
        tax
        lda s_on,x
        beq @miss
        lda s_hit,x
        bne @miss
        lda #HIT_T
        sta s_hit,x
        lda s_kind,x
        bne @decoy
        inc hits
        lda #SFX_GOOD
        jsr API_SFX
        jsr draw_header
        lda #<s_plus1
        ldx #>s_plus1
        ldy #5
        jmp floater
@decoy: inc bad
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #10
        sta flash_t
        lda #<s_oops
        ldx #>s_oops
        ldy #2
        jmp floater
@miss:  inc whiffs
        bne :+
        dec whiffs              ; (saturates)
:
        lda #SFX_BLIP
        jsr API_SFX
        lda #<s_miss
        ldx #>s_miss
        ldy #6
        jmp floater

; One sprite per live popup, rising out of its shelf over POP_T frames and ducking back at the end.
place_sprites:
        lda #0
        sta spr
        ldx #0
@s:     lda s_on,x
        beq @next
        ldy spr
        cpy #8
        bcs @next
        lda s_kind,x            ; frame: kind (0 target, 2 decoy) + 1 once whacked
        ldy s_hit,x
        beq :+
        ora #1
:       tay
        lda pop_cols,y
        sta t1
        tya
        clc
        adc #POP_PTR
        ldy spr
        sta SCREEN + $3f8,y
        lda t1
        sta $d027,y
        ; pop = min(age, life - age, POP_T); whacked = fully up
        lda #POP_T
        ldy s_hit,x
        bne @pop
        lda s_life,x
        sec
        sbc s_age,x
        cmp s_age,x
        bcc :+
        lda s_age,x
:       cmp #POP_T
        bcc @pop
        lda #POP_T
@pop:   tay
        lda pop_off,y
        sta t1
        lda spr
        asl
        tay
        lda col_tab,x           ; x = 24 + column × 8 + 20
        asl
        asl
        asl
        clc
        adc #24 + 20
        sta $d000,y
        lda row_tab,x           ; y = 50 + shelf row × 8 - 15 + offset
        asl
        asl
        asl
        clc
        adc #50 + 3 * 8 - 15
        adc t1
        sta $d001,y
        inc spr
@next:  inx
        cpx #SLOTS
        bne @s
        ldx spr                 ; enable the first spr sprites
        lda enable_tab,x
        sta $d015
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): whack each popup once it is fully up, cursor on it.
bot:    ldx #SLOTS-1
@s:     lda s_on,x
        beq @n
        lda s_hit,x
        bne @n
        lda s_kind,x            ; (spare the decoys)
        bne @n
        lda s_age,x
        cmp #POP_T + 2
        bne @n
        txa
        pha
        lda cursor
        ldx #0
        jsr draw_cursor         ; (clobbers t0-t2)
        pla
        sta cursor
        ldx #1
        jsr draw_cursor
        lda #J_FIRE
        sta JOYP
        rts
@n:     dex
        bpl @s
        rts
.endif

; A × t1 / 256 -> A (8 × 8 multiply, high byte).
mul8:
        sta t0
        lda #0
        ldy #8
@l:     lsr t0
        bcc :+
        clc
        adc t1
:       ror
        dey
        bne @l
        rts

; dv (24 bit) / dsr -> dv, remainder in rem.
div24:
        lda #0
        sta rem
        ldx #24
@l:     asl dv
        rol dv+1
        rol dv+2
        rol rem
        lda rem
        bcs @sub
        cmp dsr
        bcc @n
@sub:   sbc dsr
        sta rem
        inc dv
@n:     dex
        bne @l
        rts

; score = clamp((20 × hits - 12 × decoys - 3 × misses) / (20 × targets), 0, 1) × 255 = (20h - 12b - 3w) × 51 / (4t)
finish:
        lda #0
        sta $d020
        sta $d015
        sta $d01b
        sta MG_SCORE
        lda #1
        sta done
        lda targets
        bne :+
        jmp @out
:       lda hits                ; 20 h (16 bit: up to ~70 targets at d = 1)
        sta t0
        lda #0
        sta t1
        asl t0
        rol t1
        asl t0
        rol t1                  ; 4 h
        lda t0
        sta dv
        lda t1
        sta dv+1
        asl dv
        rol dv+1
        asl dv
        rol dv+1                ; 16 h
        lda dv
        clc
        adc t0
        sta dv
        lda dv+1
        adc t1
        sta dv+1
        lda whiffs              ; - 3 w
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda t0
        clc
        adc whiffs
        sta t0
        bcc :+
        inc t1
:       lda dv
        sec
        sbc t0
        sta dv
        lda dv+1
        sbc t1
        sta dv+1
        bcs :+
        jmp @out                ; negative: 0
:
        lda bad                 ; - 12 b
        asl
        asl
        sta t0                  ; 4 b (b <= 63)
        asl                     ; 8 b
        sta t1
        lda #0
        rol
        sta t2
        lda t1
        clc
        adc t0
        sta t1
        bcc :+
        inc t2
:       lda dv
        sec
        sbc t1
        sta dv
        lda dv+1
        sbc t2
        sta dv+1
        bcs :+
        jmp @out
:
        ; × 51 = × 32 + × 16 + × 2 + × 1 (24 bit)
        lda dv
        sta t0
        lda dv+1
        sta t1
        lda #0
        sta dv+2
        ldx #4                  ; × 16
:       asl dv
        rol dv+1
        rol dv+2
        dex
        bne :-
        lda dv                  ; × 16 + × 32 = × 48
        asl
        sta t2
        lda dv+1
        rol
        pha
        lda dv+2
        rol
        tay
        lda t2
        clc
        adc dv
        sta dv
        pla
        adc dv+1
        sta dv+1
        tya
        adc dv+2
        sta dv+2
        lda t0                  ; + × 2 + × 1 = × 3
        asl
        sta t2
        lda t1
        rol
        tay
        lda t2
        clc
        adc t0
        sta t2
        tya
        adc t1
        tay
        lda t2
        clc
        adc dv
        sta dv
        tya
        adc dv+1
        sta dv+1
        lda dv+2
        adc #0
        sta dv+2
        lsr dv+2                ; / 4, then / targets
        ror dv+1
        ror dv
        lsr dv+2
        ror dv+1
        ror dv
        lda targets
        sta dsr
        jsr div24
        lda dv+1
        ora dv+2
        beq :+
        lda #255
        .byte $2c
:       lda dv
        sta MG_SCORE
@out:   sec
        rts

.rodata
s_name:     .byte "Whack-a-Bug", 0
s_help:     .byte "Hit the targets as they pop up. Spare the decoys!", 0
s_keys:     .byte "Joystick + FIRE, or keys 1-9", 0
s_oops:     .byte "Oops!", 0
s_hitcnt:   .byte "Hit ", 0
s_plus1:    .byte "+1", 0
s_miss:     .byte "miss", 0
s_escaped:  .byte "escaped", 0
col_tab:    .byte GRID_X, GRID_X + 8, GRID_X + 16, GRID_X, GRID_X + 8, GRID_X + 16, GRID_X, GRID_X + 8, GRID_X + 16
row_tab:    .byte GRID_Y, GRID_Y, GRID_Y, GRID_Y + 5, GRID_Y + 5, GRID_Y + 5, GRID_Y + 10, GRID_Y + 10, GRID_Y + 10
col_of_slot: .byte 0, 1, 2, 0, 1, 2, 0, 1, 2
key_label:  .byte "789456123"
key_codes9: .byte 24, 27, 32, 11, 16, 19, 56, 59, 8     ; KERNAL matrix codes of 7 8 9 4 5 6 1 2 3
pop_off:    .byte 15, 13, 10, 8, 5, 3, 0                ; px below fully up, by pop frame
enable_tab: .byte 0, 1, 3, 7, 15, 31, 63, 127, 255

.include "gen/mg_whack_data.s"

.bss
s_on:       .res SLOTS
s_hit:      .res SLOTS          ; frames left of the whacked state, 0 = not whacked
s_age:      .res SLOTS
s_life:     .res SLOTS
s_kind:     .res SLOTS          ; 0 target, 2 decoy
s_fl:       .res SLOTS          ; floater frames left
buf:        .res 16
