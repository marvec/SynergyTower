; Coffee Run (src/minigames/coffee.js) as a disk-loaded overlay at $4000.
; Memorise the colleagues' coffee orders, then rebuild each one from memory, part by part, out of 4 choices.
; The last order is always the department boss's.
; Difficulty curve (d = MG_DIFF / 255; orders = parts = round(byDiff(d, 2, 4))):
;   d = 0: 2 orders of 2 parts (size, drink); 7.1 s to memorise (FIRE skips), 23 s to rebuild
;   d = 1: 4 orders of 4 parts (+ milk, extra); 14.3 s to memorise, 46.6 s to rebuild
;   memorise: orders × parts × byDiff(d, 1.4, 0.8) + 1.5 s; rebuild: min(70, orders × parts × byDiff(d, 4.5, 2.6) + 5) s
; Score = correct parts / all parts. Content: gen/mg_coffee_data.s.
; Differs from the JS: the order cards are a 2 × 2 grid with one line per part, the part tabs are coloured words.

.include "api.inc"
.include "gen/chars.inc"

MAX_C    = 4                    ; orders = parts per order
CHOICES  = 4
MEMO_F   = 75                   ; memorise: + 1.5 s
MEMO_P   = 70                   ; frames per part at d = 0 (1.4 s), minus 0.6 s × d
BUILD_F  = 250                  ; rebuild: + 5 s
BUILD_P  = 225                  ; frames per part at d = 0 (4.5 s), minus 1.9 s × d
BUILD_MAX = 70 * 50
FLASH_T  = 15                   ; 0.3 s: the picked box shows right / wrong
NEXT_T   = 40                   ; 0.8 s between orders
MSG_T    = 45                   ; floaters last 0.9 s

; memo screen: one card per order, 20 × (parts + 6)
CARD_W   = 20
; build screen: customer panel on the left, choices on the right
PANEL_W  = 16
RX       = PANEL_W + 1          ; left edge of the right side
RW       = 40 - RX
TAB_Y    = 4                    ; part names
CORR_Y   = 7                    ; "Correct n/N"
OPT_Y    = 10                   ; first choice box row
CUP_X    = 6
CUP_BOT  = 21                   ; the cup's bottom row
NAME_Y   = 6                    ; customer panel: face rows 4-5, name, "The usual, please."
MSG_L    = 9                    ; "Perfect cup!" row (panel)
LIST_Y   = 11                   ; "+ Venti" lines
MSG_R    = 23                   ; "They wanted ..." row

.zeropage
c:        .res 1                ; orders = parts
total:    .res 1                ; c × c
phase:    .res 1                ; 0 memorise, 1 rebuild
oi:       .res 1                ; order index
pbase:    .res 1                ; oi × c
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
cy:       .res 1
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

; ---- setup

; A = difficulty, X = department (the content is this department's anyway)
init:
        sta diff
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
        ; orders = parts = round(byDiff(d, 2, 4)): 3 from d 0.25, 4 from 0.75
        ldx #2
        lda diff
        cmp #64
        bcc :+
        inx
        cmp #192
        bcc :+
        inx
:       stx c
        txa
        jsr square
        sta total
        ; memorise: c² × (70 - diff × 30 / 255) + 75 frames
        lda diff
        ldx #30
        jsr mul8
        sta dv_n+1
        lda #255
        jsr div8
        lda #MEMO_P
        sec
        sbc dv_n
        ldx #MEMO_F
        jsr times_c2
        sta memo_lo
        stx memo_hi
        ; rebuild: min(3500, c² × (225 - diff × 95 / 255) + 250) frames
        lda diff
        ldx #95
        jsr mul8
        sta dv_n+1
        lda #255
        jsr div8
        lda #BUILD_P
        sec
        sbc dv_n
        ldx #BUILD_F
        jsr times_c2
        cpx #>BUILD_MAX
        bcc :+
        lda #<BUILD_MAX
        ldx #>BUILD_MAX
:       sta build_lo
        stx build_hi
        ; names: c - 1 distinct colleagues (partial Fisher-Yates), the last order is the boss's
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
        txa
        clc
        adc #1
        cmp c                   ; while x < c - 1
        bcc @pick
        lda #<s_boss
        sta name_lo,x
        lda #>s_boss
        sta name_hi,x
        ; each order: a hair colour and a random option per part
        lda #0
        sta t1                  ; picks index
        ldx #0
@ord:   stx t0
        jsr API_RAND
        and #7
        tay
        lda hair_tab,y
        ldx t0
        sta hair,x
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
        cmp c
        bne @part
        ldx t0
        inx
        cpx c
        bne @ord
        jmp draw_memo

; A = n -> A = n × n (n <= 15).
square:
        tax
        lda #0
:       dex
        bmi :+
        clc
        adc c
        bne :-
:       rts

; A/X = A × c² + X (16 bit).
times_c2:
        stx t2
        ldx total
        jsr mul8
        tax
        lda dv_n
        clc
        adc t2
        bcc :+
        inx
:       rts

; ---- memorise phase

draw_memo:
        text 1, 0, s_name, 7
        text 32, 0, s_memo, 7
        lda #7
        sta COLOR
        lda #<s_remember
        ldx #>s_remember
        ldy #2
        ldx c
        cpx #3
        ldx #>s_remember
        bcs :+
        ldy #3
:       jsr API_CENTER
        lda #0
        sta t2
@card:  ldx c                   ; card position: a 2 × 2 grid (3 orders: the third centred below)
        lda card_tab - 2,x
        clc
        adc t2
        tax
        lda card_x,x
        sta cx
        lda card_y,x
        sta cy
        lda #1
        sta COLOR
        lda #CARD_W
        sta FILL_W
        lda c
        clc
        adc #6
        sta FILL_H
        ldx cx
        ldy cy
        jsr API_BOX
        ldx cx                  ; face and name
        inx
        inx
        ldy cy
        iny
        lda t2
        jsr order_face
        ldx t2
        lda name_lo,x
        sta PTR
        lda name_hi,x
        sta PTR+1
        lda #1
        sta COLOR
        lda cx
        clc
        adc #5
        tax
        ldy cy
        iny
        jsr API_PRINT
        lda #6                  ; rule
        sta COLOR
        lda #CARD_W-4
        sta FILL_W
        lda #1
        sta FILL_H
        ldx cx
        inx
        inx
        ldy cy
        iny
        iny
        iny
        lda #CH_B
        jsr API_FILL
        ; "Size  Venti" lines
        lda t2
        jsr pick_base
        sta t1
        lda #0
        sta t0
@line:  lda t0
        clc
        adc cy
        adc #4
        sta row
        lda #3
        sta COLOR
        ldx t0
        lda part_lo,x
        sta PTR
        lda part_hi,x
        sta PTR+1
        ldx cx
        inx
        ldy row
        jsr API_PRINT
        ldx t1
        lda picks,x
        jsr opt_ptr
        lda #1
        sta COLOR
        lda cx
        clc
        adc #7
        tax
        ldy row
        jsr API_PRINT
        inc t1
        inc t0
        lda t0
        cmp c
        bne @line
        inc t2
        lda t2
        cmp c
        beq :+
        jmp @card
:       lda #<s_ready
        ldx #>s_ready
        jsr footer
        lda memo_lo
        ldx memo_hi
        jmp timer_start

; A = order -> A = its first picks entry (order × c).
pick_base:
        tax
        lda #0
:       dex
        bmi :+
        clc
        adc c
        bne :-
:       rts

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
        lda build_lo
        ldx build_hi
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
        lda c
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
        ldy #NAME_Y - 2
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
        ldy #NAME_Y
        jsr print_in
        lda #3
        sta COLOR
        lda #<s_usual1
        sta PTR
        lda #>s_usual1
        sta PTR+1
        lda #0
        ldx #PANEL_W
        ldy #NAME_Y + 1
        jsr print_in
        lda #<s_usual2
        sta PTR
        lda #>s_usual2
        sta PTR+1
        lda #0
        ldx #PANEL_W
        ldy #NAME_Y + 2
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

; Part names in a row: done green, current cyan, to do blue.
draw_tabs:
        lda #RX + 1
        sta cx
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
        lda part_lo,x
        sta PTR
        lda part_hi,x
        sta PTR+1
        ldx cx
        ldy #TAB_Y
        jsr API_PRINT
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc cx
        sta cx
        inc t2
        lda t2
        cmp c
        bne @t
        rts

; "Correct n/N" right-aligned on row CORR_Y.
draw_correct:
        text RX+9, CORR_Y, s_correct, 7
        lda #7
        sta COLOR
        lda total               ; the total ends at column 39
        ldx #39
        cmp #10
        bcc :+
        dex
:       stx t0
        ldy #CORR_Y
        jsr API_NUM
        dec t0
        lda #'/'
        ldx t0
        ldy #CORR_Y
        jsr API_PUTC
        lda correct             ; the count ends before the slash
        ldx t0
        dex
        cmp #10
        bcc :+
        dex
:       ldy #CORR_Y
        jmp API_NUM

; The cup: as tall as the size picked (default before), blue band in the middle third, dark lid.
draw_cup:
        lda #PANEL_W-2
        sta FILL_W
        lda #CUP_BOT - LIST_Y - MAX_C + 1
        sta FILL_H
        lda #' '
        ldx #1
        ldy #LIST_Y + MAX_C
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
        text 9, MSG_R, s_wanted, 2
        jsr right_opt
        jsr opt_ptr
        ldx #21
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
        ldx #1
        jsr API_PUTC
        ldx pi
        lda built,x
        jsr opt_ptr
        ldx #3
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
        cmp c
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
        ldx c                   ; all parts right?
        dex
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
        lda #MSG_R
        ldx #1
        jmp clear_rows

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
        adc c
        sta pbase
        lda oi
        cmp c
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

; score = correct × 255 / (c × c)
finish:
        lda correct
        ldx #255
        jsr mul8
        sta dv_n+1
        lda total
        jsr div8
        lda dv_n
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
; cards: entries card_tab[c - 2] .. of card_x / card_y
card_tab:   .byte 0, 2, 5
card_x:     .byte 0, 20,  0, 20, 10,  0, 20,  0, 20
card_y:     .byte 5,  5,  3,  3, 13,  3,  3, 13, 13
hair_tab:   .byte 2, 7, 1, 4, 3, 5, 2, 1
; cup band by height in rows (0-6): from row h/3, round(h/3) rows (at least 1)
band_top:   .byte 0, 0, 0, 1, 1, 1, 2
band_h:     .byte 1, 1, 1, 1, 1, 2, 2

.include "gen/mg_coffee_data.s"

.bss
diff:     .res 1
memo_lo:  .res 1
memo_hi:  .res 1
build_lo: .res 1
build_hi: .res 1
pool:     .res N_COUNT
name_lo:  .res MAX_C
name_hi:  .res MAX_C
hair:     .res MAX_C
picks:    .res MAX_C * MAX_C    ; option per order and part
choices:  .res CHOICES
built:    .res MAX_C
