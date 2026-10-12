; Perfect Timing (src/minigames/timing.js) as a disk-loaded overlay at $4000.
; First mash FIRE to fill a draining bar (smash the printer!), then stop the swinging needle in the green zone,
; round after round; the yellow band around it counts half. Score = 20% mash speed + 80% needle rounds:
;   mash = max(0.3, min(1, 1 - max(0, time - par) / (2 par))), a round = 1 green / 0.5 yellow / 0 else.
; Difficulty d = MG_DIFF / 255 (JS byDiff(d, a, b) = a + (b - a) × d):
;   d = 0: 4 rounds, 70 s; a press fills 9%, the bar drains 12%/s, par 3 s; needle 0.5 bars/s,
;          green zone 24% of the bar
;   d = 1: 7 rounds, 62 s; a press fills 7%, drain 28%/s, par 5 s; needle 1.1 bars/s, zone 12%;
;          from d 0.45 the zone drifts (0.05 .. 0.12 + 0.15 d bars/s)
;   every round: the needle 5% faster, the zone 5% narrower (but at least 0.075 × the needle's speed)
; A press within 0.35 s of a round's start doesn't count; after 6 s the round is lost ("Too slow!").
; The needle and the zone are sprites (pixel-exact); the bar is 256 px, positions in 1/128 px.
; Content per department (gen/mg_timing_data.s): texts and the 22 × 10 illustration (idle, blink, hit, miss).

.include "api.inc"
.include "gen/chars.inc"

GRACE_T   = 18                  ; 0.35 s
SLOW_T    = 6 * 50
RESULT_T  = 40                  ; 0.8 s between rounds
BREATH_T  = 60                  ; 1.2 s after the warm-up
MSG_T     = 50
FL_T      = 45                  ; smack floaters fade after 0.9 s
FLASH_T   = 10                  ; border flash on a miss
FLOATERS  = 4
BAR_U     = $8000               ; the bar's 256 px in 1/128 px
MOVE_DIFF = 115                 ; d > 0.45: the zone drifts

; layout
ART_X     = 9                   ; illustration: 22 × 10 cells at columns 9-30, rows 3-12
ART_Y     = 3
MSG_Y     = 14
BAR_X     = 4                   ; bar: columns 4-35 (256 px), rows 16-17, in a box
BAR_Y     = 16
INSTR_Y   = 19
HINT_Y    = 20
DOTS_Y    = 21
BAR_PX    = 24 + BAR_X * 8      ; sprite x of the bar's left edge
SPR_Y     = 50 + BAR_Y * 8      ; sprite y of the bar's top
SPR_FRAMES = $e300              ; needle, full block, green part, yellow part
SPR_PTR   = (SPR_FRAMES - $c000) / 64
F_NEEDLE  = 0
F_FULL    = 1
F_GREEN   = 2
F_YELLOW  = 3
SPAN_W    = 48                  ; px per x-expanded zone sprite

PH_MASH   = 0
PH_AIM    = 1
PH_RESULT = 2
ART_ANIM  = $ff                 ; art_mode: idle / blink alternating

.zeropage
phase:    .res 1
done:     .res 1
anim:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
pa:       .res 2                ; art copy: source chars, colours, screen, colour RAM
pc:       .res 2
ps:       .res 2
pd:       .res 2
sp_s:     .res 2                ; span: start px (signed), width, first sprite, sprites, frame, cache slot
sp_w:     .res 2
sp_first: .res 1
sp_n:     .res 1
sp_f:     .res 1
sp_c:     .res 1
en:       .res 1                ; sprite enable bits being built
msb:      .res 1
bd_a:     .res 2                ; bydiff
bd_b:     .res 2
bd_m:     .res 2
bd_p:     .res 3
bd_t:     .res 1
bd_h:     .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A/X = byDiff(a, b), rounded (16 bit).
.macro bydiff_w aa, bb
        lda #<(aa)
        sta bd_a
        lda #>(aa)
        sta bd_a+1
        lda #<(bb)
        sta bd_b
        lda #>(bb)
        sta bd_b+1
        jsr bydiff
.endmacro

; ---- setup

init:
        sta MG_DIFF
        lda #0                  ; zero page and BSS state (the overlay stays loaded between plays)
        ldx #<(bd_a - phase)
:       sta phase,x
        dex
        bpl :-
        ldx #<(bss_end - bss_start)
:       sta bss_start-1,x
        dex
        bne :-
        lda #$ff
        sta art_shown
        sta r
        sta cache_w
        sta cache_w+1
        sta last_hc
        lda #ART_ANIM
        sta art_mode
        ; the difficulty curve
        bydiff_w 4, 7
        sta rounds
        bydiff_w 70 * 50, 62 * 50
        sta total
        stx total+1
        bydiff_w 5898, 4588     ; fill per press: 9% .. 7% of 65536
        sta per
        stx per+1
        bydiff_w 157, 367       ; drain per frame: 12% .. 28% per second
        sta drain
        stx drain+1
        bydiff_w 150, 250       ; par: 3 .. 5 s
        sta par
        bydiff_w 328, 721       ; needle: 0.5 .. 1.1 bars/s in 1/128 px per frame
        sta sp_base
        stx sp_base+1
        bydiff_w 61, 31         ; zone: 24% .. 12% of 256 px
        sta zw_base
        bydiff_w 79, 177        ; drift: up to 0.12 .. 0.27 bars/s
        sta zv_top
        ; sprite frames: needle (a 7 px head, a 2 px stem) and a full 24 × 16 block
        ldx #0
        txa
:       sta SPR_FRAMES,x
        inx
        bne :-
        ldx #2 * 3
:       lda #$fe
        sta SPR_FRAMES + F_NEEDLE * 64,x
        dex
        dex
        dex
        bpl :-
        ldx #17 * 3             ; rows 3-20
:       lda #$18
        sta SPR_FRAMES + F_NEEDLE * 64 + 9,x
        dex
        dex
        dex
        bpl :-
        ldx #16 * 3 - 1
        lda #$ff
:       sta SPR_FRAMES + F_FULL * 64,x
        dex
        bpl :-
        ; sprites: hires, the zone ones x-expanded, in front of the bar
        lda #0
        sta $d01c
        sta $d017
        sta $d01b
        sta $d015
        lda #%00111110
        sta $d01d
        lda #1                  ; needle white, green zone, yellow band
        sta $d027
        lda #5
        sta $d028
        sta $d029
        lda #7
        sta $d02a
        sta $d02b
        sta $d02c
        lda #SPR_PTR + F_NEEDLE
        sta SCREEN + $3f8
        lda #SPR_Y - 3
        sta $d001
        ldx #2
:       lda #SPR_Y
        sta $d001,x
        inx
        inx
        cpx #12
        bne :-
        ; the scene
        text 1, 0, s_name, 7
        jsr draw_header
        lda #6
        sta COLOR
        lda #34
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #BAR_X - 1
        ldy #BAR_Y - 1
        jsr API_BOX
        lda #INSTR_Y
        ldx #3
        jsr clear_rows
        center INSTR_Y, s_mashhow, 1
        center HINT_Y, s_hint1, 3
        center HINT_Y + 1, s_hint2, 3
        jsr draw_mash_bar
        jsr update_art
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda total
        ldx total+1
        jmp timer_start

; ---- drawing

; Row 0, right: "Warm-up" or "Round r/rounds".
draw_header:
        lda #10
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #30
        ldy #0
        jsr API_FILL
        lda phase
        bne :+
        text 33, 0, s_warmup, 1
        rts
:       text 31, 0, s_round, 1
        lda r                   ; max(1, min(r + 1, rounds))
        cmp #$ff
        bne :+
        lda #0
:       clc
        adc #1
        cmp rounds
        bcc :+
        lda rounds
:       ldx #37
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        lda rounds
        ldx #39
        ldy #0
        jmp API_NUM

; A/X = text, Y = colour: centred on the message row (cleared after MSG_T unless T is 0).
message:
        sty t2
        pha
        txa
        pha
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        lda t2
        sta COLOR
        pla
        tax
        pla
        ldy #MSG_Y
        jsr API_CENTER
        lda #MSG_T
        sta msg_t
        rts

; The illustration: the frame for art_mode (ART_ANIM: idle and blink alternating every 8 frames).
update_art:
        lda art_mode
        cmp #ART_ANIM
        bne :+
        lda anim
        lsr
        lsr
        lsr
        and #1
:       cmp art_shown
        beq @out
        sta art_shown
        tax
        lda art_ch_lo,x
        sta pa
        lda art_ch_hi,x
        sta pa+1
        lda art_co_lo,x
        sta pc
        lda art_co_hi,x
        sta pc+1
        lda #<(SCREEN + ART_Y * 40 + ART_X)
        sta ps
        sta pd
        lda #>(SCREEN + ART_Y * 40 + ART_X)
        sta ps+1
        lda #>(COLRAM + ART_Y * 40 + ART_X)
        sta pd+1
        ldx #ART_H
@row:   ldy #ART_W - 1
:       lda (pa),y
        sta (ps),y
        lda (pc),y
        sta (pd),y
        dey
        bpl :-
        lda pa
        clc
        adc #ART_W
        sta pa
        bcc :+
        inc pa+1
:       lda pc
        clc
        adc #ART_W
        sta pc
        bcc :+
        inc pc+1
:       lda ps
        clc
        adc #40
        sta ps
        sta pd
        bcc :+
        inc ps+1
        inc pd+1
:       dex
        bne @row
@out:   rts

; The mash bar: filled half cells in green / yellow / red by the fill level, the rest dark grey.
draw_mash_bar:
        lda fill+1
        lsr
        lsr
        sta t0                  ; half cells 0..63
        ldx #2                  ; red under 40%, yellow, green over 75%
        lda fill+1
        cmp #103
        bcc :+
        ldx #7
        cmp #192
        bcc :+
        ldx #5
:       stx t1
        lda t0
        cmp last_hc
        bne :+
        cpx last_col
        beq @out
:       sta last_hc
        stx last_col
        ldy #0                  ; cell
@c:     tya
        asl
        sta t2                  ; 2 × cell
        lda #MC_A
        ldx #8
        lda t0
        sec
        sbc t2                  ; half cells left for this cell: >= 2 full, 1 half, else empty
        bcc @empty
        beq @empty
        cmp #1
        bne :+
        lda #240 + 1 + 4        ; left half
        ldx t1
        bne @put
:       lda #CH_BLOCK
        ldx t1
        bne @put
@empty: lda #MC_A
        ldx #8
@put:   sta SCREEN + BAR_Y * 40 + BAR_X,y
        sta SCREEN + BAR_Y * 40 + 40 + BAR_X,y
        txa
        sta COLRAM + BAR_Y * 40 + BAR_X,y
        sta COLRAM + BAR_Y * 40 + 40 + BAR_X,y
        iny
        cpy #32
        bne @c
@out:   rts

; The needle bar's base: red (the zone and the needle are sprites over it).
draw_aim_bar:
        ldy #31
:       lda #MC_C
        sta SCREEN + BAR_Y * 40 + BAR_X,y
        sta SCREEN + BAR_Y * 40 + 40 + BAR_X,y
        lda #2 | 8
        sta COLRAM + BAR_Y * 40 + BAR_X,y
        sta COLRAM + BAR_Y * 40 + 40 + BAR_X,y
        dey
        bpl :-
        rts

; Round dots under the bar: results in green / yellow / red, the current one white, the rest blue.
draw_dots:
        lda rounds
        eor #$ff
        sec
        adc #20
        sta t1                  ; column of the first dot
        ldx #0
@d:     stx t0
        lda #6
        cpx r
        bne :+
        lda #1
:       cpx done_n
        bcs :+
        ldy results,x
        lda result_col,y
:       sta COLOR
        txa
        asl
        adc t1
        tax
        lda #CH_BLOCK
        ldy #DOTS_Y
        jsr API_PUTC
        ldx t0
        inx
        cpx rounds
        bne @d
        rts

; ---- smack floaters (in the margins beside the illustration)

spawn_floater:
        ldx fl_next
        inx
        cpx #FLOATERS
        bcc :+
        ldx #0
:       stx fl_next
        lda fl_t,x
        beq :+
        jsr erase_floater
        ldx fl_next
:       lda #SMACKS
        jsr API_RMOD
        sta t0
        tay
        ldx fl_next
        lda smack_len,y
        sta fl_len,x
        eor #$ff                ; x = 0 .. 9 - len (left) or 31 .. 40 - len (right)
        sec
        adc #10
        jsr API_RMOD
        sta t1
        jsr API_RAND
        and #1
        beq :+
        lda t1
        clc
        adc #31
        sta t1
:       ldx fl_next
        lda t1
        sta fl_x,x
        lda #ART_H
        jsr API_RMOD
        clc
        adc #ART_Y
        ldx fl_next
        sta fl_y,x
        lda #FL_T
        sta fl_t,x
        ldy t0
        lda smack_lo,y
        sta PTR
        lda smack_hi,y
        sta PTR+1
        lda #7
        sta COLOR
        ldy fl_y,x
        lda fl_x,x
        tax
        jmp API_PRINT

; X = floater: its text blanked.
erase_floater:
        lda fl_len,x
        sta FILL_W
        lda #1
        sta FILL_H
        lda fl_y,x
        tay
        lda fl_x,x
        tax
        lda #' '
        jmp API_FILL

age_floaters:
        ldx #FLOATERS - 1
:       lda fl_t,x
        beq :+
        dec fl_t,x
        bne :+
        stx t0
        jsr erase_floater
        ldx t0
:       dex
        bpl :--
        rts

; ---- one frame

frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr age_floaters
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jsr clear_rows
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       jsr update_art
        jsr timer_tick
        bcc :+
        jmp time_up
:       lda phase
        beq mash
        cmp #PH_AIM
        bne :+
        jmp aim
:       jmp result

; ---- the warm-up

mash:
        inc mash_t
        bne :+
        inc mash_t+1
:       lda fill                ; drain
        sec
        sbc drain
        sta fill
        lda fill+1
        sbc drain+1
        sta fill+1
        bcs :+
        lda #0
        sta fill
        sta fill+1
:
.if .defined(AUTOPLAY)
        dec bot_t               ; perfect player: 10 presses a second
        bpl :+
        lda #4
        sta bot_t
        lda #J_FIRE
        sta JOYP
:
.endif
        lda JOYP
        and #J_FIRE
        beq @draw
        lda #5                  ; rim shot = the click
        jsr API_SFX
        jsr API_RAND            ; 35%: a smack floater
        cmp #90
        bcs :+
        jsr spawn_floater
:       lda fill
        clc
        adc per
        sta fill
        lda fill+1
        adc per+1
        sta fill+1
        bcc @draw
        jmp mashed
@draw:  jsr draw_mash_bar
        lda anim                ; the call to action pulses yellow / white
        and #7
        bne :+
        lda anim
        and #8
        beq @w
        center MSG_Y, s_mash, 7
        clc
        rts
@w:     center MSG_Y, s_mash, 1
:       clc
        rts

; The bar is full: the mash score, a breather, then the needle rounds.
mashed:
        lda #$ff
        sta fill
        sta fill+1
        jsr draw_mash_bar
        ; mash score = 255 - 255 × max(0, time - par) / (2 par), at least 77 (0.3)
        lda mash_t
        sec
        sbc par
        sta dv
        lda mash_t+1
        sbc #0
        sta dv+1
        bcs :+
        lda #255                ; under par
        bne @ms
:       lda par                 ; over >= 2 par: the floor
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda dv
        cmp t0
        lda dv+1
        sbc t1
        bcs @floor
        ldx #7                  ; over × 128 / par (< 256)
:       asl dv
        rol dv+1
        dex
        bne :-
        lda par
        sta dsr
        jsr div16
        lda dv
        eor #$ff                ; 255 - ratio
        cmp #77
        bcs @ms
@floor: lda #77
@ms:    sta ms255
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_mashed
        ldx #>s_mashed
        ldy #5
        jsr message
        lda #MSG_T + 10
        sta msg_t
        ; the needle UI
        lda #PH_RESULT
        sta phase
        lda #BREATH_T
        sta res_t
        lda #2                  ; the art shows its success frame
        sta art_mode
        jsr new_round
        jsr draw_aim_bar
        lda #INSTR_Y
        ldx #3
        jsr clear_rows
        center INSTR_Y, s_verb, 1
        jsr draw_dots
        jsr draw_header
        jsr place_sprites
        clc
        rts

; ---- the needle rounds

; Zone and needle for round r (the warm-up's breather uses round 0's).
new_round:
        lda r
        cmp #$ff
        bne :+
        lda #0
:       sta t0                  ; r × 13 / 256 = 5% a round
        asl
        adc t0
        asl
        asl
        adc t0
        sta t1
        ; speed = base + base × r × 13 / 256
        lda sp_base
        sta bd_m
        lda sp_base+1
        sta bd_m+1
        jsr mul16x8
        lda sp_base
        clc
        adc bd_p+1
        sta speed
        lda sp_base+1
        adc bd_p+2
        sta speed+1
        ; zw = max(base - base × r × 13 / 256, speed × 15 / 512)
        lda zw_base
        jsr mul8
        eor #$ff
        sec
        adc zw_base
        sta zw
        lda speed               ; speed × 15 / 512 = (speed × 16 - speed) / 512
        sta bd_m
        lda speed+1
        sta bd_m+1
        lda #15
        sta t1
        jsr mul16x8             ; -> bd_p (24 bit)
        lda bd_p+1              ; / 512
        lsr bd_p+2
        ror
        cmp zw
        bcc :+
        sta zw
:       ; zc = 38 + zw/2 + random(0 .. 180 - zw) px (0.15 .. 0.85 of the bar)
        lda #181
        sec
        sbc zw
        jsr API_RMOD
        clc
        adc #38
        sta t0
        lda zw
        lsr
        sta t2                  ; zw / 2
        clc
        adc t0
        jsr px_to_u
        sta zc
        stx zc+1
        ; drift limits: 0.08 .. 0.92 of the bar, minus half the zone
        lda #21
        clc
        adc t2
        jsr px_to_u
        sta zlo
        stx zlo+1
        lda #235
        sec
        sbc t2
        jsr px_to_u
        sta zhi
        stx zhi+1
        lda #0
        sta zv
        sta zv+1
        lda MG_DIFF
        cmp #MOVE_DIFF
        bcc @nodrift
        ; zv = 33 + random × (top - 33) / 256 (1/128 px per frame), either way
        lda zv_top
        sec
        sbc #33
        sta t1
        jsr API_RAND
        jsr mul8
        clc
        adc #33
        sta zv
        jsr API_RAND
        and #1
        beq @nodrift
        lda #0
        sec
        sbc zv
        sta zv
        lda #0
        sbc #0
        sta zv+1
@nodrift:
        ; the needle starts at either end
        lda #0
        sta p
        sta dir
        sta round_t
        sta round_t+1
        jsr API_RAND
        and #1
        beq :+
        lda #>BAR_U
        sta p+1
        lda #1
        sta dir
        rts
:       lda #0
        sta p+1
        rts

; A = px -> A/X = px × 128.
px_to_u:
        sta t0
        lda #0
        lsr t0
        ror
        ldx t0
        rts

aim:
        ; the needle bounces between the ends
        lda dir
        bne @left
        lda p
        clc
        adc speed
        sta p
        lda p+1
        adc speed+1
        sta p+1
        cmp #>BAR_U             ; past the right end (p > $8000)?
        bcc @zone
        bne :+
        lda p
        beq @zone
:       lda #0                  ; p = 2 × BAR_U - p
        sec
        sbc p
        sta p
        lda #0
        sbc p+1
        sta p+1
        lda #1
        sta dir
        bne @zone
@left:  lda p
        sec
        sbc speed
        sta p
        lda p+1
        sbc speed+1
        sta p+1
        bcs @zone
        lda #0                  ; p = -p
        sec
        sbc p
        sta p
        lda #0
        sbc p+1
        sta p+1
        lda #0
        sta dir
@zone:  lda zv                  ; the zone drifts, turning at its limits
        ora zv+1
        beq @t
        lda zc
        clc
        adc zv
        sta zc
        lda zc+1
        adc zv+1
        sta zc+1
        lda zhi                 ; zc > zhi?
        cmp zc
        lda zhi+1
        sbc zc+1
        bcc @turn
        lda zc                  ; zc < zlo?
        cmp zlo
        lda zc+1
        sbc zlo+1
        bcs @t
@turn:  lda #0
        sec
        sbc zv
        sta zv
        lda #0
        sbc zv+1
        sta zv+1
@t:     inc round_t
        bne :+
        inc round_t+1
:       jsr place_sprites
        jsr calc_dist
        lda round_t+1           ; a press counts after the grace period
        bne :+
        lda round_t
        cmp #GRACE_T + 1
        bcc @slow
:
.if .defined(AUTOPLAY)
        lda zw                  ; perfect player: press within a quarter zone of the centre
        jsr px_to_u             ; (zw / 4 px = zw × 32)
        stx t0
        lsr t0
        ror
        lsr t0
        ror
        cmp dist
        lda t0
        sbc dist+1
        bcc :+
        lda #J_FIRE
        sta JOYP
:
.endif
        lda JOYP
        and #J_FIRE
        beq @slow
        lda #1
        jmp judge
@slow:  lda round_t+1           ; 6 s: too slow
        cmp #>SLOW_T
        bcc @out
        lda round_t
        cmp #<SLOW_T
        bcc @out
        lda #0
        jmp judge
@out:   clc
        rts

; dist = |p - zc| (1/128 px).
calc_dist:
        lda p
        sec
        sbc zc
        sta dist
        lda p+1
        sbc zc+1
        sta dist+1
        bcs :+
        lda #0
        sec
        sbc dist
        sta dist
        lda #0
        sbc dist+1
        sta dist+1
:       rts

; C=1 if dist <= A px × 128 / 2^Y (Y = 0 .. 7).
within:
        jsr px_to_u
        stx t0
        cpy #0
        beq @cmp
:       lsr t0
        ror
        dey
        bne :-
@cmp:   cmp dist
        lda t0
        sbc dist+1
        rts

; A = 1 pressed, 0 timed out: score the round.
judge:
        sta t2
        jsr calc_dist
        lda #0                  ; t1 = 2 green, 1 yellow, 0 miss
        sta t1
        lda t2
        beq @set
        lda zw
        ldy #0
        jsr within              ; dist <= zw
        bcc @set
        inc t1
        lda zw
        ldy #1
        jsr within              ; dist <= zw / 2
        bcc @set
        inc t1
@set:   ldy done_n
        lda t1
        sta results,y
        clc
        adc sum2
        sta sum2
        inc done_n
        lda t1
        beq @miss
        cmp #2
        bne @half
        lda #SFX_GOOD
        jsr API_SFX
        lda #2                  ; art: hit
        sta art_mode
        lda zw                  ; dist <= zw / 6 ~ zw × 21 / 128: PERFECT!
        sta t1
        lda #43
        jsr mul8                ; zw × 43 / 256 px = zw / 6
        ldy #0
        jsr within
        bcc :+
        lda #<s_perfect
        ldx #>s_perfect
        ldy #5
        bne @msg
:       lda #<s_thhit
        ldx #>s_thhit
        ldy #5
        bne @msg
@half:  lda #SFX_BLIP
        jsr API_SFX
        lda #0                  ; art: the plain idle frame
        sta art_mode
        lda #<s_close
        ldx #>s_close
        ldy #7
        bne @msg
@miss:  lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #FLASH_T
        sta flash_t
        lda #3                  ; art: miss
        sta art_mode
        lda #<s_thmiss
        ldx #>s_thmiss
        ldy t2
        bne :+
        lda #<s_slow
        ldx #>s_slow
:       ldy #2
@msg:   jsr message
        jsr draw_dots
        lda #PH_RESULT
        sta phase
        lda #RESULT_T
        sta res_t
        clc
        rts

result:
        dec res_t
        bne @out
        inc r
        lda r
        cmp rounds
        bcc :+
        jmp finish
:       jsr new_round
        lda #PH_AIM
        sta phase
        lda #ART_ANIM
        sta art_mode
        jsr draw_header
        jsr draw_dots
        jsr place_sprites
@out:   clc
        rts

; ---- sprites

; The needle (sprite 0), the green zone (1-2) and the yellow band (3-5) from p, zc and zw.
place_sprites:
        lda #0
        sta msb
        lda #1
        sta en
        ; needle: x = BAR_PX + p / 128 - 3
        lda p
        asl
        lda p+1
        rol
        sta t0
        lda #0
        rol
        sta t1                  ; p in px (0..256)
        lda t0
        clc
        adc #<(BAR_PX - 3)
        sta $d000
        lda t1
        adc #>(BAR_PX - 3)
        beq :+
        lda #1
        sta msb
:       ; zone centre in px
        lda zc
        asl
        lda zc+1
        rol
        sta t2
        ; green: from zc - zw/2, zw wide
        lda zw
        lsr
        sta t0
        lda t2
        sec
        sbc t0
        sta sp_s
        lda #0
        sbc #0
        sta sp_s+1
        lda zw
        sta sp_w
        lda #0
        sta sp_w+1
        lda #1
        sta sp_first
        lda #2
        sta sp_n
        lda #F_GREEN
        sta sp_f
        lda #0
        sta sp_c
        jsr span
        ; yellow: from zc - zw, 2 zw wide
        lda t2
        sec
        sbc zw
        sta sp_s
        lda #0
        sbc #0
        sta sp_s+1
        lda zw
        asl
        sta sp_w
        lda #0
        rol
        sta sp_w+1
        lda #3
        sta sp_first
        sta sp_n
        lda #F_YELLOW
        sta sp_f
        lda #1
        sta sp_c
        jsr span
        lda msb
        sta $d010
        lda en
        sta $d015
        rts

; A run of sp_n x-expanded sprites from sp_first covering sp_w px from bar px sp_s (clipped to the bar):
; full blocks, then the part frame sp_f (rebuilt when its width changes, cache slot sp_c).
span:
        lda sp_s+1              ; clip on the left
        bpl :+
        lda sp_w
        clc
        adc sp_s
        sta sp_w
        lda sp_w+1
        adc sp_s+1
        sta sp_w+1
        lda #0
        sta sp_s
        sta sp_s+1
:       lda sp_w+1              ; nothing left?
        bmi @off_all
        ora sp_w
        bne :+
@off_all:
        jmp @none
:
        lda sp_s                ; clip on the right: w <= 256 - s
        clc
        adc sp_w
        lda sp_s+1
        adc sp_w+1
        beq :+
        lda #0
        sec
        sbc sp_s
        sta sp_w
        lda #0
        sta sp_w+1
:       ; sprite by sprite
        ldx sp_first
@s:     lda sp_w+1
        bne @full
        lda sp_w
        beq @off
        cmp #SPAN_W
        bcs @full
        ; the part: rebuild the frame if this width is new
        ldy sp_c
        cmp cache_w,y
        beq :+
        sta cache_w,y
        stx t1
        jsr build_part
        ldx t1
:       lda sp_f
        bne @ptr
@full:  lda #F_FULL
@ptr:   clc
        adc #SPR_PTR
        sta SCREEN + $3f8,x
        txa                     ; x = BAR_PX + s
        asl
        tay
        lda sp_s
        clc
        adc #<BAR_PX
        sta $d000,y
        lda sp_s+1
        adc #>BAR_PX
        beq :+
        lda bit_tab,x
        ora msb
        sta msb
:       lda bit_tab,x
        ora en
        sta en
        lda sp_s                ; next: 48 px on
        clc
        adc #SPAN_W
        sta sp_s
        bcc :+
        inc sp_s+1
:       lda sp_w
        sec
        sbc #SPAN_W
        sta sp_w
        lda sp_w+1
        sbc #0
        sta sp_w+1
        bpl :+
        lda #0
        sta sp_w
        sta sp_w+1
:
@off:   inx
        dec sp_n
        bne @s
@none:  rts

; A = width in screen px (1..47, x-expanded): frame sp_f gets that many px of 16 rows set.
build_part:
        clc
        adc #1
        lsr                     ; sprite pixels 1..24
        ldx #0
:       cmp #8                  ; three bytes of a row
        bcc :+
        sbc #8
        pha
        lda #$ff
        sta row3,x
        pla
        inx
        cpx #3
        bne :-
        beq @fill
:       tay
        lda mask_tab,y
        sta row3,x
        inx
        lda #0
:       cpx #3
        beq @fill
        sta row3,x
        inx
        bne :-
@fill:  lda sp_f                ; frame address: SPR_FRAMES + f × 64
        asl
        asl
        asl
        asl
        asl
        asl
        tay
        ldx #16
:       lda row3
        sta SPR_FRAMES,y
        lda row3+1
        sta SPR_FRAMES+1,y
        lda row3+2
        sta SPR_FRAMES+2,y
        iny
        iny
        iny
        dex
        bne :-
        rts

; ---- the end

; The total time ran out: during the warm-up, a tenth of the fill.
time_up:
        lda phase
        bne finish
        lda fill+1
        sta t1
        lda #26
        jsr mul8
        jmp finish_a

; score = mash / 5 + 102 × sum2 / rounds (sum2 = round results in halves)
finish:
        lda ms255
        sta dv
        lda #0
        sta dv+1
        lda #5
        sta dsr
        jsr div16
        lda dv
        pha
        lda sum2                ; 102 × sum2 (16 bit)
        sta t1
        lda #102
        sta bd_m
        lda #0
        sta bd_m+1
        jsr mul16x8
        lda bd_p
        sta dv
        lda bd_p+1
        sta dv+1
        lda rounds
        sta dsr
        jsr div16
        pla
        clc
        adc dv
        bcc finish_a
        lda #255
finish_a:
        sta MG_SCORE
        lda #1
        sta done
        lda #0
        sta $d015
        sta $d01d
        sta $d020
        sec
        rts

; ---- arithmetic

; A × t1 / 256 -> A.
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

; bd_m (16 bit) × t1 -> bd_p (24 bit: bd_p+1/+2 = the product / 256).
mul16x8:
        lda t1
        sta bd_t
        lda #0
        sta bd_p
        sta bd_p+1
        sta bd_p+2
        ldy #8
@l:     lsr bd_t
        bcc :+
        lda bd_p+1
        clc
        adc bd_m
        sta bd_p+1
        lda bd_p+2
        adc bd_m+1
        sta bd_p+2
:       ror bd_p+2
        ror bd_p+1
        ror bd_p
        dey
        bne @l
        rts

; dv (16 bit) / dsr -> dv, remainder in rem.
div16:
        lda #0
        sta rem
        ldx #16
@l:     asl dv
        rol dv+1
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

; A/X = round(bd_a + (bd_b - bd_a) × MG_DIFF / 255), 16 bit.
bydiff:
        lda bd_b
        sec
        sbc bd_a
        sta bd_m
        lda bd_b+1
        sbc bd_a+1
        sta bd_m+1
        php                     ; N: b < a
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda MG_DIFF             ; p = |b - a| × diff (24 bit)
        sta t1
        jsr mul16x8
        ; p / 255 ~ (p + p / 256 + 128) / 256 = p2:(p1 + p2) + carry of (p0 + p1 + 128)
        lda #0
        sta bd_h
        lda bd_p
        clc
        adc #$80
        bcc :+
        inc bd_h
        clc
:       adc bd_p+1
        bcc :+
        inc bd_h
:       lda bd_p+1
        clc
        adc bd_p+2
        sta bd_m
        lda bd_p+2
        adc #0
        sta bd_m+1
        lda bd_m
        clc
        adc bd_h
        sta bd_m
        bcc :+
        inc bd_m+1
:       plp
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda bd_m
        clc
        adc bd_a
        pha
        lda bd_m+1
        adc bd_a+1
        tax
        pla
        rts

.rodata
s_name:     .byte "Perfect Timing", 0
s_help:     .byte "Mash FIRE to fill the bar, then stop the needle in the green zone.", 0
s_keys:     .byte "FIRE: mash, then stop the needle", 0
s_warmup:   .byte "Warm-up", 0
s_round:    .byte "Round", 0
s_mashhow:  .byte "Mash FIRE as fast as you can!", 0
s_perfect:  .byte "PERFECT!", 0
s_close:    .byte "Close enough", 0
s_slow:     .byte "Too slow!", 0
result_col: .byte 2, 7, 5       ; miss, half, hit
bit_tab:    .byte 1, 2, 4, 8, 16, 32, 64, 128
mask_tab:   .byte $00, $80, $c0, $e0, $f0, $f8, $fc, $fe

.include "gen/mg_timing_data.s"

.bss
bss_start:
rounds:     .res 1
total:      .res 2
per:        .res 2
drain:      .res 2
par:        .res 1
sp_base:    .res 2
zw_base:    .res 1
zv_top:     .res 1
fill:       .res 2              ; 65536 = full
mash_t:     .res 2
ms255:      .res 1
r:          .res 1              ; round, $ff during the warm-up
done_n:     .res 1              ; rounds scored
sum2:       .res 1
results:    .res 8
speed:      .res 2
zw:         .res 1              ; zone width, px
zc:         .res 2              ; zone centre, 1/128 px
zv:         .res 2
zlo:        .res 2
zhi:        .res 2
p:          .res 2              ; needle, 1/128 px
dir:        .res 1              ; 0 right, 1 left
dist:       .res 2
round_t:    .res 2
res_t:      .res 1
msg_t:      .res 1
flash_t:    .res 1
art_mode:   .res 1
art_shown:  .res 1
last_hc:    .res 1
last_col:   .res 1
cache_w:    .res 2
row3:       .res 3
dv:         .res 2
dsr:        .res 1
rem:        .res 1
fl_next:    .res 1
fl_x:       .res FLOATERS
fl_y:       .res FLOATERS
fl_len:     .res FLOATERS
fl_t:       .res FLOATERS
.if .defined(AUTOPLAY)
bot_t:      .res 1
.endif
bss_end:
