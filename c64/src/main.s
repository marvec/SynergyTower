; SynergyTower for the Commodore 64, resident part.
;
; Memory map ($01 = $36: BASIC ROM out, KERNAL + I/O in)
;   $0002-$003f, $0080-$008f  zero page (shared part in api.inc, resident part in zp.inc)
;   $0801-$3fff  part 1: BASIC stub, API table, engine, charset/sprite/music data
;   $4000-$5fff  overlay slot: mini-games (mg.*), title + setup (sys.title), terminal (sys.term)
;   $6000-$7fff  load buffer for packed files
;   $8000-$93ff  current floor (floorNN, unpacked): map, colours, walk/interact grid, header
;   $9400-$94ff  career state = the save game (state.inc)
;   $9500-$bfff  part 2: dialogs, game table, economy tables, strings
;   $c000/$c400  screens (VIC bank 3)    $c800 charset (file chars)
;   $e000-$fff9  part 3 (RAM under the KERNAL): sprites, then long texts read with the KERNAL banked out
; Files are loaded by track/sector through our own fast loader (drive code in src/drive.s); the C64 clocks
; every bit, so the raster IRQ (SID music) keeps running during loads. Only the boot file uses the KERNAL.

.include "api.inc"
.include "state.inc"
.include "gen/floor.inc"
.include "gen/files.inc"
.include "gen/chars.inc"

LOADBUF  = $6000
SPRBASE  = ($e000 - $c000) / 64   ; sprite pointer of the first person frame
CHARSET  = $c800
SCREEN2  = $c400                  ; second screen for the scrolling playfield
MAX_ACT  = 16
HUD_ROWS = 3                      ; fixed rows at the top; the playfield scrolls below them
PF_ROWS  = 25 - HUD_ROWS
CAM_MAX  = (28 - PF_ROWS) * 8     ; camera range in map pixels
SPLIT_LINE = 70                   ; raster IRQ below the HUD: fine scroll + screen of the playfield
MUSIC_LINE = 250                  ; raster IRQ below the screen: music, frame counter, keyboard
SONG_FLOOR    = 0
SONG_MINIGAME = 1
SONG_TITLE    = 2
REVIEW_PASS   = 153               ; 60 % of 255
COFFEE_MACHINE_S = 15 * 60
CHECKIN_TOAST_T = 150             ; frames from the receptionist's welcome to the coffee card toast
PLAYER_SHIRT  = 15                ; light grey (src/game.js playerLook, floors 1-15)
RECENT        = 8                 ; colleague lines not repeated soon
ACTOR_HAIR    = 4                 ; your hair (an overlay sprite on your head)
HAIR_SPR      = ($fd00 - $c000) / 64   ; its frames (down, up, left, right), put there by sys.title

.include "zp.inc"
.import __BSS_RUN__, __BSS_SIZE__, __BSS2_RUN__, __BSS2_SIZE__

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
        jmp print_raw
        jmp sfx
        jmp rand
        jmp fill
        jmp print_num
        jmp putc
        jmp print_center_raw
        jmp box
        jmp bar
        jmp rand_mod
        jmp getkey
        jmp play_song

; =====================================================================================================
start:
        sei
        cld
        lda #$36
        sta $01
        lda #<__BSS_RUN__       ; variables start at 0
        ldx #>__BSS_RUN__
        ldy #>(__BSS_SIZE__ + 255)
        jsr clear_pages
        lda #<__BSS2_RUN__
        ldx #>__BSS2_RUN__
        ldy #>(__BSS2_SIZE__ + 255)
        jsr clear_pages
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
        ; (the charset and the sprites are in place: the boot file unpacked them to $c800 and $e000)
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
        lda #<nmi_rti           ; RESTORE while the KERNAL is banked out (far_str): ignore it
        sta $fffa
        lda #>nmi_rti
        sta $fffb
        lda #1                  ; defaults until a save says otherwise
        sta st_music
        sta st_sfx
        cli
        lda #0                  ; a clean screen while the save and the title load
        sta COLOR
        jsr cls
        lda #3
        sta COLOR
        ldy #12
        lda #<s_loading
        ldx #>s_loading
        jsr print_center
        jsr load_game
        lda #0
        rol                     ; C=1: no save
        eor #1
        sta HAVE_SAVE

; ---- title, setup, intro (sys.title overlay) ----------------------------------------------------------
title:
        ldx #$ff                ; a fresh start (also from the menu's "Save & quit")
        txs
        jsr plain_screen
        lda #0
        sta $d015
        sta PANEL_T
        sta QACT                ; (a quest doesn't survive quitting to the title)
.ifdef AUTOPLAY
        lda HAVE_SAVE           ; test builds: straight into a fresh career
        bne :+
        jsr auto_career
:       jmp career
.endif
        lda #SYS_TITLE_T
        ldx #SYS_TITLE_S
        jsr load_overlay
        lda HAVE_SAVE
        jsr OVERLAY             ; -> A = 1 new career (names + looks filled in), 0 continue
        cmp #1
        bne career
        jsr st_new
        lda #1
        sta st_intro            ; (the overlay showed the intro)
        sta HAVE_SAVE
        jsr save_game
career: ldx #SONG_FLOOR
        jsr play_song
        jsr load_floor
        jsr init_actors
        jsr enter_floor
        lda st_welcome
        bne :+
        lda #1
        sta st_welcome
        jsr welcome
        jsr save_game
        jsr enter_floor
:       jsr arrival_banner
        lda #4                  ; first nudge after 4 s
        sta NUDGE_T
        lda st_lobby            ; checking in: the receptionist greets you
        bne floor_loop
        lda FL_HDR + HDR_FLOORNO
        cmp #1
        bne floor_loop
        lda #CHECKIN_TOAST_T
        sta GREET_T

; ---- the floor ------------------------------------------------------------------------------------
floor_loop:
        jsr wait_frame
        jsr camera_swap         ; the beam just left the playfield: swap screens if one is ready,
        jsr mux_show            ; move the sprites with the camera,
        jsr camera_colours      ; and copy the colour RAM before the beam is back
        jsr hud_sync
        jsr read_input
        jsr move_player
        jsr move_npcs
        jsr camera_step
        jsr check_near
        jsr bump_gate
        jsr panel_tick
        jsr timed_lines
        lda CLOCK               ; once a second: timers, coffee, markers
        cmp LAST_SEC
        beq :+
        sta LAST_SEC
        jsr sec_tasks
:       jsr mux_build
        jsr getkey
        beq @fire
        ldx #0                  ; hotkeys
:       cmp hot_keys,x
        beq @hot
        inx
        cpx #HOT_N
        bne :-
@fire:  lda JOYP
        and #J_FIRE
        beq floor_loop
        jsr interact
        jmp floor_loop
@hot:   txa
        asl
        tax
        lda hot_jump+1,x
        pha
        lda hot_jump,x
        pha
        rts                     ; (each returns through enter_floor to the loop... via jmp below)

hot_keys:  .byte 3, 'B', 'P', 'T', 'S', 'M', 'H', '?', 95, 'G'
HOT_N = * - hot_keys
hot_jump:  .word hk_menu - 1, hk_shop - 1, hk_perks - 1, hk_train - 1, hk_stats - 1, hk_music - 1
           .word hk_help - 1, hk_help - 1, hk_menu - 1, hk_giveup - 1
hk_menu:  jsr pause_menu
          jmp floor_loop
hk_shop:  jsr shop
          jmp floor_loop
hk_perks: jsr perks
          jmp floor_loop
hk_train: jsr train
          jmp floor_loop
hk_stats: jsr stats_dialog
          jmp floor_loop
hk_giveup:
          lda QACT
          beq :+
          jsr quest_giveup
:         jmp floor_loop
hk_help:  jsr how_to
          jsr enter_floor
          jmp floor_loop
hk_music: lda st_music
          eor #1
          sta st_music
          jsr music_apply
          lda #<s_musicon_t
          ldx #>s_musicon_t
          ldy st_music
          bne :+
          lda #<s_musicoff_t
          ldx #>s_musicoff_t
:         jsr toast
          jmp floor_loop

; Once a second on the floor.
sec_tasks:
        jsr coffee_tick
        jsr update_markers
        jsr hud_values
        lda NEAR                ; prompts with a countdown
        cmp #$ff
        beq :+
        jsr draw_status
:       jsr quest_tick
        jmp recep_tick

; Lines that follow a moment after something else (the receptionist's greeting, the coffee card toast).
timed_lines:
        lda GREET_T
        beq :+
        dec GREET_T
        cmp #CHECKIN_TOAST_T - 25
        bne :+
        lda #0
        sta GREET_T
        jsr sb_line             ; "Welcome, <name>! Please check in at the front desk."
        lda #<s_welcome_r
        ldx #>s_welcome_r
        jsr sb_str
        lda #<st_name
        ldx #>st_name
        jsr sb_str
        lda #<s_welcome_r2
        ldx #>s_welcome_r2
        jsr sb_str
        jsr sb_end
        lda #<linebuf
        ldx #>linebuf
        jsr recep_say
:       lda CHECKIN_T
        beq :+
        dec CHECKIN_T
        bne :+
        jsr sb_line             ; "Coffee card loaded: N cups. It refills by itself from now on."
        lda #<s_cardloaded
        ldx #>s_cardloaded
        jsr sb_str
        lda st_coffee
        jsr sb_num
        lda #<s_cardloaded2
        ldx #>s_cardloaded2
        jsr sb_str
        jsr sb_end
        jmp toast_line
:       rts

disk_error:
        jsr plain_screen
        lda #2
        sta COLOR
        ldy #18
        lda #<s_diskerr
        ldx #>s_diskerr
        jsr print_center
:       jmp :-

nmi_rti:
        rti

; A = track, X = sector of an overlay: load it to $4000 unless it is the one there already.
load_overlay:
        cmp LOADED
        bne :+
        cpx LOADED+1
        beq @done
:       sta LOADED
        stx LOADED+1
        jsr set_loadbuf
        lda LOADED
        ldx LOADED+1
        jsr fl_load
        bcc :+
        jmp disk_error
:       lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<OVERLAY
        sta DST
        lda #>OVERLAY
        sta DST+1
        jsr lz_unpack
@done:  rts

; The workstation: the terminal. Too big for the overlay slot, it is unpacked in place over $4000-$93ff (slot,
; load buffer and floor) from a packed copy loaded to the top of that area; the floor is loaded again after.
; It returns A = floor to warp to (systemctl isolate), 0 = none.
open_terminal:
        jsr plain_screen
        lda #0
        sta $d015
        sta LOADED              ; (the overlay slot gets overwritten)
        sta LOADED+1
        sta COLOR
        jsr cls
        lda #3
        sta COLOR
        ldy #12
        lda #<s_loading
        ldx #>s_loading
        jsr print_center
        lda FL_HDR + HDR_TERMID
        sta MG_WS
        lda #<SYS_TERM_AT
        sta DST
        lda #>SYS_TERM_AT
        sta DST+1
        lda #SYS_TERM_T
        ldx #SYS_TERM_S
        jsr fl_load
        bcc :+
        jmp disk_error
:       lda #<SYS_TERM_AT
        sta SRC
        lda #>SYS_TERM_AT
        sta SRC+1
        lda #<OVERLAY
        sta DST
        lda #>OVERLAY
        sta DST+1
        jsr lz_unpack
        jsr OVERLAY
        sta T3
        lda #0                  ; the floor again
        sta COLOR
        jsr cls
        jsr load_floor
        lda T3
        beq :+
        jmp warp
:       jmp enter_floor

; Draw the whole floor screen: HUD, map, sprites.
enter_floor:
        jsr plain_screen
        lda #0
        sta COLOR
        jsr cls
        lda #$ff
        sta NEAR
        lda #0
        sta REDRAW
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
        ldx st_skin             ; skin: the sprites' shared colour, your choice
        lda skin_c64,x
        sta $d026
        lda #0                  ; people: multicolour, black outline, normal size (overlays change these)
        sta $d025
        sta $d017
        sta $d01d
        lda #$ff
        sta $d01c
        jsr update_sprites
        lda #0
        sta $c6
        rts

; Screen $c000 without scrolling (title, mini-games, dialogs).
plain_screen:
        lda #0
        sta MUXN
        sta FRONT
        sta PEND
        lda #$02                ; screen $c000, charset $c800
        sta NEXT_D018
        lda #3
        sta NEXT_S
        rts

.ifdef AUTOPLAY
; Test builds: a career without the title screen.
auto_career:
        ldx #0
:       lda s_autocorp,x
        sta st_corp,x
        beq :+
        inx
        bne :-
:       ldx #0
:       lda s_autoname,x
        sta st_name,x
        beq :+
        inx
        bne :-
:       lda #0
        sta st_color
        lda #1                  ; a look to see on the floor: tan, blond, long hair
        sta st_skin
        lda #2
        sta st_hair
        sta st_hstyle
        lda #SYS_TITLE_T
        ldx #SYS_TITLE_S
        jsr load_overlay
        jsr OVERLAY + 3
        jsr st_new
        lda #1
        sta st_intro
        sta st_welcome
        lda #AUTO_LOBBY
        sta st_lobby
        lda #AUTO_FLOOR         ; the floor of the game under test
        sta st_floor
        sta st_max
        lda #AUTO_COFFEE
        sta st_coffee
        lda #AUTO_READY
        beq :+
        lda #10                 ; promotion-ready: stars, level, keycard fee
        sta st_stars
        lda #2
        sta st_level
        lda #200
        sta st_sp
:
        lda #<autoplay_script
        sta AUTOPTR
        lda #>autoplay_script
        sta AUTOPTR+1
        lda #0
        sta AUTOCNT
        rts
s_autocorp: .byte "Synergex", 0
s_autoname: .byte "Tester", 0
.endif

.include "actors.s"
.include "scroll.s"
.include "floor.s"
.include "hud.s"
.include "host.s"
.include "quest.s"
.include "state.s"
.include "save.s"
.include "text.s"
.include "loader.s"

set_loadbuf:
        lda #<LOADBUF
        sta DST
        lda #>LOADBUF
        sta DST+1
        rts

; Clear Y pages from A/X on (a little past the end is fine: the BSS areas end below $4000 / $c000).
clear_pages:
        sta DST
        stx DST+1
        lda #0
        tax
:       sta (DST,x)
        inc DST
        bne :-
        inc DST+1
        dey
        bne :-
        rts


.include "screen.s"
.include "irq.s"

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

corp_c64: .byte 14, 3, 9, 6, 2, 5, 7, 10, 4, 8, 12, 13   ; data/corpColors.js -> C64 colours
hair_c64: .byte 0, 9, 7, 2, 15                           ; HAIR_COLORS (as tools/titledata.js)
skin_c64: .byte 10, 8, 9, 9                              ; SKIN_TONES
bit_tab: .byte 1, 2, 4, 8, 16, 32, 64, 128
bit_inv: .byte $fe, $fd, $fb, $f7, $ef, $df, $bf, $7f
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

.include "gen/music.s"
.include "gen/bpe.s"

.segment "DATA"
.ifdef AUTOPLAY
.include "gen/autoplay.s"
.endif

; ---- part 2 ($9500) -----------------------------------------------------------------------------------
.segment "CODE2"
.include "ui.s"
.include "dialogs.s"
.include "menus.s"
.include "ride.s"

.segment "RODATA2"
.include "gen/strings.s"
.include "gen/games.s"
.include "gen/econ.s"

; ---- part 3 ($e000, under the KERNAL) --------------------------------------------------------------------
.segment "FAR"
sprite_data:                    ; $e000: 12 person frames (VIC bank 3 pointers 128-139)
        .incbin "gen/sprites.bin"
        .res 6 * 64             ; $e300: Boss Alert's frames (the overlay copies them here)
.include "gen/far.s"
.include "gen/fartext.s"

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
abase:   .res MAX_ACT               ; sprite pointer of the actor's first frame
ssy:     .res MAX_ACT               ; screen y this frame
vis:     .res MAX_ACT               ; visible actors, sorted by ssy
nvis:    .res 1
dn:      .res 1                     ; display list (built by mux_build)
d_line:  .res MAX_ACT
d_hw:    .res MAX_ACT
d_x:     .res MAX_ACT
d_y:     .res MAX_ACT
d_msb:   .res MAX_ACT
d_col:   .res MAX_ACT
d_ptr:   .res MAX_ACT
akind:   .res MAX_ACT               ; ACTOR_* (colleague, receptionist, HR rep)
apause:  .res MAX_ACT               ; frames a colleague stands still (talking)
mus_w1:  .res 1
mus_w2:  .res 1
mus_w3:  .res 1
mus_f3:  .res 1
mus_t3:  .res 1
mus_sweep: .res 1

HAVE_SAVE: .res 1
LAST_SEC:  .res 1
PANEL_T:   .res 1               ; frames left on the HUD panel (speech, toast)
NUDGE_T:   .res 1
NUDGE_I:   .res 1
GREET_T:   .res 1
CHECKIN_T: .res 1
NAG_T:     .res 1
BUMP_T:    .res 1
REDRAW:    .res 1               ; the map changed: redraw the playfield
MK_I:      .res 1
MK_C:      .res 1
MK_COL:    .res 1
TALK_A:    .res 1
TMPW:      .res 2
HW_ROW:    .res 1
HW_COL:    .res 1
HW_WS:     .res 1
HW_X:      .res 1
HW_Y:      .res 1
STATUS_COL: .res 1
FL_MINCOST: .res 1              ; cheapest / priciest task on this floor (HUD coffee colour)
FL_MAXCOST: .res 1
CUR_SONG:  .res 1
QACT:      .res 1               ; a floor quest is on
QPHASE:    .res 1               ; 0 search, 1 back to the desk
QDL:       .res 3               ; its deadline
QSTATION:  .res 1
QFIRST:    .res 1               ; the first board actor
QCHECKED:  .res 1
QFAIL_T:   .res 2
QDESK:     .res 1
HAIR_A:    .res 1               ; the hair actor
recent:    .res RECENT
farbuf:    .res 256
textbuf = farbuf                ; (composed texts: never needed while a far text is)

.segment "LOWBSS"                ; $0200 (BASIC's input buffer)
MUXN:    .res 1                     ; entries 8+ for the IRQ (copied by mux_show)
MUXI:    .res 1
m_line:  .res MAX_ACT - 8
m_hw:    .res MAX_ACT - 8
m_hw2:   .res MAX_ACT - 8
m_x:     .res MAX_ACT - 8
m_y:     .res MAX_ACT - 8
m_msb:   .res MAX_ACT - 8
m_col:   .res MAX_ACT - 8
m_ptr:   .res MAX_ACT - 8

.segment "BSS2"
UI_TITLE:  .res 2
UI_ROW:    .res 1
UI_COL:    .res 1
UI_NB:     .res 1
UI_LR:     .res 1
UI_CB:     .res 2
UI_WS:     .res 1
UI_SX:     .res 1
UI_SY:     .res 1
UI_KEY:    .res 1
UI_BROW:   .res 1
UI_FOCUS:  .res 1
ui_blo:    .res UI_MAXB
ui_bhi:    .res UI_MAXB
ui_bfl:    .res UI_MAXB
ui_bkey:   .res UI_MAXB
lbuf0 = $02c1                   ; button labels: 40 bytes in the free page-2 area,
lbuf1 = $033c                   ; 6 × 32 in the tape buffer (no tape here)
CARD_I:    .res 1
CARD_G:    .res 1
CARD_ACT:  .res 1
CARD_COST: .res 1
LIFT_PB:   .res 1
LIFT_F:    .res 1
STAT_TAB:  .res 1
SHOP_P:    .res 1
PERK_I:    .res 1
HOST_I:    .res 1
HOST_G:    .res 1
HOST_COST: .res 1
HOST_CHECKIN: .res 1
HOST_REVIEW: .res 1
HOST_STARS: .res 1
HOST_SO:   .res 1
HOST_BEST: .res 1
RIDE_FROM: .res 1
RIDE_TO:   .res 1
RIDE_SHOW: .res 1
RIDE_K:    .res 1
RIDE_T:    .res 1
RIDE_WARP: .res 1
