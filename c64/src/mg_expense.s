; Expense Fraud Detective (src/minigames/expense.js) as a disk-loaded overlay at $4000.
; Receipts land on the desk one at a time: APPROVE (right) the legit ones, REJECT (left) the fraud before the
; receipt's timer runs out. Difficulty 0-0.17 (floors 1-2): 8-9 receipts, ~42-58 % fraud, 8-7.4 s each, no
; duplicates (those start at d 0.6). The stamps unlock 0.45 s after a receipt lands; pressing before that is
; mashing and costs 4 %. Score = (correct - wrong / 2) / receipts - 0.04 × mashes, 90 s safety cap.
; Content: src/data/mg-expense.js, lobby + shared receipts (gen/mg_expense_data.s). The two rubber stamps are
; multicolour sprites (4 each: knob, stem, handle, rubber); the chosen one flies onto the receipt.

.include "api.inc"

MAX_N     = 9                   ; receipts per round
IN_T      = 15                  ; 0.3 s: the receipt lands
READ_T    = 22                  ; 0.45 s before the stamps unlock
STAMP_T   = 15                  ; 0.3 s stamp phase
FLY_T     = 11                  ; 0.22 s of it in flight
HOLD_OK   = 55                  ; verdict on screen: 1.1 s right, 1.4 s timed out, 2 s wrong
HOLD_LATE = 70
HOLD_BAD  = 100
SKIP_T    = 23                  ; FIRE moves on after 0.45 s
TOTAL     = 90 * 50             ; safety cap
PER_ITEM  = 8 * 50              ; byDiff(d, 8, 4.5) s
MSG_T     = 50
FLASH_T   = 8                   ; red border for a wrong call (the JS screen shake)
SPAM_PEN  = 10                  ; 0.04 × 255

P_IN      = 0
P_DECIDE  = 1
P_STAMP   = 2
P_RESULT  = 3
C_REJECT  = 0
C_APPROVE = 1
C_NONE    = $ff

; flags byte of a receipt (tools/mg/expense.js)
F_FRAUD   = $80
F_DEPT    = $40
F_TWO     = $08
F_DAY     = $07

; strings after the flags: merchant, item text + amount (1-2×), then these (offset by 2 for two items)
S_TOTAL   = 3
S_REASON  = 4
S_TELL    = 6

RC_X      = 5                   ; receipt box: columns 5-34, text in 6-33
RC_Y      = 2
RC_W      = 30
RC_RIGHT  = 34                  ; right-aligned text ends left of this column
BTN_Y     = 15
BTN_H     = 6
REJ_X     = 1
APP_X     = 27
BTN_W     = 12
TALLY_Y   = 17
MSG_Y     = 19                  ; message slot between the buttons, columns 13-26
VERD_Y    = 21
INK_X     = 14                  ; ink box: 12 × 3 on the receipt's middle
INK_W     = 12

; sprites: x in half pixels (all positions are even), y in pixels
STAMP_PTR = ($e300 - $c000) / 64
HOME_Y    = 50 + BTN_Y * 8 + 8  ; stamp top one row into the button
REJ_SX    = (24 + (REJ_X * 8 + BTN_W * 4) - 12) / 2
APP_SX    = (24 + (APP_X * 8 + BTN_W * 4) - 12) / 2
RC_SX     = (24 + 20 * 8 - 12) / 2
LIFT      = 6                   ; the stamp hovers this high until it lands

.zeropage
n:        .res 1                ; receipts this round
qi:       .res 1                ; current receipt
phase:    .res 1
pt:       .res 1                ; frames in the phase
left:     .res 2                ; frames left to decide
per_item: .res 2
total:    .res 2
correct:  .res 1
wrong:    .res 1
spam:     .res 1
judged:   .res 1
call:     .res 1
ok:       .res 1
done:     .res 1
msg_t:    .res 1
msg_id:   .res 1
flash_t:  .res 1
want:     .res 1                ; this frame's call from the stick, C_NONE = none
flags:    .res 1                ; current receipt
rp:       .res 2                ; current receipt record
sp:       .res 2
mid:      .res 1                ; receipt's middle row
row:      .res 1
bufi:     .res 1
sx:       .res 1                ; flying stamp
sy:       .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- set-up

; A = difficulty
init:
        sta t0
        ldx #8                  ; round(byDiff(d, 8, 13)): 9 from d 0.1
        cmp #26
        bcc :+
        inx
:       stx n
        lsr                     ; per item: 400 - 0.6875 × A frames (8 s -> 4.5 s over the full range)
        sta t1
        lsr
        lsr
        sta t2
        lsr
        clc
        adc t2
        adc t1
        sta t1
        lda #<PER_ITEM
        sec
        sbc t1
        sta per_item
        lda #>PER_ITEM
        sbc #0
        sta per_item+1
        lda #0
        sta qi
        sta correct
        sta wrong
        sta spam
        sta judged
        sta done
        sta msg_t
        sta msg_id
        sta flash_t
        lda #<TOTAL
        sta total
        lda #>TOTAL
        sta total+1
        ; fraud count: round(n × U(0.42, 0.58)) = high byte of n × (108..148) + 128
        lda #41
        jsr API_RMOD
        clc
        adc #108
        sta t0
        lda #128
        sta t1
        lda #0
        sta t2
        ldx n
:       lda t1
        clc
        adc t0
        sta t1
        bcc :+
        inc t2
:       dex
        bne :--
        ; queue: t2 fraud, n - t2 legit, department-weighted, then shuffled
        ldx #R_COUNT-1
        lda #1
:       sta avail,x
        dex
        bpl :-
        ldx #MAX_N-1
        lda #0
:       sta results,x
        dex
        bpl :-
        lda #0
        sta t3                  ; queue length
        lda t2
        sta t0
        lda n
        sec
        sbc t2
        pha
        ldx #R_LEGIT            ; fraud receipts: R_LEGIT..R_COUNT-1
        ldy #R_FRAUD
        jsr draw
        pla
        sta t0
        ldx #0
        ldy #R_LEGIT
        jsr draw
        ldx n
        dex
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda queue,x
        pha
        lda queue,y
        sta queue,x
        pla
        sta queue,y
        dex
        bne @shuf
        jsr init_sprites
        ; screen
        text 1, 0, s_name, 7
        text 29, 0, s_receipt, 7
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        jmp begin

; Weighted sampling without replacement: t0 receipts from X..X+Y-1 appended to queue (t3 = its length).
; Weight 5 for the department's own receipts, 2 for the shared ones (3 : 1.2 in the JS).
draw:
        stx dr_base
        sty dr_cnt
@pick:  lda t0
        beq @done
        lda #0                  ; sum of the weights still in the pool
        sta t1
        ldx dr_base
        ldy dr_cnt
:       lda avail,x
        beq :+
        jsr weight
        clc
        adc t1
        sta t1
:       inx
        dey
        bne :--
        lda t1
        jsr API_RMOD
        sta t1
        ldx dr_base
@walk:  lda avail,x
        beq @skip
        jsr weight
        sta t2
        lda t1
        sec
        sbc t2
        bcc @hit
        sta t1
@skip:  inx
        bne @walk               ; (always: the sum guarantees a hit)
@hit:   lda #0
        sta avail,x
        txa
        ldx t3
        sta queue,x
        inc t3
        dec t0
        jmp @pick
@done:  rts

; X = receipt -> A = its weight (X, Y kept)
weight: lda rec_hi,x
        sta sp+1
        lda rec_lo,x
        sta sp
        sty t2
        ldy #0
        lda (sp),y
        ldy t2
        and #F_DEPT
        beq :+
        lda #5
        rts
:       lda #2
        rts

init_sprites:
        ldx #0                  ; clear 4 sprite blocks, then copy the stamp parts
        txa
:       sta $e300,x
        inx
        bne :-
        ldx #STAMP_ROWS * 3 - 1
:       lda stamp_knob,x
        sta $e300,x
        lda stamp_stem,x
        sta $e340,x
        lda stamp_body,x
        sta $e380,x
        lda stamp_rubber,x
        sta $e3c0,x
        dex
        bpl :-
        ldx #7
:       txa
        and #3
        clc
        adc #STAMP_PTR
        sta SCREEN + $3f8,x
        lda spr_col,x
        sta $d027,x
        dex
        bpl :-
        lda #$ff
        sta $d01c               ; multicolour: outline $d025 black, highlight $d026 light red
        lda #0
        sta $d017
        sta $d01d
        sta $d01b
        sta $d025
        lda #10
        sta $d026
        jsr stamps_home
        lda #$ff
        sta $d015
        rts

; Both stamps on their buttons.
stamps_home:
        lda #REJ_SX
        ldx #HOME_Y
        ldy #C_REJECT
        jsr place
        lda #APP_SX
        ldx #HOME_Y
        ldy #C_APPROVE
        ; fall through

; Stamp Y (0 reject, 1 approve) at half-pixel x A, top y X.
place:  sty t0
        stx t1
        asl                     ; C = bit 8 of x
        sta t2
        lda $d010
        and stamp_keep,y
        bcc :+
        ora stamp_bits,y
:       sta $d010
        tya
        asl
        asl
        asl                     ; sprite 4 × Y -> register offset 8 × Y
        tax
        ldy #4
:       lda t2
        sta $d000,x
        lda t1
        sta $d001,x
        inx
        inx
        dey
        bne :-
        rts

; ---------------------------------------------------------------- one receipt

begin:
        lda #P_IN
        sta phase
        lda #0
        sta pt
        lda #C_NONE
        sta call
        lda per_item
        sta left
        lda per_item+1
        sta left+1
        ldx qi
        ldy queue,x
        lda rec_lo,y
        sta rp
        lda rec_hi,y
        sta rp+1
        ldy #0
        lda (rp),y
        sta flags
        jsr draw_receipt
        jsr draw_counter
        jsr draw_tally
        jsr draw_hint
        lda #0
        jsr draw_buttons
        lda per_item            ; full bar while it lands
        ldx per_item+1
        jmp timer_start

draw_counter:
        lda #7
        sta COLOR
        ldx #37
        ldy #0
        lda qi
        clc
        adc #1
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        ldx #39
        ldy #0
        lda n
        jmp API_NUM

; The paper: merchant, number, date and time, items, total, reason, submitter; a torn bottom edge.
draw_receipt:
        lda #RC_Y
        ldx #BTN_Y - RC_Y
        jsr clear_rows
        ; height = 9 + items + reason lines
        lda #S_REASON + 1
        jsr field
        ldy #0
        lda (sp),y
        beq :+
        lda #1
:       clc
        adc #11                 ; borders, merchant, number, date, 2 dashes, total, submitter, 1 item, 1 reason
        sta t3
        lda flags
        and #F_TWO
        beq :+
        inc t3
:       lda t3
        sta FILL_H
        lsr
        clc
        adc #RC_Y
        sta mid
        lda #RC_W
        sta FILL_W
        lda #1
        sta COLOR
        ldx #RC_X
        ldy #RC_Y
        jsr API_BOX
        lda t3                  ; torn edge: alternating top-left / top-right quarter blocks
        clc
        adc #RC_Y - 1
        tay
        lda #RC_X + 1
        sta t0
:       lda t0
        and #1
        clc
        adc #241
        ldx t0
        jsr kputc
        inc t0
        lda t0
        cmp #RC_X + RC_W - 1
        bne :-
        ; merchant
        lda #0
        jsr str_n
        lda #1
        sta COLOR
        lda sp
        ldx sp+1
        ldy #RC_Y + 1
        jsr API_CENTER
        ; Receipt #0nnnnn: 5 random digits, not starting with 00 (1000-99999)
        jsr buf_reset
        ldx #0
:       lda s_rno,x
        beq :+
        jsr buf_c
        inx
        bne :-
:       lda #10
        jsr API_RMOD
        sta t0
        jsr buf_digit
        lda #10
        ldx t0
        bne :+
        lda #9
:       jsr API_RMOD
        ldx t0
        bne :+
        clc
        adc #1
:       jsr buf_digit
        lda #3
        sta t0
:       lda #10
        jsr API_RMOD
        jsr buf_digit
        dec t0
        bne :-
        jsr buf_end
        lda #6
        sta COLOR
        lda #<buf
        ldx #>buf
        ldy #RC_Y + 2
        jsr API_CENTER
        ; weekday (forced or Mon-Fri), date 1-28, month; weekends in red
        jsr buf_reset
        lda flags
        and #F_DAY
        beq :+
        sec
        sbc #1
        bcs @day
:       lda #5
        jsr API_RMOD
@day:   sta t1
        asl
        adc t1
        tax
        lda day_names,x
        jsr buf_c
        lda day_names+1,x
        jsr buf_c
        lda day_names+2,x
        jsr buf_c
        lda #' '
        jsr buf_c
        lda #28
        jsr API_RMOD
        clc
        adc #1
        jsr buf_n
        lda #' '
        jsr buf_c
        lda #12
        jsr API_RMOD
        sta t0
        asl
        adc t0
        tax
        lda month_names,x
        jsr buf_c
        lda month_names+1,x
        jsr buf_c
        lda month_names+2,x
        jsr buf_c
        jsr buf_end
        ldx #1
        lda t1
        cmp #5                  ; Sat, Sun
        bcc :+
        ldx #2
:       stx COLOR
        ldx #RC_X + 1
        ldy #RC_Y + 3
        jsr API_PRINT
        ; time 8:00-21:59
        jsr buf_reset
        lda #14
        jsr API_RMOD
        clc
        adc #8
        jsr buf_n
        lda #':'
        jsr buf_c
        lda #60
        jsr API_RMOD
        jsr buf_n2
        jsr buf_end
        lda #1
        sta COLOR
        ldy #RC_Y + 3
        jsr print_right
        ; items
        lda #RC_Y + 4
        sta row
        jsr dashes
        lda #1
        sta t1                  ; string index of the item text
@item:  lda #1
        sta COLOR
        lda t1
        jsr str_n
        jsr sp_ptr
        ldx #RC_X + 1
        ldy row
        jsr API_PRINT
        lda t1
        clc
        adc #1
        jsr str_n
        jsr sp_ptr
        ldy row
        jsr print_right
        inc row
        lda t1
        cmp #3
        beq :+
        lda flags
        and #F_TWO
        beq :+
        lda #3
        sta t1
        bne @item
:       jsr dashes
        ; total
        lda #1
        sta COLOR
        lda #<s_total
        sta PTR
        lda #>s_total
        sta PTR+1
        ldx #RC_X + 1
        ldy row
        jsr API_PRINT
        lda #S_TOTAL
        jsr field
        jsr sp_ptr
        ldy row
        jsr print_right
        inc row
        ; reason (1-2 lines) and the submitter, in pen colour
        lda #S_REASON
        sta t1
@reason:
        lda t1
        jsr field
        ldy #0
        lda (sp),y
        beq :+
        lda #3
        sta COLOR
        jsr sp_ptr
        ldx #RC_X + 1
        ldy row
        jsr API_PRINT
        inc row
:       inc t1
        lda t1
        cmp #S_REASON + 2
        bne @reason
        lda #SUB_COUNT
        jsr API_RMOD
        tax
        lda sub_lo,x
        sta PTR
        lda sub_hi,x
        sta PTR+1
        lda #3
        sta COLOR
        ldy row
        ; fall through

; PTR = string, Y = row, COLOR: printed so that it ends at the receipt's right margin.
print_right:
        sty t2
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #RC_RIGHT
        tax
        ldy t2
        jmp API_PRINT

; A dashed line across the receipt on `row`, then row + 1.
dashes:
        lda #6
        sta COLOR
        lda #<s_dashes
        sta PTR
        lda #>s_dashes
        sta PTR+1
        ldx #RC_X + 1
        ldy row
        jsr API_PRINT
        inc row
        rts

; A = string index after the flags (0 merchant, 1-4 items) -> sp
str_n:
        sta t0
        lda rp
        clc
        adc #1
        sta sp
        lda rp+1
        adc #0
        sta sp+1
@skip:  lda t0
        beq @done
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
:       dec t0
        jmp @skip
@done:  rts

; A = S_TOTAL.. -> sp (2 strings later when the receipt has a second item)
field:
        tax
        lda flags
        and #F_TWO
        beq :+
        inx
        inx
:       txa
        jmp str_n

sp_ptr: lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        rts

; ---- a small string builder for the generated lines
buf_reset:
        lda #0
        sta bufi
        rts
buf_c:  stx t3
        ldx bufi
        sta buf,x
        inc bufi
        ldx t3
        rts
buf_digit:
        ora #'0'
        jmp buf_c
; A = 0..99 without a leading zero
buf_n:  cmp #10
        bcc buf_digit
; A = 0..99 as two digits
buf_n2: ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        jsr buf_digit
        pla
        jmp buf_digit
buf_end:
        lda #0
        jsr buf_c
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        rts

; Past calls green / red, the current one yellow, the rest open.
draw_tally:
        lda n
        lsr
        eor #$ff
        sec
        adc #20
        sta t1                  ; first column
        ldx #0
@k:     stx t0
        lda #CH_PIP
        ldy results,x
        beq @open
        lda res_col-1,y
        bne @col
@open:  cpx qi
        bne :+
        lda #7
        bne @col
:       lda #CH_PIPOFF
        sta t2
        lda #6
        bne @put
@col:   ldy #CH_PIP
        sty t2
@put:   sta COLOR
        lda t0
        clc
        adc t1
        tax
        ldy #TALLY_Y
        lda t2
        jsr API_PUTC
        ldx t0
        inx
        cpx n
        bne @k
        rts

; A = 0 locked, 1 active: button frames and key lines dim while locked.
draw_buttons:
        tay
        lda btn_col,y
        sta t3
        ldy #1
@b:     sty t2
        lda t3
        sta COLOR
        lda #BTN_W
        sta FILL_W
        lda #BTN_H
        sta FILL_H
        ldx btn_x,y
        ldy #BTN_Y
        jsr API_BOX
        ldy t2
        lda btn_lcol,y
        sta COLOR
        lda btn_lab_lo,y
        sta PTR
        lda btn_lab_hi,y
        sta PTR+1
        ldx btn_lab_x,y
        ldy #BTN_Y + 3
        jsr API_PRINT
        ldy t2
        lda #1
        ldx t3
        cpx #1
        beq :+
        lda #6
:       sta COLOR
        lda btn_key_lo,y
        sta PTR
        lda btn_key_hi,y
        sta PTR+1
        ldx btn_key_x,y
        ldy #BTN_Y + 4
        jsr API_PRINT
        ldy t2
        dey
        bpl @b
        rts

; The rules under the desk while no verdict is up.
draw_hint:
        lda #VERD_Y
        ldx #3
        jsr clear_rows
        center VERD_Y + 1, s_hint1, 1
        center VERD_Y + 2, s_hint2, 1
        rts

; A/X = message, Y = colour: in the slot between the buttons for a second.
message:
        sty t0
        pha
        txa
        pha
        lda #14
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #13
        ldy #MSG_Y
        jsr API_FILL
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #MSG_Y
        jsr API_CENTER
        lda #MSG_T
        sta msg_t
        lda #0
        sta msg_id
        rts

; ---------------------------------------------------------------- per frame

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
        lda #<s_blank
        ldx #>s_blank
        ldy #0
        jsr message
        lda #0
        sta msg_t
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       lda total               ; the safety cap: anything unjudged counts as wrong
        bne :+
        dec total+1
:       dec total
        lda total
        ora total+1
        bne :+
        lda n
        sec
        sbc judged
        clc
        adc wrong
        sta wrong
        jmp finish
:       inc pt
        bne :+
        dec pt
:       ; the stick: left = reject, right = approve
        ldx #C_NONE
        lda JOYP
        and #J_LEFT
        beq :+
        ldx #C_REJECT
:       lda JOYP
        and #J_RIGHT
        beq :+
        ldx #C_APPROVE
:       stx want
        txa
        bmi @free
        lda phase               ; locked while it lands and for READ_T after
        beq @mash
        cmp #P_DECIDE
        bne @free
        lda pt
        cmp #READ_T
        bcs @free
@mash:  inc spam
        lda #C_NONE
        sta want
        lda #SFX_BLIP
        jsr API_SFX
        lda msg_t
        beq :+
        lda msg_id
        cmp #1
        beq @free
:       lda #<s_read
        ldx #>s_read
        ldy #7
        jsr message
        lda #1
        sta msg_id
@free:  lda phase
        beq @in
        cmp #P_DECIDE
        beq @decide
        cmp #P_STAMP
        bne :+
        jmp stamp_frame
:       jmp result_frame
@in:    lda pt
        cmp #IN_T
        bcc @out
        lda #P_DECIDE
        sta phase
        lda #0
        sta pt
@out:   clc
        rts
@decide:
        lda pt
        cmp #READ_T
        bne :+
        lda #1
        jsr draw_buttons
:       jsr timer_tick
.if .defined(AUTOPLAY)
        lda pt                  ; perfect player: stamps a moment after they unlock
        cmp #READ_T + 3
        bne :+
        ldx #C_APPROVE
        lda flags
        bpl @bot
        ldx #C_REJECT
@bot:   stx want
:
.endif
        lda want
        bmi :+
        jmp decide
:       lda left
        bne :+
        dec left+1
:       dec left
        lda left
        ora left+1
        bne @out
        jmp judge

; A = the call: the stamp leaves its button.
decide:
        sta call
        lda #P_STAMP
        sta phase
        lda #0
        sta pt
        lda #SFX_BLIP
        jsr API_SFX
        lda #0
        jsr draw_buttons
        lda #0
        jsr API_BAR
        clc
        rts

; The stamp flies to the receipt in FLY_T frames (hovering LIFT px up), the ink appears, then the verdict.
stamp_frame:
        lda pt
        cmp #STAMP_T
        bcc :+
        jmp judge
:       cmp #FLY_T + 1
        bcs @out
        ldx call
        lda home_sx,x
        sta t0
        lda #RC_SX
        sta t1
        jsr lerp
        sta sx
        lda #HOME_Y
        sta t0
        lda mid                 ; land with the rubber just above the ink box
        asl
        asl
        asl
        clc
        adc #50 - 8 - STAMP_ROWS - 2
        sta t1
        jsr lerp
        ldx pt
        cpx #FLY_T
        beq :+
        sec
        sbc #LIFT
:       sta sy
        tax
        lda sx
        ldy call
        jsr place
        lda pt
        cmp #FLY_T
        bne @out
        ldx call
        jsr draw_ink
        lda #SFX_BLIP
        jsr API_SFX
@out:   clc
        rts

; t0 -> t1 at step pt of FLY_T: A = t0 + (t1 - t0) × pt / FLY_T
lerp:   ldx pt
        cpx #FLY_T
        bcc :+
        lda t1
        rts
:       lda frac,x
        sta t3
        lda t1
        sec
        sbc t0
        php
        bcs :+
        eor #$ff
        adc #1
:       jsr mul8                ; A = |delta| × frac / 256
        plp
        bcc :+
        clc
        adc t0
        rts
:       sta t2
        lda t0
        sec
        sbc t2
        rts

; A × t3 / 256 -> A
mul8:   sta t2
        lda #0
        ldx #8
:       lsr t2
        bcc :+
        clc
        adc t3
:       ror
        dex
        bne :--
        rts

; X = C_REJECT / C_APPROVE / C_NONE (expired): the ink box on the receipt's middle.
draw_ink:
        inx                     ; 0 expired, 1 rejected, 2 approved
        stx t0
        lda ink_col,x
        sta COLOR
        lda #INK_W
        sta FILL_W
        lda #3
        sta FILL_H
        lda #' '                ; clear under it first
        ldx #INK_X
        ldy mid
        dey
        jsr API_FILL
        ldx #INK_X
        ldy mid
        dey
        jsr API_BOX
        ldy t0
        lda ink_hi,y
        tax
        lda ink_lo,y
        ldy mid
        jmp API_CENTER

; Right or wrong: tally, verdict, sound; the stamp goes home.
judge:
        ldy #0                  ; ok = a call was made and REJECT == fraud
        lda call
        bmi @set
        lda flags
        rol                     ; C = fraud
        lda #0
        rol                     ; 1 fraud
        eor call                ; reject (0) on fraud (1) -> 1
        tay
@set:   sty ok
        ldx judged
        lda #1
        cpy #0
        bne :+
        lda #2
:       sta results,x
        inc judged
        lda call
        bpl :+
        ldx #C_NONE
        jsr draw_ink            ; EXPIRED
:       jsr stamps_home
        lda ok
        beq @wrong
        inc correct
        lda #SFX_GOOD
        jsr API_SFX
        lda flags
        bpl :+
        lda #<s_caught
        ldx #>s_caught
        bne :++
:       lda #<s_approved
        ldx #>s_approved
:       ldy #5
        jsr message
        lda #RIGHT_COUNT
        jsr API_RMOD
        tax
        lda rl_lo,x
        ldy rl_hi,x
        jmp @head
@wrong: inc wrong
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #FLASH_T
        sta flash_t
        lda call
        bpl :+
        lda #<s_timeup
        ldy #>s_timeup
        bne @head
:       lda #WRONG_COUNT
        jsr API_RMOD
        tax
        lda wl_lo,x
        ldy wl_hi,x
@head:  sta sp                  ; verdict: head + "It was FRAUD." / "It was legit.", then the tell
        sty sp+1
        jsr buf_reset
        ldy #0
:       lda (sp),y
        beq :+
        jsr buf_c
        iny
        bne :-
:       lda #<s_fraud
        ldx #>s_fraud
        bit flags
        bmi :+
        lda #<s_legit
        ldx #>s_legit
:       sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        jsr buf_c
        iny
        cmp #0
        bne :-
        lda #VERD_Y
        ldx #3
        jsr clear_rows
        ldx #5
        lda ok
        bne :+
        ldx #2
:       stx COLOR
        lda #<buf
        ldx #>buf
        ldy #VERD_Y
        jsr API_CENTER
        lda #S_TELL
        sta t1
@tell:  lda t1
        jsr field
        lda #1
        sta COLOR
        lda t1
        clc
        adc #VERD_Y + 1 - S_TELL
        tay
        lda sp
        ldx sp+1
        jsr API_CENTER
        inc t1
        lda t1
        cmp #S_TELL + 2
        bne @tell
        jsr draw_tally
        lda #P_RESULT
        sta phase
        lda #0
        sta pt
        clc
        rts

result_frame:
        ldx #HOLD_OK
        lda ok
        bne :+
        ldx #HOLD_BAD
        lda call
        bpl :+
        ldx #HOLD_LATE
:       cpx pt
        beq @next
        bcc @next
        lda pt
        cmp #SKIP_T
        bcc @out
.if .defined(AUTOPLAY)
        lda #J_FIRE
        sta JOYP
.endif
        lda JOYP
        and #J_FIRE
        beq @out
@next:  inc qi
        lda qi
        cmp n
        bcs finish
        jsr begin
@out:   clc
        rts

; score = (2 × correct - wrong) × 255 / (2 × n) - 10 × spam, clamped to 0..255
finish:
        lda #0
        sta MG_SCORE
        lda correct
        asl
        sec
        sbc wrong
        bcc @store              ; negative
        beq @store
        sta t0
        lda #0                  ; t1:t2 = t0 × 255 = t0 × 256 - t0
        sec
        sbc t0
        sta t1
        lda t0
        sbc #0
        sta t2
        lda n
        asl
        sta t3
        ldx #0                  ; divide by 2n
@div:   lda t1
        sec
        sbc t3
        tay
        lda t2
        sbc #0
        bcc @q
        sta t2
        sty t1
        inx
        bne @div
        dex                     ; (255 × 2n / 2n would wrap: cap)
@q:     stx MG_SCORE
        ldx spam
        beq @store
:       lda MG_SCORE
        sec
        sbc #SPAM_PEN
        bcs :+
        lda #0
:       sta MG_SCORE
        dex
        bne :--
@store: lda #1
        sta done
        sec
        rts

.rodata
s_name:     .byte "Expense Fraud Detective", 0
s_help:     .byte "APPROVE the legit receipts, REJECT the fraud.", 0
s_receipt:  .byte "Receipt", 0
s_keys:     .byte "Left = reject    Right = approve", 0
s_hint1:    .byte "Legit = APPROVE, fraud = REJECT.", 0
s_hint2:    .byte "Check the date, amounts and reason.", 0
s_rno:      .byte "Receipt #0", 0
s_total:    .byte "TOTAL", 0
s_dashes:   .byte "- - - - - - - - - - - - - - ", 0
s_read:     .byte "Read it first!", 0
s_caught:   .byte "Fraud caught!", 0
s_approved: .byte "Approved", 0
s_blank:    .byte 0
s_timeup:   .byte "Time's up!", 0
s_fraud:    .byte " It was FRAUD.", 0
s_legit:    .byte " It was legit.", 0
s_rej:      .byte "REJECT", 0
s_app:      .byte "APPROVE", 0
s_rejkey:   .byte "< Left", 0
s_appkey:   .byte "Right >", 0
s_expired:  .byte "EXPIRED", 0
s_rejected: .byte "REJECTED", 0
s_approved2: .byte "APPROVED", 0
ink_lo:     .byte <s_expired, <s_rejected, <s_approved2
ink_hi:     .byte >s_expired, >s_rejected, >s_approved2
ink_col:    .byte 4, 2, 5
res_col:    .byte 5, 2          ; tally: right, wrong
btn_col:    .byte 6, 1          ; frames: locked, active
btn_x:      .byte REJ_X, APP_X
btn_lcol:   .byte 2, 5
btn_lab_lo: .byte <s_rej, <s_app
btn_lab_hi: .byte >s_rej, >s_app
btn_lab_x:  .byte REJ_X + 3, APP_X + 3
btn_key_lo: .byte <s_rejkey, <s_appkey
btn_key_hi: .byte >s_rejkey, >s_appkey
btn_key_x:  .byte REJ_X + 3, APP_X + 3
home_sx:    .byte REJ_SX, APP_SX
stamp_bits: .byte $0f, $f0
stamp_keep: .byte $f0, $0f
spr_col:    .byte 2, 12, 9, 2,  2, 12, 9, 5     ; knob, stem, handle, rubber (red / green)
frac:       .repeat FLY_T, I
            .byte I * 256 / FLY_T
            .endrepeat

.include "gen/mg_expense_data.s"

.bss
queue:      .res MAX_N
results:    .res MAX_N           ; 0 open, 1 right, 2 wrong
avail:      .res R_COUNT
buf:        .res 40
dr_base:    .res 1
dr_cnt:     .res 1
