; Badge Tailgate (src/minigames/tailgate.js) as a disk-loaded overlay at $4000.
; A queue walks toward the lobby turnstile. Employees badge in (green BEEP, "ID" above the head), visitors wear
; a VISITOR sticker ("VIS"); anyone with neither is a stranger, sometimes tailgating right behind a colleague
; or in a disguise (ladder, pizza, hi-vis, duck). Stop the strangers before they cross the gate line.
; Difficulty 0 (floor 1): 42 px/s, one arrival every ~1.75 s for 30 s, 12 % tailgaters, 20 % lone strangers,
; 12 % visitors, at least 4 strangers. Score = (caught - 0.75 × wrong stops) / strangers.
; Coordinates are C64 pixels (2/3 of the browser's 480-px-wide scene); people are expanded sprites.
; Content: src/data/mg-tailgate.js (gen/mg_tailgate_data.s, also the disguise sprite frames).

.include "api.inc"
.include "gen/chars.inc"

MAXP      = 40                  ; people in the queue (a round has ~16-24)
GATE_X    = 220                 ; the gate line (browser 330)
BEEP_X    = GATE_X - 9          ; badges are read here (browser GATE_X - 14)
ZONE_X    = 107                 ; badge indicators light up from here (browser REVEAL = 170)
APPEAR_X  = 32                  ; people come out of the revolving door here
EXIT_X    = 272                 ; ... and step into the elevator lobby here (keeps it to 8 sprites)
SPAWN_X   = -11                 ; the queue starts behind the door (browser -16)
TAIL_GAP  = 17                  ; a tailgater walks this close behind (browser 26)
MIN_GAP   = 29                  ; browser 44
LANE_Y    = 128                 ; sprite y of someone in the queue (feet on pixel row 119)
ASIDE_DY  = 16                  ; pulled aside: 16 px lower (browser 24)
ASIDE_IN  = 12                  ; frames to step aside (0.25 s)
HOLD_STR  = 95                  ; a stopped stranger argues 1.9 s, then gets escorted out
HOLD_OK   = 75                  ; a wrongly stopped colleague complains 1.5 s, then passes
FLAP_T    = 37                  ; the flap stays open 0.75 s after a beep
LED_T     = 25
GUARD_T   = 25
FLOAT_T   = 50
FLASH_T   = 10                  ; border flash instead of the screen shake
TAIL_MAX  = 3750                ; 75 s
END_PAD   = 175                 ; 3.5 s after the last person reaches the gate (+27 px)
PERSON_L  = ($e000 - $c000) / 64 + 6    ; person frames walking left: 134-136, right: 137-139
PERSON_R  = PERSON_L + 3
OUTFIT_P  = ($e300 - $c000) / 64        ; duck R/L, pizza R/L, ladder R/L (140-145)

; states, kinds, outfits, flags
ST_WALK   = 0
ST_ASIDE  = 1
ST_ESCORT = 2
ST_PASS   = 3
ST_GONE   = 4
K_EMP     = 0
K_VIS     = 1
K_STR     = 2
O_LADDER  = 1
O_PIZZA   = 2
O_HIVIS   = 3
O_DUCK    = 4
F_CROSSED = 1
F_BEEPED  = 2
F_HOP     = 4

; rows
SIGN_Y    = 2
DOOR_Y    = 6
MARK_Y    = 9                   ; target marker
BADGE_Y   = 10                  ; badge indicators (on the baseboard)
FLOOR_Y   = 11
CARPET_Y  = 14
FLOAT_Y   = 17
UI_Y      = 18
GATE_COL  = 27
GUARD_COL = 30
QUARTER   = 240                 ; + pattern: quarter-block chars

.zeropage
n:        .res 1                ; people in the queue
spd:      .res 1                ; walking speed, 1/256 px per frame
spd_pass: .res 1                ; 1.2 × spd
gap:      .res 1                ; average spacing (speed × interval)
tail_p:   .res 1                ; chances out of 256
th_solo:  .res 1
th_vis:   .res 1
disg_p:   .res 1
dist:     .res 2
arr:      .res 2                ; queue length (speed × 30 s of arrivals)
caught:   .res 1
wrong:    .res 1
sneaked:  .res 1
strangers: .res 1
flap_t:   .res 1
led_t:    .res 1
led_col:  .res 1
guard_t:  .res 1
float_t:  .res 1
flash_t:  .res 1
anim:     .res 1
door_t:   .res 1
door_k:   .res 1
elev_t:   .res 1
elev1:    .res 1
elev2:    .res 1
manual:   .res 1                ; person picked with left/right, $ff = the one nearest the gate
target:   .res 1                ; $ff = nobody
tidx:     .res 1                ; target's position in cands
nc:       .res 1
bubble_p: .res 1                ; whose speech bubble is up, $ff = none
pi:       .res 1
slot:     .res 1
xmsb:     .res 1
enable:   .res 1
done:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
dv:       .res 3                ; div24 dividend -> quotient
rem:      .res 1
dsr:      .res 1
sp:       .res 2
bw:       .res 1                ; speech bubble box
bh:       .res 1
bx:       .res 1
by:       .res 1
l2:       .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; N=0 if person X's x >= c (signed 16-bit compare).
.macro xge c
        lda p_xlo,x
        cmp #<(c)
        lda p_xhi,x
        sbc #>(c)
        bvc *+4                 ; (no label: it would end the @local scope)
        eor #$80
.endmacro

; ---- setup

; A = difficulty 0-255 (d = A / 255; floors 1-2 stay below ~0.18)
init:
        sta t0
        ldx #<(done - n)
        lda #0
:       sta n,x
        dex
        bpl :-
        lda #$ff
        sta manual
        sta target
        sta bubble_p
        lda #6                  ; (browser: ex / 2 + seconds, mod 40)
        sta elev1
        lda #31
        sta elev2
        ; byDiff over d = A / 255, linearised for d < 0.2
        lda t0
        lsr
        clc
        adc #143                ; 42 px/s -> 143/256 px per frame (+ 38 px/s × d)
        sta spd
        lsr
        lsr
        lsr
        sta t1
        lsr
        sta t2
        lsr
        lsr
        clc
        adc t1
        adc t2
        adc spd
        sta spd_pass            ; × 1.203
        lda t0
        lsr
        lsr
        lsr
        lsr
        sta t1
        lsr
        clc
        adc t1
        adc #49                 ; speed × interval: 73.5 browser px = 49 (+ 23 × d)
        sta gap
        lda t0                  ; arrivals: 840 + 4A px (1260 browser px at d = 0)
        asl
        sta arr
        lda #0
        rol
        sta arr+1
        asl arr
        rol arr+1
        lda arr
        clc
        adc #<840
        sta arr
        lda arr+1
        adc #>840
        sta arr+1
        lda t0                  ; tailgaters: 0.12 + 0.16 d
        lsr
        lsr
        lsr
        sta t1
        lsr
        lsr
        clc
        adc t1
        adc #31
        sta tail_p
        adc #51                 ; lone strangers 0.2
        sta th_solo
        adc #31                 ; visitors 0.12
        sta th_vis
        lda t0                  ; disguise: 0.1 + 0.6 d
        lsr
        sta t1
        lsr
        lsr
        clc
        adc t1
        adc #26
        sta disg_p
        jsr make_queue
        ; disguise frames into the sprite area (RAM under the KERNAL)
        ldx #0
:       lda outfit_frames,x
        sta $e300,x
        lda outfit_frames+128,x
        sta $e380,x
        lda outfit_frames+256,x
        sta $e400,x
        inx
        bpl :-
        ; sprites: expanded multicolour, in front of the scenery
        lda #$ff
        sta $d017
        sta $d01d
        sta $d01c
        lda #0
        sta $d01b
        sta $d015
        sta $d025               ; outline black
        lda #10
        sta $d026               ; skin
        jsr draw_scene
        ; time limit: until the last person is 27 px past the gate, + 3.5 s, at most 75 s
        ldx n
        dex
        lda #<(GATE_X + 27)
        sec
        sbc p_xlo,x
        sta dv+1
        lda #>(GATE_X + 27)
        sbc p_xhi,x
        sta dv+2
        lda #0
        sta dv
        lda spd
        sta dsr
        jsr div24
        lda dv
        clc
        adc #<END_PAD
        sta dv
        lda dv+1
        adc #>END_PAD
        sta dv+1
        cmp #>TAIL_MAX
        bcc :+
        bne @cap
        lda dv
        cmp #<TAIL_MAX
        bcc :+
@cap:   lda #<TAIL_MAX
        sta dv
        lda #>TAIL_MAX
        sta dv+1
:       lda dv
        ldx dv+1
        jmp timer_start

; Everyone walks at the same speed, so the whole queue is laid out up front behind the door.
make_queue:
        lda #13                 ; browser 20
        sta dist
        lda #0
        sta dist+1
@next:  lda n
        cmp #MAXP - 1
        bcc :+
        jmp @full
:       lda dist+1
        cmp arr+1
        bcc :+
        bne @full
        lda dist
        cmp arr
        bcs @full
:       jsr API_RAND
        sta t2
        cmp tail_p
        bcs @solo
        lda #K_EMP              ; a colleague with a tailgater right behind
        jsr add_person
        lda dist
        clc
        adc #TAIL_GAP
        sta dist
        bcc :+
        inc dist+1
:       lda #K_STR
        jsr add_person
        lda #1
        sta p_tail,x
        bne @step
@solo:  lda #K_STR
        ldx t2
        cpx th_solo
        bcc @add
        lda #K_VIS
        cpx th_vis
        bcc @add
        lda #K_EMP
@add:   jsr add_person
@step:  lda #141                ; gap × (0.75 .. 1.3) = gap × 192 / 256 + gap × (0..140) / 256
        jsr API_RMOD
        sta t1
        lda gap
        jsr mul8
        sta t2
        lda #192
        sta t1
        lda gap
        jsr mul8
        clc
        adc t2
        cmp #MIN_GAP
        bcs :+
        lda #MIN_GAP
:       clc
        adc dist
        sta dist
        bcc :+
        inc dist+1
:       jmp @next
@full:
        ; at least four strangers per round: unmask random colleagues
        lda #50
        sta t2
@more:  ldx n
        lda #0
        sta strangers
:       dex
        bmi :+
        lda p_kind,x
        cmp #K_STR
        bne :-
        inc strangers
        bne :-
:       lda strangers
        cmp #4
        bcs @colours
        dec t2
        beq @colours
        lda n
        jsr API_RMOD
        tax
        lda p_kind,x
        bne @more               ; (K_EMP = 0)
        lda #K_STR
        sta p_kind,x
        jsr disguise
        jmp @more
@colours:
        ldx n
@c:     dex
        bmi @done
        stx t0
        lda #8
        jsr API_RMOD
        tay
        lda shirt_tab,y
        ldx t0
        ldy p_out,x
        beq :+
        lda outfit_col-1,y
:       sta p_col,x
        jmp @c
@done:  rts

; A = kind: append a person at x = SPAWN_X - dist. Returns X = index.
add_person:
        ldx n
        inc n
        sta p_kind,x
        lda #<SPAWN_X
        sec
        sbc dist
        sta p_xlo,x
        lda #>SPAWN_X
        sbc dist+1
        sta p_xhi,x
        lda #0
        sta p_frac,x
        sta p_st,x
        sta p_tail,x
        sta p_out,x
        sta p_flags,x
        sta p_dy,x
        lda p_kind,x
        cmp #K_STR
        bne :+
        ; fall through
; Person X (a stranger): a disguise with chance disg_p. Keeps X.
disguise:
        lda #0
        sta p_out,x
        stx t0
        jsr API_RAND
        cmp disg_p
        bcs @no
        lda #4
        jsr API_RMOD
        ldx t0
        clc
        adc #1
        sta p_out,x
@no:    ldx t0
:       rts

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

; ---- scenery

draw_scene:
        text 1, 0, s_name, 7
        jsr draw_header
        jsr draw_wall
        ; floor, red carpet, scan zone
        lda #FLOOR_Y
        ldx #7
        ldy #MC_HALL
        jsr band
        lda #27
        sta FILL_W
        lda #1
        sta FILL_H
        lda #2 | 8
        sta COLOR
        ldx #0
        ldy #CARPET_Y
        lda #MC_C
        jsr API_FILL
        lda #14
        sta FILL_W
        lda #4 | 8
        sta COLOR
        ldx #13
        ldy #CARPET_Y
        lda #MC_C
        jsr API_FILL
        text 12, CARPET_Y+1, s_zone, 4
        ; stanchions behind the queue (gold posts; a rope would need a hires char on black)
        lda #7 | 8
        sta COLOR
        lda #1
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #3
:       stx t2
        lda stanch_x,x
        tax
        ldy #FLOOR_Y+1
        lda #MC_C
        jsr API_FILL
        ldx t2
        dex
        bpl :-
        ; the gate: post (the reader on top is drawn with the LED), gate line
        lda #8
        sta COLOR
        lda #1
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #GATE_COL
        ldy #FLOOR_Y+1
        lda #MC_B
        jsr API_FILL
        lda #7
        sta COLOR
        lda #2
        sta FILL_H
        ldx #GATE_COL
        ldy #CARPET_Y+2
        lda #CH_L
        jsr API_FILL
        ; the guard
        ldx #GUARD_COL
        ldy #FLOOR_Y+2
        lda #6
        jsr face
        lda #6 | 8
        sta COLOR
        lda #2
        sta FILL_W
        sta FILL_H
        ldx #GUARD_COL
        ldy #FLOOR_Y+4
        lda #MC_C
        jsr API_FILL
        ; control panel
        lda #6
        sta COLOR
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #0
        ldy #UI_Y
        lda #CH_T
        jsr API_FILL
        text 0, UI_Y+1, s_id, 5
        text 4, UI_Y+1, s_leg1, 5
        text 0, UI_Y+2, s_vis, 7
        text 4, UI_Y+2, s_leg2, 7
        text 1, UI_Y+3, s_q, 2
        text 4, UI_Y+3, s_leg3, 2
        lda #2
        sta COLOR
        lda #7
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #19
        ldy #UI_Y+1
        jsr API_BOX
        text 20, UI_Y+2, s_stop, 1
        text 20, UI_Y+3, s_fire, 7
        jsr draw_stats
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; A = first row, X = rows, Y = char: full-width band of a shared-grey multicolour char.
band:
        stx FILL_H
        pha
        lda #40
        sta FILL_W
        lda #8
        sta COLOR
        tya
        tax
        pla
        tay
        txa
        ldx #0
        jmp API_FILL

; Rows 2-9: wall, sign, revolving door, plant, elevators (also redrawn when a speech bubble goes).
draw_wall:
        lda #SIGN_Y
        ldx #8
        ldy #MC_B
        jsr band
        lda #6
        sta COLOR
        lda #35
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #2
        ldy #SIGN_Y
        jsr API_BOX
        lda #33
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #3
        ldy #SIGN_Y+1
        lda #' '
        jsr API_FILL
        center SIGN_Y+1, s_sign1, 7
        center SIGN_Y+2, s_sign2, 3
        ; door frame and its sign
        lda #8
        sta COLOR
        lda #4
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #0
        ldy #DOOR_Y+3
        lda #MC_A
        jsr API_FILL
        text 1, DOOR_Y+3, s_in, 7
        ; plant
        lda #5 | 8
        sta COLOR
        lda #2
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #5
        ldy #DOOR_Y
        lda #MC_C
        jsr API_FILL
        lda #2 | 8
        sta COLOR
        lda #1
        sta FILL_H
        ldx #5
        ldy #DOOR_Y+2
        lda #MC_C
        jsr API_FILL
        ; elevators: dark frame, white doors, floor number on top
        ldx #31
        jsr elevator
        ldx #35
        jsr elevator
        jsr draw_door
        ; fall through
draw_elev_numbers:
        lda #7
        sta COLOR
        ldx #32
        lda elev1
        jsr num2
        ldx #36
        lda elev2
        ; fall through
; A = 0..39: floor number A + 1 as two chars at X, row DOOR_Y.
num2:
        clc
        adc #1
        ldy #'0' - 1
        sec
:       iny
        sbc #10
        bcs :-
        adc #'0' + 10
        pha
        tya
        cmp #'0'
        bne :+
        lda #' '
:       ldy #DOOR_Y
        jsr kputc
        inx
        pla
        jmp kputc

; X = left column of an elevator (4 wide).
elevator:
        stx t2
        lda #8
        sta COLOR
        lda #4
        sta FILL_W
        lda #4
        sta FILL_H
        ldy #DOOR_Y
        lda #MC_A
        jsr API_FILL
        lda #1 | 8
        sta COLOR
        lda #2
        sta FILL_W
        lda #3
        sta FILL_H
        ldx t2
        inx
        ldy #DOOR_Y+1
        lda #MC_C
        jmp API_FILL

; The revolving door's glass with the turning panel at column door_k.
draw_door:
        lda #3 | 8
        sta COLOR
        lda #4
        sta FILL_W
        lda #3
        sta FILL_H
        ldx #0
        ldy #DOOR_Y
        lda #MC_C
        jsr API_FILL
        lda #8
        sta COLOR
        lda #1
        sta FILL_W
        ldx door_k
        ldy #DOOR_Y
        lda #MC_A
        jmp API_FILL

; "Caught c/N", right-aligned on row 0.
draw_header:
        ldy #0
        lda #' '
        sta buf,y
        iny
        ldx #0
:       lda s_caught,x
        beq :+
        sta buf,y
        iny
        inx
        bne :-
:       lda caught
        jsr bnum
        lda #'/'
        sta buf,y
        iny
        lda strangers
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

draw_stats:
        text 26, UI_Y+1, s_busted, 5
        ldx #34
        ldy #UI_Y+1
        lda caught
        jsr API_NUM
        ldx #6                  ; dim until it happens
        lda wrong
        beq :+
        ldx #2
:       stx t2
        stx COLOR
        lda #<s_wrong
        sta PTR
        lda #>s_wrong
        sta PTR+1
        ldx #26
        ldy #UI_Y+2
        jsr API_PRINT
        lda t2
        sta COLOR
        ldx #39
        ldy #UI_Y+2
        lda wrong
        cmp #10
        bcc :+
        dex
:       jsr API_NUM
        ldx #6
        lda sneaked
        beq :+
        ldx #7
:       stx t2
        stx COLOR
        lda #<s_sneaked
        sta PTR
        lda #>s_sneaked
        sta PTR+1
        ldx #26
        ldy #UI_Y+3
        jsr API_PRINT
        lda t2
        sta COLOR
        ldx #38
        ldy #UI_Y+3
        lda sneaked
        jmp API_NUM

; A/X = text, Y = colour: a floater centred on row FLOAT_Y for a second.
floater:
        sty t2
        pha
        txa
        pha
        jsr clear_float
        lda t2
        sta COLOR
        pla
        tax
        pla
        ldy #FLOAT_Y
        jsr API_CENTER
        lda #FLOAT_T
        sta float_t
        rts

clear_float:
        lda #FLOAT_Y
        ldx #1
        ldy #MC_HALL
        jsr band
        lda #7
        sta COLOR
        ldx #GATE_COL
        ldy #FLOAT_Y
        lda #CH_L
        jmp API_PUTC

; Speech bubble of person A above the heads (box rows 5-8, or 6-8 for one line), its line p_line.
draw_bubble:
        sta bubble_p
        tax
        ldy p_line,x
        lda bub_lo,y
        sta sp
        lda bub_hi,y
        sta sp+1
        ldy #0
        lda (sp),y              ; width of the longer line
        clc
        adc #2
        sta bw
        iny
:       lda (sp),y
        beq :+
        iny
        bne :-
:       iny
        sty l2                  ; offset of line 2
        lda (sp),y
        beq :+
        lda #4
        .byte $2c
:       lda #3
        sta bh
        eor #$ff
        sec
        adc #MARK_Y             ; top row = 9 - height
        sta by
        ; column: centred on the person, kept on screen
        ldx bubble_p
        jsr col_of
        sta bx
        lda bw
        lsr
        sta t0
        lda bx
        sec
        sbc t0
        bcs :+
        lda #0
:       sta bx
        lda #40
        sec
        sbc bw
        cmp bx
        bcs :+
        sta bx
:       ldx bubble_p
        lda #1
        ldy p_kind,x
        cpy #K_STR
        bne :+
        lda #7                  ; a stranger's bubble: yellow
:       sta COLOR
        lda bw
        sta FILL_W
        lda bh
        sta FILL_H
        ldx bx
        ldy by
        jsr API_BOX
        dec FILL_W              ; clear the inside
        dec FILL_W
        dec FILL_H
        dec FILL_H
        ldx bx
        inx
        ldy by
        iny
        lda #' '
        jsr API_FILL
        lda #1
        sta COLOR
        lda #1
        jsr @line
        lda l2
@line:  clc
        adc sp
        sta PTR
        lda sp+1
        adc #0
        sta PTR+1
        ldx bx
        inx
        inc by
        ldy by
        jmp API_PRINT

; A = screen column of person X's middle (x / 8), x assumed 0..319.
col_of:
        lda p_xhi,x
        lsr
        lda p_xlo,x
        ror
        lsr
        lsr
        rts

; ---- one frame

frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr tick_timers
        jsr timer_tick
        bcc :+
        jmp finish
:       jsr move_people
        jsr targeting
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda JOYP
        and #J_FIRE
        beq :+
        lda target
        jsr stop
:       lda bubble_p            ; bubble over once its person stops arguing
        bmi :+
        tax
        lda p_st,x
        cmp #ST_ASIDE
        beq :+
        lda #$ff
        sta bubble_p
        jsr draw_wall
:       jsr place_sprites
        jsr draw_marks
        jsr draw_gate
        ldx n                   ; everybody gone?
:       dex
        bmi :+
        lda p_st,x
        cmp #ST_GONE
        beq :-
        clc
        rts
:       jmp finish

tick_timers:
        lda flap_t
        beq :+
        dec flap_t
:       lda led_t
        beq :+
        dec led_t
:       lda guard_t
        beq :+
        dec guard_t
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       lda float_t
        beq :+
        dec float_t
        bne :+
        jsr clear_float
:       inc door_t              ; the revolving door turns every 1/3 s
        lda door_t
        cmp #17
        bcc :+
        lda #0
        sta door_t
        inc door_k
        lda door_k
        and #3
        sta door_k
        jsr draw_door
:       inc elev_t              ; elevator floors tick every second
        lda elev_t
        cmp #50
        bcc @out
        lda #0
        sta elev_t
        ldx elev1
        jsr inc40
        stx elev1
        ldx elev2
        jsr inc40
        stx elev2
        jmp draw_elev_numbers
@out:   rts

inc40:  inx
        cpx #40
        bcc :+
        ldx #0
:       rts

move_people:
        ldx #0
@p:     cpx n
        bne :+
        rts
:       stx pi
        lda p_st,x
        beq @walk
        jmp @aside
@walk:
        jsr step_fwd
        lda p_flags,x
        and #F_BEEPED | F_CROSSED
        bne @cross
        xge BEEP_X
        bmi @cross
        lda p_flags,x
        ora #F_BEEPED
        sta p_flags,x
        lda p_kind,x
        cmp #K_STR
        beq @nobadge
        lda #FLAP_T             ; BEEP: the flap opens
        sta flap_t
        lda #5 | 8
        sta led_col
        lda #LED_T
        sta led_t
        lda #SFX_BLIP
        jsr API_SFX
        jmp @cross
@nobadge:
        lda flap_t
        bne @cross
        lda p_flags,x           ; vaults the closed turnstile
        ora #F_HOP
        sta p_flags,x
        lda #2 | 8
        sta led_col
        lda #LED_T
        sta led_t
@cross: ldx pi
        lda p_flags,x
        and #F_CROSSED
        bne @exit
        xge GATE_X
        bmi @exit
        lda p_flags,x
        ora #F_CROSSED
        sta p_flags,x
        lda p_kind,x
        cmp #K_STR
        bne @exit
        inc sneaked
        jsr flash
        lda #N_SNEAK
        jsr API_RMOD
        tax
        lda fl_sneak_lo,x
        pha
        lda fl_sneak_hi,x
        tax
        pla
        ldy #7
        jsr floater
        jsr draw_stats
@exit:  ldx pi
        xge EXIT_X
        bmi @next
@gone:  lda #ST_GONE
        sta p_st,x
@next:  ldx pi
        inx
        jmp @p
@aside: cmp #ST_ASIDE
        bne @escort
        inc p_t,x
        ldy p_t,x
        cpy #ASIDE_IN
        bcc :+
        ldy #ASIDE_IN
:       lda aside_tab,y
        sta p_dy,x
        lda p_t,x
        cmp p_hold,x
        bcc @next
        lda #ST_PASS
        ldy p_kind,x
        cpy #K_STR
        bne :+
        lda #ST_ESCORT
:       sta p_st,x
        jmp @next
@escort:
        cmp #ST_ESCORT
        bne @pass
        lda p_xlo,x             ; escorted out at 1 px per frame (browser 75 px/s)
        bne :+
        dec p_xhi,x
:       dec p_xlo,x
        xge APPEAR_X
        bmi @gone
        jmp @next
@pass:  cmp #ST_PASS
        bne @next
        lda p_frac,x
        clc
        adc spd_pass
        sta p_frac,x
        bcc :+
        inc p_xlo,x
        bne :+
        inc p_xhi,x
:       jmp @exit

; Person X walks one frame forward (keeps X).
step_fwd:
        lda p_frac,x
        clc
        adc spd
        sta p_frac,x
        bcc :+
        inc p_xlo,x
        bne :+
        inc p_xhi,x
:       rts

flash:
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #FLASH_T
        sta flash_t
        rts

; Candidates: walking, not past the gate, out of the door; in queue order (nearest the gate first).
targeting:
        lda #0
        sta nc
        ldx #0
@c:     cpx n
        beq @built
        lda p_st,x
        bne @skip
        lda p_flags,x
        and #F_CROSSED
        bne @skip
        xge APPEAR_X
        bmi @skip
        txa
        ldy nc
        sta cands,y
        inc nc
@skip:  inx
        bne @c
@built: lda #$ff
        sta target
        lda nc
        bne :+
        sta tidx
        rts
:       ldy #0                  ; the manual pick must still be a candidate
        lda manual
        bmi @first
:       cmp cands,y
        beq @found
        iny
        cpy nc
        bne :-
        lda #$ff
        sta manual
@first: ldy #0
@found: sty tidx
        lda cands,y
        sta target
        ; left = further back in the queue, right = toward the gate
        lda JOYP
        and #J_LEFT
        beq :+
        iny
        cpy nc
        bcc @pick
        dey
        bcs @pick
:       lda JOYP
        and #J_RIGHT
        beq @out
        tya
        beq @pick
        dey
@pick:  sty tidx
        lda cands,y
        sta target
        cpy #0
        bne :+
        lda #$ff
:       sta manual
        lda #SFX_BLIP
        jsr API_SFX
@out:   rts

; A = person to stop ($ff: nobody, just a click).
stop:
        tax
        bpl :+
        lda #SFX_BLIP
        jmp API_SFX
:       stx pi
        lda #ST_ASIDE
        sta p_st,x
        lda #0
        sta p_t,x
        lda #GUARD_T
        sta guard_t
        cpx manual
        bne :+
        lda #$ff
        sta manual
:       lda p_kind,x
        cmp #K_STR
        bne @legit
        inc caught
        lda #HOLD_STR
        sta p_hold,x
        ldy p_out,x
        beq :+
        lda #3                  ; disguise lines: 3 per outfit
        jsr API_RMOD
        ldx pi
        ldy p_out,x
        clc
        adc dis_base-1,y
        jmp @line
:       lda #N_EXCUSE
        jsr API_RMOD
        clc
        adc #B_EXCUSE
@line:  ldx pi
        sta p_line,x
        lda #SFX_GOOD
        jsr API_SFX
        ldx pi
        lda p_tail,x
        beq :+
        lda #<s_tailbust
        ldx #>s_tailbust
        bne @fl
:       lda #<s_busted2
        ldx #>s_busted2
@fl:    ldy #5
        jsr floater
        jmp @shown
@legit: inc wrong
        lda #HOLD_OK
        sta p_hold,x
        lda p_kind,x
        cmp #K_VIS
        bne :+
        lda #N_LEGIT_VIS
        jsr API_RMOD
        clc
        adc #B_LEGIT_VIS
        bne @l2
:       lda #N_LEGIT
        jsr API_RMOD
        clc
        adc #B_LEGIT
@l2:    ldx pi
        sta p_line,x
        jsr flash
        lda #N_WRONG
        jsr API_RMOD
        tax
        lda fl_wrong_lo,x
        pha
        lda fl_wrong_hi,x
        tax
        pla
        ldy #2
        jsr floater
@shown: lda bubble_p            ; one bubble at a time: the newest
        bmi :+
        jsr draw_wall
:       lda pi
        jsr draw_bubble
        jsr draw_stats
        jmp draw_header

; ---- drawing every frame

; Sprites for the people on screen, front of the queue first (lower sprites are in front).
place_sprites:
        lda #0
        sta slot
        sta xmsb
        sta enable
        tax
@p:     cpx n
        bne :+
        jmp @end
:       stx pi
        lda p_st,x
        cmp #ST_GONE
        beq @skip
        xge APPEAR_X
        bmi @skip
        xge EXIT_X
        bmi @show
@skip:  jmp @next
@show:  ldy slot
        lda p_xhi,x
        beq :+
        lda bit_tab,y
        ora xmsb
        sta xmsb
:       lda bit_tab,y
        ora enable
        sta enable
        lda p_col,x
        sta $d027,y
        tya
        asl
        tay
        lda p_xlo,x
        sta $d000,y
        ; walking step: changes every 4 px
        lda p_xlo,x
        lsr
        lsr
        and #1
        sta t1
        ; facing left: escorted, or a stranger who was stopped
        lda p_st,x
        cmp #ST_ESCORT
        beq @left
        cmp #ST_ASIDE
        bne @right
        lda #0                  ; standing
        sta t1
        lda p_kind,x
        cmp #K_STR
        beq @left
@right: lda #0
        .byte $2c
@left:  lda #1
        sta t2                  ; 0 right, 1 left
        lda p_out,x
        beq @person
        cmp #O_HIVIS
        beq @person
        tay
        lda outfit_ptr-1,y      ; R frame; L is the next one
        clc
        adc t2
        ldy slot
        sta SCREEN + $3f8,y
        lda t1                  ; no leg frames: bob a pixel instead
        jmp @y
@person:
        lda p_st,x
        cmp #ST_ASIDE
        beq :+
        inc t1                  ; walking: step A / B (frames 1-2)
:       lda t2
        beq :+
        lda #PERSON_L
        .byte $2c
:       lda #PERSON_R
        clc
        adc t1
        ldy slot
        sta SCREEN + $3f8,y
        lda #0
@y:     sta t1                  ; pixels up
        jsr hop_of
        clc
        adc t1
        sta t1
        lda #LANE_Y
        clc
        adc p_dy,x
        sec
        sbc t1
        pha
        lda slot
        asl
        tay
        pla
        sta $d001,y
        inc slot
        lda slot
        cmp #8
        beq @end
@next:  ldx pi
        inx
        jmp @p
@end:   lda xmsb
        sta $d010
        lda enable
        sta $d015
        rts

; A = how high person X is vaulting the turnstile (0-9 px). Keeps X.
hop_of:
        lda p_flags,x
        and #F_HOP
        beq @no
        lda p_st,x
        bne @no
        lda p_xhi,x
        bne @no
        lda p_xlo,x
        sec
        sbc #BEEP_X
        bcc @no
        cmp #HOP_LEN
        bcs @no
        tay
        lda hop_tab,y
        rts
@no:    lda #0
        rts

; Row 9: the target marker. Row 10: badges light up in the scan zone.
draw_marks:
        lda #8
        sta COLOR
        lda #26
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #4
        ldy #MARK_Y
        lda #MC_B
        jsr API_FILL
        lda #40
        sta FILL_W
        ldx #0
        ldy #BADGE_Y
        lda #MC_A
        jsr API_FILL
        ldx target
        bmi :+
        jsr col_of
        tax
        lda #7
        sta COLOR
        lda #'V'
        ldy #MARK_Y
        jsr API_PUTC
:       ldx #0
@p:     cpx n
        bne :+
        rts
:       stx pi
        lda p_st,x
        bne @next
        lda p_flags,x
        and #F_CROSSED
        bne @next
        xge ZONE_X
        bmi @next
        lda p_kind,x
        cmp #K_STR
        beq @next
        cmp #K_VIS
        beq @vis
        lda p_xlo,x             ; "ID" (+ the beep, blinking) over the middle
        sec
        sbc #4
        jsr col_a
        sta t2
        lda #<s_id
        sta PTR
        lda #>s_id
        sta PTR+1
        lda #5
        sta COLOR
        ldx t2
        ldy #BADGE_Y
        jsr API_PRINT
        lda anim
        and #$10
        beq @next
        ldx t2
        inx
        inx
        lda #')'
        ldy #BADGE_Y
        jsr API_PUTC
        jmp @next
@vis:   lda p_xlo,x
        sec
        sbc #8
        jsr col_a
        tax
        lda #<s_vis
        sta PTR
        lda #>s_vis
        sta PTR+1
        lda #7
        sta COLOR
        ldy #BADGE_Y
        jsr API_PRINT
@next:  ldx pi
        inx
        jmp @p

; A = x - offset (x < 256 in the scan zone): screen column.
col_a:
        lsr
        lsr
        lsr
        rts

; The reader LED, the flap and the guard's arm.
draw_gate:
        ldy #MC_A               ; LED off
        lda #8
        ldx led_t
        beq :+
        ldy #MC_C
        lda led_col
:       sta COLOR
        tya
        ldx #GATE_COL
        ldy #FLOOR_Y
        jsr API_PUTC
        lda flap_t              ; closed: glass across the lane
        beq :+
        lda #8
        ldy #MC_HALL
        bne :++
:       lda #3 | 8
        ldy #MC_C
:       sta COLOR
        sty t2
        lda #1
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #GATE_COL+1
        ldy #FLOOR_Y+1
        lda t2
        jsr API_FILL
        lda guard_t             ; the guard raises his hand
        beq :+
        lda #7
        sta COLOR
        lda #QUARTER + 10       ; right half: the hand
        ldx #GUARD_COL-1
        ldy #FLOOR_Y+2
        jsr API_PUTC
        lda #6 | 8
        sta COLOR
        lda #MC_C
        ldx #GUARD_COL-1
        ldy #FLOOR_Y+3
        jmp API_PUTC
:       lda #8
        sta COLOR
        lda #1
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #GUARD_COL-1
        ldy #FLOOR_Y+2
        lda #MC_HALL
        jmp API_FILL

.if .defined(AUTOPLAY)
; Perfect player (test builds): stop each stranger a moment after the badges light up for them.
bot:    ldx #0
@c:     cpx nc
        beq @no
        ldy cands,x
        lda p_kind,y
        cmp #K_STR
        bne @n
        lda p_xhi,y
        bne @go
        lda p_xlo,y
        cmp #ZONE_X + 24
        bcc @n
@go:    sty manual
        tya
        jmp stop
@n:     inx
        bne @c
@no:    rts
.endif

; score = clamp((4 × caught - 3 × wrong) / (4 × strangers), 0, 1) × 255
finish:
        lda #0
        sta $d015
        sta $d017
        sta $d01d
        sta $d020
        lda caught
        asl
        asl
        sta t0
        lda wrong
        asl
        adc wrong
        sta t1
        lda t0
        sec
        sbc t1
        bcs :+
        lda #0
:       sta t0                  ; × 255 = × 256 - itself
        lda #0
        sta dv+2
        sec
        sbc t0
        sta dv
        lda t0
        sbc #0
        sta dv+1
        lda strangers
        asl
        asl
        sta dsr
        jsr div24
        lda dv+1
        beq :+
        lda #255
        .byte $2c
:       lda dv
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:     .byte "Badge Tailgate", 0
s_help:     .byte "Stop anyone without a badge or VISITOR sticker.", 0
s_keys:     .byte "FIRE stops the marked one, L/R picks", 0
s_caught:   .byte "Caught ", 0
s_zone:     .byte "BADGE SCAN ZONE", 0
s_in:       .byte "IN", 0
s_id:       .byte "ID", 0
s_vis:      .byte "VIS", 0
s_q:        .byte "?", 0
s_leg1:     .byte "BADGE: let in", 0
s_leg2:     .byte "VISITOR: let in", 0
s_leg3:     .byte "NOTHING: STOP!", 0
s_stop:     .byte "STOP!", 0
s_fire:     .byte "FIRE", 0
s_busted:   .byte "Busted:", 0
s_wrong:    .byte "Wrong stops:", 0
s_sneaked:  .byte "Sneaked in:", 0
s_busted2:  .byte "Busted!", 0
s_tailbust: .byte "Tailgater busted!", 0
shirt_tab:  .byte 14, 2, 5, 8, 4, 6, 3, 15
outfit_col: .byte 9, 15, 13, 7          ; ladder (brown), pizza boxes, hi-vis, duck
outfit_ptr: .byte OUTFIT_P + 4, OUTFIT_P + 2, 0, OUTFIT_P
dis_base:   .byte B_DIS_LADDER, B_DIS_PIZZA, B_DIS_HIVIS, B_DIS_DUCK
stanch_x:   .byte 5, 10, 15, 20
bit_tab:    .byte 1, 2, 4, 8, 16, 32, 64, 128
aside_tab:  .byte 0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16   ; 16 × t / 12
hop_tab:    .byte 0, 1, 3, 4, 5, 6, 7, 8, 9, 9, 9, 8, 7, 6, 5, 4, 3, 1, 0   ; sin over 19 px × 9
HOP_LEN = * - hop_tab

.include "gen/mg_tailgate_data.s"

.bss
p_xlo:      .res MAXP
p_xhi:      .res MAXP
p_frac:     .res MAXP
p_st:       .res MAXP
p_kind:     .res MAXP
p_tail:     .res MAXP
p_out:      .res MAXP
p_flags:    .res MAXP
p_t:        .res MAXP
p_hold:     .res MAXP
p_col:      .res MAXP
p_dy:       .res MAXP
p_line:     .res MAXP
cands:      .res MAXP
buf:        .res 24
