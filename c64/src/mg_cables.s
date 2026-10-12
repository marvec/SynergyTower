; Cable Spaghetti (src/minigames/cables.js) as a disk-loaded overlay at $4000.
; The server-room patch panel is wired all wrong: re-patch every cable to the socket with its colour.
; Connecting a port to a socket swaps the two cable ends, so the wiring stays a permutation.
; Difficulty curve (d = MG_DIFF / 255):
;   d = 0: 5 cables in distinct colours, 45 s
;   cables round(byDiff(d, 5, 8)); a striped twin of a colour from d 0.45, two from 0.85; a PROD cable (already
;   right, never to be touched) from 0.55; blinking LEDs from 0.5; time byDiff(d, 45, 40) s
; Score = patched / free cables - 0.2 per mistake beyond the free ones (1, or 2 from 6 cables) - 0.25 per PROD
; touch, + 5 % of the time left when all are patched.
; Cables are drawn in quarter blocks (2 × 2 pixels per cell) into an off-screen buffer and copied over:
; tangled ones as Bézier curves, patched ones straight. Content: src/data/mg-cables.js (gen/mg_cables_data.s).
; Differs from the JS: a twin is the same colour as its cable but dashed, with a striped swatch (a text cell has
; one colour); the PROD cable is red with yellow, its alarm flashes on row 2; from 7 cables the ports and
; sockets are single rows with an arrow for the cursor instead of boxes; "it clicked" lines go to row 23.

.include "api.inc"
.include "gen/chars.inc"

MAX_N     = 8
FLOAT_T   = 45                  ; 0.9 s for the messages
END_T     = 40                  ; 0.8 s from "All patched!" to the result
SHAKE_T   = 6                   ; 0.12 s screen shake on a mistake
PROD_SHAKE = 25                 ; 0.5 s on a PROD touch
ALARM_T   = 42                  ; ~0.83 s alarm
BLINK     = 8                   ; frames per blink of the picked cable
TIME_T    = 45 * 50             ; minus the difficulty: byDiff(d, 45, 40) s

PORT_W    = 5                   ; port boxes: columns 0-4
SOCK_X    = 19                  ; socket boxes: columns 19-39
SOCK_W    = 21
LABEL_X   = 22
LED_X     = 38
MSG_X     = 10                  ; row 23: "Moves" left, messages in columns 10-31, "Oops" right
MSG_W     = 22

; the cable area (quarter-block pixels: 2 per cell)
AREA_C    = 5                   ; columns 5-18: plug, cable, plug
AREA_R    = 4                   ; rows 4-22
BW        = 14
BH        = 19
PX0       = 2 * AREA_C + 1      ; cable start: right half of the port plug
PX3       = 2 * (AREA_C + BW - 1) ; cable end: left half of the socket plug
STEPS     = 16                  ; Bézier segments
PTS       = STEPS + 1
QB        = 240                 ; quarter blocks: QB + 1 top left, 2 top right, 4 bottom left, 8 bottom right
HL_MAX    = 120                 ; cells remembered for the picked cable's blink

K_PLAIN   = 0                   ; cable kinds
K_TWIN    = 1
K_PROD    = 2
RED       = 3                   ; palette index of red (the PROD cable's)

.zeropage
px:       .res 1                ; plot position (quarter-block pixels)
py:       .res 1
pcol:     .res 1
lx0:      .res 1                ; line from (lx0, ly0) to (lx1, ly1)
ly0:      .res 1
lx1:      .res 1
ly1:      .res 1
ldx_:     .res 1                ; |dx|
ldy_:     .res 1                ; -|dy|
lsx:      .res 1
lsy:      .res 1
lerr:     .res 1
le2:      .res 1
bp:       .res 2                ; buffer row pointers
cp:       .res 2
sp:       .res 2                ; screen / colour RAM pointers
cl:       .res 2
acc:      .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
col:      .res 1                ; keyboard column: 0 ports, 1 sockets
cur:      .res 2                ; cursor row per column
sel_side: .res 1                ; 0 none, 1 a port, 2 a socket
sel_idx:  .res 1
anim:     .res 1
n:        .res 1                ; cables
m:        .res 1                ; cables that can be patched (all but PROD)
pix:      .res 1                ; pixels plotted on the current cable (dashes, PROD stripes)
kind:     .res 1                ; the current cable's kind

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- setup

; A = difficulty, X = department (the content is this department's anyway)
init:
        sta diff
        lda #0
        ldx #vars_end - vars - 1
:       sta vars,x
        dex
        bpl :-
        sta col
        sta cur
        sta cur+1
        sta sel_side
        sta anim
        ; the difficulty's features
        ldx #5                  ; cables: round(byDiff(d, 5, 8))
        lda diff
        cmp #43
        bcc :+
        inx
        cmp #128
        bcc :+
        inx
        cmp #213
        bcc :+
        inx
:       stx n
        stx m
        ldx #0                  ; striped twins
        cmp #115
        bcc :+
        inx
        cmp #217
        bcc :+
        inx
:       stx pairs
        cmp #141                ; PROD from d 0.55
        rol has_prod
        lda has_prod
        beq :+
        dec m
:       lda diff                ; blinking LEDs from d 0.5
        cmp #128
        rol blinky
        lda #1                  ; free mistakes: 2 from 6 cables
        ldx n
        cpx #6
        bcc :+
        lda #2
:       sta free_miss
        ; rows: 4 apart (5 cables), 3 (6), 2 from 7 (no boxes), centred on row 13
        ldx n
        lda step_tab - 5,x
        sta step
        lda n                   ; first row = 13 - (n - 1) × step / 2
        sec
        sbc #1
        tax
        lda #0
:       dex
        bmi :+
        clc
        adc step
        bne :-
:       lsr
        eor #$ff
        sec
        adc #13
        ldx #0
:       sta row_tab,x
        pha
        asl                     ; cable y at a port / socket: the cell's lower half
        ora #1
        sta py_tab,x
        pla
        clc
        adc step
        inx
        cpx n
        bne :-
        ; colours: the bases from the 7 a text cell can show (not red when there is a PROD cable), then the twins
        ; of the first bases, then PROD
        ldx #PALETTE - 1
:       txa
        sta pool,x
        dex
        bpl :-
        ldy #PALETTE
        lda has_prod
        beq :+
        lda pool + PALETTE - 1  ; red out
        sta pool + RED
        dey
:       tya
        tax                     ; palette entries to pick from
        lda m
        sec
        sbc pairs
        sta bases
        tay
        lda #0
        jsr pick
        ldx #0
:       ldy pool,x
        lda palette,y
        sta cab_col,x
        lda #K_PLAIN
        sta cab_kind,x
        inx
        cpx bases
        bne :-
        ldy #0
:       cpy pairs
        beq :+
        lda cab_col,y
        sta cab_col,x
        lda #K_TWIN
        sta cab_kind,x
        inx
        iny
        bne :-
:       lda has_prod
        beq :+
        lda palette + RED
        sta cab_col,x
        lda #K_PROD
        sta cab_kind,x
:       ; the cables in random rows
        jsr shuffle_n
        ldx n
        dex
:       ldy pool,x
        lda cab_col,y
        sta tmp_col,x
        lda cab_kind,y
        sta tmp_kind,x
        dex
        bpl :-
        ldx n
        dex
:       lda tmp_col,x
        sta cab_col,x
        lda tmp_kind,x
        sta cab_kind,x
        dex
        bpl :-
        ; labels: the department's + 12 generic ones, n of those; PROD has its own
        ldx #D_DEPT + D_GEN - 1
:       txa
        sta pool,x
        dex
        bpl :-
        lda #D_DEPT
        ldx #D_GEN
        ldy #12
        jsr pick
        lda #0
        ldx #D_DEPT + 12
        ldy n
        jsr pick
        ldx n
        dex
:       lda pool,x
        ldy cab_kind,x
        cpy #K_PROD
        bne :+
        lda #D_PROD
:       sta cab_label,x
        dex
        bpl :--
        ; socket order: want[j] = the cable whose colour socket j shows, home[cable] = its socket
        jsr shuffle_n
        ldx n
        dex
:       lda pool,x
        sta want,x
        tay
        txa
        sta home,y
        dex
        bpl :-
        ; initial wiring: PROD in its socket, the others a derangement (each in another cable's socket)
        ldx #0
        ldy #0
:       lda cab_kind,x
        cmp #K_PROD
        bne @fr
        lda home,x
        sta cab_end,x
        bpl @nf
@fr:    txa
        sta free_l,y
        iny
@nf:    inx
        cpx n
        bne :-
@der:   ldx m                   ; pool = shuffled free cables, none in its own place
        dex
:       lda free_l,x
        sta pool,x
        dex
        bpl :-
        lda #0
        ldx m
        ldy m
        jsr pick
        ldx m
        dex
:       lda pool,x
        cmp free_l,x
        beq @der
        dex
        bpl :-
        ldx m
        dex
:       ldy pool,x              ; end[free[k]] = home[perm[k]]
        lda home,y
        ldy free_l,x
        sta cab_end,y
        dex
        bpl :-
        ; the tangle: two random control points per cable (x 12-33, y 8-45)
        ldx n
        dex
@ctl:   stx ctl_i
        lda #22
        jsr API_RMOD
        clc
        adc #12
        ldx ctl_i
        sta c1x,x
        lda #22
        jsr API_RMOD
        clc
        adc #12
        ldx ctl_i
        sta c2x,x
        lda #38
        jsr API_RMOD
        clc
        adc #2 * AREA_R
        ldx ctl_i
        sta c1y,x
        lda #38
        jsr API_RMOD
        clc
        adc #2 * AREA_R
        ldx ctl_i
        sta c2y,x
        txa
        jsr curve
        ldx ctl_i
        dex
        bpl @ctl
        ; screen
        text 1, 0, s_name, 7
        center 2, s_hint, 3
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        jsr draw_status
        jsr draw_boxes
        jsr render
        lda #<TIME_T
        sec
        sbc diff
        pha
        lda #>TIME_T
        sbc #0
        tax
        pla
        jmp timer_start

; pool[A .. A+X-1]: Y random picks moved to the front of that range (partial Fisher-Yates).
pick:
        sta fy_off
        stx fy_cnt
        sty fy_k
        lda #0
        sta fy_i
        cpy #0
        beq @out
@p:     lda fy_cnt
        sec
        sbc fy_i
        jsr API_RMOD
        clc
        adc fy_i
        adc fy_off
        tay
        lda fy_i
        clc
        adc fy_off
        tax
        lda pool,x
        pha
        lda pool,y
        sta pool,x
        pla
        sta pool,y
        inc fy_i
        lda fy_i
        cmp fy_k
        bne @p
@out:   rts

; pool[0..n-1] = a random permutation of 0..n-1.
shuffle_n:
        ldx n
        dex
:       txa
        sta pool,x
        dex
        bpl :-
        lda #0
        ldx n
        ldy n
        jmp pick

; ---------------------------------------------------------------- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr effects
        lda end_t
        beq @play
        dec end_t
        beq :+
        clc
        rts
:       lda #1                  ; all patched: score with the time bonus
        jmp finish
@play:  jsr timer_tick
        bcc :+
        lda #0
        jmp finish
:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda JOYP
        and #J_LEFT
        beq :+
        lda #0
        sta col
        inc ui_dirty
:       lda JOYP
        and #J_RIGHT
        beq :+
        lda #1
        sta col
        inc ui_dirty
:       lda JOYP
        and #J_UP
        beq :+
        ldx col
        dec cur,x
        bpl @moved
        lda n
        sec
        sbc #1
        sta cur,x
        bpl @moved
:       lda JOYP
        and #J_DOWN
        beq @fire
        ldx col
        inc cur,x
        lda cur,x
        cmp n
        bcc @moved
        lda #0
        sta cur,x
@moved: inc ui_dirty
@fire:  lda JOYP
        and #J_FIRE
        beq @draw
        lda col
        sta aside
        ldx col
        lda cur,x
        sta aidx
        jsr act
@draw:  lda ui_dirty
        beq :+
        jsr draw_boxes
        jsr draw_status
:       lda cab_dirty
        beq @wait
        jsr render
@wait:  clc
        rts

; Timers of the message, the shake, the alarm, the blinking LEDs and the picked cable's blink.
effects:
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        jsr clear_msg
:       lda shake_t
        beq @alarm
        dec shake_t
        lda #0
        ldx shake_t
        beq :+
        jsr API_RAND
        and #3
:       ora #$18                ; multicolour text, 40 columns (as the host sets it)
        sta $d016
@alarm: lda alarm_t             ; PROD alarm: row 2 flashes "PROD ALARM!", then the hint again
        beq @leds
        dec alarm_t
        beq @hint
        lda anim
        and #7
        bne @leds
        ldx #2                  ; red / off every 8 frames
        lda anim
        and #8
        beq :+
        ldx #0
:       stx COLOR
        lda #2
        ldx #1
        jsr clear_rows
        lda #<s_alarm
        ldx #>s_alarm
        ldy #2
        jsr API_CENTER
        jmp @leds
@hint:  lda #2
        ldx #1
        jsr clear_rows
        center 2, s_hint, 3
@leds:  lda blinky
        beq @blink
        lda anim
        and #3
        bne @blink
        jsr draw_leds
@blink: lda hl_n
        beq @done
        lda anim
        and #BLINK - 1
        bne @done
        lda hl_on
        eor #1
        sta hl_on
        ldx hl
        lda cab_col,x
        ldy hl_on
        beq :+
        lda #0                  ; off (black)
:       sta pcol
        ldx #0
@cell:  ldy hl_r,x
        lda scr_lo + AREA_R,y
        clc
        adc #AREA_C
        sta cl
        lda scr_hi + AREA_R,y
        adc #>(COLRAM - SCREEN)
        sta cl+1
        ldy hl_c,x
        lda pcol
        sta (cl),y
        inx
        cpx hl_n
        bne @cell
@done:  rts

; ---------------------------------------------------------------- rules

; Port (aside 0) or socket (aside 1) number aidx was picked.
act:
        lda aside
        bne @right
        ldx aidx                ; the PROD port: alarm
        lda cab_kind,x
        cmp #K_PROD
        bne :+
        jmp touch_prod
:       lda sel_side
        cmp #2
        bne :+
        lda aidx                ; a socket was picked first: patch this port to it
        sta ci
        lda sel_idx
        sta cj
        jmp connect
:       jsr blip
        lda sel_side
        cmp #1
        bne @sel_l
        lda sel_idx
        cmp aidx
        bne @sel_l
        lda #0                  ; the same port again: drop it
        sta sel_side
        beq @changed
@sel_l: lda #1
        sta sel_side
        lda aidx
        sta sel_idx
        tax                     ; on to the sockets, at this cable's socket
        lda cab_end,x
        sta cur+1
        lda #1
        sta col
        bne @changed
@right: lda aidx                ; the socket PROD is in: alarm
        jsr owner
        tax
        lda cab_kind,x
        cmp #K_PROD
        bne :+
        jmp touch_prod
:       lda sel_side
        cmp #1
        bne :+
        lda sel_idx
        sta ci
        lda aidx
        sta cj
        jmp connect
:       jsr blip
        lda sel_side
        cmp #2
        bne @sel_r
        lda sel_idx
        cmp aidx
        bne @sel_r
        lda #0
        sta sel_side
        beq @changed
@sel_r: lda #2
        sta sel_side
        lda aidx
        sta sel_idx
        jsr owner
        sta cur                 ; back to the ports, at the cable in this socket
        lda #0
        sta col
@changed:
        lda #1
        sta ui_dirty
        sta cab_dirty
        rts

; Hands off PROD: -0.25, alarm, the selection is dropped.
touch_prod:
        inc prod_hits
        lda #0
        sta sel_side
        lda #1
        sta ui_dirty
        sta cab_dirty
        lda #ALARM_T
        sta alarm_t
        lda #PROD_SHAKE
        sta shake_t
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_prod
        ldx #>s_prod
        ldy #2
        jmp message

; Patch cable ci to socket cj: it swaps ends with the cable plugged in there.
connect:
        lda #0
        sta sel_side
        sta col
        lda #1
        sta ui_dirty
        sta cab_dirty
        lda cj
        jsr owner
        sta ck
        cmp ci
        bne :+
        jmp blip                ; already there
:       tax
        lda cab_kind,x
        cmp #K_PROD
        bne :+
        jmp touch_prod
:       ldx ci
        jsr is_ok
        sta was_i
        ldx ck
        jsr is_ok
        sta was_k
        ldx ci
        ldy ck
        lda cab_end,x
        pha
        lda cab_end,y
        sta cab_end,x
        pla
        sta cab_end,y
        inc moves
        lda ci
        jsr curve
        lda ck
        jsr curve
        lda #0
        sta gained
        lda ci
        ldy was_i
        jsr check_gain
        lda ck
        ldy was_k
        jsr check_gain
        lda gained
        beq @miss
        lda was_i
        ora was_k
        bne @miss
        lda #SFX_GOOD
        jsr API_SFX
        jmp @all
@miss:  inc mistakes
        lda #SFX_BAD
        jsr API_SFX
        lda #SHAKE_T
        sta shake_t
        lda was_i
        ora was_k
        beq :+
        lda #<s_unplug
        ldx #>s_unplug
        bne :++
:       lda #<s_still
        ldx #>s_still
:       ldy #7
        jsr message
@all:   jsr ok_count
        cmp m
        bne @out
        lda #<s_all
        ldx #>s_all
        ldy #7
        jsr message
        lda #END_T
        sta end_t
@out:   rts

; A = cable, Y = whether it was patched before: a newly patched one says so ("Click!").
check_gain:
        tax
        cpy #0
        bne @no
        jsr is_ok
        beq @no
        lda #1
        sta gained
        lda #CL_COUNT
        jsr API_RMOD
        tax
        lda cl_lo,x
        pha
        lda cl_hi,x
        tax
        pla
        ldy #5
        jmp message
@no:    rts

; X = cable -> A = 1 if it is in its own socket (X kept).
is_ok:
        lda cab_end,x
        cmp home,x
        beq :+
        lda #0
        rts
:       lda #1
        rts

; A = socket -> A = the cable plugged into it.
owner:
        ldx n
        dex
:       cmp cab_end,x
        beq :+
        dex
        bne :-
:       txa
        rts

; A = patched cables (PROD not counted).
ok_count:
        lda #0
        sta t0
        ldx n
        dex
:       lda cab_kind,x
        cmp #K_PROD
        beq :+
        jsr is_ok
        clc
        adc t0
        sta t0
:       dex
        bpl :--
        lda t0
        rts

blip:   lda #SFX_BLIP
        jmp API_SFX

; A = 1 to add the time bonus. score = patched × 255 / m - 51 per extra mistake - 64 per PROD touch
; (+ cells left / 3, ~5 % of 255)
finish:
        sta t2
        jsr ok_count
        ldx #255
        jsr mul8
        sta acc+1
        lda m
        jsr div8                ; acc = patched × 255 / m
        lda t2
        beq @pen
        lda tm_cells
        ldx #0
:       cmp #3
        bcc :+
        sbc #3
        inx
        bne :-
:       txa
        clc
        adc acc
        sta acc
        bcc @pen
        inc acc+1
@pen:   lda mistakes
        sec
        sbc free_miss
        bcc @prod
        beq @prod
        tax
:       lda acc                 ; - 51 per extra mistake
        sec
        sbc #51
        sta acc
        lda acc+1
        sbc #0
        sta acc+1
        bcc @zero
        dex
        bne :-
@prod:  ldx prod_hits
        beq @clamp
:       lda acc                 ; - 64 per PROD touch
        sec
        sbc #64
        sta acc
        lda acc+1
        sbc #0
        sta acc+1
        bcc @zero
        dex
        bne :-
@clamp: lda acc+1
        beq :+
        lda #255
        bne @set
:       lda acc
        jmp @set
@zero:  lda #0
@set:   sta MG_SCORE
        lda #$18
        sta $d016
        lda #1
        sta done
        sec
        rts

; A × X -> A (high byte), acc (low byte).
mul8:
        stx t1
        sta t0
        lda #0
        ldx #8
@m:     lsr t1
        bcc :+
        clc
        adc t0
:       ror
        ror acc
        dex
        bne @m
        rts

; acc (16 bit) / A -> acc.
div8:
        sta t0
        lda #0
        ldx #16
@d:     asl acc
        rol acc+1
        rol
        bcs @sub
        cmp t0
        bcc :+
@sub:   sbc t0
        inc acc
:       dex
        bne @d
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): every 15 frames pick the first tangled port, then its own socket.
bot:    inc bot_t
        lda bot_t
        cmp #15
        bcc @out
        lda #0
        sta bot_t
        lda sel_side
        bne @sock
        ldx #0
:       jsr is_ok
        beq :+
        inx
        cpx n
        bne :-
        rts
:       stx aidx
        stx cur
        lda #0
        sta aside
        jmp act
@sock:  ldx sel_idx
        lda home,x
        sta aidx
        sta cur+1
        lda #1
        sta aside
        jmp act
@out:   rts
.endif

; ---------------------------------------------------------------- drawing

; Port and socket boxes: picked yellow, cursor cyan, others blue (the PROD socket red). From 7 cables there are
; no boxes: an arrow marks the cursor / the pick.
draw_boxes:
        lda #0
        sta ui_dirty
        lda n
        sec
        sbc #1
        sta t2
@b:     ldx t2                  ; port t2: its colour
        lda #6
        ldy cur
        cpy t2
        bne :+
        ldy col
        bne :+
        lda #3
:       ldy sel_side
        cpy #1
        bne :+
        ldy sel_idx
        cpy t2
        bne :+
        lda #7
:       sta COLOR
        jsr box_at
        ldx step
        cpx #3
        bcc @pmark
        ldx #0
        jsr API_BOX
        jmp @pswatch
@pmark: lda #' '                ; no box: an arrow when not blue
        ldx COLOR
        cpx #6
        beq :+
        lda #CH_ARROW
:       ldx #0
        iny
        jsr API_PUTC
@pswatch:
        ldx t2                  ; colour swatch: solid, striped (twin) or red / yellow (PROD)
        lda cab_col,x
        sta COLOR
        ldy cab_kind,x
        lda sw_char,y
        ldy row_tab,x
        ldx #1
        jsr API_PUTC
        ldx t2
        ldy cab_kind,x
        cpy #K_PROD
        bne :+
        lda #7
        sta COLOR
:       lda sw_char,y
        ldy row_tab,x
        ldx #2
        jsr API_PUTC
        ldx t2
        jsr draw_port_led
        ldx t2                  ; the jack: green when patched, red when not
        jsr is_ok
        tax
        lda led_col,x
        ora #8
        sta COLOR
        ldx t2
        ldy row_tab,x
        ldx #PORT_W - 1
        lda #MC_KNOB
        jsr API_PUTC
        ; socket t2
        ldx t2
        lda #6
        ldy want,x
        lda cab_kind,y
        cmp #K_PROD
        lda #6
        bcc :+
        lda #2
:       ldy cur+1
        cpy t2
        bne :+
        ldy col
        beq :+
        lda #3
:       ldy sel_side
        cpy #2
        bne :+
        ldy sel_idx
        cpy t2
        bne :+
        lda #7
:       sta COLOR
        lda step
        cmp #3
        bcc @smark
        lda #SOCK_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldy row_tab,x
        dey
        ldx #SOCK_X
        jsr API_BOX
        jmp @jack
@smark: lda #' '                ; no box: '<' for the cursor (cyan) / the pick (yellow)
        ldx COLOR
        cpx #3
        beq :+
        cpx #7
        bne :++
:       lda #'<'
:       ldx t2
        ldy row_tab,x
        ldx #SOCK_X + SOCK_W - 1
        jsr API_PUTC
@jack:  lda COLOR               ; the jack: a dark hole in the box's left side
        ora #8
        sta COLOR
        ldx t2
        ldy row_tab,x
        ldx #SOCK_X
        lda #MC_KNOB
        jsr API_PUTC
        ldx t2
        ldy want,x
        lda cab_col,y
        sta COLOR
        ldx cab_kind,y
        lda sw_char,x
        cpx #K_PROD
        bne :+
        lda #CH_BLOCK
:       ldx t2
        ldy row_tab,x
        ldx #SOCK_X + 1
        jsr API_PUTC
        lda #1                  ; label: white, PROD red
        sta COLOR
        ldx t2
        ldy want,x
        lda cab_kind,y
        cmp #K_PROD
        bne :+
        lda #2
        sta COLOR
:       lda cab_label,y
        tay
        lda dev_lo,y
        sta PTR
        lda dev_hi,y
        sta PTR+1
        ldy row_tab,x
        ldx #LABEL_X
        jsr API_PRINT
        ldx t2
        jsr draw_sock_led
        dec t2
        bmi :+
        jmp @b
:       rts

; Port box of row X: FILL_W/FILL_H set, Y = top row.
box_at:
        lda #PORT_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldy row_tab,x
        dey
        rts

; Blinking LEDs (from d 0.5): every port and socket LED again.
draw_leds:
        ldx n
        dex
:       stx t2
        jsr draw_port_led
        ldx t2
        jsr draw_sock_led
        ldx t2
        dex
        bpl :-
        rts

; X = port: its LED green when patched; else red, blinking from d 0.5 (else dim).
draw_port_led:
        stx t1
        jsr is_ok
        tax
        lda led_col,x
        sta COLOR
        lda led_char,x
        cpx #1
        beq @put
        ldx blinky
        beq @put
        lda anim                ; phase: anim / 8 + 1.5 × row
        lsr
        lsr
        lsr
        clc
        adc t1
        sta t0
        lda t1
        lsr
        adc t0
        lsr
        lda #CH_PIPOFF
        bcc @put
        lda #CH_PIP
@put:   ldx t1
        ldy row_tab,x
        ldx #3
        jmp API_PUTC

; X = socket: its LED green when the right cable is in; else yellow, flickering red / yellow / off from d 0.5.
draw_sock_led:
        stx t1
        ldy want,x
        ldx #7
        lda cab_end,y
        cmp home,y
        bne :+
        ldx #5
        bne @col
:       lda blinky
        beq @col
        jsr API_RAND
        and #3
        tax
        lda flicker,x
        tax
@col:   stx COLOR
        lda #CH_PIP
        cpx #0
        bne :+
        lda #CH_PIPOFF
        ldx #2
        stx COLOR
:       ldx t1
        ldy row_tab,x
        ldx #LED_X
        jmp API_PUTC

; "Patched n/m" on the title row; "Moves n" and "Oops n" on row 23.
draw_status:
        text 28, 0, s_patched, 7
        jsr ok_count
        ldx #36
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        lda m
        ldx #38
        ldy #0
        jsr API_NUM
        text 0, 23, s_moves, 3
        ldx #6
        ldy #23
        lda moves
        jsr API_NUM
        lda mistakes
        beq @out
        ldx #7
        cmp free_miss
        bcc :+
        beq :+
        ldx #2
:       stx COLOR
        lda #<s_oops
        sta PTR
        lda #>s_oops
        sta PTR+1
        ldx #33
        ldy #23
        jsr API_PRINT
        ldx #38
        ldy #23
        lda mistakes
        jsr API_NUM
@out:   rts

; A/X = message, Y = colour: centred in the middle of row 23 for 0.9 s.
message:
        sta t0
        stx t1
        sty t2
        jsr clear_msg
        lda t0
        sta PTR
        lda t1
        sta PTR+1
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
        adc #MSG_W
        lsr
        clc
        adc #MSG_X
        tax
        ldy #23
        lda #FLOAT_T
        sta msg_t
        jmp API_PRINT

clear_msg:
        lda #MSG_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #MSG_X
        ldy #23
        lda #' '
        jmp API_FILL

; ---------------------------------------------------------------- cables

; A = cable: its Bézier points from the port, past the two control points, to the socket it is in.
curve:
        tax
        lda #PX0
        sta cx4
        lda c1x,x
        sta cx4+1
        lda c2x,x
        sta cx4+2
        lda #PX3
        sta cx4+3
        lda py_tab,x
        sta cy4
        lda c1y,x
        sta cy4+1
        lda c2y,x
        sta cy4+2
        ldy cab_end,x
        lda py_tab,y
        sta cy4+3
        lda pts_base,x
        sta pt_i
        tay
        lda cx4                 ; the end points as they are
        sta pts_x,y
        lda cy4
        sta pts_y,y
        lda cx4+3
        sta pts_x+STEPS,y
        lda cy4+3
        sta pts_y+STEPS,y
        lda #1
        sta bstep
@s:     inc pt_i
        ldx #0
        jsr weigh
        ldy pt_i
        sta pts_x,y
        ldx #4
        jsr weigh
        ldy pt_i
        sta pts_y,y
        inc bstep
        lda bstep
        cmp #STEPS
        bne @s
        rts

; X = 0 for x, 4 for y: A = (Σ weight[k][step] × coordinate[k] + 128) / 256.
weigh:
        stx t2
        lda #128
        sta acc
        lda #0
        sta acc+1
        ldx bstep               ; weights start at step 1
        dex
        stx w_i
        lda #4
        sta k_cnt
@k:     ldx t2
        lda cx4,x               ; (cy4 follows cx4)
        sta t0
        ldx w_i
        lda weights,x
        sta t1
        lda #0                  ; t1 × t0 -> A (high), w_lo
        ldx #8
@m:     lsr t1
        bcc :+
        clc
        adc t0
:       ror
        ror w_lo
        dex
        bne @m
        tax
        lda w_lo
        clc
        adc acc
        sta acc
        txa
        adc acc+1
        sta acc+1
        lda w_i
        clc
        adc #STEPS - 1
        sta w_i
        inc t2
        dec k_cnt
        bne @k
        lda acc+1
        rts

; Draw every cable into the buffer and copy it to the screen: tangled ones first, patched ones over them,
; the picked one last (its cells are remembered for the blink).
render:
        lda #0
        sta cab_dirty
        sta hl_n
        sta hl_on
        sta rec
        ldx #0                  ; clear the buffer
        lda #' '
:       sta buf_ch,x
        sta buf_ch + BW * BH - 256,x
        inx
        bne :-
        lda #$ff
        sta hl
        lda sel_side
        beq @pass
        lda sel_idx
        ldx sel_side
        cpx #1
        beq :+
        jsr owner
:       sta hl
@pass:  lda #0                  ; tangled
        sta pass
@p:     ldx n
        dex
@c:     cpx hl
        beq @next
        jsr is_ok
        cmp pass
        bne @next
        stx t2
        jsr draw_cable
        ldx t2
@next:  dex
        bpl @c
        inc pass
        lda pass
        cmp #2
        bne @p
        ldx hl
        bmi @copy
        inc rec
        jsr draw_cable
        lda #0
        sta rec
@copy:  ldx #0
@r:     lda brow_lo,x
        sta bp
        lda brow_hi,x
        sta bp+1
        lda crow_lo,x
        sta cp
        lda crow_hi,x
        sta cp+1
        lda scr_lo + AREA_R,x
        clc
        adc #AREA_C
        sta sp
        sta cl
        lda scr_hi + AREA_R,x
        adc #0
        sta sp+1
        clc
        adc #>(COLRAM - SCREEN)
        sta cl+1
        ldy #BW - 1
:       lda (bp),y
        sta (sp),y
        lda (cp),y
        sta (cl),y
        dey
        bpl :-
        inx
        cpx #BH
        bne @r
        rts

; X = cable: straight when patched, else its curve; plugs at both ends.
draw_cable:
        lda cab_col,x
        sta pcol
        lda cab_kind,x
        sta kind
        lda #0
        sta pix
        stx dc_i
        jsr is_ok
        beq @curve
        lda #PX0
        sta lx0
        lda py_tab,x
        sta ly0
        lda #PX3
        sta lx1
        ldy cab_end,x
        lda py_tab,y
        sta ly1
        jsr line
        jmp @plugs
@curve: lda pts_base,x
        sta dc_p
        lda #STEPS
        sta dc_n
@seg:   ldy dc_p
        lda pts_x,y
        sta lx0
        lda pts_y,y
        sta ly0
        lda pts_x+1,y
        sta lx1
        lda pts_y+1,y
        sta ly1
        jsr line
        inc dc_p
        dec dc_n
        bne @seg
@plugs: lda #K_PLAIN            ; plugs: solid in the cable's colour
        sta kind
        ldx dc_i
        lda cab_col,x
        sta pcol
        lda #PX0 - 1
        sta px
        lda py_tab,x
        sta py
        jsr plug
        ldx dc_i
        lda #PX3 + 1
        sta px
        ldy cab_end,x
        lda py_tab,y
        sta py
        ; fall through

; A full block at the cell of (px, py).
plug:   jsr cell
        lda #CH_BLOCK
        sta (bp),y
        lda pcol
        sta (cp),y
        rts

; Bresenham line from (lx0, ly0) to (lx1, ly1), 8-connected.
line:
        ldx #1
        lda lx1
        sec
        sbc lx0
        bcs :+
        eor #$ff
        adc #1                  ; (C=0) negate
        ldx #$ff
:       sta ldx_
        stx lsx
        ldx #1
        lda ly1
        sec
        sbc ly0
        bcs :+
        eor #$ff
        adc #1
        ldx #$ff
:       stx lsy
        eor #$ff                ; dy = -|dy|
        clc
        adc #1
        sta ldy_
        clc
        adc ldx_
        sta lerr
@loop:  lda lx0
        sta px
        lda ly0
        sta py
        jsr plot
        lda lx0
        cmp lx1
        bne :+
        lda ly0
        cmp ly1
        beq @done
:       lda lerr
        asl
        sta le2
        sec                     ; e2 >= dy: step x
        sbc ldy_
        bvc :+
        eor #$80
:       bmi @no_x
        lda lerr
        clc
        adc ldy_
        sta lerr
        lda lx0
        clc
        adc lsx
        sta lx0
@no_x:  lda ldx_                ; e2 <= dx: step y
        sec
        sbc le2
        bvc :+
        eor #$80
:       bmi @loop
        lda lerr
        clc
        adc ldx_
        sta lerr
        lda ly0
        clc
        adc lsy
        sta ly0
        jmp @loop
@done:  rts

; Set the quarter-block pixel (px, py): a twin leaves every other 4 pixels out (dashes), PROD is yellow every
; other 4 pixels (stripes).
plot:   inc pix
        lda kind
        beq @on
        lda pix
        and #4
        beq @on
        lda kind
        cmp #K_TWIN
        bne :+
        rts
:       lda #7                  ; PROD stripe
        bne @col
@on:    lda pcol
@col:   sta plot_c
        jsr cell
        lda py
        and #1
        asl
        sta t0
        lda px
        and #1
        ora t0
        tax
        lda (bp),y
        cmp #QB + 1
        bcs :+
        lda #QB
:       ora qbit,x
        sta (bp),y
        lda plot_c
        sta (cp),y
        rts

; bp/cp = buffer rows of (px, py), Y = its column. Remembers the cell while drawing the picked cable.
cell:   lda py
        lsr
        sec
        sbc #AREA_R
        tax
        lda brow_lo,x
        sta bp
        lda brow_hi,x
        sta bp+1
        lda crow_lo,x
        sta cp
        lda crow_hi,x
        sta cp+1
        lda px
        lsr
        sec
        sbc #AREA_C
        tay
        lda rec
        beq @out
        stx t1
        ldx hl_n
        cpx #HL_MAX
        bcs @out
        lda t1
        sta hl_r,x
        tya
        sta hl_c,x
        inc hl_n
@out:   rts

.rodata
s_name:    .byte "Cable Spaghetti", 0
s_help:    .byte "Re-patch every cable to its colour.", 0
s_hint:    .byte "Match every cable to its colour!", 0
s_keys:    .byte "FIRE port then socket  Left/right: side", 0
s_patched: .byte "Patched", 0
s_moves:   .byte "Moves", 0
s_oops:    .byte "Oops", 0
s_still:   .byte "Still wrong...", 0
s_unplug:  .byte "Unplugged a good one!", 0
s_all:     .byte "All patched!", 0
s_prod:    .byte "DON'T TOUCH PROD!", 0
s_alarm:   .byte "PROD ALARM!", 0

; JS cable colours the C64 can put in a text cell: blue, green, yellow, orange (red), purple, cyan, white
PALETTE = 7
palette:   .byte 6, 5, 7, 2, 4, 3, 1
step_tab:  .byte 4, 3, 2, 2     ; rows per cable for 5-8 cables
sw_char:   .byte CH_BLOCK, CH_HALF, CH_BLOCK ; swatch cells: plain, twin (stripes), PROD (+ a yellow cell)
led_col:   .byte 2, 5
led_char:  .byte CH_PIPOFF, CH_PIP
flicker:   .byte 0, 2, 7, 7     ; unpatched socket LEDs from d 0.5: off, red, yellow
qbit:      .byte 1, 2, 4, 8
pts_base:  .repeat MAX_N, I
           .byte I * PTS
           .endrepeat
scr_lo:    .repeat 25, I
           .byte <(SCREEN + I * 40)
           .endrepeat
scr_hi:    .repeat 25, I
           .byte >(SCREEN + I * 40)
           .endrepeat
brow_lo:   .repeat BH, I
           .byte <(buf_ch + I * BW)
           .endrepeat
brow_hi:   .repeat BH, I
           .byte >(buf_ch + I * BW)
           .endrepeat
crow_lo:   .repeat BH, I
           .byte <(buf_cl + I * BW)
           .endrepeat
crow_hi:   .repeat BH, I
           .byte >(buf_cl + I * BW)
           .endrepeat

; Cubic Bézier weights × 256 at steps 1-15 of 16: (1-u)³, 3(1-u)²u, 3(1-u)u², u³.
CUBE = STEPS * STEPS * STEPS
weights:   .repeat STEPS - 1, I
           .byte ((STEPS - I - 1) * (STEPS - I - 1) * (STEPS - I - 1) * 256 + CUBE / 2) / CUBE
           .endrepeat
           .repeat STEPS - 1, I
           .byte (3 * (STEPS - I - 1) * (STEPS - I - 1) * (I + 1) * 256 + CUBE / 2) / CUBE
           .endrepeat
           .repeat STEPS - 1, I
           .byte (3 * (STEPS - I - 1) * (I + 1) * (I + 1) * 256 + CUBE / 2) / CUBE
           .endrepeat
           .repeat STEPS - 1, I
           .byte ((I + 1) * (I + 1) * (I + 1) * 256 + CUBE / 2) / CUBE
           .endrepeat

.include "gen/mg_cables_data.s"

.bss
vars:                           ; cleared by init
done:      .res 1
end_t:     .res 1
moves:     .res 1
mistakes:  .res 1
prod_hits: .res 1
msg_t:     .res 1
shake_t:   .res 1
alarm_t:   .res 1
ui_dirty:  .res 1
cab_dirty: .res 1
hl:        .res 1               ; the picked cable, $ff = none
hl_n:      .res 1
hl_on:     .res 1
rec:       .res 1
has_prod:  .res 1
blinky:    .res 1
bot_t:     .res 1
vars_end:
diff:      .res 1
pairs:     .res 1
bases:     .res 1
free_miss: .res 1
step:      .res 1               ; rows per cable
ctl_i:     .res 1
aside:     .res 1
aidx:      .res 1
ci:        .res 1
cj:        .res 1
ck:        .res 1
was_i:     .res 1
was_k:     .res 1
gained:    .res 1
pass:      .res 1
fy_off:    .res 1
fy_cnt:    .res 1
fy_k:      .res 1
fy_i:      .res 1
bstep:     .res 1
pt_i:      .res 1
w_i:       .res 1
w_lo:      .res 1
k_cnt:     .res 1
dc_i:      .res 1
dc_p:      .res 1
dc_n:      .res 1
plot_c:    .res 1
cx4:       .res 4
cy4:       .res 4
pool:      .res D_DEPT + D_GEN
cab_col:   .res MAX_N
cab_kind:  .res MAX_N
tmp_col:   .res MAX_N
tmp_kind:  .res MAX_N
cab_label: .res MAX_N
cab_end:   .res MAX_N           ; socket each cable is plugged into
want:      .res MAX_N
home:      .res MAX_N
free_l:    .res MAX_N           ; the cables that are not PROD
row_tab:   .res MAX_N
py_tab:    .res MAX_N
c1x:       .res MAX_N
c1y:       .res MAX_N
c2x:       .res MAX_N
c2y:       .res MAX_N
pts_x:     .res MAX_N * PTS
pts_y:     .res MAX_N * PTS
hl_r:      .res HL_MAX
hl_c:      .res HL_MAX
buf_ch:    .res BW * BH
buf_cl:    .res BW * BH
