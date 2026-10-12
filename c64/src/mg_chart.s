; Magic Chart (src/minigames/chart.js) as a disk-loaded overlay at $4000.
; Tune the mystery sliders, knobs and switches until the quarterly chart climbs to the target line. Every
; control has a hidden sweet spot; the closer the whole panel is, the steeper the chart rises.
;   d = 0: 3 controls (one of each kind), threshold 0.78, no market drift, 85 s for 3 quarters
;   d = 1: 6 controls (two of each), threshold 0.81, from d = 0.5 a "market shift" moves one slider's or
;          knob's sweet spot by 1 every 16 s (d = 0.5) to 10 s (d = 1), 80 s
; Controls: round(3 + 3 d), kinds slider, knob, switch, slider, knob, switch cut to that many and shuffled.
; quality = mean of 1 - |value - target| / range; slope = (quality - threshold) × 125 per second (× 0.3
; below the threshold), sampled every 0.1 s with ±0.6 noise. Score = (quarters + progress of the current
; one) / 3. The chart is drawn in quarter blocks, 2 samples per pixel column (12.8 s of history).
; With 4-6 controls the boxes narrow (10, 8, 6 columns): compact knobs and shortened labels in the boxes,
; the focused control's full label on the row above the panel.
; Content: src/data/mg-chart.js (gen/mg_chart_data.s).

.include "api.inc"
.include "gen/chars.inc"

MAX_CTRLS = 6
DRIFT_DIFF = 128                ; market shifts from d = 0.5
DRIFT_T   = 16 * 50             ; minus 6 s × d (from d = 0.5)
SHIFT_T   = 60                  ; "Market shift!" shown 1.2 s
ROUNDS    = 3
START_V   = 25
SAMPLE_T  = 5                   ; 0.1 s per chart sample
TIME_T    = 85 * 50             ; minus the difficulty: byDiff(d, 85, 80) s
THR_BASE  = 597                 ; threshold 0.78 × 765 (quality is summed in 1/255 steps over 3 controls)
FLASH_T   = 30                  ; 0.6 s gold flash
MSG_T     = 45                  ; 0.9 s for the "target smashed" texts
V_MAX     = 100 * 256           ; v is 8.8 fixed point

K_SLIDER  = 0
K_KNOB    = 1
K_SWITCH  = 2

; monitor (rows 2-14) and the chart in it
MON_X     = 1
MON_W     = 39
CH_X      = 6                   ; plot: columns 6-37, rows 5-13 = 64 × 18 quarter-block pixels
CH_Y      = 5
CW        = 32
CHH       = 9
HIST      = 2 * CW              ; one value per pixel column
; control panel: 3-6 boxes of 13 / 10 / 8 / 6 × 8 on rows 16-23, the focused one's label on row 15
BOX_Y     = 16
LABEL_Y   = 15

.zeropage
bp:       .res 2                ; buffer row
cl:       .res 2                ; colour RAM row
sp:       .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
cx:       .res 1                ; left column of the control box being drawn
ci:       .res 1                ; control being drawn
v:        .res 2                ; chart value, 8.8
dd:       .res 2                ; quality - threshold (signed)
acc:      .res 2
px:       .res 1                ; pixel column being drawn
pcol:     .res 1
focus:    .res 1
btop:     .res 1
bbot:     .res 1
cc:       .res 1
crow:     .res 1
col_end:  .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department
init:
        sta diff
        lda #0
        ldx #vars_end - vars - 1
:       sta vars,x
        dex
        bpl :-
        sta focus
        lda #SAMPLE_T
        sta samp_t
        ; threshold = 0.78 + 0.03 d: + difficulty / 11 in 1/765 steps
        lda diff
        ldx #0
:       cmp #11
        bcc :+
        sbc #11
        inx
        bne :-
:       txa
        clc
        adc #<THR_BASE
        sta thr
        lda #>THR_BASE
        adc #0
        sta thr+1
        lda #T_COUNT
        jsr API_RMOD
        sta title
        ; controls: round(3 + 3 d) = 3 + (3 × diff + 128) / 256, and the panel layout for that many
        lda diff
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda t0
        clc
        adc diff
        bcc :+
        inc t1
:       clc
        adc #128
        lda t1
        adc #3
        sta nctl
        sec
        sbc #3
        tay
        lda lab_base_tab,y
        sta lab_base
        tya
        asl
        asl
        asl
        tay
        ldx #0
:       lda lay_tab,y
        sta lay,x
        iny
        inx
        cpx #LAY_SIZE
        bne :-
        lda bx0                 ; box columns
        ldx #0
:       sta box_x,x
        clc
        adc bw
        inx
        cpx #MAX_CTRLS
        bne :-
        ; market shifts from d = 0.5: every 16 s - 6 s × d = 800 - diff × (1 + 1/8 + 1/16) frames
        lda diff
        cmp #DRIFT_DIFF
        bcc @nodrift
        lsr
        lsr
        lsr
        sta t0                  ; d / 8
        lsr
        clc
        adc t0
        adc diff
        sta t0
        lda #0
        rol
        sta t1
        lda #<DRIFT_T
        sec
        sbc t0
        sta drift_every
        lda #>DRIFT_T
        sbc t1
        sta drift_every+1
        lda #1
        sta drift_on
        jsr drift_reset
@nodrift:
        ; the panel: slider, knob, switch, slider, knob, switch cut to nctl and shuffled, a label of its kind
        ; for each (no two alike), random settings
        ldx #MAX_CTRLS - 1
:       lda kind_seq,x
        sta kind,x
        dex
        bpl :-
        ldx nctl
        dex
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda kind,x
        pha
        lda kind,y
        sta kind,x
        pla
        sta kind,y
        dex
        bne @shuf
        ldx nctl
        dex
@ctl:   stx t0
        ldy kind,x
        lda kind_count,y
        jsr API_RMOD
        ldx t0
        ldy kind,x
        clc
        adc kind_first,y
        sta label,x
        ldy nctl                ; taken by a later control (they are picked from the last down)? again
        dey
:       cpy t0
        beq :+
        bcc :+
        cmp label,y
        beq @ctl
:       dey
        bpl :--
        ldy kind,x
        lda range_tab,y
        clc
        adc #1
        jsr API_RMOD
        ldx t0
        sta value,x
        dex
        bpl @ctl
        jsr new_targets
        ; screen
        text 1, 0, s_name, 7
        jsr draw_quarter
        lda #1
        sta COLOR
        lda #MON_W
        sta FILL_W
        lda #13
        sta FILL_H
        ldx #MON_X
        ldy #2
        jsr API_BOX
        lda #1
        sta COLOR
        ldx title
        lda title_lo,x
        sta PTR
        lda title_hi,x
        sta PTR+1
        ldx #3
        ldy #3
        jsr API_PRINT
        text CH_X, 4, s_target, 7
        ldx #CH_X + 7           ; the target line
:       stx t0
        lda #7
        sta COLOR
        lda #'-'
        ldy #4
        jsr API_PUTC
        ldx t0
        inx
        inx
        cpx #CH_X + 22
        bcc :-
        ldx #4                  ; y axis: 100, 75, 50, 25, 0
:       stx t0
        lda #3
        sta COLOR
        lda axis_lo,x
        sta PTR
        lda axis_hi,x
        sta PTR+1
        lda axis_x,x
        pha
        txa
        asl
        adc #CH_Y
        tay
        pla
        tax
        jsr API_PRINT
        ldx t0
        dex
        bpl :-
        jsr draw_pills
        ldx nctl                ; every box
        lda bitv,x
        sec
        sbc #1
        sta dirty
        jsr draw_panel
        jsr draw_label
        jsr draw_slope
        jsr render
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<TIME_T
        sec
        sbc diff
        pha
        lda #>TIME_T
        sbc #0
        tax
        pla
        jmp timer_start

; New hidden sweet spots, mostly away from the current settings; the quarter always starts in decline.
new_targets:
        ldx nctl
        dex
@c:     stx t0
        lda kind,x
        cmp #K_SWITCH
        bne @dial
        jsr API_RAND            ; 75 %: the other position
        ldx t0
        ldy value,x
        cmp #192
        bcs :+
        tya
        eor #1
        tay
:       tya
        sta target,x
        jmp @next
@dial:  lda #7                  ; up to 6 retries while it is closer than 35 % of the range
        sta t1
@try:   ldx t0
        ldy kind,x
        lda range_tab,y
        clc
        adc #1
        jsr API_RMOD
        ldx t0
        sta target,x
        dec t1
        beq @next
        sec
        sbc value,x
        bcs :+
        eor #$ff
        adc #1
:       ldy kind,x
        cmp min_dist,y
        bcc @try
@next:  ldx t0
        dex
        bpl @c
        jsr quality
        lda dd+1
        bmi @reset
        ldx #$ff                ; still good enough: send the first dial to the far end
:       inx
        lda kind,x
        cmp #K_SWITCH
        beq :-
        tay
        lda value,x
        asl
        sta t1
        lda range_tab,y         ; value > range / 2: to 0, else to the top
        cmp t1
        bcs :+
        lda #0
:       sta target,x
@reset: lda #0
        sta v
        lda #START_V
        sta v+1
        ldx #HIST - 1
:       sta hist,x
        dex
        bpl :-
        inc chart_dirty
        rts

; dd = quality × 765 - threshold (signed), quality relative to the threshold: Σ closeness × 255, scaled
; from nctl controls to 3 (× 768 / nctl / 256).
quality:
        lda #0
        sta acc
        sta acc+1
        ldx nctl
        dex
:       lda value,x
        sec
        sbc target,x
        bcs :+
        eor #$ff
        adc #1
:       ldy kind,x
        clc
        adc close_off,y
        tay
        lda close_tab,y
        clc
        adc acc
        sta acc
        bcc :+
        inc acc+1
:       dex
        bpl :---
        ldy nctl
        lda qmul-3,y
        beq @sub                ; 3 controls: as it is
        sta t3                  ; acc = acc × t3 / 256 (24-bit product, top two bytes)
        lda #0
        sta t2                  ; product byte 0
        sta pcol                ; byte 1
        sta col_end             ; byte 2
        ldx #8
@mul:   asl t2
        rol pcol
        rol col_end
        asl t3
        bcc :+
        lda t2
        clc
        adc acc
        sta t2
        lda pcol
        adc acc+1
        sta pcol
        bcc :+
        inc col_end
:       dex
        bne @mul
        lda pcol
        sta acc
        lda col_end
        sta acc+1
@sub:   lda acc
        sec
        sbc thr
        sta dd
        lda acc+1
        sbc thr+1
        sta dd+1
        rts

; ---------------------------------------------------------------- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       lda msg_t
        beq :+
        dec msg_t
        bne :+
        jsr clear_msgs
:       jsr timer_tick
        bcc :+
        jmp finish
:       lda drift_on            ; market shifts
        beq @nodrift
        lda drift_t
        bne :+
        dec drift_t+1
:       dec drift_t
        lda drift_t
        ora drift_t+1
        bne @nodrift
        jsr drift_reset
        jsr shift
@nodrift:
        lda shift_t
        beq :+
        dec shift_t
        bne :+
        jsr draw_label
:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        jsr ctl_key
        cmp nctl
        bcs :+
        jsr set_focus
:       lda JOYP
        and #J_LEFT
        beq :+
        ldx focus
        dex
        txa
        bpl @setf
        lda nctl
        sec
        sbc #1
        bpl @setf
:       lda JOYP
        and #J_RIGHT
        beq @adj
        ldx focus
        inx
        txa
        cmp nctl
        bcc @setf
        lda #0
@setf:  jsr set_focus
@adj:   lda JOYP
        and #J_UP
        beq :+
        lda #1
        jsr adjust
:       lda JOYP
        and #J_DOWN
        beq :+
        lda #$ff
        jsr adjust
:       lda JOYP
        and #J_FIRE
        beq @panel
        ldx focus
        lda kind,x
        cmp #K_KNOB
        bne :+
        lda value,x             ; the knob turns on and wraps around
        clc
        adc #1
        and #7
        sta value,x
        jsr clicked
        jmp @panel
:       cmp #K_SWITCH
        bne @panel
        jsr adjust
@panel: lda dirty
        beq :+
        jsr draw_panel
:       dec samp_t
        bne @draw
        lda #SAMPLE_T
        sta samp_t
        jsr sample
        lda done
        beq :+
        sec
        rts
:       jsr draw_slope
@draw:  lda msg_t
        bne @out
        lda rphase              ; second half of a chart redraw
        beq :+
        jsr render_2
        jmp @out
:       lda chart_dirty
        beq @out
        jsr render_1
@out:   clc
        rts

; A = +1 / -1: change the focused control (a switch flips either way).
adjust:
        ldx focus
        ldy kind,x
        cpy #K_SWITCH
        bne :+
        lda value,x
        eor #1
        sta value,x
        jmp clicked
:       clc
        adc value,x
        bmi @out                ; below 0
        cmp range_tab,y
        beq :+
        bcs @out                ; above the range
:       sta value,x
        jmp clicked
@out:   rts

clicked:
        lda #SFX_BLIP
        jsr API_SFX
        ; fall through

; Mark the focused control's box for a redraw.
mark:   ldx focus
        lda bitv,x
        ora dirty
        sta dirty
        rts

; A = control to focus: both boxes get redrawn, and the label row.
set_focus:
        cmp focus
        beq :+
        pha
        jsr mark
        pla
        sta focus
        jsr mark
        jmp draw_label
:       rts

; Keys 1-6: A = 0..5, or $ff.
ctl_key:
        jsr number_key
        bpl @out
        lda $cb
        ldx #1
:       cmp key56,x
        beq :+
        dex
        bpl :-
        txa                     ; $ff
        rts
:       txa
        clc
        adc #4
@out:   rts

; Market shift: one slider's or knob's sweet spot moves by 1 (back in if it would leave the range).
shift:
        jsr API_RAND
        and #1
        sta t1                  ; 0 up, 1 down
@pick:  lda nctl
        jsr API_RMOD
        tax
        ldy kind,x
        cpy #K_SWITCH
        beq @pick
        lda t1
        bne @dn
        lda target,x            ; up, unless at the top
        cmp range_tab,y
        bcs @dec
@inc:   inc target,x
        bne @shown
@dn:    lda target,x            ; down, unless at 0
        beq @inc
@dec:   dec target,x
@shown: lda #SHIFT_T
        sta shift_t
        ; fall through

; Row 15: "Market shift!" while it shows, else the focused control's full label (with 4-6 controls).
draw_label:
        lda #LABEL_Y
        ldx #1
        jsr clear_rows
        lda shift_t
        beq :+
        center LABEL_Y, s_shift, 7
        rts
:       lda nctl
        cmp #4
        bcc :+
        lda #7
        sta COLOR
        ldx focus
        ldy label,x
        lda lab_lo,y
        ldx lab_hi,y
        ldy #LABEL_Y
        jmp API_CENTER
:       rts

; drift_t = drift_every
drift_reset:
        lda drift_every
        sta drift_t
        lda drift_every+1
        sta drift_t+1
        rts

; One chart sample: v += slope × 0.1 s + noise; a full chart wins the quarter.
sample:
        jsr quality
        lda dd+1
        bmi @neg
        lda dd                  ; rising: × 4.1875 (125 × 0.1 × 256 / 765 = 4.18)
        sta acc
        lda dd+1
        sta acc+1
        ldx #4                  ; acc = dd × 3 / 16
        lda dd
        asl
        sta t0
        lda dd+1
        rol
        sta t1
        lda t0
        clc
        adc dd
        sta t0
        lda t1
        adc dd+1
        sta t1
:       lsr t1
        ror t0
        dex
        bne :-
        asl acc                 ; + dd × 4
        rol acc+1
        asl acc
        rol acc+1
        lda acc
        clc
        adc t0
        sta acc
        lda acc+1
        adc t1
        sta acc+1
        jmp @add
@neg:   lda dd                  ; sinking: × 0.3 × 4.18 = × 1.25
        sta acc
        lda dd+1
        sta acc+1
        cmp #$80                ; acc / 4, keeping the sign
        ror acc+1
        ror acc
        lda acc+1
        cmp #$80
        ror acc+1
        ror acc
        lda acc
        clc
        adc dd
        sta acc
        lda acc+1
        adc dd+1
        sta acc+1
@add:   lda acc
        clc
        adc v
        sta v
        lda acc+1
        adc v+1
        sta v+1
        ; noise: rnd × 1.19 - 151 (±0.59 units)
        jsr API_RAND
        sta t0
        lsr
        lsr
        sta t1                  ; rnd / 4
        lsr
        lsr
        sta t2                  ; rnd / 16
        lda t0
        clc
        adc t1
        sta t0
        lda #0
        adc #0
        sta t1
        lda t0
        sec
        sbc t2
        sta t0
        lda t1
        sbc #0
        sta t1
        lda t0
        sec
        sbc #151
        sta t0
        lda t1
        sbc #0
        sta t1
        lda v
        clc
        adc t0
        sta v
        lda v+1
        adc t1
        sta v+1
        bpl :+
        lda #0                  ; below 0
        sta v
        sta v+1
:       lda v+1
        cmp #>V_MAX
        bcc @push
        lda #<V_MAX
        sta v
        lda #>V_MAX
        sta v+1
        jmp smash
@push:  lda half                ; every second sample becomes a pixel column
        eor #1
        sta half
        bne @out
        ldx #0
:       lda hist+1,x
        sta hist,x
        inx
        cpx #HIST - 1
        bne :-
        lda v+1
        sta hist + HIST - 1
        inc chart_dirty
@out:   rts

; The chart reached the target: next quarter, or the win.
smash:
        inc round
        lda #SFX_GOOD
        jsr API_SFX
        lda #7
        sta $d020
        lda #FLASH_T
        sta flash_t
        lda round
        cmp #ROUNDS
        bcc :+
        lda #255
        sta MG_SCORE
        jmp done_now
:       jsr new_targets
        jsr draw_pills
        jsr draw_quarter
        jsr render              ; the fresh chart, then the texts over it
        lda #5
        sta COLOR
        lda #'Q'
        ldx #11
        ldy #8
        jsr API_PUTC
        ldx #12
        ldy #8
        lda round
        jsr API_NUM
        text 13, 8, s_smashed, 5
        center 10, s_newq, 7
        lda #MSG_T
        sta msg_t
        rts

clear_msgs:
        lda #CW
        sta FILL_W
        lda #3
        sta FILL_H
        lda #' '
        ldx #CH_X
        ldy #8
        jsr API_FILL
        inc chart_dirty
        rts

; Time's up: score = (quarters + max(0, v - 25) / 75) / 3 = quarters × 85 + (v - 25) × 17 / 15.
finish:
        lda v+1
        sec
        sbc #START_V
        bcs :+
        lda #0
:       sta t0                  ; × 17
        lda #0
        sta t1
        lda t0
        ldx #4
:       asl
        rol t1
        dex
        bne :-
        clc
        adc t0
        sta t0
        lda t1
        adc #0
        sta t1
        ldx #0                  ; / 15
:       lda t0
        sec
        sbc #15
        tay
        lda t1
        sbc #0
        bcc :+
        sta t1
        sty t0
        inx
        bne :-
:       stx t0
        lda round               ; + quarters × 85
        asl
        asl
        sta t1
        asl
        asl
        clc
        adc t1                  ; × 20
        asl
        asl                     ; × 80
        adc round
        adc round
        adc round
        adc round
        adc round               ; × 85
        adc t0
        sta MG_SCORE
done_now:
        lda #0
        sta $d020
        lda #1
        sta done
        sec
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): every 4 frames move the first control that is off its sweet spot by one step.
bot:    inc bot_t
        lda bot_t
        and #3
        bne @out
        ldx #0
:       lda value,x
        cmp target,x
        bne @fix
        inx
        cpx nctl
        bne :-
@out:   rts
@fix:   cpx focus
        beq :+
        txa                     ; focus it first
        jmp set_focus
:       lda value,x
        cmp target,x
        lda #1
        bcc :+                  ; value < target: up
        lda #$ff
:       jmp adjust
.endif

; ---------------------------------------------------------------- drawing

; "Quarter n/3" top right.
draw_quarter:
        text 29, 0, s_quarter, 7
        lda round
        cmp #ROUNDS
        bcc :+
        lda #ROUNDS - 1
:       clc
        adc #1
        ldx #37
        ldy #0
        jmp API_NUM

; Q1 Q2 Q3 on the monitor: won green, current white, later blue.
draw_pills:
        ldx #ROUNDS - 1
@p:     stx t0
        lda #5
        cpx round
        bcc @set
        beq @cur
        lda #6
        bne @set
@cur:   lda #1
@set:   sta COLOR
        lda pill_x,x
        tax
        lda #'Q'
        ldy #4
        jsr API_PUTC
        ldx t0
        lda pill_x,x
        tax
        inx
        lda t0
        clc
        adc #'1'
        ldy #4
        jsr API_PUTC
        ldx t0
        dex
        bpl @p
        rts

; "+12.3 / s" right-aligned on the monitor's title row, green or red. Tenths = dd × 1.633, or × 0.49 below.
draw_slope:
        lda dd+1
        bmi @neg
        lda dd
        sta acc
        lda dd+1
        sta acc+1
        lda #'+'
        sta slope_s
        ldx #1
        jsr shr_add             ; + dd / 2
        ldx #3
        jsr shr_add             ; + dd / 8
        ldx #7
        jsr shr_add             ; + dd / 128
        lda #5
        bne @fmt
@neg:   lda dd                  ; |dd|
        eor #$ff
        clc
        adc #1
        sta dd
        lda dd+1
        eor #$ff
        adc #0
        sta dd+1
        lda #0
        sta acc
        sta acc+1
        lda #'-'
        sta slope_s
        ldx #1
        jsr shr_add             ; |dd| / 2
        ldx #7
        jsr shr_add             ; - |dd| / 128 (here: + then twice -, below)
        lda acc
        sec
        sbc t0
        sta acc
        lda acc+1
        sbc t1
        sta acc+1
        lda acc
        sec
        sbc t0
        sta acc
        lda acc+1
        sbc t1
        sta acc+1
        lda #2
@fmt:   sta pcol
        ldx #0                  ; tens of tenths -> whole units
:       lda acc
        sec
        sbc #10
        tay
        lda acc+1
        sbc #0
        bcc :+
        sta acc+1
        sty acc
        inx
        bne :-
:       ldy #1                  ; "+", units, ".", tenths, " / s"
        txa
        cmp #10
        bcc :+
        ldx #'0' - 1
@tens:  inx
        sbc #10
        bcs @tens
        adc #10
        pha
        txa
        sta slope_s,y
        iny
        pla
:       ora #'0'
        sta slope_s,y
        iny
        lda #'.'
        sta slope_s,y
        iny
        lda acc
        ora #'0'
        sta slope_s,y
        iny
        ldx #0
:       lda s_per_s,x
        sta slope_s,y
        beq :+
        iny
        inx
        bne :-
:       sty t3                  ; length
        lda #10
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #28
        ldy #3
        lda #' '
        jsr API_FILL
        lda pcol
        sta COLOR
        lda #<slope_s
        sta PTR
        lda #>slope_s
        sta PTR+1
        lda #38
        sec
        sbc t3
        tax
        ldy #3
        jsr API_PRINT
        jsr quality             ; (dd was made positive above)
        rts

; acc += dd >> X (dd >= 0); t0/t1 = the shifted value.
shr_add:
        lda dd
        sta t0
        lda dd+1
        sta t1
:       lsr t1
        ror t0
        dex
        bne :-
        lda acc
        clc
        adc t0
        sta acc
        lda acc+1
        adc t1
        sta acc+1
        rts

; The control boxes marked in `dirty`: focused yellow, others blue. Every cell inside is written (no clearing
; first), so a redraw never shows a half-empty box.
draw_panel:
        ldx nctl
        dex
        stx ci
@c:     ldx ci
        lda bitv,x
        and dirty
        bne :+
        jmp @next
:       lda bitv,x
        eor dirty
        sta dirty
        lda box_x,x
        sta cx
        lda #6
        cpx focus
        bne :+
        lda #7
:       sta t3                  ; frame colour
        sta COLOR
        lda bw
        sta FILL_W
        lda #8
        sta FILL_H
        ldx cx
        ldy #BOX_Y
        jsr API_BOX
        lda #3                  ; number in the top border
        sta COLOR
        lda ci
        clc
        adc #'1'
        ldx cx
        inx
        ldy #BOX_Y
        jsr API_PUTC
        ldx ci                  ; label in the bottom border, shortened to the box
        lda label,x
        clc
        adc lab_base
        tay
        lda lab_lo,y
        sta PTR
        lda lab_hi,y
        sta PTR+1
        lda bw
        sec
        sbc #2
        sec
        sbc lab_len,y
        lsr
        sec
        adc cx
        tax
        lda #1
        ldy t3
        cpy #7
        bne :+
        lda #7
:       sta COLOR
        ldy #BOX_Y + 7
        jsr API_PRINT
        lda #1
        sta FILL_H
        ldx ci
        lda kind,x
        beq @slider
        cmp #K_KNOB
        bne :+
        jmp @knob
:       jmp @switch
@next:  dec ci
        bmi :+
        jmp @c
:       rts

; slider: a track with the thumb on half-row 11 - value of rows 17-22, the value next to it
@slider:
        ldx ci
        lda #11
        sec
        sbc value,x
        sta t0                  ; half-row
        lsr
        clc
        adc #BOX_Y + 1
        sta t1                  ; thumb row
        lda #BOX_Y + 1
        sta t2
@srow:  lda l_thw
        sta FILL_W
        lda t2
        cmp t1
        beq @thumb
        lda #6                  ; track
        sta COLOR
        lda cx
        clc
        adc l_thumb
        tax
        ldy t2
        lda #' '
        jsr API_FILL
        lda cx
        clc
        adc l_track
        tax
        ldy t2
        lda #CH_L
        jsr API_PUTC
        jmp @num
@thumb: lda #1
        sta COLOR
        lda t0
        and #1
        tax
        lda thumb_ch,x
        pha
        lda cx
        clc
        adc l_thumb
        tax
        ldy t2
        pla
        jsr API_FILL
@num:   lda #2                  ; the value beside the thumb, blank elsewhere
        sta FILL_W
        lda #3
        sta COLOR
        lda cx
        clc
        adc l_num
        tax
        ldy t2
        lda #' '
        jsr API_FILL
        lda t2
        cmp t1
        bne :+
        lda cx
        clc
        adc l_num
        tax
        ldy t2
        stx t3
        ldx ci
        lda value,x
        ldx t3
        jsr API_NUM
:       inc t2
        lda t2
        cmp #BOX_Y + 7
        beq :+
        jmp @srow
:       jmp @next

; knob: a grey body, 8 ticks around it (the current one yellow), the body quarter facing it white
@knob:  lda #3                  ; body quarters 3..0: grey, the one facing the value white
        sta t2
@q:     ldx ci
        ldy value,x
        lda #8
        sta COLOR
        lda #MC_B
        sta t1
        lda point_q,y
        cmp t2
        bne :+
        lda #1 | 8
        sta COLOR
        lda #MC_C
        sta t1
:       lda t2
        and #1
        clc
        adc l_body
        adc cx
        tax
        lda t2
        lsr
        clc
        adc #BOX_Y + 3
        tay
        lda t1
        jsr API_PUTC
        dec t2
        bpl @q
        lda #7
        sta t2                  ; tick
@tick:  lda t2                  ; (compact ticks 8 entries on)
        clc
        adc l_tick
        tay
        lda tick_dx,y           ; signed, from the body's left column
        clc
        adc l_body
        clc
        adc cx
        pha
        lda tick_y,y
        tay
        ldx ci
        lda #6
        sta COLOR
        lda #CH_PIPOFF
        sta t1
        lda value,x
        cmp t2
        bne :+
        lda #7
        sta COLOR
        lda #CH_PIP
        sta t1
:       pla
        tax
        lda t1
        jsr API_PUTC
        dec t2
        bpl @tick
        lda nctl                ; - and + beside the wide knob only
        cmp #4
        bcs @kdone
        lda #3
        sta COLOR
        lda cx
        clc
        adc #1
        tax
        ldy #BOX_Y + 3
        lda #'-'
        jsr API_PUTC
        lda cx
        clc
        adc #13 - 3
        tax
        ldy #BOX_Y + 3
        lda #'+'
        jsr API_PUTC
@kdone: jmp @next

; switch: a dark slot with the lever up (green, ON) or down (red, OFF)
@switch:
        lda #2
        sta FILL_W
        sta FILL_H
        lda #1                  ; t2: the half with the lever, 0 top, 1 bottom
        ldx ci
        eor value,x
        sta t2
        lda #1
        sta t1                  ; half
@half:  lda #8
        sta COLOR
        lda #MC_A
        ldx t1
        cpx t2
        bne :+
        ldx ci
        ldy value,x
        lda lever_col,y
        sta COLOR
        lda #MC_C
:       pha
        lda t1
        asl
        adc #BOX_Y + 1
        tay
        lda cx
        clc
        adc l_body
        tax
        pla
        jsr API_FILL
        dec t1
        bpl @half
        ldx ci
        ldy value,x
        lda onoff_col,y
        sta COLOR
        lda onoff_lo,y
        sta PTR
        lda onoff_hi,y
        sta PTR+1
        lda cx
        clc
        adc l_body
        tax
        ldy #BOX_Y + 6
        jsr API_PRINT
        jmp @next

; The chart: every pixel column joins the previous value to its own, green going up, red going down.
; Drawn cell by cell into a buffer (chars) and copied; colours go straight to colour RAM. That takes about
; a frame, so the game loop does it in two halves on consecutive frames (render_1, render_2).
render:
        jsr render_1
        ; fall through
render_2:
        lda #HIST / 2
        ldx #HIST
        jsr columns
        ldx #CW - 1             ; copy
:       .repeat CHH, I
        lda buf + I * CW,x
        sta SCREEN + (CH_Y + I) * 40 + CH_X,x
        .endrepeat
        dex
        bpl :-
        lda #0
        sta rphase
        rts

render_1:
        lda #0
        sta chart_dirty
        ldx #CW - 1
        lda #' '
:       .repeat CHH, I
        sta buf + I * CW,x
        .endrepeat
        dex
        bpl :-
        lda #1
        sta rphase
        lda #0
        ldx #HIST / 2
        ; fall through

; Pixel columns A to X - 1 into the buffer.
columns:
        sta px
        stx col_end
@col:   ldx px
        lda hist,x
        tay
        txa
        beq @first              ; x = 0: no previous value
        lda hist-1,x
        jmp :+
@first: tya
:       sta t2                  ; previous value
        ldx #5                  ; green when flat or rising
        cpy t2
        bcs :+
        ldx #2
:       stx pcol
        lda ypx,y
        sta t0
        ldy t2
        lda ypx,y
        sta t1
        cmp t0                  ; t0 = top pixel row, t1 = bottom
        bcs :+
        ldy t0
        sta t0
        sty t1
:       lda px                  ; this column's bits in a cell: left or right half
        and #1
        tax
        lda bit_top,x
        sta btop
        lda bit_bot,x
        sta bbot
        lda px
        lsr
        sta cc
        lda t0
        lsr
        sta crow
@cell:  lda #0                  ; the cell's top pixel if 2 × row >= top, bottom one if 2 × row + 1 <= bottom
        sta t3
        lda crow
        asl
        cmp t0
        bcc :+
        lda btop
        sta t3
        lda crow
        asl
:       ora #1
        cmp t1
        beq :+
        bcs :++
:       lda t3
        ora bbot
        sta t3
:       ldx crow
        lda brow_lo,x
        sta bp
        lda brow_hi,x
        sta bp+1
        lda srow_lo,x
        sta cl
        lda srow_hi,x
        clc
        adc #>(COLRAM - SCREEN)
        sta cl+1
        ldy cc
        lda (bp),y
        cmp #QB + 1
        bcs :+
        lda #QB
:       ora t3
        sta (bp),y
        lda pcol
        sta (cl),y
        inc crow
        lda crow
        asl
        cmp t1
        bcc @cell
        beq @cell
        inc px
        lda px
        cmp col_end
        beq :+
        jmp @col
:       rts

.rodata
s_name:    .byte "Magic Chart", 0
s_help:    .byte "Tune the controls until the chart climbs.", 0
s_keys:    .byte "Left/right pick, up/down adjust, FIRE", 0
s_quarter: .byte "Quarter  /3", 0
s_target:  .byte "TARGET", 0
s_smashed: .byte " target smashed!", 0
s_newq:    .byte "New quarter, new chart", 0
s_per_s:   .byte " / s", 0
s_on:      .byte "ON ", 0
s_off:     .byte "OFF", 0
s_100:     .byte "100", 0
s_75:      .byte "75", 0
s_50:      .byte "50", 0
s_25:      .byte "25", 0
s_0:       .byte "0", 0
axis_lo:   .byte <s_100, <s_75, <s_50, <s_25, <s_0
axis_hi:   .byte >s_100, >s_75, >s_50, >s_25, >s_0
axis_x:    .byte CH_X - 3, CH_X - 2, CH_X - 2, CH_X - 2, CH_X - 1
pill_x:    .byte 29, 32, 35
s_shift:   .byte "Market shift!", 0
bitv:      .byte 1, 2, 4, 8, 16, 32, 64
kind_seq:  .byte K_SLIDER, K_KNOB, K_SWITCH, K_SLIDER, K_KNOB, K_SWITCH
key56:     .byte 16, 19         ; key matrix codes of 5 and 6
qmul:      .byte 0, 192, 154, 128 ; 768 / controls (3: no scaling)
lab_base_tab: .byte 0, L_COUNT, 2 * L_COUNT, 3 * L_COUNT ; labels for boxes of 13, 10, 8, 6 columns

; panel layout for 3-6 controls: box width, first box column, then from a box's left column: knob body /
; switch, slider thumb, its width, slider track, slider value, tick table (0 wide, 8 compact)
LAY_SIZE = 8
lay_tab:   .byte 13, 1, 5, 5, 3, 6, 9, 0
           .byte 10, 0, 4, 3, 3, 4, 7, 0
           .byte  8, 0, 3, 1, 3, 2, 5, 8
           .byte  6, 2, 2, 1, 2, 1, 3, 8

QB = 240                        ; quarter blocks: QB + 1 top left, 2 top right, 4 bottom left, 8 bottom right
bit_top:   .byte 1, 2          ; a pixel column's bits in a cell (left / right half)
bit_bot:   .byte 4, 8
thumb_ch:  .byte QB + 3, QB + 12 ; slider thumb in the top / bottom half of its row

range_tab: .byte 10, 7, 1       ; slider, knob, switch
min_dist:  .byte 4, 3           ; a new sweet spot is at least 35 % of the range away (if it can be)
close_off: .byte 0, 11, 19
close_tab:                      ; 255 × (1 - distance / range)
           .repeat 11, I
           .byte (255 * (10 - I) + 5) / 10
           .endrepeat
           .repeat 8, I
           .byte (255 * (7 - I) + 3) / 7
           .endrepeat
           .byte 255, 0

; knob ticks (8 positions over 270 degrees, from bottom left clockwise) and the body quarter facing each
; (column from the body's left column: wide around a body in a 13 or 10 column box, compact for 8 or 6)
tick_dx:   .byte <-2, <-3, <-2, <-1, 2, 3, 4, 3
           .byte <-1, <-1, <-1, 0, 1, 2, 2, 2
tick_y:    .byte BOX_Y + 5, BOX_Y + 4, BOX_Y + 2, BOX_Y + 1, BOX_Y + 1, BOX_Y + 2, BOX_Y + 4, BOX_Y + 5
           .byte BOX_Y + 5, BOX_Y + 4, BOX_Y + 3, BOX_Y + 2, BOX_Y + 2, BOX_Y + 3, BOX_Y + 4, BOX_Y + 5
point_q:   .byte 2, 2, 0, 0, 1, 1, 3, 3 ; 0 top left, 1 top right, 2 bottom left, 3 bottom right
lever_col: .byte 2 | 8, 5 | 8   ; off red, on green
onoff_col: .byte 3, 5
onoff_lo:  .byte <s_off, <s_on
onoff_hi:  .byte >s_off, >s_on

; chart value 0-100 -> pixel row 0 (top) - 17
ypx:       .repeat 101, I
           .byte ((100 - I) * (2 * CHH - 1) + 50) / 100
           .endrepeat
brow_lo:   .repeat CHH, I
           .byte <(buf + I * CW)
           .endrepeat
brow_hi:   .repeat CHH, I
           .byte >(buf + I * CW)
           .endrepeat
srow_lo:   .repeat CHH, I
           .byte <(SCREEN + (CH_Y + I) * 40 + CH_X)
           .endrepeat
srow_hi:   .repeat CHH, I
           .byte >(SCREEN + (CH_Y + I) * 40 + CH_X)
           .endrepeat

.include "gen/mg_chart_data.s"

.bss
vars:                           ; cleared by init
done:        .res 1
round:       .res 1
flash_t:     .res 1
msg_t:       .res 1
half:        .res 1
dirty:       .res 1             ; control boxes to redraw (bit per control)
chart_dirty: .res 1
rphase:      .res 1             ; 1: the chart's first half is in the buffer
bot_t:       .res 1
drift_on:    .res 1
shift_t:     .res 1
vars_end:
diff:        .res 1
samp_t:      .res 1
thr:         .res 2
title:       .res 1
kind:        .res MAX_CTRLS
label:       .res MAX_CTRLS
value:       .res MAX_CTRLS
target:      .res MAX_CTRLS
box_x:       .res MAX_CTRLS
nctl:        .res 1             ; controls (3-6)
lab_base:    .res 1
lay:                            ; the layout row for nctl (lay_tab)
bw:          .res 1
bx0:         .res 1
l_body:      .res 1
l_thumb:     .res 1
l_thw:       .res 1
l_track:     .res 1
l_num:       .res 1
l_tick:      .res 1
drift_every: .res 2
drift_t:     .res 2
slope_s:     .res 12
hist:        .res HIST
buf:         .res CW * CHH
