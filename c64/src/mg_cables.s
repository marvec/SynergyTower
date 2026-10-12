; Cable Spaghetti (src/minigames/cables.js) as a disk-loaded overlay at $4000.
; The server-room patch panel is wired all wrong: re-patch every cable to the socket with its colour.
; Connecting a port to a socket swaps the two cable ends, so the wiring stays a permutation. Difficulty 0
; (floor 1): 5 cables in distinct colours, no PROD cable, no striped twins, no blinking LEDs, 45 s.
; Score = patched / 5 - 0.2 per mistake beyond the first + 5 % of the time left when all are patched.
; Cables are drawn in quarter blocks (2 × 2 pixels per cell) into an off-screen buffer and copied over:
; tangled ones as Bézier curves, patched ones straight. Content: src/data/mg-cables.js (gen/mg_cables_data.s).

.include "api.inc"
.include "gen/chars.inc"

N         = 5                   ; cables
FREE_MISS = 1                   ; mistakes that cost nothing (2 from 6 cables up)
END_T     = 40                  ; 0.8 s from "All patched!" to the result
FLOAT_T   = 45                  ; 0.9 s for the feedback texts
SHAKE_T   = 6                   ; 0.12 s screen shake on a mistake
BLINK     = 8                   ; frames per blink of the picked cable
TIME_T    = 45 * 50             ; minus the difficulty: byDiff(d, 45, 40) s

ROW0      = 5                   ; screen row of port / socket 0
ROW_STEP  = 4
PORT_W    = 5                   ; port boxes: columns 0-4
SOCK_X    = 21                  ; socket boxes: columns 21-39
SOCK_W    = 19
LABEL_X   = 24
LED_X     = 38
MSG_X     = 10                  ; row 23: "Moves" left, messages in columns 10-31, "Oops" right
MSG_W     = 22
FL_X      = 22                  ; feedback over a socket box: columns 22-38
FL_W      = 17

; the cable area (quarter-block pixels: 2 per cell)
AREA_C    = 5                   ; columns 5-20: plug, cable, plug
AREA_R    = 4                   ; rows 4-22
BW        = 16
BH        = 19
PX0       = 2 * AREA_C + 1      ; cable start: right half of the port plug
PX3       = 2 * (AREA_C + BW - 1) ; cable end: left half of the socket plug
STEPS     = 16                  ; Bézier segments
PTS       = STEPS + 1
QB        = 240                 ; quarter blocks: QB + 1 top left, 2 top right, 4 bottom left, 8 bottom right
HL_MAX    = 120                 ; cells remembered for the picked cable's blink

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

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department (only the lobby's labels are on the disk)
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
        ; colours: 5 of the 7 the C64 can show in a text cell
        ldx #PALETTE - 1
:       txa
        sta pool,x
        dex
        bpl :-
        lda #0
        ldx #PALETTE
        ldy #N
        jsr pick
        ldx #N - 1
:       ldy pool,x
        lda palette,y
        sta cab_col,x
        dex
        bpl :-
        ; labels: the department's + 12 generic ones, 5 of those
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
        ldy #N
        jsr pick
        ldx #N - 1
:       lda pool,x
        sta cab_label,x
        dex
        bpl :-
        ; socket order: want[j] = the cable whose colour socket j shows, home[cable] = its socket
        jsr shuffle_n
        ldx #N - 1
:       lda pool,x
        sta want,x
        tay
        txa
        sta home,y
        dex
        bpl :-
        ; initial wiring: a derangement, every cable plugged into another cable's socket
@der:   jsr shuffle_n
        ldx #N - 1
:       txa
        cmp pool,x
        beq @der
        dex
        bpl :-
        ldx #N - 1
:       ldy pool,x
        lda home,y
        sta cab_end,x
        dex
        bpl :-
        ; the tangle: two random control points per cable (x 14-37, y 8-45)
        ldx #N - 1
@ctl:   stx ctl_i
        lda #24
        jsr API_RMOD
        clc
        adc #14
        ldx ctl_i
        sta c1x,x
        lda #24
        jsr API_RMOD
        clc
        adc #14
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
        rts

; pool[0..N-1] = a random permutation of 0..N-1.
shuffle_n:
        ldx #N - 1
:       txa
        sta pool,x
        dex
        bpl :-
        lda #0
        ldx #N
        ldy #N
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
        bne @wait
        lda #1                  ; all patched: score with the time bonus
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
        lda #N - 1
        sta cur,x
        bpl @moved
:       lda JOYP
        and #J_DOWN
        beq @fire
        ldx col
        inc cur,x
        lda cur,x
        cmp #N
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

; Timers of the feedback texts, the shake and the picked cable's blink.
effects:
        ldx #N - 1
@f:     lda float_t,x
        beq @nf
        dec float_t,x
        bne @nf
        stx t2
        lda row_tab,x
        sec
        sbc #2
        tay
        lda #FL_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #FL_X
        lda #' '
        jsr API_FILL
        ldx t2
@nf:    dex
        bpl @f
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        jsr clear_msg
:       lda shake_t
        beq @blink
        dec shake_t
        lda #0
        ldx shake_t
        beq :+
        jsr API_RAND
        and #3
:       ora #$18                ; multicolour text, 40 columns (as the host sets it)
        sta $d016
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
        lda sel_side
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
@right: lda sel_side
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
        cmp #N
        bne @out
        lda #<s_all
        ldx #>s_all
        ldy #7
        jsr message
        lda #END_T
        sta end_t
@out:   rts

; A = cable, Y = whether it was patched before: a newly patched one says so over its socket.
check_gain:
        tax
        cpy #0
        bne @no
        jsr is_ok
        beq @no
        lda #1
        sta gained
        lda cab_end,x
        sta t2                  ; socket
        lda #CL_COUNT
        jsr API_RMOD
        tax
        lda cl_lo,x
        sta PTR
        lda cl_hi,x
        sta PTR+1
        lda #FL_W               ; centred over the socket box
        sec
        sbc cl_len,x
        lsr
        clc
        adc #FL_X
        pha
        ldx t2
        lda #FLOAT_T
        sta float_t,x
        lda row_tab,x
        sec
        sbc #2
        tay
        lda #5
        sta COLOR
        pla
        tax
        jmp API_PRINT
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
        ldx #N - 1
:       cmp cab_end,x
        beq :+
        dex
        bne :-
:       txa
        rts

; A = patched cables.
ok_count:
        lda #0
        sta t0
        ldx #N - 1
:       jsr is_ok
        clc
        adc t0
        sta t0
        dex
        bpl :-
        lda t0
        rts

blip:   lda #SFX_BLIP
        jmp API_SFX

; A = 1 to add the time bonus. score = patched × 51 - 51 × extra mistakes (+ cells left / 3, ~5 % of 255)
finish:
        sta t2
        jsr ok_count
        sta t0
        asl                     ; × 51 = × 32 + × 16 + × 2 + × 1
        asl
        asl
        asl
        sta t1
        asl
        clc
        adc t1
        sta t1
        lda t0
        asl
        adc t1
        adc t0
        sta acc
        lda #0
        sta acc+1
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
        sbc #FREE_MISS
        bcc @clamp
        beq @clamp
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
        cpx #N
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

; Port and socket boxes: picked yellow, cursor cyan, others blue.
draw_boxes:
        lda #0
        sta ui_dirty
        lda #N - 1
        sta t2
@b:     ldx t2
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
        ldx #0
        jsr API_BOX
        ldx t2                  ; colour swatch
        lda cab_col,x
        sta COLOR
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        ldy row_tab,x
        ldx #1
        lda #CH_BLOCK
        jsr API_FILL
        ldx t2                  ; LED and jack: green when patched, red when not
        jsr is_ok
        tax
        lda led_col,x
        sta COLOR
        lda led_char,x
        ldx t2
        ldy row_tab,x
        ldx #3
        jsr API_PUTC
        ldx t2
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
        ldy cur+1
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
        lda #SOCK_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldy row_tab,x
        dey
        ldx #SOCK_X
        jsr API_BOX
        lda COLOR               ; the jack: a dark hole in the box's left side
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
        ldy row_tab,x
        ldx #SOCK_X + 1
        lda #CH_BLOCK
        jsr API_PUTC
        lda #1
        sta COLOR
        ldx t2
        ldy want,x
        lda cab_label,y
        tay
        lda dev_lo,y
        sta PTR
        lda dev_hi,y
        sta PTR+1
        ldy row_tab,x
        ldx #LABEL_X
        jsr API_PRINT
        ldx t2                  ; LED: yellow while the wrong cable is in, green when right
        ldy want,x
        ldx #7
        lda cab_end,y
        cmp home,y
        bne :+
        ldx #5
:       stx COLOR
        ldx t2
        ldy row_tab,x
        ldx #LED_X
        lda #CH_PIP
        jsr API_PUTC
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

; "Patched n/5" on the title row; "Moves n" and "Oops n" on row 23.
draw_status:
        text 29, 0, s_patched, 7
        jsr ok_count
        ldx #37
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
        cmp #FREE_MISS + 1
        bcc :+
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
        sta step
@s:     inc pt_i
        ldx #0
        jsr weigh
        ldy pt_i
        sta pts_x,y
        ldx #4
        jsr weigh
        ldy pt_i
        sta pts_y,y
        inc step
        lda step
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
        ldx step                ; weights start at step 1
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
@p:     ldx #N - 1
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
@plugs: ldx dc_i
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

; Set the quarter-block pixel (px, py) in colour pcol.
plot:   jsr cell
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
        lda pcol
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
s_patched: .byte "Patched  /5", 0
s_moves:   .byte "Moves", 0
s_oops:    .byte "Oops", 0
s_still:   .byte "Still wrong...", 0
s_unplug:  .byte "Unplugged a good one!", 0
s_all:     .byte "All patched!", 0

; JS cable colours the C64 can put in a text cell: blue, green, yellow, orange (red), purple, cyan, white
PALETTE = 7
palette:   .byte 6, 5, 7, 2, 4, 3, 1
led_col:   .byte 2, 5
led_char:  .byte CH_PIPOFF, CH_PIP
qbit:      .byte 1, 2, 4, 8
row_tab:   .repeat N, I
           .byte ROW0 + I * ROW_STEP
           .endrepeat
py_tab:    .repeat N, I             ; cable y at a port / socket: the cell's lower half
           .byte 2 * (ROW0 + I * ROW_STEP) + 1
           .endrepeat
pts_base:  .repeat N, I
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
msg_t:     .res 1
shake_t:   .res 1
ui_dirty:  .res 1
cab_dirty: .res 1
hl:        .res 1               ; the picked cable, $ff = none
hl_n:      .res 1
hl_on:     .res 1
rec:       .res 1
float_t:   .res N
bot_t:     .res 1
vars_end:
diff:      .res 1
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
step:      .res 1
pt_i:      .res 1
w_i:       .res 1
w_lo:      .res 1
k_cnt:     .res 1
dc_i:      .res 1
dc_p:      .res 1
dc_n:      .res 1
cx4:       .res 4
cy4:       .res 4
pool:      .res D_DEPT + D_GEN
cab_col:   .res N
cab_label: .res N
cab_end:   .res N               ; socket each cable is plugged into
want:      .res N
home:      .res N
c1x:       .res N
c1y:       .res N
c2x:       .res N
c2y:       .res N
pts_x:     .res N * PTS
pts_y:     .res N * PTS
hl_r:      .res HL_MAX
hl_c:      .res HL_MAX
buf_ch:    .res BW * BH
buf_cl:    .res BW * BH
