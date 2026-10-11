; SynergyTower for the Commodore 64 - proof of concept, resident part.
;
; Memory map ($01 = $36: BASIC ROM out, KERNAL + I/O in)
;   $0002-$003f  zero page (shared part in api.inc)
;   $0801-$3fff  this program: BASIC stub, API table, engine, charset/sprite/music data
;   $4000-$5fff  mini-game overlay slot (MG.* files, unpacked here)
;   $6000-$7fff  load buffer for packed files
;   $8000-$8fff  current floor (FLOOR01, unpacked): map, colours, walk/interact grid, header
;   $c000-$c3ff  screen (VIC bank 3)    $c800-$cfff charset    $e000- sprites (RAM under the KERNAL)
; Files are loaded by track/sector through our own fast loader (drive code in src/drive.s); the C64 clocks
; every bit, so the raster IRQ (SID music) keeps running during loads. Only the boot file uses the KERNAL.

.include "api.inc"
.include "gen/floor.inc"
.include "gen/files.inc"

LOADBUF  = $6000
SPRBASE  = ($e000 - $c000) / 64   ; sprite pointer of the first person frame
CHARSET  = $c800
SCREEN2  = $c400                  ; second screen for the scrolling playfield
MAX_ACT  = 8
SPLIT_LINE = 62                   ; raster IRQ below the HUD: fine scroll + screen of the playfield
MUSIC_LINE = 250                  ; raster IRQ below the screen: music, frame counter, keyboard


.include "zp.inc"

.segment "HEAD"
        .word $0801

.segment "CODE"
; ---- BASIC stub: 10 SYS2061
        .word @link, 10
        .byte $9e, "2061", 0
@link:  .word 0
        jmp start
; ---- API jump table (fixed addresses, see api.inc)
.assert * = API_WAIT, error, "API table moved"
        jmp wait_frame
        jmp read_input
        jmp cls
        jmp print
        jmp sfx
        jmp rand
        jmp fill
        jmp print_num
        jmp putc
        jmp print_center
        jmp box
        jmp bar
        jmp rand_mod

; =====================================================================================================
start:
        sei
        cld
        lda #$36
        sta $01
        ; VIC bank 3: screen $c000, charset $c800
        lda $dd02
        ora #$03
        sta $dd02
        lda $dd00
        and #$fc
        sta $dd00
        lda #$02
        sta $d018
        lda #$c0
        sta $0288
        ; charset and sprites into the VIC bank
        lda #<charset_data
        sta SRC
        lda #>charset_data
        sta SRC+1
        lda #<CHARSET
        sta DST
        lda #>CHARSET
        sta DST+1
        ldx #8
        jsr copy_pages
        lda #<sprite_data
        sta SRC
        lda #>sprite_data
        sta SRC+1
        lda #$00
        sta DST
        lda #$e0
        sta DST+1
        ldx #>(SPRITE_BYTES + 255)
        jsr copy_pages
        ; colours and modes
        lda #0
        sta $d020
        sta $d021
        lda #11
        sta $d022
        lda #12
        sta $d023
        lda #$18                ; multicolour text, 40 columns
        sta $d016
        lda #$1b
        sta $d011
        lda #$ff
        sta $d01c               ; multicolour sprites
        lda #0
        sta $d025               ; sprite colour 1: outline / hair
        sta $d015
        sta $d017
        sta $d01d
        sta $d01b
        lda #10
        sta $d026               ; sprite colour 2: skin
        lda #0
        sta $ffff               ; VIC idle-state byte (RAM under the KERNAL): the scroll gap stays black
        jsr plain_screen
        ; SID
        ldx #$18
        lda #0
:       sta $d400,x
        dex
        bpl :-
        lda #$08
        sta $d411               ; voice 3 pulse width for pulse effects
        ; raster IRQ at line 250, CIA interrupts off
        lda #$7f
        sta $dc0d
        sta $dd0d
        lda $dc0d
        lda $dd0d
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        lda #SPLIT_LINE
        sta $d012
        lda #1
        sta $d01a
        sta $cc                 ; no cursor blink
        lda #$ff
        sta $d019
        ; seed the random generator
        lda $d012
        eor $dc04
        ora #1
        sta RNG
        lda #$5a
        sta RNG+1
        lda #0
        sta LOADED
        sta LOADED+1
        sta MSG_T
        cli

        ldx #0                  ; floor music plays during the load
        jsr music_start
        lda #0
        sta COLOR
        jsr cls
        lda #7
        sta COLOR
        ldy #8
        lda #<s_title
        ldx #>s_title
        jsr print_center
        lda #1
        sta COLOR
        ldy #10
        lda #<s_sub
        ldx #>s_sub
        jsr print_center
        lda #3
        sta COLOR
        ldy #15
        lda #<s_loadfloor
        ldx #>s_loadfloor
        jsr print_center

        jsr set_loadbuf
        lda #FLOOR01_T
        ldx #FLOOR01_S
        jsr fl_load
        bcc :+
        jmp disk_error
:       lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<FL_MAP
        sta DST
        lda #>FL_MAP
        sta DST+1
        jsr lz_unpack

        lda #START_CLIPS & $ff
        sta clips
        lda #START_CLIPS >> 8
        sta clips+1
        lda #START_COFFEE
        sta coffee
        lda #0
        sta stars
        ldx #MAX_ACT-1
:       sta iadone,x
        sta iadone+8,x
        dex
        bpl :-
        jsr init_actors
.ifdef AUTOPLAY
        jsr tod_read            ; time since the boot file started
        ldx #7
:       lda s_loadtime_num,x
        sta boot_time,x
        dex
        bpl :-
        lda #<autoplay_script
        sta AUTOPTR
        lda #>autoplay_script
        sta AUTOPTR+1
        lda #0
        sta AUTOCNT
.endif
        jsr enter_floor

; ---- the floor ------------------------------------------------------------------------------------
floor_loop:
        jsr wait_frame
        jsr camera_swap         ; the beam just left the playfield: swap screens if one is ready,
        jsr update_sprites      ; move the sprites with the camera,
        jsr camera_colours      ; and copy the colour RAM before the beam is back
        jsr hud_sync
        jsr read_input
        jsr move_player
        jsr move_npcs
        jsr camera_step
        jsr check_near
        jsr msg_tick
        lda JOYP
        and #J_FIRE
        beq floor_loop
        jsr interact
        jmp floor_loop

disk_error:
        jsr plain_screen
        lda #2
        sta COLOR
        ldy #18
        lda #<s_diskerr
        ldx #>s_diskerr
        jsr print_center
:       jmp :-

; Draw the whole floor screen: HUD, map, sprites.
enter_floor:
        jsr plain_screen
        lda #0
        sta COLOR
        jsr cls
        lda #$ff
        sta NEAR
        jsr camera_target
        sta CAMPY
        jsr coarse_row
        sta CROW
        ldx #0
        jsr scroll_patch
        jsr draw_chars
        jsr copy_colours
        jsr set_fine
        jsr draw_hud
        jsr draw_status
        jsr update_sprites
        rts

; Screen $c000 without scrolling (title, mini-games, result screens).
plain_screen:
        lda #0
        sta FRONT
        sta PEND
        lda #$02                ; screen $c000, charset $c800
        sta NEXT_D018
        lda #3
        sta NEXT_S
        rts

; ---- actors -----------------------------------------------------------------------------------------
init_actors:
        lda FL_HDR + HDR_SPAWN
        sta ax_lo
        lda FL_HDR + HDR_SPAWN + 1
        sta ax_hi
        lda FL_HDR + HDR_SPAWN + 2
        sta ay
        lda #14
        sta acol
        lda #0
        sta adir
        sta aanim
        sta astill
        sta asteps
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
        sta acol,x
        lda FL_HDR + HDR_NPC + 4,y
        sta astill,x
        lda #0
        sta adir,x
        sta aanim,x
        sta asteps,x
        tya
        clc
        adc #HDR_NPC_SIZE
        tay
        inx
        bne @npc
@done:  rts

; Sprite registers from the actor table. Actors outside the visible rows are switched off.
update_sprites:
        lda CAMPY
        sta T0                  ; camera y in pixels
        lda #0
        sta T1                  ; x MSBs
        sta T2                  ; enable mask
        ldx #0
@loop:  cpx nact
        bcs @write
        txa
        asl
        tay
        lda ay,x
        sec
        sbc T0
        bcc @next               ; above the screen
        cmp #10
        bcc @next               ; would cover the HUD
        cmp #185
        bcs @next
        adc #46                 ; 50 (top) + 16 (HUD) - 20 (feet row in the sprite)
        sta $d001,y
        lda ax_lo,x
        clc
        adc #12                 ; 24 (left) - 12 (half sprite)
        sta $d000,y
        lda ax_hi,x
        adc #0
        beq :+
        lda bit_tab,x
        ora T1
        sta T1
:       lda bit_tab,x
        ora T2
        sta T2
        lda acol,x
        sta $d027,x
        ; frame: dir * 3 + (moving ? 1 + (anim / 8 & 1) : 0)
        lda adir,x
        sta T3
        asl
        adc T3
        sta T3
        lda aanim,x
        beq :+
        lsr
        lsr
        lsr
        and #1
        clc
        adc #1
:       clc
        adc T3
        adc #SPRBASE
        sta SCREEN + $3f8,x     ; sprite pointers of both screens
        sta SCREEN2 + $3f8,x
@next:  inx
        bne @loop
@write: lda T1
        sta $d010
        lda T2
        sta $d015
        rts

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
        lda FRAME
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

; ---- smooth vertical scrolling ------------------------------------------------------------------------
; The playfield (screen rows 2-24) shows 23 of the floor's 28 map rows; the camera moves by single pixels.
; Fine scroll: the split IRQ sets YSCROLL just below the HUD, which delays the playfield's first bad line
; by g = (-CAMPY) & 7 lines (the gap stays black), so map row CROW = (CAMPY + 7) / 8 starts g lines down.
; Coarse scroll: the chars of the new rows are drawn into the hidden screen, then the screens swap in the
; same frame as the colour RAM, which is copied right after the beam leaves the playfield and stays ahead
; of it all the way down.

; A = camera for the player: centred, clamped to 0..40.
camera_target:
        lda ay
        sec
        sbc #96
        bcs :+
        lda #0
:       cmp #41
        bcc :+
        lda #40
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
        ldx #79
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
.repeat 23, i
        ldx T1
        lda T0
        sta .ident(.sprintf("dcs%d", i))       ; chars: lda map,x
        stx .ident(.sprintf("dcs%d", i)) + 1
        adc #<(FL_COL - FL_MAP)
        sta .ident(.sprintf("ccs%d", i))       ; colours: lda mapcol,x
        txa
        adc #>(FL_COL - FL_MAP)
        sta .ident(.sprintf("ccs%d", i)) + 1
        lda #>(SCREEN + (i + 2) * 40)          ; chars: sta screen,x
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

; 23 rows of chars, column by column (the target screen is hidden, so order doesn't matter): ~8.6k cycles.
draw_chars:
        ldx #39
dc_col:
.repeat 23, i
.ident(.sprintf("dcs%d", i)) = * + 1
        lda FL_MAP,x
        sta SCREEN + (i + 2) * 40,x
.endrep
        dex
        bmi :+
        jmp dc_col
:       rts

; 23 rows of colour RAM in groups of 4 rows (~1.6k cycles a group, faster than the beam): ~9.4k cycles.
copy_colours:
.repeat 6, g
        ldx #39
:
.repeat 4, k
.if g * 4 + k < 23
.ident(.sprintf("ccs%d", g * 4 + k)) = * + 1
        lda FL_COL,x
        sta COLRAM + (g * 4 + k + 2) * 40,x
.endif
.endrep
        dex
        bpl :-
.endrep
        rts


; ---- interaction ------------------------------------------------------------------------------------
; Look around the player's feet (facing direction first) for an interactable tile.
check_near:
        lda #0
        sta T2
@try:   lda adir
        clc
        adc T2
        and #3
        tax
        lda look_dx,x
        clc
        adc ax_lo
        sta T0
        lda look_dx,x
        bpl @pos
        lda #$ff
        .byte $2c
@pos:   lda #0
        adc ax_hi
        sta T1
        lda ay
        clc
        adc look_dy,x
        jsr info_at
        cmp #2
        bcs @found
        inc T2
        lda T2
        cmp #4
        bne @try
        lda #$ff
        bne @set
@found: sbc #2
@set:   cmp NEAR
        beq :+
        sta NEAR
        lda MSG_T
        bne :+
        jsr draw_status
:       rts

; Point IA at interactable A.
ia_ptr:
        sta T0
        asl
        asl
        adc T0
        asl                     ; × 10
        clc
        adc #<(FL_HDR + HDR_IA)
        sta IA
        lda #>(FL_HDR + HDR_IA)
        adc #0
        sta IA+1
        rts

interact:
        lda NEAR
        cmp #$ff
        bne :+
        rts
:       jsr ia_ptr
        ldy #0
        lda (IA),y
        beq @station
        cmp #1
        bne @hr
        lda #<s_elevator
        ldx #>s_elevator
        jmp show_msg
@hr:    lda #<s_hr
        ldx #>s_hr
        jmp show_msg
@station:
        ldx NEAR
        lda iadone,x
        beq :+
        lda #<s_done
        ldx #>s_done
        jmp show_msg
:       ldy #8                  ; overlay track (0 = not on this disk)
        lda (IA),y
        bne :+
        lda #<s_later
        ldx #>s_later
        jmp show_msg
:       ldy #1                  ; coffee cost of this station's game
        lda (IA),y
        sta cost
        lda coffee
        cmp cost
        bcs :+
        lda #<s_nocoffee
        ldx #>s_nocoffee
        jmp show_msg
:       jmp play_station

show_msg:
        sta PTR
        stx PTR+1
        lda #150
        sta MSG_T
        lda #1
        sta COLOR
        jsr clear_status
        ldx #1
        ldy #1
        jsr print
        lda #SFX_BAD
        jmp sfx

msg_tick:
        lda MSG_T
        beq :+
        dec MSG_T
        bne :+
        jsr draw_status
:       rts

; ---- HUD ---------------------------------------------------------------------------------------------
; Row 0: floor name + paperclips, coffee, KPI stars.  Row 1: title, or what FIRE would do here.
draw_hud:
        lda #7
        sta COLOR
        ldx #1
        ldy #0
        lda #<(FL_HDR + HDR_NAME)
        sta PTR
        lda #>(FL_HDR + HDR_NAME)
        sta PTR+1
        jsr print
        ; paperclips
        lda #7
        sta COLOR
        ldx #23
        ldy #0
        lda #CH_CLIP
        jsr putc
        ldx #24
        ldy #0
        jsr print_clips
        ; coffee n/max
        lda #1
        sta COLOR
        ldx #30
        ldy #0
        lda #CH_COFFEE
        jsr putc
        ldx #31
        ldy #0
        lda coffee
        jsr print_num
        lda #'/'
        jsr putc_next
        lda #COFFEE_MAX
        jsr print_num_next
        ; stars n/quota
        lda #7
        sta COLOR
        ldx #35
        ldy #0
        lda #CH_STAR
        jsr putc
        lda #1
        sta COLOR
        ldx #36
        ldy #0
        lda stars
        jsr print_num
        lda #'/'
        jsr putc_next
        lda #QUOTA
        jsr print_num_next
        rts

clear_status:
        lda #1
        sta FILL_H
        lda #40
        sta FILL_W
        ldx #0
        ldy #1
        lda #' '
        jmp fill

draw_status:
        jsr clear_status
        lda NEAR
        cmp #$ff
        beq @title
        jsr ia_ptr
        lda #7
        sta COLOR
        lda #<s_fire
        sta PTR
        lda #>s_fire
        sta PTR+1
        ldx #1
        ldy #1
        jsr print
        ldy #6
        lda (IA),y
        sta PTR
        iny
        lda (IA),y
        sta PTR+1
        lda #1
        sta COLOR
        ldx #7
        ldy #1
        jmp print
@title: lda #3
        sta COLOR
        lda #<(FL_HDR + HDR_TITLE)
        sta PTR
        lda #>(FL_HDR + HDR_TITLE)
        sta PTR+1
        ldx #1
        ldy #1
        jmp print

; ---- mini-game host ------------------------------------------------------------------------------
play_station:
        jsr plain_screen
        lda #0
        sta $d015
        sta COLOR
        jsr cls
        ldx #1                  ; mini-game music
        jsr music_start
        ldy #6
        lda (IA),y
        sta PT
        iny
        lda (IA),y
        sta PT+1
        lda #7
        sta COLOR
        ldy #10
        lda PT
        ldx PT+1
        jsr print_center
        ; already in memory? (same track/sector as the overlay we loaded last)
        ldy #8
        lda (IA),y
        sta filep
        iny
        lda (IA),y
        sta filep+1
        lda filep
        cmp LOADED
        bne @load
        lda filep+1
        cmp LOADED+1
        bne @load
        lda #<s_cached
        sta PT
        lda #>s_cached
        sta PT+1
        jmp @ready
@load:  lda #3
        sta COLOR
        ldy #13
        lda #<s_loading
        ldx #>s_loading
        jsr print_center
        jsr tod_reset
        jsr set_loadbuf
        lda filep
        ldx filep+1
        jsr fl_load
        bcc :+
        jmp disk_error
:       jsr tod_read            ; PT = "Loaded from disk in N.N s"
        lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<OVERLAY
        sta DST
        lda #>OVERLAY
        sta DST+1
        jsr lz_unpack
        lda filep
        sta LOADED
        lda filep+1
        sta LOADED+1
@ready: ; ready screen: name, help, load info
        lda #0
        sta COLOR
        jsr cls
        lda #7
        sta COLOR
        ldy #7
        lda MG_NAME
        ldx MG_NAME+1
        jsr print_center
        lda #1
        sta COLOR
        ldy #10
        lda MG_HELP
        ldx MG_HELP+1
        jsr print_center
        lda #3
        sta COLOR
        ldy #14
        lda PT
        ldx PT+1
        jsr print_center
        lda #5
        sta COLOR
        ldy #19
        lda #<s_pressfire
        ldx #>s_pressfire
        jsr print_center
.ifdef AUTOPLAY
        jsr blk_show
.endif
        jsr wait_fire
        lda coffee
        sec
        sbc cost
        sta coffee
        lda #0
        sta COLOR
        jsr cls
        lda #0                  ; difficulty: floor 1 = easiest
        ldx #0                  ; department: lobby
        jsr MG_INIT
@frame: jsr wait_frame
        jsr read_input
.ifdef AUTOPLAY
        lda #0                  ; test builds: the overlay's bot plays, not the scripted joystick
        sta JOYP
.endif
        jsr MG_FRAME
        bcc @frame
        lda #0                  ; sprites and border as the overlay may have left them
        sta $d015
        sta $d017
        sta $d01d
        sta $d01b
        sta $d020
        ; result
        lda MG_SCORE
        ldx #0
        cmp #89
        bcc :+
        inx
        cmp #153
        bcc :+
        inx
        cmp #217
        bcc :+
        inx
:       stx T2                  ; stars
        txa
        clc
        adc stars
        sta stars
        ; paperclips: economy.taskReward(floor, stars)
        ldx T2
        lda reward_tab,x
        sta T3
        clc
        adc clips
        sta clips
        bcc :+
        inc clips+1
:       ldx NEAR
        lda #1
        sta iadone,x
        jsr remove_marker
        ldx #0
        jsr music_start
        lda #SFX_GOOD
        jsr sfx
        ; result screen
        lda #0
        sta COLOR
        jsr cls
        lda #7
        sta COLOR
        ldy #7
        lda MG_NAME
        ldx MG_NAME+1
        jsr print_center
        ldx #0
@stars: lda #7
        sta COLOR
        lda #CH_STAR
        cpx T2
        bcc :+
        lda #6                  ; dim colour for missing stars
        sta COLOR
        lda #CH_STAROFF
:       stx SAVEX
        pha
        txa
        asl
        adc #17
        tax
        ldy #11
        pla
        jsr putc
        ldx SAVEX
        inx
        cpx #3
        bne @stars
        lda #1
        sta COLOR
        ldx #14
        ldy #14
        lda #'+'
        jsr putc
        lda T3
        jsr print_num_next
        lda #<s_clips
        sta PTR
        lda #>s_clips
        sta PTR+1
        jsr print_next
        lda #5
        sta COLOR
        ldy #19
        lda #<s_pressfire
        ldx #>s_pressfire
        jsr print_center
        jsr wait_fire
        jmp enter_floor

; Put back the char under a finished station's "!" marker.
remove_marker:
        ldy #3
        lda (IA),y
        cmp #$ff
        beq @done
        sta PT+1
        dey
        lda (IA),y
        clc
        adc #<FL_MAP
        sta PT
        lda PT+1
        adc #>FL_MAP
        sta PT+1
        ldy #4
        lda (IA),y
        ldy #0
        sta (PT),y
        lda PT
        clc
        adc #<(FL_COL - FL_MAP)
        sta PT
        lda PT+1
        adc #>(FL_COL - FL_MAP)
        sta PT+1
        ldy #5
        lda (IA),y
        ldy #0
        sta (PT),y
@done:  rts

; CIA 1 time-of-day clock: counts 50 Hz mains ticks on its own, so it stays right while interrupts are off.
tod_reset:
        lda $dc0e
        ora #$80                ; 50 Hz TOD input (PAL)
        sta $dc0e
        lda $dc0f
        and #$7f                ; writes set the clock, not the alarm
        sta $dc0f
        lda #0
        sta $dc0b               ; hours: stops the clock
        sta $dc0a
        sta $dc09
        sta $dc08               ; tenths: starts it
        rts

; PT = "Loaded from disk in S.T s", straight from the BCD clock.
tod_read:
        lda $dc0b               ; latch
        lda $dc0a
        lda $dc09               ; seconds (BCD)
        sta T0
        lda $dc08               ; tenths, unlatches
        and #$0f
        ora #'0'
        pha
        ldy #0
        lda T0
        lsr
        lsr
        lsr
        lsr
        beq :+
        ora #'0'
        sta s_loadtime_num,y
        iny
:       lda T0
        and #$0f
        ora #'0'
        sta s_loadtime_num,y
        iny
        lda #'.'
        sta s_loadtime_num,y
        iny
        pla
        sta s_loadtime_num,y
        iny
        lda #' '
        sta s_loadtime_num,y
        iny
        lda #'s'
        sta s_loadtime_num,y
        iny
        lda #0
        sta s_loadtime_num,y
        lda #<s_loadtime
        sta PT
        lda #>s_loadtime
        sta PT+1
        rts

wait_fire:
.ifdef AUTOPLAY
        ldx #250                ; test builds: 5 s, long enough for a screenshot
.else
        ldx #25                 ; ignore presses for half a second
.endif
:       jsr wait_frame
        dex
        bne :-
:       jsr wait_frame
        jsr read_input
        lda JOYP
        and #J_FIRE
        beq :-
        lda #SFX_BLIP
        jmp sfx

.ifdef AUTOPLAY
; Log frames since the previous mark: wait for the drive, transfer, wait, transfer, ...
blk_mark:
        ldx blk_n
        cpx #16
        bcs :+
        lda FRAME
        sec
        sbc blk_t
        sta blk_log,x
        inc blk_n
:       lda FRAME
        sta blk_t
        rts

; Print the log on row 22: pairs "wait/transfer" in frames.
blk_show:
        lda #3
        sta COLOR
        ldx #1
        ldy #21
        lda #<s_boottime
        sta PTR
        lda #>s_boottime
        sta PTR+1
        jsr print
        lda #<boot_time
        sta PTR
        lda #>boot_time
        sta PTR+1
        jsr print_next
        lda #6
        sta COLOR
        ldx #0
        stx T2
@l:     ldx T2
        cpx blk_n
        bcs @done
        lda blk_log,x
        pha
        txa
        asl
        asl
        adc #0
        ldy #22
        cpx #8
        bcc :+
        ldy #23
        sbc #32
:       tax
        pla
        jsr print_num
        inc T2
        bne @l
@done:  rts
.endif

.include "loader.s"

set_loadbuf:
        lda #<LOADBUF
        sta DST
        lda #>LOADBUF
        sta DST+1
        rts

; Copy X pages from SRC to DST.
copy_pages:
        ldy #0
:       lda (SRC),y
        sta (DST),y
        iny
        bne :-
        inc SRC+1
        inc DST+1
        dex
        bne :-
        rts

; ---- API ----------------------------------------------------------------------------------------------
wait_frame:
        lda FRAME
:       cmp FRAME
        beq :-
        rts

; Joystick port 2 merged with the keyboard (WASD / cursor keys, SPACE or RETURN = fire).
read_input:
.ifdef AUTOPLAY
        jsr autoplay
.else
        lda $dc00
        eor #$ff
        and #$1f
.endif
        sta TMP
        ldx $cb                 ; KERNAL: matrix code of the key held down, 64 = none
        lda #0
        cpx #9
        bne :+
        lda #J_UP
:       cpx #10
        bne :+
        lda #J_LEFT
:       cpx #13
        bne :+
        lda #J_DOWN
:       cpx #18
        bne :+
        lda #J_RIGHT
:       cpx #60
        bne :+
        lda #J_FIRE
:       cpx #1
        bne :+
        lda #J_FIRE
:       cpx #7
        bne :+
        lda $028d
        lsr
        lda #J_DOWN
        bcc :+
        lda #J_UP
:       cpx #2
        bne :+
        lda $028d
        lsr
        lda #J_RIGHT
        bcc :+
        lda #J_LEFT
:       ora TMP
        sta TMP
        lda JOY
        eor #$ff
        and TMP
        sta JOYP
        lda TMP
        sta JOY
        rts

.ifdef AUTOPLAY
; Scripted joystick for headless tests: walk to the station, press fire, then poke at things.
autoplay:
        lda AUTOCNT
        bne @run
        ldy #0
        lda (AUTOPTR),y
        beq @free
        sta AUTOCNT
        iny
        lda (AUTOPTR),y
        sta AUTOBITS
        lda AUTOPTR
        clc
        adc #2
        sta AUTOPTR
        bcc @run
        inc AUTOPTR+1
@run:   dec AUTOCNT
        lda AUTOBITS
        rts
@free:  lda FRAME                ; fire every 2.5 s, so the screens stay up long enough for screenshots
        and #127
        bne :+
        lda #J_FIRE
        rts
:       cmp #64
        bne :+
        lda #J_RIGHT
        rts
:       lda #0
        rts
.endif

; A = random byte (xorshift16, J. Metcalf)
rand:
        lda RNG+1
        lsr
        lda RNG
        ror
        eor RNG+1
        sta RNG+1
        ror
        eor RNG
        sta RNG
        eor RNG+1
        sta RNG+1
        rts

; Screen + colour pointers for column X, row Y. Colour RAM shares the low 10 bits with the screen.
set_pos:
        txa
        clc
        adc srow_lo,y
        sta SCR
        sta CLR
        lda srow_hi,y
        adc #0
        sta SCR+1
        and #$03
        ora #>COLRAM
        sta CLR+1
        rts

cls:
        ldx #0
:       lda #' '
        sta SCREEN,x
        sta SCREEN+250,x
        sta SCREEN+500,x
        sta SCREEN+750,x
        lda COLOR
        sta COLRAM,x
        sta COLRAM+250,x
        sta COLRAM+500,x
        sta COLRAM+750,x
        inx
        cpx #250
        bne :-
        rts

print:
        jsr set_pos
print_next:                     ; continue at SCR/CLR
        ldy #0
:       lda (PTR),y
        beq @end
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        iny
        bne :-
@end:   tya
        clc
        adc SCR
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       rts

; A/X = string, Y = row: print centred.
print_center:
        sta PTR
        stx PTR+1
        sty T1
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #40                 ; 40 - length
        lsr
        tax
        ldy T1
        jmp print

putc:
        pha
        jsr set_pos
        pla
putc_next:
        ldy #0
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        inc SCR
        inc CLR
        bne :+
        inc SCR+1
        inc CLR+1
:       rts

fill:
        sta TMP+2
        jsr set_pos
        lda FILL_H
        sta TMP+3
@row:   ldy FILL_W
        dey
:       lda TMP+2
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        dey
        bpl :-
        lda SCR
        clc
        adc #40
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       dec TMP+3
        bne @row
        rts

; A = 0..255 at X, Y in decimal (no leading zeros).
print_num:
        pha
        jsr set_pos
        pla
print_num_next:
        ldy #0
        sty TMP+1               ; digits printed so far
        ldx #'0'
@h:     cmp #100
        bcc :+
        sbc #100
        inx
        bne @h
:       jsr @digit
        ldx #'0'
@t:     cmp #10
        bcc :+
        sbc #10
        inx
        bne @t
:       jsr @digit
        ora #'0'
        tax
        inc TMP+1               ; the last digit always prints
@digit: cpx #'0'                ; X = digit char, A = remainder (kept)
        bne :+
        ldy TMP+1
        beq @skip
:       sta TMP
        txa
        jsr putc_next
        lda TMP
        inc TMP+1
@skip:  rts

; clips (16-bit) at X, Y, 5 digits without leading zeros.
print_clips:
        jsr set_pos
        lda clips
        sta T0
        lda clips+1
        sta T1
        lda #0
        sta T3                  ; started
        ldx #0
@pow:   ldy #'0'
@sub:   lda T0
        sec
        sbc pow10_lo,x
        sta T2
        lda T1
        sbc pow10_hi,x
        bcc @out
        sta T1
        lda T2
        sta T0
        iny
        bne @sub
@out:   cpy #'0'
        bne :+
        lda T3
        bne :+
        cpx #4
        bne @next
:       tya
        stx SAVEX
        jsr putc_next
        ldx SAVEX
        inc T3
@next:  inx
        cpx #5
        bne @pow
        lda #' '                ; erase a digit left over from a shorter number
        jmp putc_next

; X, Y = top left, FILL_W × FILL_H outer size, COLOR: a frame of line chars (the inside is left alone).
box:
        jsr set_pos
        lda FILL_W
        sec
        sbc #1
        sta TMP+2               ; offset of the right edge
        lda FILL_H
        sec
        sbc #2
        sta TMP+3               ; rows between top and bottom
        lda #CH_TL
        ldx #CH_T
        ldy #CH_TR
        jsr @line
:       lda TMP+3
        beq :+
        jsr @down
        ldy #0
        lda #CH_L
        jsr @put
        ldy TMP+2
        lda #CH_R
        jsr @put
        dec TMP+3
        jmp :-
:       jsr @down
        lda #CH_BL
        ldx #CH_B
        ldy #CH_BR
@line:  sty TMP+1               ; A = left, X = middle, Y = right char
        ldy #0
        jsr @put
        iny
:       cpy TMP+2
        bcs :+
        txa
        jsr @put
        iny
        bne :-
:       lda TMP+1
@put:   sta (SCR),y
        lda COLOR
        sta (CLR),y
        rts
@down:  lda SCR
        clc
        adc #40
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       rts

; A = 0..38: timer bar on row 1, A cells of solid blocks in COLOR, the rest cleared.
bar:
        sta TMP+2
        ldx #1
        ldy #1
        jsr set_pos
        ldy #0
:       lda #' '
        cpy TMP+2
        bcs :+
        lda #CH_BLOCK
:       sta (SCR),y
        lda COLOR
        sta (CLR),y
        iny
        cpy #38
        bne :--
        rts

; A = n (1..255) -> A = random 0..n-1
rand_mod:
        sta TMP+2
        jsr rand
:       cmp TMP+2
        bcc :+
        sbc TMP+2
        bcs :-
:       rts

sfx:
        php
        sei
        jsr drum_start
        lda #20
        sta SFX_LOCK
        plp
        rts

; ---- IRQ + SID player ----------------------------------------------------------------------------
irq:
        lda #$ff
        sta $d019
        lda $d012
        cmp #MUSIC_LINE
        bcs @music
        ; below the HUD (lines 51-66): playfield screen, then YSCROLL on line 66, the HUD's last line.
        ; YSCROLL = 2 would match line 66 itself and start a bad line there, so it goes 1 first, 2 a line later.
        lda NEXT_D018
        sta $d018
        lda NEXT_S
        ora #$18
        tay
@w66:   ldx $d012
        cpx #66
        bcc @w66
        cpy #$1a
        bne @set
        lda #$19
        sta $d011
@w67:   ldx $d012
        cpx #67
        bcc @w67
@set:   sty $d011
        lda #MUSIC_LINE
        sta $d012
        jmp $febc               ; KERNAL: restore registers, RTI
@music: lda #$1b                ; YSCROLL 3 again for the HUD
        sta $d011
        lda #SPLIT_LINE
        sta $d012
        inc FRAME
        jsr music_play
        jmp $ea31               ; KERNAL: jiffy clock + keyboard scan, then RTI

; X = song index
music_start:
        php
        sei
        lda songs_lo,x
        sta MUS_SONG
        lda songs_hi,x
        sta MUS_SONG+1
        ldy #2
        lda (MUS_SONG),y
        sta MUS_LEN
        iny
        lda (MUS_SONG),y
        sta mus_w1
        sta $d404
        iny
        lda (MUS_SONG),y
        sta $d405
        iny
        lda (MUS_SONG),y
        sta $d406
        iny
        lda (MUS_SONG),y
        sta $d403
        iny
        lda (MUS_SONG),y
        sta mus_w2
        sta $d40b
        iny
        lda (MUS_SONG),y
        sta $d40c
        iny
        lda (MUS_SONG),y
        sta $d40d
        iny
        lda (MUS_SONG),y
        sta $d40a
        lda MUS_SONG
        clc
        adc #11
        sta MUS_DATA
        sta MUS_PTR
        lda MUS_SONG+1
        adc #0
        sta MUS_DATA+1
        sta MUS_PTR+1
        lda #0
        sta MUS_STEP
        sta $d402
        sta $d409
        lda #1
        sta MUS_TICK
        sta MUS_ON
        lda #$0f
        sta $d418
        plp
        rts

music_play:
        lda MUS_ON
        bne :+
        rts
:       dec MUS_TICK
        beq @step
        lda MUS_TICK
        cmp #1
        bne @tick
        ; one frame before the next step: release voices that change there (lets the next note retrigger)
        ldy #0
        lda (MUS_PTR),y
        beq :+
        lda mus_w1
        sta $d404
:       iny
        lda (MUS_PTR),y
        beq @tick
        lda mus_w2
        sta $d40b
@tick:  jmp drum_tick
@step:  lda MUS_STEP
        and #1
        tay
        lda (MUS_SONG),y
        sta MUS_TICK
        ldy #0
        lda (MUS_PTR),y
        beq @v2
        cmp #1
        beq @off1
        tax
        lda freq_lo,x
        sta $d400
        lda freq_hi,x
        sta $d401
        lda mus_w1
        ora #1
        sta $d404
        bne @v2
@off1:  lda mus_w1
        sta $d404
@v2:    iny
        lda (MUS_PTR),y
        beq @v3
        cmp #1
        beq @off2
        tax
        lda freq_lo,x
        sta $d407
        lda freq_hi,x
        sta $d408
        lda mus_w2
        ora #1
        sta $d40b
        bne @v3
@off2:  lda mus_w2
        sta $d40b
@v3:    iny
        lda (MUS_PTR),y
        beq @adv
        ldx SFX_LOCK
        bne @adv
        jsr drum_start
@adv:   lda MUS_PTR
        clc
        adc #3
        sta MUS_PTR
        bcc :+
        inc MUS_PTR+1
:       inc MUS_STEP
        lda MUS_STEP
        cmp MUS_LEN
        bne @tick
        lda #0
        sta MUS_STEP
        lda MUS_DATA
        sta MUS_PTR
        lda MUS_DATA+1
        sta MUS_PTR+1
        jmp drum_tick

; A = drum / effect id (1..8) on voice 3.
drum_start:
        sta DT0
        asl
        adc DT0
        asl                     ; × 6
        tax
        lda #0
        sta $d412
        lda drum_tab-6,x
        sta mus_w3
        lda drum_tab-6+1,x
        sta $d413
        lda drum_tab-6+2,x
        sta $d414
        lda drum_tab-6+3,x
        sta mus_f3
        sta $d40f
        lda #0
        sta $d40e
        lda drum_tab-6+4,x
        sta mus_sweep
        lda drum_tab-6+5,x
        sta mus_t3
        lda mus_w3
        ora #1
        sta $d412
        rts

drum_tick:
        lda SFX_LOCK
        beq :+
        dec SFX_LOCK
:       lda mus_t3
        beq @done
        dec mus_t3
        bne :+
        lda mus_w3
        sta $d412               ; gate off
        rts
:       lda mus_f3
        clc
        adc mus_sweep
        sta mus_f3
        sta $d40f
@done:  rts

; =====================================================================================================
.segment "RODATA"

; wave, AD, SR, freq hi, sweep per frame, frames
drum_tab:
        .byte $11, $09, $00, $12, $fe, 5    ; 1 kick
        .byte $81, $09, $00, $22, $00, 4    ; 2 snare
        .byte $81, $04, $00, $c0, $00, 1    ; 3 hat
        .byte $81, $08, $00, $c0, $00, 4    ; 4 open hat
        .byte $81, $03, $00, $50, $00, 1    ; 5 rim
        .byte $11, $06, $00, $30, $00, 3    ; 6 blip
        .byte $11, $08, $00, $28, $04, 10   ; 7 good
        .byte $21, $0a, $00, $0c, $ff, 12   ; 8 bad

reward_tab: .byte REWARD0, REWARD1, REWARD2, REWARD3
bit_tab: .byte 1, 2, 4, 8, 16, 32, 64, 128
dir_dx:  .byte 0, 0, $ff, 1             ; down, up, left, right
dir_dy:  .byte 1, $ff, 0, 0
look_dx: .byte 0, 0, $f9, 6             ; where to look for interactables per facing
look_dy: .byte 4, $f6, $fe, $fe
pow10_lo: .byte <10000, <1000, <100, <10, <1
pow10_hi: .byte >10000, >1000, >100, >10, >1

srow_lo: .repeat 25, i
        .byte <(SCREEN + i * 40)
        .endrep
srow_hi: .repeat 25, i
        .byte >(SCREEN + i * 40)
        .endrep
mrow_lo: .repeat 28, i
        .byte <(FL_MAP + i * 40)
        .endrep
mrow_hi: .repeat 28, i
        .byte >(FL_MAP + i * 40)
        .endrep
irow_lo: .repeat 28, i
        .byte <(FL_INFO + i * 40)
        .endrep
irow_hi: .repeat 28, i
        .byte >(FL_INFO + i * 40)
        .endrep

s_title:     .byte "SYNERGY TOWER", 0
s_sub:       .byte "Commodore 64 proof of concept", 0
s_loadfloor: .byte "Loading floor 1 from disk...", 0
s_diskerr:   .byte "Disk error. Is the disk in drive 8?", 0
s_fire:      .byte "FIRE:", 0
s_elevator:  .byte "Elevator: needs a promotion first.", 0
s_hr:        .byte "HR: come back with enough KPI stars.", 0
s_done:      .byte "Done here for today. Try another one.", 0
s_later:     .byte "Not on the C64 disk yet. Try another!", 0
s_nocoffee:  .byte "Out of coffee.", 0
s_loading:   .byte "Loading from disk...", 0
s_cached:    .byte "Still in memory: no disk access.", 0
s_pressfire: .byte "Press FIRE", 0
s_clips:     .byte " paperclips", 0
.ifdef AUTOPLAY
s_boottime:  .byte "Boot to floor: ", 0
.endif

.include "gen/music.s"

charset_data:
        .incbin "gen/charset.bin"
sprite_data:
        .incbin "gen/sprites.bin"
SPRITE_BYTES = * - sprite_data

.segment "DATA"
s_loadtime:  .byte "Loaded from disk in "
s_loadtime_num: .res 8, 0
.ifdef AUTOPLAY
.include "gen/autoplay.s"
.endif

.segment "BSS"
nact:    .res 1
ax_lo:   .res MAX_ACT
ax_hi:   .res MAX_ACT
ay:      .res MAX_ACT
adir:    .res MAX_ACT
aanim:   .res MAX_ACT
acol:    .res MAX_ACT
astill:  .res MAX_ACT
asteps:  .res MAX_ACT
amode:   .res MAX_ACT
iadone:  .res 16
clips:   .res 2
filep:   .res 2
blk_n:   .res 1
blk_t:   .res 1
blk_log: .res 16
boot_time: .res 8
cost:    .res 1
coffee:  .res 1
stars:   .res 1
mus_w1:  .res 1
mus_w2:  .res 1
mus_w3:  .res 1
mus_f3:  .res 1
mus_t3:  .res 1
mus_sweep: .res 1
