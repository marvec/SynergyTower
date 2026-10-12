; Org Chart Shuffle (src/minigames/orgchart.js) as a disk-loaded overlay at $4000.
; A surprise reorg: put every employee badge into a box of the org chart so that every clue on the leaked HR
; memo holds, then SUBMIT REORG. FIRE on a badge (in the chart or the staff list) picks it up, FIRE on a box
; drops it there (swapping with whoever was in it), FIRE on the list puts it back.
; Difficulty curve (d = MG_DIFF / 255):
;   d < 0.2: 2 charts of 4 boxes; d < 0.45: 2 charts of 5; d < 0.75: 1 chart of 6; else 1 chart of 7
;   time byDiff(d, 80, 70) s for all charts (the review after a submit does not count)
; Score per chart = clamp((f - b) / (1 - b)), f = the share of clues that hold, b = 0.8 × min(0.6, what a random
; full placement gets on average); the charts are averaged (a chart not reached counts 0). On time-out the chart in
; progress is scored as it stands. Content: gen/mg_orgchart_data.s (tools/mg/orgchart.js).
; Differs from the JS: the puzzles are generated at build time by the JS generator (12 per size; the brute force
; over all placements is too slow for a 6502) and get random names here; names have at most 4 letters; no faces;
; the chart title is in the header row; keyboard / joystick only (the JS drag and drop is FIRE + FIRE).

.include "api.inc"

MAX_N     = 7
CHART_Y   = 2                   ; depth d at row CHART_Y + 2d, connectors in between
TRAY_Y    = 8                   ; person p: rows TRAY_Y + 2p (name, quirk) and the row under it (quirk)
QUIRK_X   = 5
HOLD_Y    = 22                  ; "Holding: Dana" / "Fill every box first!"
SUB_Y     = 23                  ; [SUBMIT REORG] n/N
LEFT_W    = 20                  ; columns 0-19: chart, staff, submit
MARK_X    = 20                  ; review: a tick / cross next to each clue
NOTE_X    = 21                  ; memo: columns 21-39, rows 3-23
NOTE_W    = 19
NOTE_Y    = 3
VBOX_Y    = 10                  ; the verdict box (rows 10-15) over the staff list
TIME_T    = 80 * 50             ; minus byDiff: 10 s × d
REVIEW_T  = 160                 ; 3.2 s
REVIEW_FIRE = REVIEW_T - 40     ; FIRE moves on after 0.8 s
MSG_T     = 45
BOT_T     = 16

.zeropage
count:    .res 1                ; charts: 2 or 1
pi:       .res 1                ; current chart
n:        .res 1                ; boxes = people
phase:    .res 1                ; 0 play, 1 review
review_t: .res 1
focus:    .res 1                ; element: 0..n-1 boxes, n..2n-1 people, 2n submit
held:     .res 1                ; person in hand, $ff none
held_from: .res 1               ; the box it came from, $ff the list
msg_t:    .res 1
dirty:    .res 1
done:     .res 1
sat_n:    .res 1
score:    .res 1
pp:       .res 2                ; puzzle / shape / string pointers
sp:       .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
row:      .res 1
ex:       .res 1                ; element centre (half cells)
ey:       .res 1
cx:       .res 1
cy:       .res 1
best:     .res 1
bs:       .res 1
dir:      .res 1
dv_n:     .res 2                ; mul8 / div8
dv_d:     .res 1
m_b:      .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

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
        sta pi
        sta done
        sta msg_t
        sta scores
        sta scores+1
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; chart size and count
        ldx #4
        lda diff
        cmp #51                 ; d < 0.2
        bcc :+
        inx
        cmp #115                ; d < 0.45
        bcc :+
        inx
        cmp #192                ; d < 0.75
        bcc :+
        inx
:       stx n
        ldy #2
        cmp #115
        bcc :+
        dey
:       sty count
        ; puzzles: count different ones of this size
        txa
        sec
        sbc #4
        tax
        lda #0
:       dex
        bmi :+
        clc
        adc #PZ_PER_SIZE
        bne :-
:       sta t0                  ; first puzzle of the size
        lda #PZ_PER_SIZE
        jsr API_RMOD
        sta t1
        clc
        adc t0
        sta pz_sel
        lda #PZ_PER_SIZE - 1    ; the second: another one
        jsr API_RMOD
        sec
        adc t1                  ; + 1 + r
        cmp #PZ_PER_SIZE
        bcc :+
        sbc #PZ_PER_SIZE
:       clc
        adc t0
        sta pz_sel+1
        ; names: count × n different ones
        ldx #NM_COUNT - 1
:       txa
        sta nm_pool,x
        dex
        bpl :-
        lda n
        ldx count
        cpx #2
        bne :+
        asl
:       sta t2                  ; picks
        ldx #0
@nm:    stx t0
        lda #NM_COUNT
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda nm_pool,x
        pha
        lda nm_pool,y
        sta nm_pool,x
        pla
        sta nm_pool,y
        inx
        cpx t2
        bne @nm
        lda #TI_COUNT
        jsr API_RMOD
        sta title0
        ; time = byDiff(d, 80, 70) s: 4000 - diff × 500 / 255 ~ 4000 - 2 × diff + diff / 32 frames
        lda diff
        lsr
        lsr
        lsr
        lsr
        lsr
        sta t0
        lda diff
        asl
        sta t1
        lda #0
        rol
        sta t2                  ; t2:t1 = 2 × diff
        lda #<TIME_T
        clc
        adc t0
        sta t0
        lda #>TIME_T
        adc #0
        sta t3
        lda t0
        sec
        sbc t1
        pha
        lda t3
        sbc t2
        tax
        pla
        jsr timer_start
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        jmp start_puzzle

; Chart pi: load its puzzle and shape, place nobody, draw everything.
start_puzzle:
        lda #0
        sta phase
        lda #$ff
        sta held
        ldx pi
        ldy pz_sel,x
        lda pz_lo,y
        sta pp
        lda pz_hi,y
        sta pp+1
        ldy #0
        lda (pp),y              ; shape
        tax
        iny
        lda (pp),y
        sta base_b
        iny
        lda (pp),y
        sta ncl
        ; shape tables
        lda sh_conn_lo,x
        sta conn_lo
        lda sh_conn_hi,x
        sta conn_hi
        lda sh_col_lo,x
        ldy sh_col_hi,x
        stx t3
        ldx #0
        jsr copy_n
        ldx t3
        lda sh_depth_lo,x
        ldy sh_depth_hi,x
        ldx #MAX_N
        jsr copy_n
        ldx t3
        lda sh_kids_lo,x
        ldy sh_kids_hi,x
        ldx #2 * MAX_N
        jsr copy_n
        ldx t3
        lda sh_par_lo,x
        ldy sh_par_hi,x
        ldx #3 * MAX_N
        jsr copy_n
        ; the puzzle: target[n], quirk[n], clues
        lda pp
        clc
        adc #3
        ldy pp+1
        bcc :+
        iny
:       ldx #4 * MAX_N
        jsr copy_n              ; target
        lda pp
        clc
        adc #3
        adc n
        ldy pp+1
        bcc :+
        iny
:       ldx #5 * MAX_N
        jsr copy_n              ; quirk_of
        lda n
        asl
        adc #3
        tay                     ; clues: ncl × (template, X, Y)
        ldx #0
:       lda (pp),y
        sta cl_t,x
        iny
        lda (pp),y
        sta cl_x,x
        iny
        lda (pp),y
        sta cl_y,x
        iny
        inx
        cpx ncl
        bne :-
        ; nobody placed; names of this chart
        ldx #MAX_N - 1
:       lda #$ff
        sta occ,x
        sta slot_of,x
        dex
        bpl :-
        lda pi
        beq :+
        lda n
:       tay
        ldx #0
:       lda nm_pool,y
        sta name_of,x
        iny
        inx
        cpx n
        bne :-
        stx focus               ; the first badge
        ; screen
        lda #2
        ldx #22
        jsr clear_rows
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #0
        ldy #0
        jsr API_FILL
        lda title0              ; the chart's title in the header
        clc
        adc pi
        cmp #TI_COUNT
        bcc :+
        sbc #TI_COUNT
:       tax
        lda ti_lo,x
        sta PTR
        lda ti_hi,x
        sta PTR+1
        lda #7
        sta COLOR
        ldx #1
        ldy #0
        jsr API_PRINT
        lda count
        cmp #2
        beq :+
        text 34, 0, s_reorg, 7
        jmp @memo
:       text 30, 0, s_reorg, 7
        lda pi
        clc
        adc #'1'
        ldx #36
        ldy #0
        jsr API_PUTC
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        lda #'2'
        ldx #38
        ldy #0
        jsr API_PUTC
@memo:  text 23, 2, s_memo, 1
        jsr draw_notes
        jmp draw_play

; Copy n bytes from A/Y to shape_buf + X.
copy_n:
        sta sp
        sty sp+1
        ldy #0
:       lda (sp),y
        sta shape_buf,x
        inx
        iny
        cpy n
        bne :-
        rts

; ---------------------------------------------------------------- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda msg_t
        beq :+
        dec msg_t
        bne :+
        inc dirty
:       lda phase
        beq @play
        dec review_t            ; review: on to the next chart after 3.2 s (FIRE after 0.8 s)
        beq @next
        lda review_t
        cmp #REVIEW_FIRE
        bcs @out
        lda JOYP
        and #J_FIRE
        beq @out
@next:  inc pi
        lda pi
        cmp count
        bne :+
        jmp finish
:       jsr start_puzzle
@out:   clc
        rts
@play:  jsr timer_tick
        bcc :+
        jsr put_back            ; time's up: this chart as it stands
        jsr evaluate
        ldx pi
        lda score
        sta scores,x
        jmp finish
:
.if .defined(AUTOPLAY)
        jsr bot
        lda phase
        bne @out
.endif
        lda JOYP
        ldx #3
:       lsr
        bcc :+
        pha
        txa
        pha
        lda dir_tab,x
        jsr nav
        pla
        tax
        pla
:       dex
        bpl :--
        lda JOYP
        and #J_FIRE
        beq :+
        lda focus
        jsr activate
        lda phase
        bne @out
:       lda dirty
        beq @out
        jsr draw_play
        clc
        rts

; Arrow A (0 up, 1 down, 2 left, 3 right): the focus jumps to the nearest element that way (as the JS: the
; smallest distance along the arrow + 2 × the distance across it).
nav:
        sta dir
        lda focus
        jsr elem_pos
        lda ex
        sta cx
        lda ey
        sta cy
        lda #$ff
        sta best
        sta bs
        lda n
        asl
        sta t3                  ; last element: submit
        lda #0
        sta t2
@e:     lda t2
        cmp focus
        beq @next
        jsr elem_pos
        lda ex
        sec
        sbc cx
        sta t0                  ; dx
        lda ey
        sec
        sbc cy
        sta t1                  ; dy
        lda dir
        cmp #2
        bcs @h
        lda t0                  ; up / down: along dy, across dx
        ldx t1
        stx t0
        sta t1
@h:     lda dir                 ; t0 = along, t1 = across; up and left count backwards
        lsr
        bcs :+
        lda t0
        eor #$ff
        clc
        adc #1
        sta t0
:       lda t0
        beq @next
        bmi @next
        lda t1                  ; + 2 × |across|
        bpl :+
        eor #$ff
        clc
        adc #1
:       asl
        clc
        adc t0
        cmp bs
        bcs @next
        sta bs
        lda t2
        sta best
@next:  inc t2
        lda t2
        cmp t3
        bcc @e
        beq @e
        lda best
        bmi :+
        sta focus
        inc dirty
        lda #SFX_BLIP
        jsr API_SFX
:       rts

; A = element: ex, ey = its centre in half cells.
elem_pos:
        cmp n
        bcs @list
        tax                     ; box: 4 columns at its column, on its depth's row
        lda s_col,x
        asl
        adc #4
        sta ex
        lda s_depth,x
        asl
        asl
        adc #2 * CHART_Y + 1
        sta ey
        rts
@list:  sbc n
        cmp n
        bcs @sub
        asl                     ; person: two rows of the list
        asl
        adc #2 * TRAY_Y + 2
        sta ey
        lda #LEFT_W
        sta ex
        rts
@sub:   lda #14
        sta ex
        lda #2 * SUB_Y + 1
        sta ey
        rts

; ---------------------------------------------------------------- rules (as the JS)

; FIRE on element A.
activate:
        inc dirty
        cmp n
        bcs @list
        tax                     ; a box: drop the badge in hand, or pick up the one in it
        ldy held
        bmi :+
        jmp drop_on
:       lda occ,x
        bmi @out
        jmp pick
@list:  sbc n
        cmp n
        bcc :+
        jmp submit
:       ldy held                ; a person: back to the list / pick up
        bmi pick
        cmp held
        php
        pha
        lda #$ff
        sta held
        lda #SFX_BLIP
        jsr API_SFX
        pla
        plp
        bne pick
@out:   rts

; Pick up person A (from its box, if any).
pick:
        sta held
        tax
        lda slot_of,x
        sta held_from
        bmi :+
        tay
        lda #$ff
        sta occ,y
        sta slot_of,x
:       lda #SFX_BLIP
        jmp API_SFX

; Box X: the badge in hand goes in; whoever was there goes to the box the badge came from (if it is free).
drop_on:
        lda occ,x
        sta t0                  ; q
        lda held
        jsr place
        lda t0
        bmi @done
        cmp held
        beq @done
        tay
        lda #$ff
        sta slot_of,y
        ldy held_from
        bmi @done
        cpy t1                  ; (place left the box in t1)
        beq @done
        lda occ,y
        bpl @done
        tya
        tax
        lda t0
        jsr place
@done:  lda #$ff
        sta held
        lda #SFX_GOOD
        jmp API_SFX

; Person A into box X (t1 = the box).
place:
        sta occ,x
        stx t1
        tay
        txa
        sta slot_of,y
        rts

; The badge in hand goes back to its box if that is still free, else to the list.
put_back:
        lda held
        bmi @out
        ldx held_from
        bmi :+
        ldy occ,x
        bpl :+
        jsr place
:       lda #$ff
        sta held
@out:   rts

submit:
        jsr put_back
        ldx n
        dex
:       lda occ,x
        bmi @empty
        dex
        bpl :-
        jsr evaluate
        ldx pi
        lda score
        sta scores,x
        lda #1
        sta phase
        lda #REVIEW_T
        sta review_t
        ; verdict: all clues hold, score >= 0.5, or worse
        ldx #0
        lda sat_n
        cmp ncl
        beq @v
        inx
        lda score
        bmi @v
        inx
@v:     stx t2
        lda vd_count,x
        jsr API_RMOD
        ldx t2
        clc
        adc vd_first,x
        sta verdict
        lda t2
        bne :+
        lda #SFX_GOOD
        bne :++
:       lda #SFX_BAD
:       jsr API_SFX
        jsr draw_notes
        jmp draw_verdict
@empty: lda #SFX_BAD
        jsr API_SFX
        lda #MSG_T
        sta msg_t
        lda #<s_fill
        sta msg_ptr
        lda #>s_fill
        sta msg_ptr+1
        rts

; sat[] per clue, sat_n, score = clamp((f - b) × 255 / (255 - b)) with f = sat_n × 255 / clues.
evaluate:
        jsr build_view
        lda #0
        sta sat_n
        ldx ncl
        dex
@c:     stx t3
        jsr check
        ldx t3
        sta sat,x
        clc
        adc sat_n
        sta sat_n
        dex
        bpl @c
        lda sat_n
        ldx #255
        jsr mul8
        sta dv_n+1
        lda ncl
        jsr div8                ; dv_n = f
        lda dv_n
        sec
        sbc base_b
        bcc @zero
        beq @zero
        ldx #255
        jsr mul8
        sta dv_n+1
        lda base_b
        eor #$ff                ; 255 - b
        jsr div8
        lda dv_n+1
        beq :+
        lda #255
        bne @set
:       lda dv_n
        bne @set
@zero:  lda #0
@set:   sta score
        rts

; Facts per person for the current placement: manager ($fe the boss, $ff unknown), direct reports, depth.
build_view:
        ldx #MAX_N - 1
        lda #$ff
:       sta v_mgr,x
        sta v_kids,x
        sta v_depth,x
        dex
        bpl :-
        inx
@s:     ldy occ,x
        bmi @next
        lda s_kids,x
        sta v_kids,y
        lda s_depth,x
        sta v_depth,y
        lda s_par,x
        bpl :+
        lda #$fe
        bne @mgr
:       stx t0
        tax
        lda occ,x               ; ($ff when that box is empty)
        ldx t0
@mgr:   sta v_mgr,y
@next:  inx
        cpx n
        bne @s
        rts

; Clue X: A = 1 if it holds for the view (X = 2 in check_* means Y).
check:
        lda cl_y,x
        sta t1                  ; Y
        ldy cl_x,x              ; X
        lda cl_t,x
        tax
        lda tm_check,x
        asl
        tax
        lda ck_tab+1,x
        pha
        lda ck_tab,x
        pha
        rts                     ; -> check_*: Y = X person, t1 = Y

ck_boss:
        lda v_depth,y
        beq yes
        bne no
ck_notboss:
        ldx v_depth,y           ; depth 1 or 2
        dex
        cpx #2
        bcc yes
        bcs no
ck_depth1:
        lda v_depth,y
        cmp #1
        beq yes
        bne no
ck_kids0:
        lda v_kids,y
        beq yes
        bne no
ck_kidspos:
        ldx v_kids,y            ; 1-3 reports
        dex
        cpx #4
        bcc yes
        bcs no
ck_kidseq:
        lda v_kids,y
        cmp t1
        beq yes
        bne no
no:     lda #0
        rts
yes:    lda #1
        rts
ck_mgr:
        lda v_mgr,y
        cmp t1
        beq yes
        bne no
ck_skip:
        ldx v_mgr,y
        cpx #$fe
        bcs no
        lda v_mgr,x
        cmp t1
        beq yes
        bne no
ck_notmgr:
        lda v_mgr,y
        cmp #$ff
        beq no
        cmp t1
        beq no
        ldx t1
        lda v_depth,x
        cmp #$ff
        beq no
        bne yes
ck_share:
        lda v_mgr,y
        cmp #$fe
        bcs no
        ldx t1
        cmp v_mgr,x
        beq yes
        bne no
ck_level:
        lda v_depth,y
        cmp #$ff
        beq no
        ldx t1
        cmp v_depth,x
        beq yes
        bne no

; MG_SCORE = the charts' average.
finish:
        lda scores
        clc
        adc scores+1
        sta dv_n
        lda #0
        rol
        sta dv_n+1
        lda count
        jsr div8
        lda dv_n
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): every BOT_T frames one step towards the target placement, then SUBMIT.
bot:    inc bot_t
        lda bot_t
        cmp #BOT_T
        bcc @out
        lda #0
        sta bot_t
        lda held
        bmi @find
        ldx n                   ; holding someone: their box in the target
        dex
:       cmp target,x
        beq :+
        dex
        bne :-
:       txa
        jmp @act
@find:  ldx #0                  ; the first box with the wrong person: pick up the right one
:       lda occ,x
        cmp target,x
        bne :+
        inx
        cpx n
        bne :-
        txa                     ; all right: submit (element 2n)
        asl
        jmp @act
:       lda target,x
        clc
        adc n
@act:   sta focus
        jsr activate
@out:   rts
.endif

; ---------------------------------------------------------------- drawing

; Chart, staff list, holding line, submit button.
draw_play:
        lda #0
        sta dirty
        ; chart: rows CHART_Y .. CHART_Y + 4
        lda #LEFT_W
        sta FILL_W
        lda #5
        sta FILL_H
        lda #' '
        ldx #0
        ldy #CHART_Y
        jsr API_FILL
        lda #6                  ; connectors
        sta COLOR
        lda conn_lo
        sta sp
        lda conn_hi
        sta sp+1
        ldy #0
        lda (sp),y
        sta t3
@cn:    dec t3
        bmi @slots
        iny
        lda (sp),y              ; depth -> row
        asl
        adc #CHART_Y + 1
        sta row
        iny
        lda (sp),y
        sta t0                  ; left
        iny
        lda (sp),y
        sta t1                  ; right
        iny                     ; (parent column: unused)
        sty t2
        lda t0
        cmp t1
        bne :+
        lda #CH_L               ; one report: straight down
        ldx t0
        ldy row
        jsr API_PUTC
        jmp @cnx
:       lda t1
        sec
        sbc t0
        sta FILL_W
        lda #1
        sta FILL_H
        lda #CH_T
        ldx t0
        ldy row
        jsr API_FILL
        lda #CH_TL
        ldx t0
        ldy row
        jsr API_PUTC
        lda #CH_TR
        ldx t1
        ldy row
        jsr API_PUTC
@cnx:   ldy t2
        jmp @cn
@slots: lda #7                  ; the boss's star
        sta COLOR
        ldx s_col
        dex
        lda #CH_STAR
        ldy #CHART_Y
        jsr API_PUTC
        lda #0
        sta t2
@s:     ldx t2
        lda s_depth,x
        asl
        adc #CHART_Y
        sta row
        lda #1
        ldy occ,x
        bpl :+
        lda #6
:       cpx focus
        bne :+
        lda #7
:       sta COLOR
        lda occ,x
        bpl @name
        lda #4                  ; empty box: ----
        sta FILL_W
        lda #1
        sta FILL_H
        ldy row
        lda s_col,x
        tax
        lda #'-'
        jsr API_FILL
        jmp @snext
@name:  jsr name_ptr
        ldx t2
        lda s_col,x
        tax
        ldy row
        jsr API_PRINT
@snext: inc t2
        lda t2
        cmp n
        bne @s
        ; staff list
        lda #TRAY_Y
        sta row
        lda #0
        sta t2
@p:     lda #LEFT_W
        sta FILL_W
        lda #2
        sta FILL_H
        lda #' '
        ldx #0
        ldy row
        jsr API_FILL
        ldx t2                  ; colours: focus yellow, placed / in hand blue, else white + cyan
        lda #1
        sta t0
        lda #3
        sta t1
        lda slot_of,x
        bpl @dim
        cpx held
        bne :+
@dim:   lda #6
        sta t0
        sta t1
:       txa
        clc
        adc n
        cmp focus
        bne :+
        lda #7
        sta t0
        sta t1
:       lda t0
        sta COLOR
        txa
        jsr name_ptr
        ldx #0
        ldy row
        jsr API_PRINT
        lda t1
        sta COLOR
        ldx t2
        ldy quirk_of,x
        lda qk_lo,y
        sta PTR
        lda qk_hi,y
        sta PTR+1
        ldx #QUIRK_X
        ldy row
        jsr API_PRINT
        jsr next_str
        ldx #QUIRK_X
        ldy row
        iny
        jsr API_PRINT
        ldx t2
        lda slot_of,x
        bmi :+
        lda #5                  ; placed: a tick under the name
        sta COLOR
        lda #CH_CHECK
        ldx #1
        ldy row
        iny
        jsr API_PUTC
:       inc row
        inc row
        inc t2
        lda t2
        cmp n
        beq :+
        jmp @p
:       ; holding line / message
        lda #LEFT_W
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #0
        ldy #HOLD_Y
        jsr API_FILL
        lda msg_t
        beq :+
        lda msg_ptr
        sta PTR
        lda msg_ptr+1
        sta PTR+1
        lda #2
        sta COLOR
        ldx #0
        ldy #HOLD_Y
        jsr API_PRINT
        jmp @sub
:       lda held
        bmi @sub
        text 0, HOLD_Y, s_holding, 3
        lda held
        jsr name_ptr
        ldx #9
        ldy #HOLD_Y
        jsr API_PRINT
@sub:   ; [SUBMIT REORG] n/N: green when every box is filled, the brackets yellow with the focus
        ldx n
        dex
        lda #0
        sta t0                  ; placed
:       ldy occ,x
        bmi :+
        inc t0
:       dex
        bpl :--
        lda #6
        ldx t0
        cpx n
        bne :+
        lda #5
:       sta COLOR
        sta t1
        lda #<s_submit
        sta PTR
        lda #>s_submit
        sta PTR+1
        ldx #1
        ldy #SUB_Y
        jsr API_PRINT
        lda n
        asl
        cmp focus
        bne :+
        lda #7
        sta COLOR
:       lda #'['
        ldx #0
        ldy #SUB_Y
        jsr API_PUTC
        lda #']'
        ldx #13
        ldy #SUB_Y
        jsr API_PUTC
        lda #1
        sta COLOR
        lda t0
        ora #'0'
        ldx #15
        ldy #SUB_Y
        jsr API_PUTC
        lda #'/'
        ldx #16
        ldy #SUB_Y
        jsr API_PUTC
        lda n
        ora #'0'
        ldx #17
        ldy #SUB_Y
        jmp API_PUTC

; A = person -> PTR = their name.
name_ptr:
        tax
        ldy name_of,x
        lda nm_lo,y
        sta PTR
        lda nm_hi,y
        sta PTR+1
        rts

; PTR = the string after the one at PTR.
next_str:
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
:       rts

; The memo: every clue word-wrapped into columns NOTE_X.., alternating colours; in the review green when it
; holds (with a tick), red when not (with a cross).
draw_notes:
        lda #LEFT_W
        sta FILL_W
        lda #24 - NOTE_Y
        sta FILL_H
        lda #' '
        ldx #MARK_X
        ldy #NOTE_Y
        jsr API_FILL
        lda #NOTE_Y
        sta row
        lda #0
        sta t3
@c:     jsr expand
        ldx t3
        lda note_col,x
        ldy phase
        beq @col
        lda #2
        ldy sat,x
        beq :+
        lda #5
:       sta COLOR
        lda #'x'
        ldy sat,x
        beq :+
        lda #CH_CHECK
:       ldx #MARK_X
        ldy row
        jsr API_PUTC
        lda COLOR
@col:   sta COLOR
        jsr print_wrapped
        inc t3
        lda t3
        cmp ncl
        bne @c
        rts

; exp_buf = "n. " + clue t3 in words.
expand:
        ldx t3
        lda cl_x,x
        sta ex                  ; (X person)
        lda cl_y,x
        sta ey                  ; (Y)
        ldy cl_t,x
        lda tm_lo,y
        sta sp
        lda tm_hi,y
        sta sp+1
        txa
        clc
        adc #'1'
        sta exp_buf
        lda #'.'
        sta exp_buf+1
        lda #' '
        sta exp_buf+2
        ldx #3
        ldy #0
@ch:    lda (sp),y
        bne :+
        jmp @end
:       iny
        sty t2
        cmp #7
        bcs @lit
        cmp #1
        bne :+
        lda ex                  ; 1: name of X
        jmp @name
:       cmp #3
        bne :+
        lda ey                  ; 3: name of Y
@name:  stx t0
        jsr name_ptr
        ldx t0
        jsr app_ptr
        jmp @next
:       cmp #2
        bne :+
        lda ex                  ; 2: quirk of X
        jmp @quirk
:       cmp #4
        bne :+
        lda ey                  ; 4: quirk of Y
@quirk: stx t0
        tax
        ldy quirk_of,x
        lda qk_lo,y
        sta PTR
        lda qk_hi,y
        sta PTR+1
        ldx t0
        jsr app_ptr             ; first line
        stx t0
        jsr next_str
        ldx t0
        ldy #0
        lda (PTR),y
        beq @next
        lda #' '                ; second line
        sta exp_buf,x
        inx
        jsr app_ptr
        jmp @next
:       cmp #5
        bne :+
        lda ey                  ; 5: the number Y
        ora #'0'
        bne @lit
:       lda #<s_people          ; 6: person / people
        ldy #>s_people
        sta PTR
        sty PTR+1
        lda ey
        cmp #1
        bne :+
        lda #<s_person
        ldy #>s_person
        sta PTR
        sty PTR+1
:       jsr app_ptr
        jmp @next
@lit:   sta exp_buf,x
        inx
@next:  ldy t2
        jmp @ch
@end:   sta exp_buf,x
        stx t1                  ; length
        rts

; Append the string at PTR to exp_buf at X (X = its new end).
app_ptr:
        ldy #0
:       lda (PTR),y
        beq :+
        sta exp_buf,x
        inx
        iny
        bne :-
:       rts

; exp_buf (length t1) greedily word-wrapped to NOTE_W columns from row `row` on (row moves on), in COLOR.
print_wrapped:
        lda #0
        sta t0                  ; start of the line
@line:  lda t1
        sec
        sbc t0
        cmp #NOTE_W + 1
        bcc @last
        lda t0                  ; the last space within NOTE_W + 1 characters ends the line
        clc
        adc #NOTE_W
        tay
:       lda exp_buf,y
        cmp #' '
        beq :+
        dey
        bne :-
:       lda #0
        sta exp_buf,y
        sty t2
        jsr @print
        ldy t2
        lda #' '
        sta exp_buf,y
        iny
        sty t0
        jmp @line
@last:  ; fall into @print for the rest
@print: lda t0
        clc
        adc #<exp_buf
        sta PTR
        lda #>exp_buf
        adc #0
        sta PTR+1
        ldx #NOTE_X
        ldy row
        inc row
        jmp API_PRINT

; The verdict box over the staff list: HR's verdict (3 lines) and how many clues hold.
draw_verdict:
        lda #2                  ; green: all hold; yellow: score >= 0.5; red
        ldx sat_n
        cpx ncl
        bne :+
        lda #5
        bne :++
:       ldx score
        bpl :+
        lda #7
:       sta COLOR
        lda #LEFT_W
        sta FILL_W
        lda #6
        sta FILL_H
        ldx #0
        ldy #VBOX_Y
        jsr API_BOX
        lda #LEFT_W - 2
        sta FILL_W
        lda #4
        sta FILL_H
        lda #' '
        ldx #1
        ldy #VBOX_Y + 1
        jsr API_FILL
        lda #1
        sta COLOR
        ldx verdict
        lda vd_lo,x
        sta PTR
        lda vd_hi,x
        sta PTR+1
        lda #VBOX_Y + 1
        sta row
@l:     jsr center_left
        jsr next_str
        inc row
        lda row
        cmp #VBOX_Y + 4
        bne @l
        ldx #0                  ; "n/m clues hold"
        lda sat_n
        jsr digit
        lda #'/'
        sta exp_buf,x
        inx
        lda ncl
        jsr digit
        lda #<s_hold
        ldy #>s_hold
        sta PTR
        sty PTR+1
        jsr app_ptr
        lda #0
        sta exp_buf,x
        lda #<exp_buf
        sta PTR
        lda #>exp_buf
        sta PTR+1
        lda #7
        sta COLOR
        ; fall through

; PTR centred in columns 1-18 of row `row`.
center_left:
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #LEFT_W
        lsr
        tax
        ldy row
        jmp API_PRINT

; A = 0-9: appended to exp_buf at X.
digit:
        ora #'0'
        sta exp_buf,x
        inx
        rts

; ---------------------------------------------------------------- arithmetic

; A × X -> A (high byte), dv_n (low byte).
mul8:
        stx m_b
        sta dv_d
        lda #0
        ldx #8
@m:     lsr m_b
        bcc :+
        clc
        adc dv_d
:       ror
        ror dv_n
        dex
        bne @m
        rts

; dv_n (16 bit) / A -> dv_n, A = remainder.
div8:
        sta dv_d
        lda #0
        ldx #16
@d:     asl dv_n
        rol dv_n+1
        rol
        bcs @sub
        cmp dv_d
        bcc :+
@sub:   sbc dv_d
        inc dv_n
:       dex
        bne @d
        rts

.rodata
s_name:    .byte "Org Chart Shuffle", 0
s_help:    .byte "Put every badge in the chart so every clue holds.", 0
s_keys:    .byte "Joystick: move  FIRE: pick up / drop", 0
s_reorg:   .byte "Reorg", 0
s_memo:    .byte "LEAKED HR MEMO", 0
s_holding: .byte "Holding:", 0
s_fill:    .byte "Fill every box first", 0
s_submit:  .byte "SUBMIT REORG", 0
s_hold:    .byte " clues hold", 0
s_person:  .byte "person", 0
s_people:  .byte "people", 0
note_col:  .byte 7, 3, 1, 7, 3, 1, 7, 3, 1
dir_tab:   .byte 3, 2, 1, 0     ; JOYP bits from bit 3 down: right, left, down, up
ck_tab:    .word ck_boss - 1, ck_notboss - 1, ck_depth1 - 1, ck_kids0 - 1, ck_kidspos - 1, ck_kidseq - 1
           .word ck_mgr - 1, ck_skip - 1, ck_notmgr - 1, ck_share - 1, ck_level - 1

.include "gen/mg_orgchart_data.s"

.bss
diff:      .res 1
pz_sel:    .res 2
title0:    .res 1
scores:    .res 2
base_b:    .res 1
ncl:       .res 1
verdict:   .res 1
conn_lo:   .res 1
conn_hi:   .res 1
msg_ptr:   .res 2
shape_buf:                      ; per box: column, depth, reports, parent; then target and quirks
s_col:     .res MAX_N
s_depth:   .res MAX_N
s_kids:    .res MAX_N
s_par:     .res MAX_N
target:    .res MAX_N           ; box -> person
quirk_of:  .res MAX_N           ; person -> quirk
occ:       .res MAX_N           ; box -> person, $ff empty
slot_of:   .res MAX_N           ; person -> box, $ff in the list
name_of:   .res MAX_N
v_mgr:     .res MAX_N
v_kids:    .res MAX_N
v_depth:   .res MAX_N
cl_t:      .res MAX_CLUES
cl_x:      .res MAX_CLUES
cl_y:      .res MAX_CLUES
sat:       .res MAX_CLUES
nm_pool:   .res NM_COUNT
exp_buf:   .res 64
