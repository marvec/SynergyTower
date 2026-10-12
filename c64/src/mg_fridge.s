; Fridge Tetris (src/minigames/fridge.js) as a disk-loaded overlay at $4000.
; Lunch containers fall into the office fridge (8 × 12 cells). Fill whole shelves (rows) to clear them;
; mystery containers still inside at the end count against you. Difficulty 0 (floor 2): 60 s, 4 shelves
; to clear, a row every 0.85 s (0.64 s by the end), 5% mystery containers; also cakes (2 × 2, can't be
; turned), yogurts (1 cell) and milk (2 cells). A 0.4 s rest locks a piece.
; Score = shelves / 4 - 0.08 per mystery left (up to 4) - 0.1 if the fridge overflowed; 1.0 ends early.
; Content: gen/mg_fridge_data.s (tools/mg/fridge.js).
;
; A cell is 2 chars wide and 1 high (the browser's 16 × 16 px at 16 × 8): the fridge interior is chars
; 12-27, rows 5-16, between the open door with the sticky note (left) and the NEXT panel (right).

.include "api.inc"
.include "gen/chars.inc"

COLS      = 8
ROWS      = 12
CELLS     = COLS * ROWS
TARGET    = 4                   ; shelves
TOTAL_T   = 60 * 50
FALL_BASE = 33                  ; frames per row: 33 + timer cells / 4 (42 at the start, 33 at the end)
FALL_SOFT = 2                   ; DOWN held: 0.04 s
LOCK_T    = 20                  ; 0.4 s resting on something
END_T     = 55                  ; the banner, 1.1 s
FLASH_T   = 17                  ; cleared shelves flash 0.35 s
MSG_T     = 60
DAS_START = 20                  ; held left/right, in 1/100 s: repeats after 0.2 s, every 0.05 s
DAS_STEP  = 5
P_MYST    = 13                  ; piece kind by a random byte: < 13 mystery (5%), < 26 cake (5%),
P_CAKE    = 26                  ; < 46 yogurt (8%), < 67 milk (8%), else a tupperware tetromino
P_YOG     = 46
P_MILK    = 67
FX        = 12                  ; interior: chars 12-27 ...
FY        = 5                   ; ... rows 5-16
PX        = 29                  ; side panel: chars 29-39
MSG_Y     = 20
K_TUP     = 0
K_MYST    = 1
K_CAKE    = 2
K_YOG     = 3
K_MILK    = 4
LK_EMPTY  = 0                   ; cell looks (char pairs, see look_l / look_r)
LK_LID    = 1
LK_FOOD   = 2
LK_MYST   = 3
LK_CAKET  = 4
LK_CAKEB  = 5
LK_YOG    = 6
LK_MILKT  = 7
LK_MILKB  = 8
LK_GHOST  = 9
LK_FLASH  = 10
LK_NONE   = $ff

.zeropage
zp_first:
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
t4:       .res 1
anim:     .res 1
done:     .res 1
cur_kind: .res 1
cur_n:    .res 1                ; matrix size 1-4
cur_x:    .res 1                ; signed
cur_y:    .res 1                ; signed
cur_id:   .res 1
cur_lid:  .res 1
cur_food: .res 1
nxt_kind: .res 1
nxt_n:    .res 1
nxt_lid:  .res 1
nxt_food: .res 1
nxt_name: .res 1
next_id:  .res 1
lines:    .res 1
overflow: .res 1
mystery:  .res 1                ; mystery containers inside
end_t:    .res 1
fall_t:   .res 1
lock_t:   .res 1
dirty:    .res 1
flash_t:  .res 1
flash_m:  .res 2                ; rows flashing (bit r of the 12)
hold_l:   .res 1
hold_r:   .res 1
msg_t:    .res 1
border_t: .res 1
cx:       .res 1                ; collide: position
cy:       .res 1
mp:       .res 2                ; collide / rotate: matrix
rp:       .res 2
cp:       .res 2
prod:     .res 2
m1:       .res 1
zp_last:
sp:       .res 2

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup -------------------------------------------------------------------------------------------
init:
        ldx #zp_last - zp_first - 1
        lda #0
:       sta zp_first,x
        dex
        bpl :-
        ldx #CELLS - 1
:       sta grid_id,x
        sta grid_lk,x
        sta grid_cl,x
        dex
        bpl :-
        lda #1
        sta next_id
        jsr draw_scene
        jsr make_piece
        jsr spawn
        jsr draw_stats
        lda #<TOTAL_T
        ldx #>TOTAL_T
        jmp timer_start

; Kitchen: the open door with a sticky note and condiments, the fridge, the panel.
draw_scene:
        text 1, 0, s_name, 7
        ; door
        lda #11
        sta FILL_W
        lda #16
        sta FILL_H
        lda #8
        sta COLOR
        ldx #0
        ldy #3
        lda #MC_B
        jsr API_FILL
        lda #7 | 8              ; the note: yellow strips above and below the text
        sta COLOR
        lda #1
        sta FILL_H
        ldx #0
        ldy #4
        lda #MC_C
        jsr API_FILL
        lda #1
        sta FILL_H
        ldx #0
        ldy #11
        lda #MC_C
        jsr API_FILL
        lda #2 | 8              ; magnet
        sta COLOR
        ldx #5
        ldy #4
        lda #MC_KNOB
        jsr API_PUTC
        lda #6
        sta FILL_H
        lda #' '
        ldx #0
        ldy #5
        jsr API_FILL
        lda #NOTE_N             ; which note
        jsr API_RMOD
        tax
        lda note_lo,x
        sta sp
        lda note_hi,x
        sta sp+1
        lda #5
        sta t4
@line:  ldy #0
        lda (sp),y
        beq @shelves
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #7
        sta COLOR
        ldx #0
        ldy t4
        jsr API_PRINT
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
:       inc t4
        bne @line
@shelves:                       ; two door shelves with bottles on them
        ldx #9
:       stx t4
        lda bottle_c,x
        sta COLOR
        ldy bottle_y,x
        lda bottle_x,x
        tax
        lda #MC_C
        jsr API_PUTC
        ldx t4
        dex
        bpl :-
        lda #10
        sta FILL_W
        lda #1
        sta FILL_H
        lda #8
        sta COLOR
        ldx #0
        ldy #14
        lda #MC_A
        jsr API_FILL
        ldx #0
        ldy #17
        lda #MC_A
        jsr API_FILL
        ; fridge body: white walls, the light, the interior
        lda #1 | 8
        sta COLOR
        lda #18
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #FX - 1
        ldy #FY - 2
        lda #MC_C
        jsr API_FILL
        lda #1
        sta FILL_H
        ldx #FX - 1
        ldy #FY + ROWS
        lda #MC_C
        jsr API_FILL
        lda #1
        sta FILL_W
        lda #ROWS
        sta FILL_H
        ldx #FX - 1
        ldy #FY
        lda #MC_C
        jsr API_FILL
        ldx #FX + 2 * COLS
        ldy #FY
        lda #MC_C
        jsr API_FILL
        lda #7 | 8              ; the light
        sta COLOR
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #FX + COLS - 1
        ldy #FY - 2
        lda #MC_CARDS
        jsr API_FILL
        ; panel
        text PX + 3, 3, s_next, 7
        text PX, 9, s_shelves, 1
        text PX, 12, s_mystery, 1
        text PX, 14, s_smell, 1
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; ---- pieces ------------------------------------------------------------------------------------------
; The next piece: kind, shape, colours, name.
make_piece:
        jsr API_RAND
        ldx #K_MYST
        cmp #P_MYST
        bcc @k
        inx                     ; K_CAKE
        cmp #P_CAKE
        bcc @k
        inx                     ; K_YOG
        cmp #P_YOG
        bcc @k
        inx                     ; K_MILK
        cmp #P_MILK
        bcc @k
        ldx #K_TUP
@k:     stx nxt_kind
        ldx #15
        lda #0
:       sta nxt_m,x
        dex
        bpl :-
        lda nxt_kind
        cmp #K_CAKE
        bcs @fixed
        lda #7                  ; a tetromino
        jsr API_RMOD
        tay
        lda tetro_n,y
        sta nxt_n
        tya
        asl
        asl
        asl
        asl
        tay
        ldx #0
:       lda tetro,y
        sta nxt_m,x
        iny
        inx
        cpx #16
        bne :-
        jmp @colours
@fixed: sec
        sbc #K_CAKE
        tay
        lda fixed_n,y
        sta nxt_n
        lda fixed_m,y
        lsr
        rol nxt_m
        lsr
        rol nxt_m+1
        lsr
        rol nxt_m+4
        lsr
        rol nxt_m+5
@colours:
        lda #8
        jsr API_RMOD
        tax
        lda lid_col,x
        sta nxt_lid
        lda #8
        jsr API_RMOD
        tax
        lda food_col,x
        sta nxt_food
        lda nxt_kind            ; name: tupperware 0-21, mystery 22-27, yogurt, milk, cake
        bne :+
        lda #TUP_N
        jsr API_RMOD
        jmp @nm
:       cmp #K_MYST
        bne :+
        lda #MYST_N
        jsr API_RMOD
        clc
        adc #TUP_N
        jmp @nm
:       tax
        lda fixed_name - K_CAKE,x
@nm:    sta nxt_name
        rts

; The next piece comes in at the top; a new next one. Overflow if it doesn't fit.
spawn:
        ldx #15
:       lda nxt_m,x
        sta cur_m,x
        dex
        bpl :-
        lda nxt_kind
        sta cur_kind
        lda nxt_n
        sta cur_n
        lda nxt_lid
        sta cur_lid
        lda nxt_food
        sta cur_food
        lda next_id
        sta cur_id
        inc next_id
        bne :+
        inc next_id             ; (0 = empty cell)
:       jsr make_piece
        jsr draw_next
        lda #COLS               ; x = (8 - size) / 2, y = -(first filled row)
        sec
        sbc cur_n
        lsr
        sta cur_x
        ldx #0
:       lda cur_m,x
        bne :+
        inx
        bne :-
:       txa
        lsr
        lsr
        eor #$ff
        clc
        adc #1
        sta cur_y
        lda #0
        sta fall_t
        sta lock_t
        lda #1
        sta dirty
.if .defined(AUTOPLAY)
        jsr bot_plan
.endif
        jsr cur_collide
        bcc :+
        lda #<s_full
        ldx #>s_full
        ldy #1
        jmp end_game
:       rts

; mp = cur_m, cx/cy = the piece's position (+ A to y): C=1 if it doesn't fit there.
cur_collide_down:
        lda #1
        .byte $2c
cur_collide:
        lda #0
        clc
        adc cur_y
        sta cy
        lda cur_x
        sta cx
        lda #<cur_m
        sta mp
        lda #>cur_m
        sta mp+1
        ; fall through

; mp = 4 × 4 matrix, cx/cy = position (signed): C=1 if a cell is outside the fridge or on food.
collide:
        ldy #15
@c:     lda (mp),y
        beq @n
        tya
        and #3
        clc
        adc cx
        cmp #COLS               ; (negative = 128+: outside too)
        bcs @hit
        sta t0
        tya
        lsr
        lsr
        clc
        adc cy
        bmi @n                  ; above the fridge: fine
        cmp #ROWS
        bcs @hit
        asl
        asl
        asl
        ora t0
        tax
        lda grid_id,x
        bne @hit
@n:     dey
        bpl @c
        clc
        rts
@hit:   sec
        rts

; tmp_m = cur_m turned clockwise: new[r][c] = old[n-1-c][r].
turn:
        ldx #15
        lda #0
:       sta tmp_m,x
        dex
        bpl :-
        lda #0
        sta t1                  ; r
@r:     lda #0
        sta t2                  ; c
@c:     lda cur_n               ; source (n-1-c) * 4 + r
        sec
        sbc #1
        sbc t2
        asl
        asl
        clc
        adc t1
        tax
        lda t1                  ; destination r * 4 + c
        asl
        asl
        adc t2
        tay
        lda cur_m,x
        sta tmp_m,y
        inc t2
        lda t2
        cmp cur_n
        bne @c
        inc t1
        lda t1
        cmp cur_n
        bne @r
        rts

; UP: turn clockwise, nudged up to 2 cells sideways if needed (not cakes and yogurts).
rotate:
        lda cur_kind
        cmp #K_CAKE
        beq @rts
        cmp #K_YOG
        beq @rts
        jsr turn
        lda #<tmp_m
        sta mp
        lda #>tmp_m
        sta mp+1
        lda cur_y
        sta cy
        ldx #0
@k:     stx t3
        lda cur_x
        clc
        adc kicks,x
        sta cx
        jsr collide
        bcc @ok
        ldx t3
        inx
        cpx #5
        bne @k
@rts:   rts
@ok:    lda cx
        sta cur_x
        ldx #15
:       lda tmp_m,x
        sta cur_m,x
        dex
        bpl :-
        lda #1
        sta dirty
        lda #SFX_BLIP
        jmp API_SFX

; A = -1 / +1: C=1 if the piece moved sideways.
shift:
        clc
        adc cur_x
        sta t3
        sta cx
        lda cur_y
        sta cy
        lda #<cur_m
        sta mp
        lda #>cur_m
        sta mp+1
        jsr collide
        bcs :+
        lda t3
        sta cur_x
        lda #1
        sta dirty
        sec
        rts
:       clc
        rts

hard_drop:
        lda #5                  ; click
        jsr API_SFX
:       jsr cur_collide_down
        bcs lock
        inc cur_y
        jmp :-

; The piece settles: into the grid, full shelves cleared, then the next piece.
lock:
        ldy #15
@c:     lda cur_m,y
        beq @n
        sty t1
        jsr cell_look           ; A = look, X = colour of matrix cell Y
        sta t2
        stx t3
        ldy t1
        tya
        lsr
        lsr
        clc
        adc cur_y
        bpl :+
        lda #1                  ; above the top
        sta overflow
        bne @n
:       asl
        asl
        asl
        sta t0
        tya
        and #3
        clc
        adc cur_x
        adc t0
        tax
        lda cur_id
        sta grid_id,x
        lda t2
        sta grid_lk,x
        lda t3
        sta grid_cl,x
@n:     dey
        bpl @c
        lda #3                  ; step: hi-hat
        jsr API_SFX
        ; clear full shelves, bottom up
        lda #0
        sta t4                  ; cleared
        sta flash_m
        sta flash_m+1
        lda #ROWS - 1
        sta t1
@row:   lda t1
        asl
        asl
        asl
        tax
        ldy #COLS
:       lda grid_id,x
        beq @next
        inx
        dey
        bne :-
        ; full: rows above move down one
        lda t1
        asl
        asl
        asl
        ora #COLS - 1
        tax
:       lda grid_id - COLS,x
        sta grid_id,x
        lda grid_lk - COLS,x
        sta grid_lk,x
        lda grid_cl - COLS,x
        sta grid_cl,x
        dex
        cpx #COLS
        bcs :-
        lda #0
:       sta grid_id,x
        dex
        bpl :-
        lda t1                  ; flash where it was (as the browser does: row - shelves so far)
        sec
        sbc t4
        bmi @fd
        tax
        cpx #8
        bcs @hi
        lda bit8,x
        ora flash_m
        sta flash_m
        jmp @fd
@hi:    lda bit8 - 8,x
        ora flash_m+1
        sta flash_m+1
@fd:    inc t4
        jmp @row                ; the same row again
@next:  dec t1
        bpl @row
        lda t4
        beq @none
        clc
        adc lines
        sta lines
        lda #FLASH_T
        sta flash_t
        lda #SFX_GOOD
        jsr API_SFX
        lda t4
        cmp #2
        bcc @one
        ora #'0'                ; "2 shelves!"
        sta buf
        ldx #0
:       lda s_shelves2,x
        sta buf+1,x
        beq :+
        inx
        bne :-
:       lda #<buf
        ldx #>buf
        ldy #5
        jsr message
        jmp @stats
@one:   lda #CLEAR_N
        jsr API_RMOD
        tax
        lda clr_lo,x
        pha
        lda clr_hi,x
        tax
        pla
        ldy #5
        jsr message
        jmp @stats
@none:  lda cur_kind
        cmp #K_MYST
        bne @stats
        lda #<s_ew
        ldx #>s_ew
        ldy #5
        jsr message
@stats: lda #1
        sta dirty
        jsr draw_stats
        lda overflow
        beq :+
        lda #<s_full
        ldx #>s_full
        ldy #1
        jmp end_game
:       jsr score
        cpx #0                  ; 1.0 or more: done early
        beq :+
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_spotless
        ldx #>s_spotless
        ldy #0
        jmp end_game
:       jmp spawn

; Y = cell of cur_m -> A = look, X = colour (the top of a container gets the lid, cakes their icing).
cell_look:
        ldx #1                  ; top: nothing of the piece above
        cpy #4
        bcc :+
        lda cur_m - 4,y
        beq :+
        dex
:       lda cur_kind
        asl
        stx t0
        ora t0                  ; kind × 2 + top
        tax
        lda kind_look,x
        pha
        lda kind_col,x
        cmp #$ff
        bne :+
        lda cur_lid
:       cmp #$fe
        bne :+
        lda cur_food
:       tax
        pla
        rts

; A/X = banner text, Y = 1 if the fridge overflowed.
end_game:
        sty t0
        ldy end_t
        bne @rts
        sta sp
        stx sp+1
        lda #END_T
        sta end_t
        lda t0
        beq :+
        sta overflow
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #20
        sta border_t
:       jsr draw_fridge         ; without the falling piece
        ldx overflow            ; banner over the fridge: red or green frame
        lda banner_col,x
        sta COLOR
        lda #2 * COLS
        sta FILL_W
        lda #3
        sta FILL_H
        ldx #FX
        ldy #9
        jsr API_BOX
        lda #2 * COLS - 2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #FX + 1
        ldy #10
        jsr API_FILL
        ldy #0                  ; centred on the fridge
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        lsr
        eor #$ff
        sec
        adc #FX + COLS
        tax
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda #1
        sta COLOR
        ldy #10
        jsr API_PRINT
@rts:   rts

; S = shelves × 64 - 20 per mystery inside (up to 4) - 26 after an overflow: A = S clamped to 0-255,
; X = 1 if S >= 255 (the browser's 1.0).
score:
        lda lines
        lsr
        lsr
        sta prod+1              ; × 64
        lda lines
        and #3
        lsr
        ror
        ror
        sta prod
        lda mystery
        cmp #5
        bcc :+
        lda #4
:       tax
        lda prod
        sec
        sbc myst_pen,x
        sta prod
        bcs :+
        dec prod+1
:       lda overflow
        beq :+
        lda prod
        sec
        sbc #26
        sta prod
        bcs :+
        dec prod+1
:       lda prod+1
        bmi @zero
        bne @max
        lda prod
        ldx #0
        cmp #255
        bcc :+
        inx
:       rts
@zero:  lda #0
        tax
        rts
@max:   lda #255
        ldx #1
        rts

; ---- frame -------------------------------------------------------------------------------------------
frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr msg_tick
        lda end_t
        beq @play
        dec end_t
        beq :+
        jmp @out
:       jsr score
        sta MG_SCORE
        lda #0
        sta $d020
        lda #1
        sta done
        sec
        rts
@play:  lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #1
        sta dirty
:       jsr timer_tick
        bcc @input
        jsr score               ; time's up
        ldx #<s_served
        ldy #>s_served
        cmp #217                ; 0.85
        bcs :+
        ldx #<s_timeup
        ldy #>s_timeup
:       txa
        pha
        tya
        tax
        pla
        ldy #0
        jsr end_game
        jmp @out
@input:
.if .defined(AUTOPLAY)
        jsr bot
        lda end_t
        bne @out
.endif
        lda JOYP
        and #J_UP
        beq :+
        jsr rotate
:       lda #<-1
        ldx #J_LEFT
        ldy #hold_l
        jsr side
        lda #1
        ldx #J_RIGHT
        ldy #hold_r
        jsr side
        lda JOYP
        and #J_FIRE
        beq @fall
        jsr hard_drop
        jmp @draw
@fall:  ldx #FALL_SOFT          ; gravity, soft drop with DOWN
        lda JOY
        and #J_DOWN
        bne :+
        lda tm_cells
        lsr
        lsr
        clc
        adc #FALL_BASE
        tax
:       stx t4
        jsr cur_collide_down
        bcc @air
        lda #0                  ; resting: locks after LOCK_T
        sta fall_t
        inc lock_t
        lda lock_t
        cmp #LOCK_T
        bcc @draw
        jsr lock
        jmp @draw
@air:   lda #0
        sta lock_t
        inc fall_t
        lda fall_t
        cmp t4
        bcc @draw
        lda #0
        sta fall_t
        inc cur_y
        lda #1
        sta dirty
@draw:  lda end_t
        bne @out
        lda dirty
        beq @out
        jsr draw_fridge
@out:   clc
        rts

; A = direction, X = joystick bit, Y = its hold counter (zero page): a press moves at once, holding it
; repeats after 0.2 s every 0.05 s (counted in 1/100 s, 2 per frame).
side:
        sta t1
        sty t2
        txa
        and JOYP
        beq @held
        lda #0
        sta 0,y
        lda t1
        jmp shift
@held:  txa
        and JOY
        bne :+
        lda #0
        sta 0,y
        rts
:       lda 0,y
        clc
        adc #2
        sta 0,y
@rep:   ldy t2
        lda 0,y
        cmp #DAS_START + 1
        bcc @rts
        sbc #DAS_STEP
        sta 0,y
        lda t1
        jsr shift
        jmp @rep
@rts:   rts

; ---- drawing -----------------------------------------------------------------------------------------
; The interior: food, the ghost where the piece will land, the piece, flashing shelves.
draw_fridge:
        ldx #CELLS - 1
:       lda grid_id,x
        beq @e
        lda grid_lk,x
        sta ov_lk,x
        lda grid_cl,x
        sta ov_cl,x
        jmp @n
@e:     sta ov_lk,x             ; LK_EMPTY
@n:     dex
        bpl :-
        lda end_t
        bne @flash
        ; ghost: as far down as the piece goes
        lda cur_y
        sta t4
:       inc cur_y
        jsr cur_collide
        bcc :-
        dec cur_y
        lda cur_y
        sta t3
        lda t4
        sta cur_y
        lda #LK_GHOST
        sta t2
        jsr @stamp_ghost
        ; the piece
        ldy #15
@p:     lda cur_m,y
        beq @pn
        sty t1
        jsr cell_look
        sta t2
        txa
        pha
        ldy t1
        lda cur_y
        jsr @cell
        pla
        bcs :+
        sta ov_cl,x
        lda t2
        sta ov_lk,x
:       ldy t1
@pn:    dey
        bpl @p
@flash: lda flash_t
        beq @show
        ldx #CELLS - 1
@f:     txa
        lsr
        lsr
        lsr
        tay
        cpy #8
        bcs :+
        lda bit8,y
        and flash_m
        jmp @fl
:       lda bit8 - 8,y
        and flash_m+1
@fl:    beq :+
        lda #LK_FLASH
        sta ov_lk,x
        lda #1
        sta ov_cl,x
:       dex
        bpl @f
@show:  lda #0
        sta dirty
        ldy #0                  ; row
@row:   sty t1
        lda row_lo + FY,y
        clc
        adc #FX
        sta rp
        sta cp
        lda row_hi + FY,y
        adc #0
        sta rp+1
        adc #>(COLRAM - SCREEN)
        sta cp+1
        tya
        asl
        asl
        asl
        tax                     ; first cell
        ldy #0
@col:   lda ov_cl,x
        ora #8
        sta (cp),y
        iny
        sta (cp),y
        dey
        lda ov_lk,x
        stx t0
        tax
        lda look_l,x
        sta (rp),y
        iny
        lda look_r,x
        sta (rp),y
        iny
        ldx t0
        inx
        cpy #2 * COLS
        bne @col
        ldy t1
        iny
        cpy #ROWS
        bne @row
        rts
; ghost cells at row t3
@stamp_ghost:
        ldy #15
:       lda cur_m,y
        beq @gn
        sty t1
        lda t3
        jsr @cell
        bcs @gs
        lda grid_id,x
        bne @gs
        lda t2
        sta ov_lk,x
        lda #0
        sta ov_cl,x
@gs:    ldy t1
@gn:    dey
        bpl :-
        rts
; matrix cell Y of a piece whose top is at row A: X = grid index, C=1 if above the fridge
@cell:  sta t0
        tya
        lsr
        lsr
        clc
        adc t0
        bmi @above
        asl
        asl
        asl
        sta t0
        tya
        and #3
        clc
        adc cur_x
        adc t0
        tax
        clc
        rts
@above: sec
        rts

; NEXT: the shape (its first two rows), the name.
draw_next:
        lda #11
        sta FILL_W
        lda #4
        sta FILL_H
        lda #' '
        ldx #PX
        ldy #4
        jsr API_FILL
        ldx #0                  ; first filled row
:       lda nxt_m,x
        bne :+
        inx
        bne :-
:       txa
        and #$0c
        sta t3                  ; its first cell
        lda #PX + 5             ; x = middle - size
        sec
        sbc nxt_n
        sta t4
        ldx #0
@c:     stx t1
        txa
        clc
        adc t3
        tay
        cpy #16
        bcs @nx
        lda nxt_m,y
        beq @nx
        ; look: the same rules as on the fridge, for the next piece
        ldx #1
        cpy #4
        bcc :+
        lda nxt_m - 4,y
        beq :+
        dex
:       stx t0
        lda nxt_kind
        asl
        ora t0
        tax
        lda kind_col,x
        cmp #$ff
        bne :+
        lda nxt_lid
:       cmp #$fe
        bne :+
        lda nxt_food
:       ora #8
        sta COLOR
        lda kind_look,x
        sta t2
        lda t1                  ; screen: column t4 + 2 × (c), row 4 + (r)
        and #3
        asl
        adc t4
        sta t0
        lda t1
        lsr
        lsr
        clc
        adc #4
        tay
        ldx t2
        lda look_l,x
        ldx t0
        jsr API_PUTC
        lda t1
        lsr
        lsr
        clc
        adc #4
        tay
        ldx t2
        lda look_r,x
        ldx t0
        inx
        jsr API_PUTC
@nx:    ldx t1
        inx
        cpx #8                  ; two rows of four
        bne @c
        ; name, two lines
        ldx nxt_kind
        lda name_col,x
        sta COLOR
        ldx nxt_name
        lda name_lo,x
        sta PTR
        lda name_hi,x
        sta PTR+1
        ldx #PX
        ldy #6
        jsr API_PRINT
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc PTR
        sta PTR
        bcc :+
        inc PTR+1
:       ldx #PX
        ldy #7
        jmp API_PRINT

; Shelves (header and panel), progress bar, mystery count, smell-o-meter.
draw_stats:
        ; mystery containers inside: distinct ids
        lda #0
        sta mystery
        ldx #CELLS - 1
@m:     lda grid_id,x
        beq @mn
        lda grid_lk,x
        cmp #LK_MYST
        bne @mn
        lda grid_id,x
        ldy mystery
        beq @new
:       cmp seen-1,y
        beq @mn
        dey
        bne :-
@new:   ldy mystery
        sta seen,y
        inc mystery
@mn:    dex
        bpl @m
        text PX, 0, s_shelves, 7
        lda #7
        jsr @count
        lda #1
        sta COLOR
        ldx #PX + 8
        ldy #9
        lda lines
        cmp #TARGET
        bcc :+
        lda #5
        sta COLOR
:       jsr @count9
        ; progress: 10 cells
        lda lines
        cmp #TARGET
        bcc :+
        lda #TARGET
:       tax
        lda prog_cells,x
        sta t3
        ldx #0
@pg:    stx t2
        lda #5
        ldy #CH_BLOCK
        cpx t3
        bcc :+
        lda #8
        ldy #MC_A
:       sta COLOR
        txa
        clc
        adc #PX
        tax
        tya
        ldy #10
        jsr API_PUTC
        ldx t2
        inx
        cpx #10
        bne @pg
        lda mystery
        ldx #1
        cmp #0
        beq :+
        ldx #5
:       stx COLOR
        ldx #PX + 9
        ldy #12
        jsr API_NUM
        ; smell-o-meter: lit segments by mystery count
        lda mystery
        cmp #5
        bcc :+
        lda #4
:       tax
        lda smell_lit,x
        sta t3
        ldx #0
@s:     stx t2
        lda smell_col,x
        ldy #CH_BLOCK
        cpx t3
        bcc :+
        lda #8
        ldy #MC_A
:       sta COLOR
        txa
        clc
        adc #PX
        tax
        tya
        ldy #15
        jsr API_PUTC
        ldx t2
        inx
        cpx #11
        bne @s
        rts
@count: sta COLOR               ; "Shelves 1/4" in the header: the numbers at PX + 8
        ldx #PX + 8
        ldy #0
@count9:
        sty t0
        stx t1
        lda lines
        jsr API_NUM
        lda #'/'
        ldx t1
        inx
        ldy t0
        jsr API_PUTC
        ldx t1
        inx
        inx
        ldy t0
        lda #TARGET
        jmp API_NUM

; A/X = message, Y = colour: centred on row MSG_Y for MSG_T frames.
message:
        sty t0
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
        lda #MSG_T
        sta msg_t
        rts

msg_tick:
        lda border_t
        beq :+
        dec border_t
        bne :+
        lda #0
        sta $d020
:       lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jmp clear_rows
:       rts

; prod = A × X.
mul8:
        sta m1
        stx t0
        lda #0
        ldx #8
        lsr m1
:       bcc :+
        clc
        adc t0
:       ror
        ror m1
        dex
        bne :--
        sta prod+1
        lda m1
        sta prod
        rts

.if .defined(AUTOPLAY)
; ---- test builds: a placement bot --------------------------------------------------------------------
; For each turn and column it drops the piece in its head and rates the result like a Tetris AI:
; shelves × 160 - holes × 70 - total height × 10 - bumpiness × 7 - highest column × 6. Then it turns,
; walks and drops, one action per frame.
bot_plan:
        lda #0
        sta b_best
        sta b_best+1
        sta b_rot
        lda cur_x
        sta b_x
        ldx #CELLS - 1
:       lda grid_id,x
        beq :+
        lda #1
:       sta b_occ,x
        dex
        bpl :--
        ldx #15
:       lda cur_m,x
        sta b_m,x
        dex
        bpl :-
        lda #0
        sta b_r
@rot:   lda #<-3
        sta b_tx
@x:     jsr b_try
        inc b_tx
        lda b_tx
        cmp #COLS
        bne @x
        lda cur_kind            ; cakes and yogurts don't turn
        cmp #K_CAKE
        beq @done
        cmp #K_YOG
        beq @done
        inc b_r
        lda b_r
        cmp #4
        beq @done
        ldx #15                 ; turn b_m: via cur_m and turn
:       lda cur_m,x
        pha
        lda b_m,x
        sta cur_m,x
        dex
        bpl :-
        jsr turn
        ldx #0
:       pla
        sta cur_m,x
        lda tmp_m,x
        sta b_m,x
        inx
        cpx #16
        bne :-
        jmp @rot
@done:  lda #0
        sta b_did
        rts

; Rate b_m dropped at column b_tx from the current row.
b_try:
        lda #<b_m
        sta mp
        lda #>b_m
        sta mp+1
        lda b_tx
        sta cx
        lda cur_y
        sta cy
        jsr collide
        bcc :+
        rts
:       inc cy                  ; drop
        jsr collide
        bcc :-
        dec cy
        ; stamp (none may stick out at the top)
        ldy #15
@s:     lda b_m,y
        beq @sn
        jsr b_idx
        bcc :+
        jmp b_unstamp
:       lda #1
        sta b_occ,x
@sn:    dey
        bpl @s
        ; full rows, rows below
        lda #0
        sta b_lines
        sta t4                  ; non-full rows from the bottom
        ldy #ROWS - 1
@fr:    tya
        asl
        asl
        asl
        tax
        lda #1
        sta b_full,y
        lda #COLS
        sta t3
:       lda b_occ,x
        bne :+
        lda #0
        sta b_full,y
:       inx
        dec t3
        bne :--
        lda b_full,y
        beq :+
        inc b_lines
        bne @fb
:       inc t4
@fb:    lda t4
        sta b_below,y
        dey
        bpl @fr
        ; columns: heights, holes
        lda #0
        sta b_holes
        sta b_agg
        sta b_agg+1
        sta b_bump
        sta b_maxh
        ldx #0
@col:   stx t3
        lda #0
        sta b_h,x
        sta t2                  ; seen the top
        ldy #0
@cr:    lda b_full,y
        bne @cn
        tya
        asl
        asl
        asl
        ora t3
        tax
        lda b_occ,x
        beq @emp
        lda t2
        bne @cn
        inc t2
        ldx t3
        lda b_below,y
        sta b_h,x
        jmp @cn
@emp:   lda t2
        beq @cn
        inc b_holes
@cn:    iny
        cpy #ROWS
        bne @cr
        ldx t3
        lda b_h,x
        clc
        adc b_agg
        sta b_agg
        lda b_h,x
        cmp b_maxh
        bcc :+
        sta b_maxh
:       cpx #0
        beq @nb
        lda b_h,x
        sec
        sbc b_h-1,x
        bcs :+
        eor #$ff
        adc #1
:       clc
        adc b_bump
        sta b_bump
@nb:    inx
        cpx #COLS
        bne @col
        ; rating = 20000 + lines × 160 - holes × 70 - agg × 10 - bump × 7 - maxh × 6
        lda #<20000
        sta b_val
        lda #>20000
        sta b_val+1
        lda b_lines
        ldx #160
        jsr mul8
        jsr b_add
        lda b_holes
        ldx #70
        jsr mul8
        jsr b_sub
        lda b_agg
        ldx #10
        jsr mul8
        jsr b_sub
        lda b_bump
        ldx #7
        jsr mul8
        jsr b_sub
        lda b_maxh
        ldx #6
        jsr mul8
        jsr b_sub
        lda b_val+1             ; best so far?
        cmp b_best+1
        bcc b_unstamp
        bne :+
        lda b_val
        cmp b_best
        bcc b_unstamp
        beq b_unstamp
:       lda b_val
        sta b_best
        lda b_val+1
        sta b_best+1
        lda b_r
        sta b_rot
        lda b_tx
        sta b_x
b_unstamp:
        ldy #15
:       lda b_m,y
        beq @n
        jsr b_idx
        bcs @n
        lda grid_id,x
        beq :+
        lda #1
:       sta b_occ,x
@n:     dey
        bpl :--
        rts
b_add:  lda b_val
        clc
        adc prod
        sta b_val
        lda b_val+1
        adc prod+1
        sta b_val+1
        rts
b_sub:  lda b_val
        sec
        sbc prod
        sta b_val
        lda b_val+1
        sbc prod+1
        sta b_val+1
        rts
; cell Y of b_m at cx/cy: X = grid index, C=1 if above the top
b_idx:  tya
        lsr
        lsr
        clc
        adc cy
        bmi :+
        asl
        asl
        asl
        sta t0
        tya
        and #3
        clc
        adc cx
        adc t0
        tax
        clc
        rts
:       sec
        rts

; One action per frame: turn, walk, drop.
bot:    lda b_did
        cmp b_rot
        bcs @walk
        inc b_did
        jmp rotate
@walk:  lda cur_x
        cmp b_x
        beq @drop
        clc                     ; (both -3..7: compare them + 8)
        adc #8
        sta t0
        lda b_x
        clc
        adc #8
        cmp t0
        lda #1
        bcs :+
        lda #<-1
:       jmp shift
@drop:  jmp hard_drop
.endif

.rodata
s_name:     .byte "Fridge Tetris", 0
s_help:     .byte "Fit the lunches in. Fill whole shelves!", 0
s_keys:     .byte "Left/right move, up rotates, FIRE drops", 0
s_next:     .byte "NEXT", 0
s_shelves:  .byte "Shelves", 0
s_shelves2: .byte " shelves!", 0
s_mystery:  .byte "Mystery:", 0
s_smell:    .byte "Smell-o-mtr", 0
s_ew:       .byte "Ew. What IS that?", 0
s_full:     .byte "FRIDGE FULL", 0
s_spotless: .byte "Fridge spotless!", 0
s_served:   .byte "Lunch is served!", 0
s_timeup:   .byte "Time's up!", 0
; the seven tetrominoes as 4 × 4 matrices (row by row) and their sizes
tetro:      .byte 0,0,0,0, 1,1,1,1, 0,0,0,0, 0,0,0,0
            .byte 1,1,0,0, 1,1,0,0, 0,0,0,0, 0,0,0,0
            .byte 0,1,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0
            .byte 0,0,1,0, 1,1,1,0, 0,0,0,0, 0,0,0,0
            .byte 1,0,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0
            .byte 0,1,1,0, 1,1,0,0, 0,0,0,0, 0,0,0,0
            .byte 1,1,0,0, 0,1,1,0, 0,0,0,0, 0,0,0,0
tetro_n:    .byte 4, 2, 3, 3, 3, 3, 3
; cake, yogurt, milk: size, cells, name
fixed_n:    .byte 2, 1, 2
fixed_m:    .byte %1111, %0001, %0101   ; bit 0: cell 0, 1: cell 1, 2: cell 4, 3: cell 5
fixed_name: .byte NAME_YOGURT + 2, NAME_YOGURT, NAME_YOGURT + 1
kicks:      .byte 0, <-1, 1, <-2, 2
lid_col:    .byte 6, 4, 2, 4, 3, 7, 2, 5        ; the browser's lid colours, nearest of the 8
food_col:   .byte 7, 5, 2, 1, 2, 7, 2, 7
; look and colour by kind × 2 + top ($ff = lid colour, $fe = food colour)
kind_look:  .byte LK_FOOD, LK_LID, LK_MYST, LK_MYST, LK_CAKEB, LK_CAKET, LK_YOG, LK_YOG, LK_MILKB, LK_MILKT
kind_col:   .byte $fe, $ff, 5, 5, 7, 4, 1, 1, 1, 1
look_l:     .byte MC_B, MC_C, MC_KNOB, MC_KNOB, MC_C, MC_CARDS, MC_CARDS, MC_C, MC_GRID, MC_A, MC_C
look_r:     .byte MC_B, MC_GRID, MC_GRID, MC_KNOB, MC_C, MC_CARDS, MC_GRID, MC_C, MC_GRID, MC_A, MC_C
name_col:   .byte 7, 5, 4, 7, 7                 ; tupperware, mystery (green), cake (pink), yogurt, milk
banner_col: .byte 5, 2
myst_pen:   .byte 0, 20, 40, 60, 80             ; 0.08 each
prog_cells: .byte 0, 2, 5, 7, 10
smell_lit:  .byte 2, 5, 7, 9, 11                ; 0.15 + 0.22 per mystery, of 11
smell_col:  .byte 5, 5, 5, 5, 7, 7, 7, 2, 2, 2, 2
bit8:       .byte 1, 2, 4, 8, 16, 32, 64, 128
bottle_x:   .byte 1, 3, 4, 6, 8, 1, 2, 4, 6, 7
bottle_y:   .byte 13, 13, 13, 13, 13, 16, 16, 16, 16, 16
bottle_c:   .byte 2|8, 7|8, 5|8, 1|8, 2|8, 1|8, 7|8, 6|8, 4|8, 4|8
row_lo:     .repeat 25, i
            .byte <(SCREEN + 40 * i)
            .endrep
row_hi:     .repeat 25, i
            .byte >(SCREEN + 40 * i)
            .endrep

.include "gen/mg_fridge_data.s"

.bss
grid_id:    .res CELLS          ; container id, 0 = empty
grid_lk:    .res CELLS
grid_cl:    .res CELLS
ov_lk:      .res CELLS          ; what draw_fridge shows
ov_cl:      .res CELLS
cur_m:      .res 16
nxt_m:      .res 16
tmp_m:      .res 16
seen:       .res CELLS
buf:        .res 16
.if .defined(AUTOPLAY)
b_occ:      .res CELLS
b_m:        .res 16
b_full:     .res ROWS
b_below:    .res ROWS
b_h:        .res COLS
b_r:        .res 1
b_tx:       .res 1
b_rot:      .res 1
b_x:        .res 1
b_did:      .res 1
b_lines:    .res 1
b_holes:    .res 1
b_agg:      .res 2
b_bump:     .res 1
b_maxh:     .res 1
b_val:      .res 2
b_best:     .res 2
.endif
