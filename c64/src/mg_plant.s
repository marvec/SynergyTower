; Desk Plant Survival (src/minigames/plant.js) as a disk-loaded overlay at $4000.
; Keep the desk plant alive through one fiscal quarter (13 weeks in 45 s): water and light must stay inside
; their green bands, pests must be sprayed, and office events meddle every ~9 s. Health rises while all is
; well and drops for every need out of its band (damage × 0.85 at difficulty 0). Score = health
; averaged over the quarter with weight 0.5 -> 1.5 (later weeks count more); a dead plant scores at most 0.3.
; Difficulty (byDiff, d 0 -> 1): quarter 45 -> 55 s, water drain 0.04 -> 0.062/s, light 0.06 -> 0.09/s,
; a pest every 4.6 -> 2.4 s, an event every 9 -> 5.5 s, damage × 0.85 -> 1.15, weekends 2 -> 2.5 s.
; The motivational poster says the department's word (POSTER in plant.js).
; Content: src/data/mg-plant.js and the plant shapes of plant.js (gen/mg_plant_data.s).

.include "api.inc"
.include "gen/chars.inc"

; ---- rules (1.0 = 32768 for water, light and health; rates per frame)
Q_T        = 2250               ; the quarter: 45 s at d 0 (+ 2 × round(250 d) frames: 55 s at d 1)
WEEK_T     = 173                ; Q / 13 (+ round(39 d))
W_LO       = 11469              ; water band 0.35-0.78, rot above 0.9, max 1.05
W_HI       = 25559
W_ROT      = 29491
W_MAX      = 34406
L_LO       = 11469              ; light band 0.35-0.72
L_HI       = 23593
L_MAX      = 32768
WATER0     = 19661              ; start: water 0.6, light 0.5, health 0.75
LIGHT0     = 16384
HEALTH0    = 24576
H_MAX      = 32768
WATER_ADD  = 6554               ; +0.2 per watering
COFFEE_ADD = 9830               ; events: +0.3, +0.25, light +0.35
INTERN_ADD = 8192
WINDOW_ADD = 11469
SPRAY_HURT = 1638               ; spraying the monitor: health -0.05
DRAIN      = 26                 ; water -0.04/s (41: -0.062/s at d 1)
DRAIN1     = 41
LIGHT_RATE = 39                 ; light ±0.06/s (±0.09/s at d 1)
LIGHT1     = 59
DH_GOOD    = 16                 ; health +0.025/s per need in its band
DH_DRY     = 26                 ; -0.04/s (+ 0.25 × the shortfall) when too dry
DH_OUT     = 20                 ; -0.03/s (+ 0.45 / 0.25 × the excess) for the other misses
DH_BUG     = 14                 ; -0.022/s per pest
DH_CLEAN   = 10                 ; +0.015/s without pests
WATER_CD   = 15                 ; 0.3 s
SPRAY_CD   = 20                 ; 0.4 s
BUG_FIRST  = 150                ; first pest after 3 s, then every 4.6 s × 0.7-1.3 (2.4 s at d 1)
BUG_MIN    = 161
BUG_MIN1   = 84
BUG_RANGE  = 139
BUG_RANGE1 = 72
EV_FIRST   = 315                ; first event after 0.7 × 9 s, then every 9 s × 0.8-1.25 (5.5 s at d 1),
EV_FIRST_D = 122                ; none in the last 3 s; EV_FIRST/EV_MIN minus round(EV_*_D × d)
EV_MIN     = 360
EV_MIN_D   = 140
EV_RANGE   = 203
EV_RANGE1  = 124
EV_END     = 150
BANNER_T   = 140                ; 2.8 s
AC_T       = 350                ; 7 s: water drains at 40 %
HEAT_T     = 300                ; 6 s: water drains twice as fast
WEEKEND_T  = 100                ; 2 s: no actions, water drains × 1.5 (2.5 s at d 1)
WEEKEND1   = 125
DMG0       = 218                ; damage × 0.85 (/256), + round(76 d): × 1.15 at d 1
DMG_D      = 76
WET_T      = 125
FLOAT_T    = 50
MAX_BUGS   = 10
W_STEP     = 3728               ; weight 64 -> 192 (/128) over the quarter, in 1/65536 per frame
W_STEP_D   = 226                ; - 3 × round(226 d): 3050 for the 55 s quarter

EV_AC      = 0                  ; event kinds (tools/mg/plant.js)
EV_COFFEE  = 1
EV_WEEKEND = 2
EV_WINDOW  = 3
EV_FRUIT   = 4
EV_INTERN  = 5
EV_HEAT    = 6
EV_AUDIT   = 7

; ---- layout
PLANT_X    = 11                 ; plant chars: cols 11-21, rows 8-13; pot rows 14-16
PLANT_Y    = 8
VIT_X      = 27                 ; vitals panel cols 26-39, rows 4-16 (inside 27-38)
BAR_W      = 12
BAND_A     = 4                  ; bar cells inside the green band (both needs): 4-8
BAND_B     = 8

.zeropage
ps:       .res 2                ; screen / colour RAM pointers for direct drawing
pc:       .res 2
sp:       .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
now:      .res 2                ; frames into the quarter
water:    .res 2
light:    .res 2
health:   .res 2
dh:       .res 2                ; health change this frame (signed)
acc:      .res 3                ; weighted health
w_frac:   .res 2
w_int:    .res 1
d_num:    .res 2
m_b:      .res 1
blinds:   .res 1                ; 1 = open
nbugs:    .res 1
focus:    .res 1
weekend_t: .res 1
water_cd: .res 1
spray_cd: .res 1
done:     .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- setup

init:
        sta diff
        jsr difficulty
        ldx #bss_end - bss_start - 1
        lda #0
:       sta bss_start,x
        dex
        bpl :-
        sta now
        sta now+1
        sta acc
        sta acc+1
        sta acc+2
        sta w_frac
        sta w_frac+1
        sta blinds
        sta nbugs
        sta focus
        sta weekend_t
        sta water_cd
        sta spray_cd
        sta done
        lda #64
        sta w_int
        lda #<WATER0
        sta water
        lda #>WATER0
        sta water+1
        lda #<LIGHT0
        sta light
        lda #>LIGHT0
        sta light+1
        lda #<HEALTH0
        sta health
        lda #>HEALTH0
        sta health+1
        lda #<BUG_FIRST
        sta bug_t
        lda #>BUG_FIRST
        sta bug_t+1
        lda #0
        ldx #EV_FIRST_D
        jsr byd
        sta t0
        lda #<EV_FIRST
        sec
        sbc t0
        sta ev_t
        lda #>EV_FIRST
        sbc #0
        sta ev_t+1
        lda #1
        sta week
        lda p_week
        sta week_t
        lda #$ff
        sta lastkey
        sta shown_win
        sta shown_plant
        sta shown_soil
        sta shown_btn
        sta shown_wet
        sta cap_good
        ; shuffled decks: good and bad captions, events
        lda #<cg_deck
        ldy #>cg_deck
        ldx #CG_COUNT
        jsr deal
        lda #<cb_deck
        ldy #>cb_deck
        ldx #CB_COUNT
        jsr deal
        lda #<ev_deck
        ldy #>ev_deck
        ldx #EV_COUNT
        jsr deal
        jsr draw_scene
        lda #<cap_first
        sta cap_ptr
        lda #>cap_first
        sta cap_ptr+1
        jsr draw_week
        lda p_q
        ldx p_q+1
        jmp timer_start

; The difficulty's parameters (p_*) from diff.
difficulty:
        lda #0                  ; quarter: Q_T + 2 × round(250 d)
        ldx #250
        jsr byd
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda t0
        clc
        adc #<Q_T
        sta p_q
        lda t1
        adc #>Q_T
        sta p_q+1
        lda p_q                 ; no events in the last 3 s
        sec
        sbc #EV_END
        sta p_evlast
        lda p_q+1
        sbc #0
        sta p_evlast+1
        lda #WEEK_T
        ldx #WEEK_T + 39
        jsr byd
        sta p_week
        lda #DRAIN
        ldx #DRAIN1
        jsr byd
        sta p_drain
        lda #LIGHT_RATE
        ldx #LIGHT1
        jsr byd
        sta p_light
        lda #BUG_MIN
        ldx #BUG_MIN1
        jsr byd
        sta p_bugmin
        lda #BUG_RANGE
        ldx #BUG_RANGE1
        jsr byd
        sta p_bugrange
        lda #EV_RANGE
        ldx #EV_RANGE1
        jsr byd
        sta p_evrange
        lda #0
        ldx #EV_MIN_D
        jsr byd
        sta t0
        lda #<EV_MIN
        sec
        sbc t0
        sta p_evmin
        lda #>EV_MIN
        sbc #0
        sta p_evmin+1
        lda #WEEKEND_T
        ldx #WEEKEND1
        jsr byd
        sta p_weekend
        lda #0
        ldx #DMG_D
        jsr byd
        clc
        adc #DMG0
        sta p_dmg
        lda #0
        adc #0
        sta p_dmg+1
        lda #0                  ; weight step: W_STEP - 3 × round(226 d)
        ldx #W_STEP_D
        jsr byd
        sta t0
        asl
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
:       lda #<W_STEP
        sec
        sbc t1
        sta p_wstep
        lda #>W_STEP
        sbc t2
        sta p_wstep+1
        rts

; byDiff: A = value at d 0, X = value at d 1 -> A = a + round((b - a) × d)
byd:
        sta t0
        stx t1
        cpx t0
        bcc @down
        txa
        sec
        sbc t0
        jsr @mul
        clc
        adc t0
        rts
@down:  lda t0
        sec
        sbc t1
        jsr @mul
        sta t1
        lda t0
        sec
        sbc t1
        rts
@mul:   ldx diff                ; A = round(A × diff / 255)
        jsr mul8
        lda d_num
        clc
        adc #127
        sta d_num
        bcc :+
        inc d_num+1
:       lda d_num+1             ; x / 255 = (x + (x >> 8) + 1) >> 8
        sec
        adc d_num
        lda d_num+1
        adc #0
        rts

; A/Y = deck, X = size: 0..X-1 shuffled (Fisher-Yates).
deal:   sta sp
        sty sp+1
        stx t0
        ldy #0
:       tya
        sta (sp),y
        iny
        cpy t0
        bne :-
        dec t0
@s:     lda t0
        beq @done
        clc
        adc #1
        jsr API_RMOD
        sta t1
        ldy t0
        lda (sp),y
        pha
        ldy t1
        lda (sp),y
        ldy t0
        sta (sp),y
        pla
        ldy t1
        sta (sp),y
        dec t0
        jmp @s
@done:  rts

; ---------------------------------------------------------------- drawing

draw_scene:
        text 1, 0, s_name, 7
        lda #1                  ; window, calendar, monitor frames
        sta COLOR
        lda #11
        sta FILL_W
        lda #9
        sta FILL_H
        ldx #0
        ldy #4
        jsr API_BOX
        lda #9
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #12
        ldy #4
        jsr API_BOX
        lda #4
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #22
        ldy #11
        jsr API_BOX
        lda #6                  ; vitals panel
        sta COLOR
        lda #14
        sta FILL_W
        lda #13
        sta FILL_H
        ldx #VIT_X - 1
        ldy #4
        jsr API_BOX
        lda #6                  ; the motivational poster: "<dept word> is fun"
        sta COLOR
        lda #10
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #1
        ldy #13
        jsr API_BOX
        text POSTER_X, 14, poster_word, 7
        text 3, 15, s_isfun, 3
        text 13, 5, s_q3, 2
        text VIT_X, 5, s_vitals, 7
        text VIT_X, 6, s_water, 1
        text VIT_X, 8, s_light, 1
        text VIT_X, 10, s_pests, 1
        text VIT_X, 12, s_health, 1
        text VIT_X, 14, s_blinds, 1
        lda #8                  ; desk, monitor stand
        sta COLOR
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #0
        ldy #17
        lda #MC_B
        jsr API_FILL
        lda #2
        sta FILL_W
        ldx #23
        ldy #15
        lda #MC_A
        jsr API_FILL
        lda #4
        sta FILL_W
        ldx #22
        ldy #16
        lda #MC_A
        jsr API_FILL
        lda #2 | 8              ; the terracotta pot with its eyes
        sta COLOR
        lda #7
        sta FILL_W
        ldx #13
        ldy #14
        lda #MC_C
        jsr API_FILL
        lda #5
        sta FILL_W
        lda #2
        sta FILL_H
        ldx #14
        ldy #15
        lda #MC_C
        jsr API_FILL
        lda #MC_KNOB
        ldx #15
        ldy #15
        jsr API_PUTC
        lda #MC_KNOB
        ldx #17
        ldy #15
        jsr API_PUTC
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; X = column, Y = row: ps / pc = its screen / colour RAM address.
set_pos:
        txa
        clc
        adc row_lo,y
        sta ps
        sta pc
        lda row_hi,y
        adc #0
        sta t3
        ora #>SCREEN
        sta ps+1
        lda t3
        ora #>COLRAM
        sta pc+1
        rts

; ---- the little string builder (fbuf)
fb_reset:
        lda #0
        sta fb_i
        rts

; A/X = string appended.
fb_str: sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        beq :+
        jsr fb_chr
        iny
        bne :-
:       rts

; A = 0..99 appended in decimal.
fb_num: ldx #'0' - 1
:       inx
        sec
        sbc #10
        bcs :-
        adc #'0' + 10
        pha
        txa
        cmp #'0'
        beq :+
        jsr fb_chr
:       pla
        ; fall through

; A appended (keeps Y).
fb_chr: sty t3
        ldy fb_i
        sta fbuf,y
        iny
        lda #0
        sta fbuf,y
        sty fb_i
        ldy t3
        rts

; Header "Week n/13", calendar, caption.
draw_week:
        jsr fb_reset
        lda #<s_week
        ldx #>s_week
        jsr fb_str
        lda week
        jsr fb_num
        lda #<s_of13
        ldx #>s_of13
        jsr fb_str
        lda #10
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        ldx #30
        ldy #0
        lda #' '
        jsr API_FILL
        lda #<fbuf
        sta PTR
        lda #>fbuf
        sta PTR+1
        lda #40
        sec
        sbc fb_i
        tax
        ldy #0
        lda #1
        sta COLOR
        jsr API_PRINT
        jsr fb_reset            ; calendar: "W3", and a red bar of the weeks so far
        lda #'W'
        jsr fb_chr
        lda week
        jsr fb_num
        lda #' '
        jsr fb_chr
        lda #<fbuf
        sta PTR
        lda #>fbuf
        sta PTR+1
        ldx #16
        ldy #5
        jsr API_PRINT
        ldx #13
        ldy #6
        jsr set_pos
        ldy #0
@cal:   tya
        asl
        sta t0                  ; weeks before this cell
        lda #' '
        ldx week
        cpx t0
        beq @put
        bcc @put
        lda #240 + 4            ; one week (bottom left)
        dex
        cpx t0
        beq @put
        lda #240 + 12           ; two
@put:   sta (ps),y
        lda #2
        sta (pc),y
        iny
        cpy #7
        bne @cal
        ; fall through

; The caption (cap_ptr: two lines), "W3: " in front, cyan while the plant is fine, yellow when it is not.
draw_caption:
        lda #22
        ldx #2
        jsr clear_rows
        ldx #3
        jsr is_good
        sta cap_good
        bne :+
        ldx #7
:       stx COLOR
        jsr fb_reset
        lda #'W'
        jsr fb_chr
        lda week
        jsr fb_num
        lda #<s_colon
        ldx #>s_colon
        jsr fb_str
        lda cap_ptr
        ldx cap_ptr+1
        jsr fb_str
        lda #<fbuf
        ldx #>fbuf
        ldy #22
        jsr API_CENTER
        lda cap_ptr
        sta sp
        lda cap_ptr+1
        sta sp+1
        jsr sp_skip
        lda sp
        ldx sp+1
        ldy #23
        jmp API_CENTER

; A = 1 if health >= 0.5.
is_good:
        lda health+1
        cmp #$40
        lda #0
        rol
        rts

; The window: blinds down, or sky (bright with enough light) over the skyline.
draw_window:
        lda light+1
        cmp #>13107             ; light >= 0.4: bright sky
        lda blinds
        rol
        cmp shown_win
        bne :+
        rts
:       sta shown_win
        lda #9
        sta FILL_W
        lda #7
        sta FILL_H
        lda #7 | 8
        sta COLOR
        lda blinds
        beq @fill               ; closed: slats all the way
        lda #1
        sta FILL_H
@fill:  ldx #1
        ldy #5
        lda #MC_GRID
        jsr API_FILL
        lda blinds
        beq @done
        ldx #6 | 8              ; sky
        lda shown_win
        and #1
        beq :+
        ldx #3 | 8
:       stx COLOR
        lda #6
        sta FILL_H
        ldx #1
        ldy #6
        lda #MC_C
        jsr API_FILL
        lda #7 | 8              ; the sun
        sta COLOR
        lda #MC_C
        ldx #8
        ldy #6
        jsr API_PUTC
        lda #8                  ; buildings
        sta COLOR
        lda #1
        sta FILL_W
        lda #0
        sta t2
@b:     ldx t2
        lda skyline,x
        sta FILL_H
        eor #$ff
        sec
        adc #12
        tay
        inx
        lda #MC_A
        jsr API_FILL
        inc t2
        lda t2
        cmp #9
        bne @b
@done:  rts

; Soil: dry, fine or soggy (with a puddle on the desk).
draw_soil:
        ldx #1
        lda water
        cmp #<W_LO
        lda water+1
        sbc #>W_LO
        bcs :+
        ldx #0
:       lda #<W_ROT
        cmp water
        lda #>W_ROT
        sbc water+1
        bcs :+
        ldx #2
:       cpx shown_soil
        bne :+
        rts
:       stx shown_soil
        lda soil_col,x
        sta COLOR
        lda soil_char,x
        pha
        lda #5
        sta FILL_W
        lda #1
        sta FILL_H
        pla
        ldx #14
        ldy #14
        jsr API_FILL
        ldx #MC_B               ; puddle
        lda #8
        ldy shown_soil
        cpy #2
        bne :+
        ldx #MC_C
        lda #6 | 8
:       sta COLOR
        lda #9
        sta FILL_W
        txa
        ldx #12
        ldy #17
        jmp API_FILL

; Monitor: white, blue while it drips.
draw_monitor:
        lda wet_t
        beq :+
        lda #1
:       cmp shown_wet
        bne :+
        rts
:       sta shown_wet
        ldx #1 | 8
        tay
        beq :+
        ldx #6 | 8
:       stx COLOR
        lda #2
        sta FILL_W
        sta FILL_H
        ldx #23
        ldy #12
        lda #MC_C
        jmp API_FILL

; The plant: the shape of its droop level in the colour of its trouble, and the pests on it.
draw_plant:
        ldx #0                  ; droop: health 0.6 / 0.4 / 0.2
        lda health+1
        cmp #>19693
        bcs :+
        inx
        cmp #>13107
        bcs :+
        inx
        cmp #>6521
        bcs :+
        inx
:       stx level
        ldy #5                  ; colour: green, yellow with bad light, red when dying (health < 0.45)
        lda health+1
        cmp #>14746
        bcs :+
        ldy #2
        bne @col
:       lda light
        cmp #<L_LO
        lda light+1
        sbc #>L_LO
        bcc @pale
        lda #<L_HI
        cmp light
        lda #>L_HI
        sbc light+1
        bcs @col
@pale:  ldy #7
@col:   sty t2
        txa
        asl
        asl
        asl
        ora t2
        cmp shown_plant
        bne :+
        lda plant_dirty
        bne :+
        rts
:       sta shown_plant
        lda #0
        sta plant_dirty
        ldx level
        lda map_lo,x
        sta sp
        lda map_hi,x
        sta sp+1
        lda #0
        sta t1                  ; row
@row:   ldx #PLANT_X
        lda t1
        clc
        adc #PLANT_Y
        tay
        jsr set_pos
        ldy #0
:       lda (sp),y
        sta (ps),y
        lda t2
        sta (pc),y
        iny
        cpy #PLANT_W
        bne :-
        lda sp
        clc
        adc #PLANT_W
        sta sp
        bcc :+
        inc sp+1
:       inc t1
        lda t1
        cmp #PLANT_H
        bne @row
        ldx nbugs               ; pests
        beq @done
@bug:   dex
        stx t1
        lda bug_cell,x
        pha
        and #15
        clc
        adc #PLANT_X
        tax
        pla
        lsr
        lsr
        lsr
        lsr
        clc
        adc #PLANT_Y
        tay
        jsr set_pos
        ldy #0
        lda #CH_PIP
        sta (ps),y
        lda #4
        sta (pc),y
        ldx t1
        bne @bug
@done:  rts

; Vitals: water and light with their bands, pests, health, blinds.
draw_vitals:
        lda water
        sta t0
        lda water+1
        sta t1
        ldx #0
        jsr band_state
        ldy #6
        jsr status
        lda #3
        ldx water+1
        cpx #>W_ROT
        bcc :+
        lda #2
:       sta bar_c
        lda water+1
        ldy #7
        jsr need_bar
        lda light
        sta t0
        lda light+1
        sta t1
        ldx #1
        jsr band_state
        ldy #8
        jsr status
        lda #7
        sta bar_c
        lda light+1
        ldy #9
        jsr need_bar
        ldx #VIT_X + 8          ; pests: "none" or the count, and a pip each
        ldy #10
        jsr set_pos
        ldy #3
        lda nbugs
        bne @n
:       lda s_none,y
        sta (ps),y
        lda #5
        sta (pc),y
        dey
        bpl :-
        bmi @pips
@n:     lda #' '
:       sta (ps),y
        dey
        bpl :-
        ldy #3
        lda nbugs
        cmp #10
        bcc :+
        lda #'1'
        ldy #2
        sta (ps),y
        lda #2
        sta (pc),y
        iny
        lda #0
:       ora #'0'
        sta (ps),y
        lda #2
        sta (pc),y
@pips:  ldx #VIT_X
        ldy #11
        jsr set_pos
        ldy #0
:       lda #' '
        cpy nbugs
        bcs :+
        lda #CH_PIP
:       sta (ps),y
        lda #2
        sta (pc),y
        iny
        cpy #MAX_BUGS
        bne :--
        ldx #VIT_X              ; health: half-cell bar, green / yellow / red
        ldy #13
        jsr set_pos
        lda health+1            ; halves = health × 24 / 32768 = (health / 256) × 3 / 16
        sta t0
        lda #0
        sta t1
        asl t0
        rol t1
        lda t0
        clc
        adc health+1
        sta t0
        lda t1
        adc #0
        lsr
        ror t0
        lsr
        ror t0
        lsr
        ror t0
        lsr
        ror t0
        ldx #5
        lda health+1
        cmp #>19661
        bcs :+
        ldx #7
        cmp #>9830
        bcs :+
        ldx #2
:       stx t1
        ldy #0
@h:     lda #' '
        ldx t0
        beq @hp
        lda #CH_HALF
        dex
        beq @h1
        dex
        lda #CH_BLOCK
@h1:    stx t0
@hp:    sta (ps),y
        lda t1
        sta (pc),y
        iny
        cpy #BAR_W
        bne @h
        lda #<s_closed          ; blinds
        ldx #>s_closed
        ldy blinds
        beq :+
        lda #<s_open
        ldx #>s_open
:       sta PTR
        stx PTR+1
        lda #3
        sta COLOR
        ldx #VIT_X + 6
        ldy #15
        jmp API_PRINT

; X = need (0 water, 1 light), t0/t1 = its level: A = 0 low, 1 in the band, 2 high.
band_state:
        lda t0
        cmp band_lo_l,x
        lda t1
        sbc band_lo_h,x
        bcc @low
        lda band_hi_l,x
        cmp t0
        lda band_hi_h,x
        sbc t1
        bcc @high
        lda #1
        rts
@low:   lda #0
        rts
@high:  lda #2
        rts

; A = band state, Y = row: "LOW" / "OK" / "HIGH" right-aligned in the panel.
status: tax
        lda st_lo,x
        sta PTR
        lda st_hi,x
        sta PTR+1
        lda st_col,x
        sta COLOR
        ldx #VIT_X + 8
        jmp API_PRINT

; A = level / 256, Y = row: track (green inside the band) with the level's marker in bar_c.
need_bar:
        sta t0                  ; halves = level / 256 × 3 / 16 (max 23)
        lda #0
        sta t1
        lda t0
        asl
        rol t1
        clc
        adc t0
        sta t0
        lda t1
        adc #0
        lsr
        ror t0
        lsr
        ror t0
        lsr
        ror t0
        lsr
        ror t0
        lda t0
        cmp #BAR_W * 2
        bcc :+
        lda #BAR_W * 2 - 1
:       sta t0
        ldx #VIT_X
        jsr set_pos
        lda #CH_HALF            ; marker: left or right half of its cell
        sta t2
        lda t0
        lsr
        sta t1                  ; marker cell
        bcc :+
        lda #240 + 10
        sta t2
:       ldy #0
@c:     cpy t1
        bne @track
        lda t2
        sta (ps),y
        lda bar_c
        bne @col
@track: lda #CH_B
        sta (ps),y
        lda #6
        cpy #BAND_A
        bcc @col
        cpy #BAND_B + 1
        bcs @col
        lda #5
@col:   sta (pc),y
        iny
        cpy #BAR_W
        bne @c
        rts

; Buttons 1-3 (focus yellow; blue and dim during the weekend).
draw_buttons:
        lda weekend_t
        beq :+
        lda #8
:       ora focus
        sta t0
        lda blinds
        asl
        asl
        ora t0
        cmp shown_btn
        bne :+
        rts
:       sta shown_btn
        lda #2
        sta t2
@b:     ldx t2
        lda #6
        ldy weekend_t
        bne :+
        cpx focus
        bne :+
        lda #7
:       sta COLOR
        lda #13
        sta FILL_W
        lda #3
        sta FILL_H
        lda btn_x,x
        tax
        ldy #19
        jsr API_BOX
        ldx t2
        lda #7
        ldy weekend_t
        beq :+
        lda #6
:       sta COLOR
        lda btn_x,x
        clc
        adc #2
        tax
        lda t2
        clc
        adc #'1'
        ldy #20
        jsr API_PUTC
        ldx t2
        lda #1
        ldy weekend_t
        beq :+
        lda #6
:       sta COLOR
        lda btn_lo,x
        sta PTR
        lda btn_hi,x
        sta PTR+1
        cpx #1
        bne :+
        lda blinds
        beq :+
        lda #<s_close
        sta PTR
        lda #>s_close
        sta PTR+1
:       lda btn_x,x
        clc
        adc #4
        tax
        ldy #20
        jsr API_PRINT
        dec t2
        bpl @b
        rts

; A/X = text, Y = colour: a line on row 18 for a second.
show_float:
        sty t2
        pha
        txa
        pha
        lda #18
        ldx #1
        jsr clear_rows
        lda t2
        sta COLOR
        pla
        tax
        pla
        ldy #18
        jsr API_CENTER
        lda #FLOAT_T
        sta float_t
        rts

; sp = past the 0 of the string at sp.
sp_skip:
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

; d_num = A × X.
mul8:   sta t3
        stx m_b
        lda #0
        ldx #8
        lsr m_b
@l:     bcc :+
        clc
        adc t3
:       ror
        ror m_b
        dex
        bne @l
        sta d_num+1
        lda m_b
        sta d_num
        rts

; ---------------------------------------------------------------- frame

frame:
        lda done
        beq :+
        sec
        rts
:       jsr timers
        jsr timer_tick          ; (the bar only: the quarter ends on `now`)
        inc now
        bne :+
        inc now+1
:       jsr week_tick
        jsr needs
        jsr spawns
        jsr grow
        jsr weigh
        lda health
        ora health+1
        bne :+
        jmp die
:       lda now
        cmp p_q
        lda now+1
        sbc p_q+1
        bcc :+
        jmp quarter_end
:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        jsr controls
        jsr draw_window
        jsr draw_soil
        jsr draw_monitor
        jsr draw_plant
        jsr draw_vitals
        jsr draw_buttons
        jsr is_good
        cmp cap_good
        beq :+
        jsr draw_caption
:       clc
        rts

timers:
        ldx #2                  ; weekend_t, water_cd, spray_cd (consecutive in the zero page)
:       lda weekend_t,x
        beq :+
        dec weekend_t,x
:       dex
        bpl :--
        ldx #2                  ; ac_t, heat_t: words
@w:     lda ac_t,x
        ora ac_t+1,x
        beq :++
        lda ac_t,x
        bne :+
        dec ac_t+1,x
:       dec ac_t,x
:       dex
        dex
        bpl @w
        lda wet_t
        beq :+
        dec wet_t
:       lda banner_t
        beq :+
        dec banner_t
        bne :+
        lda #2
        ldx #2
        jsr clear_rows
:       lda float_t
        beq :+
        dec float_t
        bne :+
        lda #18
        ldx #1
        jsr clear_rows
:       lda border_t
        beq :+
        dec border_t
        bne :+
        lda #0
        sta $d020
:       rts

; A new week every WEEK_T frames: its caption from the good or the bad deck.
week_tick:
        dec week_t
        bne @out
        lda p_week
        sta week_t
        lda week
        cmp #13
        bcs @out
        inc week
        lda week
        cmp #13
        bne :+
        lda #<cap_last
        ldx #>cap_last
        bne @set
:       jsr is_good
        beq @bad
        ldx gi
        ldy cg_deck,x
        inx
        cpx #CG_COUNT
        bne :+
        ldx #0
:       stx gi
        lda capg_lo,y
        ldx capg_hi,y
        jmp @set
@bad:   ldx bi
        ldy cb_deck,x
        inx
        cpx #CB_COUNT
        bne :+
        ldx #0
:       stx bi
        lda capb_lo,y
        ldx capb_hi,y
@set:   sta cap_ptr
        stx cap_ptr+1
        jmp draw_week
@out:   rts

; Water drains (slower with the AC on, faster in a heatwave or a weekend); light follows the blinds.
needs:
        lda p_drain
        ldx ac_t
        bne :+
        ldx ac_t+1
        beq @heat
:       ldx #102                ; × 0.4
        jsr mul8
        lda d_num+1
@heat:  ldx heat_t
        bne :+
        ldx heat_t+1
        beq @wkend
:       asl
@wkend: ldx weekend_t
        beq :+
        sta t0
        lsr
        clc
        adc t0
:       sta t0
        lda water
        sec
        sbc t0
        tax
        lda water+1
        sbc #0
        bcs :+
        lda #0
        tax
:       stx water
        sta water+1
        lda blinds
        beq @dark
        lda light
        clc
        adc p_light
        sta light
        bcc :+
        inc light+1
:       lda light+1             ; cap at 1.0
        cmp #>L_MAX
        bcc @out
        lda #<L_MAX
        sta light
        lda #>L_MAX
        sta light+1
@out:   rts
@dark:  lda light
        sec
        sbc p_light
        tax
        lda light+1
        sbc #0
        bcs :+
        lda #0
        tax
:       stx light
        sta light+1
        rts

; Pests arrive every few seconds, office events every ~9 s.
spawns:
        lda bug_t
        bne :+
        dec bug_t+1
:       dec bug_t
        lda bug_t
        ora bug_t+1
        bne @ev
        lda p_bugrange
        jsr API_RMOD
        clc
        adc p_bugmin
        sta bug_t
        lda #0
        adc #0
        sta bug_t+1
        jsr spawn_bug
@ev:    lda ev_t
        ora ev_t+1
        beq @fire
        lda ev_t
        bne :+
        dec ev_t+1
:       dec ev_t
        lda ev_t
        ora ev_t+1
        bne @out
@fire:  lda now
        cmp p_evlast
        lda now+1
        sbc p_evlast+1
        bcs @out
        lda p_evrange
        jsr API_RMOD
        clc
        adc p_evmin
        sta ev_t
        lda p_evmin+1
        adc #0
        sta ev_t+1
        jmp fire_event
@out:   rts

; A pest on a random part of the plant (up to MAX_BUGS).
spawn_bug:
        lda nbugs
        cmp #MAX_BUGS
        bcs @out
        lda #20                 ; tries
        sta t2
@try:   lda #PLANT_H
        jsr API_RMOD
        sta t0
        lda #PLANT_W
        jsr API_RMOD
        sta t1
        ldx t0
        clc
        adc mul11,x
        ldx level
        clc
        adc map_lo,x
        sta sp
        lda map_hi,x
        adc #0
        sta sp+1
        ldy #0
        lda (sp),y
        cmp #' '
        bne @ok
        dec t2
        bne @try
@ok:    lda t0
        asl
        asl
        asl
        asl
        ora t1
        ldx nbugs
        sta bug_cell,x
        inc nbugs
        lda #1
        sta plant_dirty
@out:   rts

; The next event of the shuffled deck: banner and effect.
fire_event:
        ldx ev_i
        lda ev_deck,x
        sta t2
        inx
        cpx #EV_COUNT
        bne :+
        ldx #0
:       stx ev_i
        lda #2
        ldx #2
        jsr clear_rows
        ldx t2
        lda ev_lo,x
        sta sp
        lda ev_hi,x
        sta sp+1
        lda #7
        sta COLOR
        lda sp
        ldx sp+1
        ldy #2
        jsr API_CENTER
        jsr sp_skip
        lda #1
        sta COLOR
        lda sp
        ldx sp+1
        ldy #3
        jsr API_CENTER
        lda #BANNER_T
        sta banner_t
        lda #SFX_GOOD
        jsr API_SFX
        ldx t2
        lda ev_kind,x
        asl
        tax
        lda ev_tab+1,x
        pha
        lda ev_tab,x
        pha
        rts

ev_tab: .word ev_ac-1, ev_coffee-1, ev_weekend-1, ev_window-1, ev_fruit-1, ev_intern-1, ev_heat-1, ev_audit-1

ev_ac:  lda #<AC_T
        sta ac_t
        lda #>AC_T
        sta ac_t+1
        rts
ev_coffee:
        lda #<COFFEE_ADD
        ldx #>COFFEE_ADD
        jmp add_water
ev_weekend:
        lda p_weekend
        sta weekend_t
        rts
ev_window:
        lda light
        clc
        adc #<WINDOW_ADD
        sta light
        lda light+1
        adc #>WINDOW_ADD
        sta light+1
        cmp #>L_MAX
        bcc :+
        lda #<L_MAX
        sta light
        lda #>L_MAX
        sta light+1
:       rts
ev_fruit:
        jsr spawn_bug
        jsr spawn_bug
        jmp spawn_bug
ev_intern:
        lda #<INTERN_ADD
        ldx #>INTERN_ADD
        jmp add_water
ev_heat:
        lda #<HEAT_T
        sta heat_t
        lda #>HEAT_T
        sta heat_t+1
        rts
ev_audit:
        lda #1
        sta blinds
        rts

; A/X = amount: water up, at most 1.05.
add_water:
        clc
        adc water
        sta water
        txa
        adc water+1
        sta water+1
        lda water
        cmp #<W_MAX
        lda water+1
        sbc #>W_MAX
        bcc :+
        lda #<W_MAX
        sta water
        lda #>W_MAX
        sta water+1
:       rts

; Health: + for every need in its band, - (more the further off) for every one outside, - per pest.
grow:
        lda #0
        sta gain
        sta gain+1
        sta loss
        sta loss+1
        lda water               ; too dry: 0.04 + 0.25 × shortfall
        cmp #<W_LO
        lda water+1
        sbc #>W_LO
        bcs @wet
        lda #<W_LO
        sec
        sbc water
        sta t0
        lda #>W_LO
        sbc water+1
        sta t1
        jsr div200
        clc
        adc #DH_DRY
        jsr lose
        jmp @light
@wet:   lda #<W_HI              ; too wet: 0.03 + 0.45 × excess
        cmp water
        lda #>W_HI
        sbc water+1
        bcs @wok
        lda water
        sec
        sbc #<W_HI
        sta t0
        lda water+1
        sbc #>W_HI
        sta t1
        jsr mul009
        clc
        adc #DH_OUT
        jsr lose
        jmp @light
@wok:   lda #DH_GOOD
        jsr win
@light: lda light               ; too dark / too bright: 0.03 + 0.25 × distance
        cmp #<L_LO
        lda light+1
        sbc #>L_LO
        bcs @bright
        lda #<L_LO
        sec
        sbc light
        sta t0
        lda #>L_LO
        sbc light+1
        sta t1
        jmp @lmiss
@bright:
        lda #<L_HI
        cmp light
        lda #>L_HI
        sbc light+1
        bcs @lok
        lda light
        sec
        sbc #<L_HI
        sta t0
        lda light+1
        sbc #>L_HI
        sta t1
@lmiss: jsr div200
        clc
        adc #DH_OUT
        jsr lose
        jmp @bugs
@lok:   lda #DH_GOOD
        jsr win
@bugs:  lda nbugs
        beq @clean
        ldx #DH_BUG
        jsr mul8
        lda d_num
        jsr lose
        jmp @apply
@clean: lda #DH_CLEAN
        jsr win
@apply: lda gain                ; net gain, or the net loss × 0.86
        sec
        sbc loss
        sta t0
        lda gain+1
        sbc loss+1
        sta t1
        bcc @hurt
        lda health
        clc
        adc t0
        sta health
        lda health+1
        adc t1
        sta health+1
        cmp #>H_MAX
        bcc :+
        lda #<H_MAX
        sta health
        lda #>H_MAX
        sta health+1
:       rts
@hurt:  lda loss                ; x = net loss, × p_dmg / 256 (0.85-1.15)
        sec
        sbc gain
        sta t0
        lda loss+1
        sbc gain+1
        sta t1
        lda t0
        ldx p_dmg
        jsr mul8
        lda d_num+1
        sta t2
        lda t1
        ldx p_dmg
        jsr mul8
        lda d_num
        clc
        adc t2
        sta t2
        lda d_num+1
        adc #0
        sta t3
        lda p_dmg+1             ; × 1.x: + x
        beq :+
        lda t2
        clc
        adc t0
        sta t2
        lda t3
        adc t1
        sta t3
:       lda health
        sec
        sbc t2
        sta health
        lda health+1
        sbc t3
        sta health+1
        bcs :+
        lda #0
        sta health
        sta health+1
:       rts

; A added to gain / loss.
win:    clc
        adc gain
        sta gain
        bcc :+
        inc gain+1
:       rts
lose:   clc
        adc loss
        sta loss
        bcc :+
        inc loss+1
:       rts

; t0/t1 = x: A = x / 200 (x/256 + x/1024 + x/2048).
div200: lda t1
        sta t2
        lsr
        lsr
        sta t3
        clc
        adc t2
        sta t2
        lda t3
        lsr
        clc
        adc t2
        rts

; t0/t1 = x (< 16384): A = x × 0.009 (x/128 + x/1024).
mul009: lda t0
        asl
        lda t1
        rol
        sta t2
        lda t1
        lsr
        lsr
        clc
        adc t2
        rts

; acc += health × weight, the weight growing from 0.5 to 1.5 over the quarter.
weigh:  lda w_frac
        clc
        adc p_wstep
        sta w_frac
        lda w_frac+1
        adc p_wstep+1
        sta w_frac+1
        bcc :+
        inc w_int
:       lda health              ; h = health / 128, at most 255
        asl
        lda health+1
        rol
        bcc :+
        lda #255
:       ldx w_int
        jsr mul8
        lda d_num               ; / 128
        asl
        lda d_num+1
        rol
        sta t0
        lda #0
        rol
        sta t1
        lda acc
        clc
        adc t0
        sta acc
        lda acc+1
        adc t1
        sta acc+1
        bcc :+
        inc acc+2
:       rts

; Keys 1-3 act once per press; left/right pick a button, FIRE presses it.
controls:
        jsr number_key
        cmp lastkey
        beq @joy
        sta lastkey
        cmp #3
        bcs @joy
        jsr act
@joy:   lda JOYP
        and #J_LEFT
        beq :+
        ldx focus
        lda prev_btn,x
        jmp @move
:       lda JOYP
        and #J_RIGHT
        beq :+
        ldx focus
        lda next_btn,x
@move:  sta focus
        lda #SFX_BLIP
        jmp API_SFX
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp act
@out:   rts

; A = 0 water, 1 blinds, 2 spray.
act:    ldx weekend_t
        beq :+
        lda #SFX_BLIP
        jsr API_SFX
        lda #<s_closedoff
        ldx #>s_closedoff
        ldy #3
        jmp show_float
:       cmp #1
        beq @blinds
        bcs @spray
        lda water_cd            ; water
        bne @out
        lda #WATER_CD
        sta water_cd
        lda #SFX_BLIP
        jsr API_SFX
        lda #<WATER_ADD
        ldx #>WATER_ADD
        jsr add_water
        lda #<W_ROT
        cmp water
        lda #>W_ROT
        sbc water+1
        bcs @out
        lda #<s_glug
        ldx #>s_glug
        ldy #7
        jmp show_float
@out:   rts
@blinds:
        lda blinds
        eor #1
        sta blinds
        lda #SFX_BLIP
        jsr API_SFX
        ldx blinds
        lda bl_hi,x
        sta t0
        lda bl_lo,x
        ldx t0
        ldy #1
        jmp show_float
@spray: lda spray_cd
        bne @out
        lda #SPRAY_CD
        sta spray_cd
        lda nbugs
        beq @monitor
        jsr fb_reset            ; "Squashed!" or "-3 pests"
        lda nbugs
        cmp #1
        beq :+
        lda #'-'
        jsr fb_chr
        lda nbugs
        jsr fb_num
        lda #<s_pests2
        ldx #>s_pests2
        jsr fb_str
        lda #<fbuf
        ldx #>fbuf
        bne @sq
:       lda #<s_squashed
        ldx #>s_squashed
@sq:    ldy #5
        jsr show_float
        lda #0
        sta nbugs
        lda #1
        sta plant_dirty
        lda #SFX_GOOD
        jmp API_SFX
@monitor:
        lda #WET_T
        sta wet_t
        lda health
        sec
        sbc #<SPRAY_HURT
        sta health
        lda health+1
        sbc #>SPRAY_HURT
        sta health+1
        bcs :+
        lda #0
        sta health
        sta health+1
:       lda #2
        sta $d020
        lda #10
        sta border_t
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_monitor
        ldx #>s_monitor
        ldy #2
        jmp show_float

.if .defined(AUTOPLAY)
; Perfect player (test builds): spray every pest, water below 0.4, blinds up under 0.4 light and down over 0.5.
BOT_WATER = 13107
BOT_DARK  = 13107
BOT_LIT   = 16384
bot:    lda weekend_t
        bne @no
        lda nbugs
        beq @w
        lda spray_cd
        bne @w
        lda #2
        jmp act
@w:     lda water_cd
        bne @l
        lda water
        cmp #<BOT_WATER
        lda water+1
        sbc #>BOT_WATER
        bcs @l
        lda #0
        jmp act
@l:     lda blinds
        bne @open
        lda light
        cmp #<BOT_DARK
        lda light+1
        sbc #>BOT_DARK
        bcs @no
        lda #1
        jmp act
@open:  lda light
        cmp #<BOT_LIT
        lda light+1
        sbc #>BOT_LIT
        bcc @no
        lda #1
        jmp act
@no:    rts
.endif

; ---------------------------------------------------------------- the end

die:    lda #<s_transfer
        ldx #>s_transfer
        ldy #2
        jsr show_float
        lda #SFX_BAD
        jsr API_SFX
        jsr acc_score
        cmp #77                 ; at most 0.3
        bcc :+
        lda #76
:       jmp finish

quarter_end:
        jsr acc_score
        ; fall through

finish: sta MG_SCORE
        lda #0
        sta $d020
        lda #1
        sta done
        sec
        rts

; A = acc / Q_T (the weighted average health 0..255).
acc_score:
        lda acc
        sta t0
        lda acc+1
        sta t1
        lda acc+2
        sta t2
        lda #0
        sta d_num
        sta d_num+1
        ldx #24
@l:     asl t0
        rol t1
        rol t2
        rol d_num
        rol d_num+1
        lda d_num
        sec
        sbc p_q
        tay
        lda d_num+1
        sbc p_q+1
        bcc @n
        sta d_num+1
        sty d_num
        inc t0
@n:     dex
        bne @l
        lda t1
        ora t2
        beq :+
        lda #255
        rts
:       lda t0
        rts

.rodata
s_name:      .byte "Desk Plant Survival", 0
s_help:      .byte "Keep water and light in the bands.", 0
s_keys:      .byte "Keys 1-3, or left/right + FIRE", 0
s_week:      .byte "Week ", 0
s_isfun:     .byte "is fun", 0
s_of13:      .byte "/13", 0
s_colon:     .byte ": ", 0
s_q3:        .byte "Q3", 0
s_vitals:    .byte "PLANT VITALS", 0
s_water:     .byte "Water", 0
s_light:     .byte "Light", 0
s_pests:     .byte "Pests", 0
s_health:    .byte "Health", 0
s_blinds:    .byte "Blinds", 0
s_open:      .byte "  OPEN", 0
s_closed:    .byte "CLOSED", 0
s_none:      .byte "none"
s_low:       .byte " LOW", 0
s_ok:        .byte "  OK", 0
s_high:      .byte "HIGH", 0
s_bwater:    .byte "WATER", 0
s_bopen:     .byte "OPEN ", 0
s_close:     .byte "CLOSE", 0
s_bspray:    .byte "SPRAY", 0
s_closedoff: .byte "Office closed!", 0
s_glug:      .byte "Glug... too much!", 0
s_bup:       .byte "Blinds up", 0
s_bdown:     .byte "Blinds down", 0
s_squashed:  .byte "Squashed!", 0
s_pests2:    .byte " pests", 0
s_monitor:   .byte "You sprayed your monitor.", 0
s_transfer:  .byte "Your plant has filed for a transfer.", 0
st_lo:       .byte <s_low, <s_ok, <s_high
st_hi:       .byte >s_low, >s_ok, >s_high
st_col:      .byte 2, 5, 2
bl_lo:       .byte <s_bdown, <s_bup
bl_hi:       .byte >s_bdown, >s_bup
btn_x:       .byte 0, 13, 26
btn_lo:      .byte <s_bwater, <s_bopen, <s_bspray
btn_hi:      .byte >s_bwater, >s_bopen, >s_bspray
prev_btn:    .byte 2, 0, 1
next_btn:    .byte 1, 2, 0
band_lo_l:   .byte <W_LO, <L_LO
band_lo_h:   .byte >W_LO, >L_LO
band_hi_l:   .byte <W_HI, <L_HI
band_hi_h:   .byte >W_HI, >L_HI
soil_char:   .byte MC_C, MC_A, MC_C ; dry (sand), fine (dark), soggy (blue)
soil_col:    .byte 7 | 8, 8, 6 | 8
skyline:     .byte 2, 3, 1, 3, 2, 1, 3, 2, 2
mul11:       .byte 0, 11, 22, 33, 44, 55
map_lo:      .byte <plant_maps, <(plant_maps + 66), <(plant_maps + 132), <(plant_maps + 198)
map_hi:      .byte >plant_maps, >(plant_maps + 66), >(plant_maps + 132), >(plant_maps + 198)
row_lo:
.repeat 25, i
        .byte <(i * 40)
.endrepeat
row_hi:
.repeat 25, i
        .byte >(i * 40)
.endrepeat

.include "gen/mg_plant_data.s"

.bss
bss_start:
bug_t:       .res 2
ev_t:        .res 2
ac_t:        .res 2             ; (ac_t, heat_t consecutive)
heat_t:      .res 2
gain:        .res 2
loss:        .res 2
week:        .res 1
week_t:      .res 1
banner_t:    .res 1
wet_t:       .res 1
float_t:     .res 1
border_t:    .res 1
lastkey:     .res 1
ev_i:        .res 1
gi:          .res 1
bi:          .res 1
cap_ptr:     .res 2
cap_good:    .res 1
level:       .res 1
plant_dirty: .res 1
bar_c:       .res 1
fb_i:        .res 1
shown_win:   .res 1
shown_plant: .res 1
shown_soil:  .res 1
shown_btn:   .res 1
shown_wet:   .res 1
bug_cell:    .res MAX_BUGS      ; row × 16 + column
bss_end:
diff:        .res 1             ; set by init, then the parameters (not cleared with the rest)
p_q:         .res 2             ; the quarter, frames
p_evlast:    .res 2
p_evmin:     .res 2
p_dmg:       .res 2
p_wstep:     .res 2
p_week:      .res 1
p_drain:     .res 1
p_light:     .res 1
p_bugmin:    .res 1
p_bugrange:  .res 1
p_evrange:   .res 1
p_weekend:   .res 1
cg_deck:     .res CG_COUNT
cb_deck:     .res CB_COUNT
ev_deck:     .res EV_COUNT
fbuf:        .res 48
