; Coffee Run (src/minigames/coffee.js) as a disk-loaded overlay at $4000.
; Memorise the colleagues' coffee orders, then rebuild each one from memory, part by part, out of 4 choices.
; Difficulty 0 (floors 1-2): 2 orders (a colleague and the department boss) of 2 parts (size, drink); 7.1 s to
; memorise (FIRE skips), 23 s to rebuild. Score = correct parts / 4. Content: gen/mg_coffee_data.s.

.include "api.inc"
.include "gen/chars.inc"

ORDERS   = 2                    ; round(byDiff(d, 2, 4))
PARTS    = 2                    ; size, drink
TOTAL    = ORDERS * PARTS
CHOICES  = 4
MEMO_T   = 355                  ; count × comps × 1.4 s + 1.5 s
BUILD_T  = 23 * 50              ; min(70, count × comps × 4.5 + 5) s
FLASH_T  = 15                   ; 0.3 s: the picked box shows right / wrong
NEXT_T   = 40                   ; 0.8 s between orders
MSG_T    = 45                   ; floaters last 0.9 s

; memo screen: one card per order
CARD_W   = 15
CARD_Y   = 5
CARD_H   = 8 + PARTS * 2
; build screen: customer panel on the left, choices on the right
PANEL_W  = 16
RX       = PANEL_W + 1          ; left edge of the right side
RW       = 40 - RX
TAB_W    = (RW - 1) / PARTS     ; part tabs
OPT_Y    = 10                   ; first choice box row
CUP_X    = 6
CUP_BOT  = 21                   ; the cup's bottom row
LIST_Y   = 13                   ; "+ Venti" lines
MSG_L    = 11                   ; "Perfect cup!" row (panel)
MSG_R    = 22                   ; "They wanted ..." row (right side)

.zeropage
phase:    .res 1                ; 0 memorise, 1 rebuild
oi:       .res 1                ; order index
pbase:    .res 1                ; oi × PARTS
pi:       .res 1                ; part index
correct:  .res 1
focus:    .res 1
flash_t:  .res 1
flash_i:  .res 1
flash_ok: .res 1
next_t:   .res 1
msgl_t:   .res 1
msgr_t:   .res 1
last_key: .res 1
done:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
row:      .res 1
cx:       .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup

init:
        lda #0
        sta phase
        sta oi
        sta pbase
        sta pi
        sta correct
        sta focus
        sta flash_t
        sta next_t
        sta msgl_t
        sta msgr_t
        sta done
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        lda #$ff
        sta last_key
        ; names: ORDERS-1 distinct colleagues (partial Fisher-Yates), the last order is the boss's
        ldx #N_COUNT-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
@pick:  stx t0
        lda #N_COUNT
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda pool,y
        pha
        lda pool,x
        sta pool,y
        pla
        sta pool,x
        tay
        lda nm_lo,y
        sta name_lo,x
        lda nm_hi,y
        sta name_hi,x
        inx
        cpx #ORDERS-1
        bne @pick
        lda #<s_boss
        sta name_lo,x
        lda #>s_boss
        sta name_hi,x
        ; each order: a hair colour and a random option per part
        ldx #0
@ord:   stx t0
        jsr API_RAND
        and #7
        tay
        lda hair_tab,y
        ldx t0
        sta hair,x
        lda pick_base,x
        sta t1
        lda #0
        sta t2                  ; part
@part:  ldx t2
        lda part_count,x
        jsr API_RMOD
        ldx t2
        clc
        adc part_first,x
        ldx t1
        sta picks,x
        inc t1
        inc t2
        lda t2
        cmp #PARTS
        bne @part
        ldx t0
        inx
        cpx #ORDERS
        bne @ord
        jmp draw_memo

; ---- memorise phase

draw_memo:
        text 1, 0, s_name, 7
        text 32, 0, s_memo, 7
        center 3, s_remember, 7
        lda #0
        sta t2
@card:  ldx t2
        lda card_x,x
        sta cx
        lda #1
        sta COLOR
        lda #CARD_W
        sta FILL_W
        lda #CARD_H
        sta FILL_H
        ldx cx
        ldy #CARD_Y
        jsr API_BOX
        lda cx                  ; face in the middle
        clc
        adc #CARD_W/2 - 1
        tax
        ldy #CARD_Y+1
        lda t2
        jsr order_face
        ldx t2                  ; name
        lda name_lo,x
        sta PTR
        lda name_hi,x
        sta PTR+1
        lda #1
        sta COLOR
        lda cx
        ldx #CARD_W
        ldy #CARD_Y+4
        jsr print_in
        lda #6                  ; rule
        sta COLOR
        lda #CARD_W-4
        sta FILL_W
        lda #1
        sta FILL_H
        lda cx
        clc
        adc #2
        tax
        ldy #CARD_Y+5
        lda #CH_B
        jsr API_FILL
        ; "Size:" / value lines
        ldx t2
        lda pick_base,x
        sta t1
        lda #0
        sta t0
@line:  lda t0
        asl
        adc #CARD_Y+6
        sta row
        lda #3
        sta COLOR
        ldx t0
        lda part_lo,x
        sta PTR
        lda part_hi,x
        sta PTR+1
        jsr print_label
        inc row
        ldx t1
        lda picks,x
        jsr opt_ptr
        lda #1
        sta COLOR
        ldx cx
        inx
        inx
        ldy row
        jsr API_PRINT
        inc t1
        inc t0
        lda t0
        cmp #PARTS
        bne @line
        inc t2
        lda t2
        cmp #ORDERS
        beq :+
        jmp @card
:       lda #<s_ready
        ldx #>s_ready
        jsr footer
        lda #<MEMO_T
        ldx #>MEMO_T
        jmp timer_start

; PTR = part name, at column cx+2 on row `row`, followed by ':'.
print_label:
        ldx cx
        inx
        inx
        ldy row
        jsr API_PRINT
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc cx
        adc #2
        tax
        ldy row
        lda #':'
        jmp API_PUTC

; ---- rebuild phase

start_build:
        lda #1
        sta phase
        lda #2
        ldx #22
        jsr clear_rows
        lda #24
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #16
        ldy #0
        lda #' '
        jsr API_FILL            ; "MEMORISE" off
        lda #1
        sta COLOR
        lda #PANEL_W
        sta FILL_W
        lda #20
        sta FILL_H
        ldx #0
        ldy #3
        jsr API_BOX
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<BUILD_T
        ldx #>BUILD_T
        jsr timer_start
        ; fall through

; Draw order oi: the customer, an empty cup, the part tabs and the first choices.
new_order:
        lda #0
        sta pi
        lda #12                 ; order counter
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #28
        ldy #0
        jsr API_FILL
        text 31, 0, s_order, 7
        lda #7
        sta COLOR
        lda oi
        clc
        adc #1
        ldx #37
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        lda #ORDERS
        ldx #39
        ldy #0
        jsr API_NUM
        ; panel interior
        lda #PANEL_W-2
        sta FILL_W
        lda #18
        sta FILL_H
        lda #' '
        ldx #1
        ldy #4
        jsr API_FILL
        lda #PANEL_W/2 - 1
        tax
        ldy #5
        lda oi
        jsr order_face
        ldx oi
        lda name_lo,x
        sta PTR
        lda name_hi,x
        sta PTR+1
        lda #1
        sta COLOR
        lda #0
        ldx #PANEL_W
        ldy #8
        jsr print_in
        lda #3
        sta COLOR
        lda #<s_usual1
        sta PTR
        lda #>s_usual1
        sta PTR+1
        lda #0
        ldx #PANEL_W
        ldy #9
        jsr print_in
        lda #<s_usual2
        sta PTR
        lda #>s_usual2
        sta PTR+1
        lda #0
        ldx #PANEL_W
        ldy #10
        jsr print_in
        jsr draw_cup
        jsr draw_correct
        jsr make_choices
        jmp draw_part

; Tabs, "Pick the ...:" and the 4 choice boxes for part pi.
draw_part:
        jsr draw_tabs
        lda #RW
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #RX
        ldy #OPT_Y-1
        jsr API_FILL
        text RX, OPT_Y-1, s_pick, 7
        lda #7
        sta COLOR
        ldx pi
        lda part_lo,x
        sta PTR
        lda part_hi,x
        sta PTR+1
        ldx #RX+9
        ldy #OPT_Y-1
        jsr API_PRINT
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #RX+9
        tax
        ldy #OPT_Y-1
        lda #':'
        jsr API_PUTC
        ; fall through

draw_choices:
        lda #0
        sta t2
@o:     ldx t2                  ; frame: flash green / red, focus yellow, idle blue
        lda #6
        cpx focus
        bne :+
        lda #7
:       ldy flash_t
        beq @col
        cpx flash_i
        bne @col
        lda #5
        ldy flash_ok
        bne @col
        lda #2
@col:   sta COLOR
        lda #RW
        sta FILL_W
        lda #3
        sta FILL_H
        lda t2
        asl
        adc t2
        adc #OPT_Y
        sta row
        tay
        ldx #RX
        jsr API_BOX
        inc row
        lda t2
        clc
        adc #'1'
        ldx #RX+2
        ldy row
        jsr API_PUTC
        lda #RW - 5             ; clear the old text
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #RX+4
        ldy row
        jsr API_FILL
        ldx t2
        lda choices,x
        jsr opt_ptr
        lda #1
        sta COLOR
        ldx #RX+4
        ldy row
        jsr API_PRINT
        inc t2
        lda t2
        cmp #CHOICES
        bne @o
        rts

; Part tabs: done green, current cyan, to do blue.
draw_tabs:
        lda #0
        sta t2
@t:     ldx t2
        lda #5
        cpx pi
        bcc :+
        lda #3
        cpx pi
        beq :+
        lda #6
:       sta COLOR
        lda tab_x,x
        sta cx
        lda #TAB_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldx cx
        ldy #3
        jsr API_BOX
        lda #1
        sta COLOR
        ldx t2
        lda part_lo,x
        sta PTR
        lda part_hi,x
        sta PTR+1
        lda cx
        ldx #TAB_W
        ldy #4
        jsr print_in
        inc t2
        lda t2
        cmp #PARTS
        bne @t
        rts

draw_correct:
        text RX+12, 7, s_correct, 7
        lda #7
        sta COLOR
        lda correct
        ldx #RX+20
        ldy #7
        jsr API_NUM
        lda #'/'
        ldx #RX+21
        ldy #7
        jsr API_PUTC
        lda #TOTAL
        ldx #RX+22
        ldy #7
        jmp API_NUM

; The cup: as tall as the size picked (default before), blue band in the middle third, dark lid.
draw_cup:
        lda #PANEL_W-2
        sta FILL_W
        lda #CUP_BOT - LIST_Y - PARTS + 1
        sta FILL_H
        lda #' '
        ldx #1
        ldy #LIST_Y + PARTS
        jsr API_FILL
        lda #CUP_DEFAULT
        ldx pi
        beq :+
        ldx built                ; part 0 is the size (its options come first)
        lda cup_rows,x
:       sta t0                  ; height in rows
        lda #CUP_BOT+1
        sec
        sbc t0
        sta row                 ; top row
        lda #3
        sta FILL_W
        lda t0
        sta FILL_H
        lda #1
        sta COLOR
        lda #CH_BLOCK
        ldx #CUP_X
        ldy row
        jsr API_FILL
        ldx t0                  ; band: the middle third
        lda band_h,x
        sta FILL_H
        lda #6
        sta COLOR
        lda row
        clc
        adc band_top,x
        tay
        lda #CH_BLOCK
        ldx #CUP_X
        jsr API_FILL
        lda #8                  ; lid: multicolour, all dark grey
        sta COLOR
        lda #1
        sta FILL_H
        ldy row
        dey
        lda #MC_A
        ldx #CUP_X
        jmp API_FILL

; ---- choices

; choices = the right option and 3 other options of part pi, shuffled.
make_choices:
        jsr right_opt
        sta choices
        ldx pi                  ; pool = the part's other options
        lda part_first,x
        sta t0
        clc
        adc part_count,x
        sta t1                  ; end
        ldy #0
        ldx t0
:       cpx choices
        beq :+
        txa
        sta pool,y
        iny
:       inx
        cpx t1
        bne :--
        sty t2                  ; pool size
        ldx #1
@pick:  stx t0                  ; choices[x] = a random pool entry, swapped out of the way
        lda t2
        jsr API_RMOD
        tay
        lda pool,y
        ldx t0
        sta choices,x
        dec t2
        ldx t2
        lda pool,x
        sta pool,y
        ldx t0
        inx
        cpx #CHOICES
        bne @pick
        ldx #CHOICES-1          ; shuffle
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda choices,x
        pha
        lda choices,y
        sta choices,x
        pla
        sta choices,y
        dex
        bne @shuf
        lda #0
        sta focus
        rts

; A = the option order oi wants for part pi.
right_opt:
        lda pbase
        clc
        adc pi
        tax
        lda picks,x
        rts

; A = choice index 0..3.
choose:
        sta flash_i
        jsr right_opt
        sta t1
        ldx flash_i
        lda choices,x
        ldx pi
        sta built,x
        cmp t1
        bne @wrong
        lda #1
        sta flash_ok
        inc correct
        lda #5
        ldx #'+'
        bne @list
@wrong: lda #0
        sta flash_ok
        lda #MSG_T              ; "They wanted ..."
        sta msgr_t
        jsr clear_msgr
        text RX, MSG_R, s_wanted, 2
        jsr right_opt
        jsr opt_ptr
        ldx #RX+12
        ldy #MSG_R
        jsr API_PRINT
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        ldx #'x'
@list:  sta COLOR               ; "+ Venti" / "x Tall" in the panel
        txa
        pha
        lda pi
        clc
        adc #LIST_Y
        sta row
        tay
        pla
        ldx #2
        jsr API_PUTC
        ldx pi
        lda built,x
        jsr opt_ptr
        ldx #4
        ldy row
        jsr API_PRINT
        lda flash_ok
        beq :+
        lda #SFX_GOOD
        jsr API_SFX
:       lda #FLASH_T
        sta flash_t
        inc pi
        jsr draw_cup
        jsr draw_correct
        lda pi
        cmp #PARTS
        beq @order
        jsr make_choices
        jmp draw_part
@order: jsr draw_tabs           ; order complete: hide the choices for 0.8 s
        lda #RW
        sta FILL_W
        lda #OPT_Y + CHOICES*3 - (OPT_Y-1)
        sta FILL_H
        lda #' '
        ldx #RX
        ldy #OPT_Y-1
        jsr API_FILL
        lda #NEXT_T
        sta next_t
        lda #MSG_T
        sta msgl_t
        ldx #PARTS-1            ; all parts right?
:       lda built,x
        sta t0
        txa
        clc
        adc pbase
        tay
        lda picks,y
        cmp t0
        bne :+
        dex
        bpl :-
        lda #5
        sta COLOR
        lda #<s_perfect
        sta PTR
        lda #>s_perfect
        sta PTR+1
        bne @msg
:       lda #7
        sta COLOR
        lda #<s_close
        sta PTR
        lda #>s_close
        sta PTR+1
@msg:   lda #0
        ldx #PANEL_W
        ldy #MSG_L
        jmp print_in

clear_msgr:
        lda #RW
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #RX
        ldy #MSG_R
        jmp API_FILL

; ---- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda phase
        bne @build
        jsr timer_tick
        bcs @go
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #50
        beq @go
.endif
        lda JOYP
        and #J_FIRE
        beq @out
@go:    jsr start_build
@out:   clc
        rts

@build: lda msgl_t              ; floaters fade
        beq :+
        dec msgl_t
        bne :+
        lda #PANEL_W-2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #1
        ldy #MSG_L
        jsr API_FILL
:       lda msgr_t
        beq :+
        dec msgr_t
        bne :+
        jsr clear_msgr
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda next_t
        bne :+
        jsr draw_choices
:       jsr timer_tick
        bcc :+
        jmp finish
:       lda next_t
        beq @play
        dec next_t
        bne @out
        inc oi
        lda pbase
        clc
        adc #PARTS
        sta pbase
        lda oi
        cmp #ORDERS
        bne :+
        jmp finish
:       jsr new_order
        clc
        rts

@play:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        and #31
        bne :++
        jsr right_opt           ; perfect player: every 32 frames pick the right box
        ldx #CHOICES-1
:       cmp choices,x
        beq @bot
        dex
        bpl :-
:
.endif
        jsr number_key          ; keys 1-4, on the press only
        cmp last_key
        beq @joy
        sta last_key
        cmp #CHOICES
        bcs @joy
@pick:  jsr choose
        clc
        rts
.if .defined(AUTOPLAY)
@bot:   txa
        jmp @pick
.endif
@joy:   lda focus
        sta t0
        lda JOYP
        and #J_DOWN
        beq :+
        inc focus
        lda focus
        cmp #CHOICES
        bcc @moved
        lda #0
        sta focus
        beq @moved
:       lda JOYP
        and #J_UP
        beq :+
        dec focus
        bpl @moved
        lda #CHOICES-1
        sta focus
        bne @moved
:       lda JOYP
        and #J_FIRE
        beq @none
        lda focus
        jmp @pick
@moved: lda #SFX_BLIP
        jsr API_SFX
        jsr draw_choices
@none:  clc
        rts

; score = correct × 255 / TOTAL
finish:
        ldx correct
        lda score_tab,x
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; ---- helpers

; A = order: its face at X, Y.
order_face:
        stx t0
        tax
        lda hair,x
        ldx t0
        jmp face

; A = option index -> PTR.
opt_ptr:
        tax
        lda opt_lo,x
        sta PTR
        lda opt_hi,x
        sta PTR+1
        rts

; PTR centred in the A-based region of X columns on row Y, in COLOR.
print_in:
        sta t0
        stx t1
        sty row
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc t1
        lsr
        clc
        adc t0
        tax
        ldy row
        jmp API_PRINT

.rodata
s_name:     .byte "Coffee Run", 0
s_help:     .byte "Memorise every order, then rebuild each one.", 0
s_memo:     .byte "MEMORISE", 0
s_remember: .byte "Remember these orders!", 0
s_ready:    .byte "FIRE when ready", 0
s_keys:     .byte "Up/down + FIRE, or keys 1-4", 0
s_order:    .byte "Order", 0
s_usual1:   .byte 34, "The usual,", 0
s_usual2:   .byte "please.", 34, 0
s_pick:     .byte "Pick the", 0
s_correct:  .byte "Correct", 0
s_wanted:   .byte "They wanted", 0
s_perfect:  .byte "Perfect cup!", 0
s_close:    .byte "Close enough?", 0
card_x:     .byte 20 - CARD_W - 1, 21    ; (ORDERS = 2)
pick_base:  .repeat ORDERS, i   ; first picks entry per order
            .byte i * PARTS
            .endrep
tab_x:      .byte RX, RX + TAB_W + 1
hair_tab:   .byte 2, 7, 1, 4, 3, 5, 2, 1
score_tab:  .byte 0, 64, 128, 191, 255
; cup band by height in rows (0-6): from row h/3, round(h/3) rows (at least 1)
band_top:   .byte 0, 0, 0, 1, 1, 1, 2
band_h:     .byte 1, 1, 1, 1, 1, 2, 2

.include "gen/mg_coffee_data.s"

.bss
pool:    .res N_COUNT
name_lo: .res ORDERS
name_hi: .res ORDERS
hair:    .res ORDERS
picks:   .res TOTAL             ; option per order and part
choices: .res CHOICES
built:   .res PARTS
