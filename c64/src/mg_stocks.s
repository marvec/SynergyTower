; Quarterly Ticker (src/minigames/stocks.js) as a disk-loaded overlay at $4000.
; A live price chart: BUY (all in) when it is low, SELL when it is high, and reach the profit target before the
; bell. The price is 100 × (1 + A sin(2 pi t / P1) + 0.4 A sin(2 pi t / P2) + noise), sampled every 0.1 s;
; P1 = 7-10 s, P2 = P1 × 0.33-0.42, the noise a random walk pulled back to 0. Selling at the target ends it.
; Difficulty 0: target +15%, no fee, 45 s, A = 0.12, noise sigma 0.01.
; Difficulty 1: target +35%, 1% fee on each trade, 40 s, A = 0.08, sigma 0.035.
; Score = gain / target (worth at the bell, shares at the last price), 0-1.
; The chart is quarter-block chars (2 × 2 px per cell): 33 columns = 66 samples (6.6 s; the browser shows 17 s),
; 13 rows = 26 px, rescaled to the visible prices every sample like the browser's. Money is kept in 0.1 EUR
; (16 bit), prices in cents. Content: gen/mg_stocks_data.s (tools/mg/stocks.js: tickers, sine table).

.include "api.inc"

NH        = 67                  ; samples kept: 66 on the chart + the one before (its first segment)
CH_X      = 1                   ; chart: columns 1-33 ...
CH_W      = 33
CH_Y      = 4                   ; ... rows 4-16
CH_H      = 13
PH        = 2 * CH_H            ; chart pixels high
TAG_X     = 34                  ; price tag column (5 chars)
TICK_Y    = 3                   ; ticker line
FLOAT_Y   = 18
STAT_Y    = 19
BAR_Y     = 20
BTN_Y     = 21                  ; buttons: boxes on rows 21-23
SAMPLE_T  = 5                   ; frames per sample (0.1 s)
FLOAT_T   = 45                  ; floaters last 0.9 s
START     = 10000               ; 1000 EUR in 0.1 EUR
P100      = 10000               ; price 100.00 in cents
BEZEL     = 6                   ; blue monitor frame
UP_COL    = 5
DOWN_COL  = 2
GOLD      = 7
QUARTER   = 240                 ; + pattern: 1 top left, 2 top right, 4 bottom left, 8 bottom right

.zeropage
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
sp:       .res 2
done:     .res 1
sub:      .res 1                ; frame within the sample (0-4): the work is spread over them
held:     .res 1                ; 1 = holding shares
cash:     .res 2                ; not holding: cash; holding: the cash that bought the shares, after the fee
buyp:     .res 2                ; price paid, cents
price:    .res 2                ; current price, cents
worth:    .res 2                ; 0.1 EUR
smooth:   .res 2                ; the sine part (bot)
ph1:      .res 2                ; sine phases, 8.8 (256 = a full turn)
ph2:      .res 2
noise:    .res 2                ; cents, signed
hh:       .res 1                ; newest sample's slot in the ring
lo:       .res 2                ; chart scale: lowest / highest price shown
hi:       .res 2
shift:    .res 1                ; (hi - v) >> shift fits 8 bits
kscale:   .res 1                ; ... × kscale / 256 = pixel row
m0:       .res 4                ; mul / div: 32-bit product / dividend -> quotient
d0:       .res 2                ; divisor; remainder in r0
r0:       .res 2
fl_t:     .res 1
lastkey:  .res 1
score:    .res 1
dirty:    .res 1                ; stats to redraw
sp2:      .res 2                ; colour RAM pointer

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup -------------------------------------------------------------------------------------------

; A = difficulty 0-255 (d = A / 255)
init:
        sta dif
        ldx #dirty - t0
        lda #0
:       sta t0,x
        dex
        bpl :-
        sta trades
        sta bot_tr
        lda #64
        sta lastkey
        lda #<START
        sta cash
        sta worth
        lda #>START
        sta cash+1
        sta worth+1
        ; byDiff: target 0.15 + 0.2 d (in 0.01%: 1500 + 7.84 A)
        lda dif
        sta m0
        lda #0
        sta m0+1
        ldx #3                  ; 8 A
:       asl m0
        rol m0+1
        dex
        bne :-
        lda dif                 ; - A / 8 - A / 32
        lsr
        lsr
        lsr
        sta t0
        lsr
        lsr
        clc
        adc t0
        sta t0
        lda m0
        sec
        sbc t0
        sta m0
        bcs :+
        dec m0+1
:       lda m0
        clc
        adc #<1500
        sta target
        lda m0+1
        adc #>1500
        sta target+1
        ; fee: 0.01 d, as × feeq / 65536 (feeq = 2.56 A)
        lda dif
        asl
        sta feeq
        lda #0
        rol
        sta feeq+1
        lda dif
        lsr
        sta t0                  ; A / 2
        lsr
        lsr
        lsr                     ; A / 16
        clc
        adc t0
        adc feeq
        sta feeq
        bcc :+
        inc feeq+1
:       ; amplitude 0.12 - 0.04 d: 1200 - 1.56 A cents; the second wave 0.4 × that
        lda dif
        lsr
        sta t0                  ; A / 2
        lsr
        lsr
        lsr                     ; A / 16
        clc
        adc t0
        sta t0
        lda #<1200
        sec
        sbc dif
        sta amp1
        lda #>1200
        sbc #0
        sta amp1+1
        lda amp1
        sec
        sbc t0
        sta amp1
        bcs :+
        dec amp1+1
:       lda amp1                ; × 102 / 256
        sta m0
        lda amp1+1
        sta m0+1
        lda #102
        jsr mul16x8
        lda m0+1
        sta amp2
        lda m0+2
        sta amp2+1
        ; noise step: sigma × sqrt(0.1) × 1.7 = 54 + 133 d cents (× -1..1)
        lda dif
        lsr
        sta t0
        lsr
        lsr
        lsr
        lsr
        lsr
        clc
        adc t0
        adc #54
        sta ampn
        ; the waves: P1 = 7-10 s -> phase step 655-936 per sample, P2 = P1 × 0.33-0.42 -> × 2.38-3.03
        lda #<282
        ldx #>282
        jsr rand16
        lda m0
        clc
        adc #<655
        sta inc1
        lda m0+1
        adc #>655
        sta inc1+1
        lda #70                 ; inc2 = 2 inc1 + inc1 × (97..166) / 256
        jsr API_RMOD
        clc
        adc #97
        pha
        lda inc1
        sta m0
        lda inc1+1
        sta m0+1
        pla
        jsr mul16x8
        lda inc1
        asl
        sta inc2
        lda inc1+1
        rol
        sta inc2+1
        lda inc2
        clc
        adc m0+1
        sta inc2
        lda inc2+1
        adc m0+2
        sta inc2+1
        jsr API_RAND            ; random phases
        sta ph1+1
        jsr API_RAND
        sta ph2+1
        ; the ticker
        lda #T_FIXED
        bpl :+
        lda #T_COUNT
        jsr API_RMOD
:       asl
        asl
        tax
        ldy #0
:       lda tickers,x
        sta s_tick,y
        inx
        iny
        cpy #4
        bne :-
        lda #0
        sta s_tick,y
        ; pre-roll the history so the chart starts full (no noise yet)
        lda #NH - 1
        sta hh
        ldx #NH
:       stx t3
        jsr advance
        jsr wave
        jsr push
        ldx t3
        dex
        bne :-
        jsr scale
        jsr calc_rows
        jsr draw_scene
        lda #<2250              ; 45 s - 5 d s = 2250 - 0.98 A frames
        sec
        sbc dif
        sta t0
        lda #>2250
        sbc #0
        tax
        lda dif
        lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        clc
        adc t0
        bcc :+
        inx
:       jmp timer_start

; ---- the price ---------------------------------------------------------------------------------------

; Phases one sample on.
advance:
        lda ph1
        clc
        adc inc1
        sta ph1
        lda ph1+1
        adc inc1+1
        sta ph1+1
        lda ph2
        clc
        adc inc2
        sta ph2
        lda ph2+1
        adc inc2+1
        sta ph2+1
        rts

; smooth = amp1 sin(ph1) + amp2 sin(ph2); price = 100.00 + smooth + noise.
wave:
        lda amp1
        sta m0
        lda amp1+1
        sta m0+1
        ldx ph1+1
        jsr smul
        sta smooth
        stx smooth+1
        lda amp2
        sta m0
        lda amp2+1
        sta m0+1
        ldx ph2+1
        jsr smul
        clc
        adc smooth
        sta smooth
        txa
        adc smooth+1
        sta smooth+1
        lda smooth
        clc
        adc noise
        sta price
        lda smooth+1
        adc noise+1
        sta price+1
        lda price
        clc
        adc #<P100
        sta price
        lda price+1
        adc #>P100
        sta price+1
        rts

; m0/m0+1 (unsigned) × sin_tab[X] / 128 -> A/X (signed 16 bit).
smul:
        lda sin_tab,x
        php
        bpl :+
        eor #$ff
        clc
        adc #1
:       jsr mul16x8             ; m0..m0+2 = amp × |s|
        lda m0                  ; / 128: << 1, take the top two bytes
        asl
        lda m0+1
        rol
        sta t0
        lda m0+2
        rol
        tax
        lda t0
        plp
        bpl :+
        eor #$ff                ; negative: 0 - value
        clc
        adc #1
        tay
        txa
        eor #$ff
        adc #0
        tax
        tya
:       rts

; The noise: noise += step × (-1..1), noise -= noise / 16 (the browser: 0.06 per sample).
walk:
        lda noise+1             ; |noise| / 16 toward 0
        php
        bpl :+
        lda #0
        sec
        sbc noise
        sta t0
        lda #0
        sbc noise+1
        jmp :++
:       lda noise
        sta t0
        lda noise+1
:       sta t1
        ldx #4
:       lsr t1
        ror t0
        dex
        bne :-
        plp
        bmi :+
        lda noise               ; positive: - |n| / 16
        sec
        sbc t0
        sta noise
        lda noise+1
        sbc t1
        sta noise+1
        jmp @step
:       lda noise               ; negative: + |n| / 16
        clc
        adc t0
        sta noise
        lda noise+1
        adc t1
        sta noise+1
@step:  jsr API_RAND            ; × ampn / 128, signed
        tax
        php
        bpl :+
        eor #$ff
        clc
        adc #1
:       sta m0
        lda #0
        sta m0+1
        lda ampn
        jsr mul16x8
        lda m0
        asl
        lda m0+1
        rol
        sta t0
        lda #0
        rol
        sta t1
        plp
        bmi :+
        lda noise
        clc
        adc t0
        sta noise
        lda noise+1
        adc t1
        sta noise+1
        rts
:       lda noise
        sec
        sbc t0
        sta noise
        lda noise+1
        sbc t1
        sta noise+1
        rts

; The price into the ring as the newest sample.
push:
        ldx hh
        inx
        cpx #NH
        bcc :+
        ldx #0
:       stx hh
        lda price
        sta h_lo,x
        lda price+1
        sta h_hi,x
        rts

; Chart scale: lowest and highest sample (and the price paid), ± 12% of the range + 0.50.
scale:
        lda #$ff
        sta lo
        sta lo+1
        lda #0
        sta hi
        sta hi+1
        ldx #NH - 1
@s:     lda h_lo,x
        cmp lo
        lda h_hi,x
        sbc lo+1
        bcs :+
        lda h_lo,x
        sta lo
        lda h_hi,x
        sta lo+1
:       lda h_lo,x
        cmp hi
        lda h_hi,x
        sbc hi+1
        bcc :+
        lda h_lo,x
        sta hi
        lda h_hi,x
        sta hi+1
:       dex
        bpl @s
        lda held
        beq @pad
        lda buyp
        cmp lo
        lda buyp+1
        sbc lo+1
        bcs :+
        lda buyp
        sta lo
        lda buyp+1
        sta lo+1
:       lda buyp
        cmp hi
        lda buyp+1
        sbc hi+1
        bcc @pad
        lda buyp
        sta hi
        lda buyp+1
        sta hi+1
@pad:   lda hi                  ; pad = range × 31 / 256 + 50
        sec
        sbc lo
        sta m0
        lda hi+1
        sbc lo+1
        sta m0+1
        lda #31
        jsr mul16x8
        lda m0+1
        clc
        adc #50
        sta t0
        lda m0+2
        adc #0
        sta t1
        lda lo
        sec
        sbc t0
        sta lo
        lda lo+1
        sbc t1
        sta lo+1
        lda hi
        clc
        adc t0
        sta hi
        lda hi+1
        adc t1
        sta hi+1
        ; (hi - lo) >> shift < 256; kscale = (PH - 1) × 256 / that
        lda hi
        sec
        sbc lo
        sta t0
        lda hi+1
        sbc lo+1
        ldx #0
:       cmp #0
        beq :+
        lsr
        ror t0
        inx
        bne :-
:       stx shift
        lda #<((PH - 1) * 256)
        sta m0
        lda #>((PH - 1) * 256)
        sta m0+1
        lda #0
        sta m0+2
        sta m0+3
        lda t0
        sta d0
        lda #0
        sta d0+1
        jsr div32
        lda m0
        sta kscale
        rts

; Pixel rows of all samples in time order (oldest first), and whether each went up.
calc_rows:
        lda hh
        sta cr_s                ; ring slot, newest first
        lda #NH - 1
        sta cr_i
@r:     ldy cr_s
        lda h_lo,y
        ldx h_hi,y
        jsr row_of
        ldy cr_i
        sta pyc,y
        ldx cr_s                ; up: this one >= the slot before (around the ring)
        txa
        bne :+
        lda #NH
:       tay
        dey
        lda h_lo,x
        cmp h_lo,y
        lda h_hi,x
        sbc h_hi,y
        lda #0
        rol
        ldy cr_i
        sta upc,y
        ldx cr_s
        bne :+
        ldx #NH
:       dex
        stx cr_s
        dec cr_i
        bpl @r
        rts

; ---- scenery -----------------------------------------------------------------------------------------

draw_scene:
        text 1, 0, s_name, 7
        ; "Target +15%" (rounded to whole %)
        ldy #0
        jsr buf_text_target
        lda #GOLD
        jsr print_right0
        ; the monitor
        lda #BEZEL
        sta COLOR
        lda #40
        sta FILL_W
        lda #CH_H + 3
        sta FILL_H
        ldx #0
        ldy #TICK_Y - 1
        jsr API_BOX
        jsr draw_buttons
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #1
        sta dirty
        jsr draw_chart
        jsr draw_marks
        jmp draw_stats

; "Target +N%" into buf from Y.
buf_text_target:
        lda #<s_target
        ldx #>s_target
        jsr bstr
        lda target              ; (target + 50) / 100
        clc
        adc #50
        sta m0
        lda target+1
        adc #0
        sta m0+1
        lda #100
        jsr div16x8
        lda m0
        jsr bnum8
        lda #'%'
        jsr bput
        jmp bend

; The BUY and SELL buttons: lit when they can be used.
draw_buttons:
        ldx #0                  ; BUY: green when not holding
        lda #UP_COL
        ldy held
        beq :+
        lda #BEZEL
:       jsr @btn
        ldx #1                  ; SELL: red when holding
        lda #DOWN_COL
        ldy held
        bne @btn
        lda #BEZEL
@btn:   sta COLOR
        stx t2
        lda #15
        sta FILL_W
        lda #3
        sta FILL_H
        lda btn_x,x
        tax
        ldy #BTN_Y
        jsr API_BOX
        ldx t2
        lda btn_lo,x
        sta PTR
        lda btn_hi,x
        sta PTR+1
        lda btn_x,x
        clc
        adc #2
        tax
        ldy #BTN_Y + 1
        jmp API_PRINT


; The chart: per column, its 13 cells cleared, then the two samples' segments as quarter blocks.
draw_chart:
        ldx #0
@c:     stx col
        lda #' '
        .repeat CH_H, r
        sta SCREEN + 40 * (CH_Y + r) + CH_X,x
        .endrep
        txa                     ; samples j = 2c + 1 (left half), 2c + 2 (right half)
        asl
        tay
        lda pyc,y               ; left span: rows pyc[j-1] .. pyc[j]
        ldx pyc+1,y
        jsr order
        sta sa0
        stx sa1
        lda pyc+1,y             ; right span: pyc[j] .. pyc[j+1]
        ldx pyc+2,y
        jsr order
        sta sb0
        stx sb1
        ldx upc+2,y             ; colour: the newer segment's
        lda updown_col,x
        sta ccol
        lda sa0                 ; cell rows: the union
        cmp sb0
        bcc :+
        lda sb0
:       lsr
        sta t0
        lda sa1
        cmp sb1
        bcs :+
        lda sb1
:       lsr
        sta t1
@row:   lda t0                  ; pixel rows 2r (top), 2r + 1 (bottom)
        asl
        sta pix
        ldy #0
        ldx #0                  ; top: sa -> 1, sb -> 2
        jsr in_spans
        inc pix                 ; bottom: sa -> 4, sb -> 8
        ldx #2
        jsr in_spans
        tya
        ora #QUARTER
        pha
        ldx t0
        lda chrow_lo,x
        sta sp
        lda chrow_hi,x
        sta sp+1
        ldy col
        pla
        sta (sp),y
        lda sp+1
        clc
        adc #>(COLRAM - SCREEN)
        sta sp+1
        lda ccol
        sta (sp),y
        inc t0
        lda t1
        cmp t0
        bcs @row
        ldx col
        inx
        cpx #CH_W
        bcs :+
        jmp @c
:       rts

; A, X -> A = the smaller, X = the larger. Keeps Y.
order:
        stx t2
        cmp t2
        bcc :+
        tax
        lda t2
:       rts

; Pixel row pix: Y |= pattern bit X+0 (in the left span) / X+1 (in the right span). Keeps X.
in_spans:
        lda pix
        cmp sa0
        bcc :+
        cmp sa1
        beq @a
        bcs :+
@a:     tya
        ora pat_tab,x
        tay
        lda pix
:       cmp sb0
        bcc :+
        cmp sb1
        beq @b
        bcs :+
@b:     tya
        ora pat_tab+1,x
        tay
:       rts

; The price tag (and "buy" with the dashed line at the price paid) right of the chart; the ticker line.
draw_marks:
        lda #5
        sta FILL_W
        lda #CH_H
        sta FILL_H
        ldx #TAG_X
        ldy #CH_Y
        lda #' '
        jsr API_FILL
        lda held
        beq @tag
        lda buyp                ; dashes in the chart's empty cells on the buy row
        ldx buyp+1
        jsr row_of
        lsr
        sta t0
        tax
        lda chrow_lo,x
        sta sp
        sta sp2
        lda chrow_hi,x
        sta sp+1
        clc
        adc #>(COLRAM - SCREEN)
        sta sp2+1
        ldy #CH_W - 1
:       lda (sp),y
        cmp #' '
        bne :+
        lda #'-'
        sta (sp),y
        lda #GOLD
        sta (sp2),y
:       dey
        bpl :--
        lda #<s_buy
        sta PTR
        lda #>s_buy
        sta PTR+1
        lda #GOLD
        sta COLOR
        lda t0
        clc
        adc #CH_Y
        tay
        ldx #TAG_X
        jsr API_PRINT
@tag:   lda price
        ldx price+1
        jsr row_of
        lsr
        clc
        adc #CH_Y
        sta tag_y
        ldy #0
        lda price
        ldx price+1
        jsr bprice1
        jsr bend
        ldx upc + NH - 1
        lda updown_col,x
        sta COLOR
        ldx #TAG_X
        ldy tag_y
        jsr print_buf
        ; ticker line: "SYNG  104.23" ... "trades: 3  fee 0.5%"
        ldy #0
        lda #<s_tick
        ldx #>s_tick
        jsr bstr
        lda #' '
        jsr bput
        jsr bput
        lda price
        ldx price+1
        jsr bprice2
        lda #' '
        jsr bput
        jsr bend
        lda #1
        sta COLOR
        ldx #2
        ldy #TICK_Y
        jsr print_buf
        ldy #0
        lda #<s_trades
        ldx #>s_trades
        jsr bstr
        lda trades
        jsr bnum8
        lda dif                 ; fee shown once there is one: 0.0-1.0%
        beq :+
        lda #<s_fee
        ldx #>s_fee
        jsr bstr
        lda dif                 ; tenths: round(10 d) = (A × 10 + 128) / 256
        ldx #10
        jsr mul8x8
        cmp #128
        txa
        adc #0
        ldx #0
        jsr bfix1
        lda #'%'
        jsr bput
:       jsr bend
        lda #3
        sta COLOR
        ldx #38
        jmp print_right

; Worth, gain and score from the current price; the stats row and the bar to the target.
draw_stats:
        jsr calc_worth
        ldy #0                  ; "Cash 1000 Shares 9.62 Worth 1003"
        lda #<s_cash
        ldx #>s_cash
        jsr bstr
        lda held                ; (0 while holding)
        beq :+
        lda #0
        tax
        beq :++
:       lda cash
        ldx cash+1
:       jsr beur
        lda #<s_shares
        ldx #>s_shares
        jsr bstr
        lda held                ; (0 while not holding)
        bne :+
        tax
        beq :++
:       lda shares
        ldx shares+1
:       jsr bshares
        lda #<s_worth
        ldx #>s_worth
        jsr bstr
        lda worth
        ldx worth+1
        jsr beur
        lda #' '                ; (clears what a longer line left)
        jsr bput
        jsr bput
        jsr bend
        lda #1
        sta COLOR
        ldx #0
        ldy #STAT_Y
        jsr print_buf
        ; gain: "+2.3%" right-aligned, green / red
        lda worth
        sec
        sbc #<START
        sta t0
        lda worth+1
        sbc #>START
        sta t1                  ; 0.01% units, signed
        ldy #0
        lda #' '
        jsr bput
        ldx #UP_COL
        lda #'+'
        bit t1
        bpl :+
        ldx #DOWN_COL
        lda #0                  ; |gain|
        sec
        sbc t0
        sta t0
        lda #0
        sbc t1
        sta t1
        lda #'-'
:       stx COLOR
        jsr bput
        lda t0                  ; tenths of a %: (|gain| + 5) / 10
        clc
        adc #5
        sta m0
        lda t1
        adc #0
        sta m0+1
        lda #10
        jsr div16x8
        lda m0
        ldx m0+1
        jsr bfix1
        lda #'%'
        jsr bput
        jsr bend
        ldx #39
        ldy #STAT_Y
        jsr print_right_y
        ; the bar: score × 38 / 256 cells gold, the rest blue
        lda score
        ldx #38
        jsr mul8x8
        stx t2
        ldx #0
:       stx t3
        lda #GOLD
        cpx t2
        bcc :+
        lda #BEZEL
:       sta COLOR
        txa
        clc
        adc #1
        tax
        lda #CH_BLOCK
        ldy #BAR_Y
        jsr API_PUTC
        ldx t3
        inx
        cpx #38
        bcc :--
        rts

; worth = cash (not holding) or cash × price / price paid; score = clamp(gain / target) × 255.
calc_worth:
        lda cash
        sta worth
        lda cash+1
        sta worth+1
        lda held
        beq @score
        lda cash
        sta m0
        lda cash+1
        sta m0+1
        lda price
        sta d0
        lda price+1
        sta d0+1
        jsr mul16x16
        lda buyp
        sta d0
        lda buyp+1
        sta d0+1
        jsr div32
        lda m0
        sta worth
        lda m0+1
        sta worth+1
@score: lda #0
        sta score
        lda worth
        sec
        sbc #<START
        sta m0
        lda worth+1
        sbc #>START
        sta m0+1
        bcc @rts                ; a loss: 0
        lda #255                ; gain × 255 / target, at most 255
        jsr mul16x8
        lda #0
        sta m0+3
        lda target
        sta d0
        lda target+1
        sta d0+1
        jsr div32
        lda m0+1
        ora m0+2
        beq :+
        lda #255
        .byte $2c
:       lda m0
        sta score
@rts:   rts

; ---- one frame ---------------------------------------------------------------------------------------

frame:
        lda done
        beq :+
        sec
        rts
:       jsr float_tick
        jsr timer_tick
        bcc :+
        jsr calc_worth          ; the bell: shares count at the last price
        jmp finish
:       ldx sub                 ; the work is spread over a sample's 5 frames
        inx
        cpx #SAMPLE_T
        bcc :+
        ldx #0
:       stx sub
        txa
        bne @s1
        jsr advance             ; a new sample
        jsr walk
        jsr wave
        jsr push
        jsr scale
.if .defined(AUTOPLAY)
        jsr bot
.endif
        jmp @input
@s1:    cmp #1
        bne @s2
        jsr calc_rows
        jmp @input
@s2:    cmp #2
        bne @s3
        jsr draw_chart
        jmp @input
@s3:    cmp #3
        bne @s4
        jsr draw_marks
        jmp @input
@s4:    jsr draw_stats
@input: lda $cb                 ; keys 1 / B buy, 2 sells (edge-detected)
        cmp lastkey
        beq @joy
        sta lastkey
        cmp #KEY_1
        beq @buy
        cmp #KEY_B
        beq @buy
        cmp #KEY_2
        beq @sell
@joy:   lda JOYP
        and #J_UP
        bne @buy
        lda JOYP
        and #J_DOWN
        beq @out
@sell:  jsr sell
        jmp @out
@buy:   jsr buy
@out:   lda done
        beq :+
        sec
        rts
:       clc
        rts

; All in at the current price (less the fee).
buy:
        lda held
        beq :+
        lda #5                  ; (rim click)
        jsr API_SFX
        lda #<s_already
        ldx #>s_already
        ldy #BEZEL
        jmp floater
:       jsr fee_of_cash
        lda #1
        sta held
        lda price
        sta buyp
        lda price+1
        sta buyp+1
        inc trades
        lda cash                ; shares × 100 = cash × 1000 / price (cash in 0.1 EUR, price in cents)
        sta m0
        lda cash+1
        sta m0+1
        lda #<1000
        sta d0
        lda #>1000
        sta d0+1
        jsr mul16x16
        lda buyp
        sta d0
        lda buyp+1
        sta d0+1
        jsr div32
        lda m0
        sta shares
        lda m0+1
        sta shares+1
        lda #SFX_BLIP
        jsr API_SFX
        ldy #0                  ; "Bought @ 98.4"
        lda #<s_bought
        ldx #>s_bought
        jsr bstr
        lda price
        ldx price+1
        jsr bprice1
        jsr bend
        lda #<buf
        ldx #>buf
        ldy #3
        jsr floater
        jmp traded

; Everything at the current price (less the fee): "+3.1%" / "-1.2%" on the trade.
sell:
        lda held
        bne :+
        lda #5
        jsr API_SFX
        lda #<s_nothing
        ldx #>s_nothing
        ldy #BEZEL
        jmp floater
:       jsr calc_worth          ; cash = worth less the fee
        lda worth
        sta cash
        lda worth+1
        sta cash+1
        jsr fee_of_cash
        lda #0
        sta held
        inc trades
        lda price               ; % = (price - fee) × 1000 / paid - 1000, in tenths
        sta m0
        sta t0
        lda price+1
        sta m0+1
        sta t1
        lda feeq
        sta d0
        lda feeq+1
        sta d0+1
        jsr mul16x16
        lda t0
        sec
        sbc m0+2
        sta m0
        lda t1
        sbc m0+3
        sta m0+1
        lda #<1000
        sta d0
        lda #>1000
        sta d0+1
        jsr mul16x16
        lda buyp
        sta d0
        lda buyp+1
        sta d0+1
        jsr div32
        lda m0
        sec
        sbc #<1000
        sta t0
        lda m0+1
        sbc #>1000
        sta t1
        ldy #0
        ldx #UP_COL
        lda #'+'
        bcs :+                  ; (C from the subtraction: >= 0)
        lda #0
        sec
        sbc t0
        sta t0
        lda #0
        sbc t1
        sta t1
        ldx #DOWN_COL
        lda #'-'
:       stx t2
        jsr bput
        lda t0
        ldx t1
        jsr bfix1
        lda #'%'
        jsr bput
        jsr bend
        lda #SFX_GOOD
        ldx t2
        cpx #UP_COL
        beq :+
        lda #SFX_BAD
:       jsr API_SFX
        lda #<buf
        ldx #>buf
        ldy t2
        jsr floater
        jsr traded
        lda cash                ; at the target: done, full marks
        sec
        sbc #<START
        tax
        lda cash+1
        sbc #>START
        bcc @rts
        cmp target+1
        bcc @rts
        bne :+
        cpx target
        bcc @rts
:       lda #255
        sta score
        jmp finish
@rts:   rts

; After a trade: buttons, stats.
traded:
        jsr draw_buttons
        jmp draw_stats

; cash -= cash × fee.
fee_of_cash:
        lda cash
        sta m0
        lda cash+1
        sta m0+1
        lda feeq
        sta d0
        lda feeq+1
        sta d0+1
        jsr mul16x16
        lda cash
        sec
        sbc m0+2
        sta cash
        lda cash+1
        sbc m0+3
        sta cash+1
        rts

; A/X = text, Y = colour: centred on the floater row for 0.9 s.
floater:
        sty t2
        pha
        txa
        pha
        lda #FLOAT_Y
        ldx #1
        jsr clear_rows
        lda t2
        sta COLOR
        pla
        tax
        pla
        ldy #FLOAT_Y
        jsr API_CENTER
        lda #FLOAT_T
        sta fl_t
        rts

float_tick:
        lda fl_t
        beq :+
        dec fl_t
        bne :+
        lda #FLOAT_Y
        ldx #1
        jmp clear_rows
:       rts

.if .defined(AUTOPLAY)
; Good trader (test builds): sells when the price's wave part turns down (or once the target is in hand), and
; when it turns up looks ahead along the waves: buys if the coming top beats today's price by the fees + 1%.
bot:    lda held
        beq :+
        lda score               ; (from the last stats: at the target already)
        cmp #255
        bne :+
        jmp sell
:       lda smooth
        cmp bot_prev
        lda smooth+1
        sbc bot_prev+1
        bvc :+
        eor #$80
:       ldx #0                  ; 0 rising, 1 falling
        asl
        bcc :+
        inx
:       lda smooth
        sta bot_prev
        lda smooth+1
        sta bot_prev+1
        cpx bot_tr
        beq @rts
        stx bot_tr
        txa
        bne @top
        lda held
        bne @rts
        jsr look
        bcc @rts
        jmp buy
@top:   lda held
        beq @rts
        jmp sell
@rts:   rts

; C=1 if the waves' next top - (smooth + noise / 2) >= 100 cents + feeq / 2 (~ the two fees).
look:
        ldx #7                  ; save the state the waves use
:       lda ph1,x               ; (ph1, ph2, noise: 6 bytes; price 2 more below)
        sta lk_save,x
        dex
        bpl :-
        lda price
        sta lk_save+8
        lda price+1
        sta lk_save+9
        lda smooth
        sta lk_top
        sta lk_cur
        lda smooth+1
        sta lk_top+1
        sta lk_cur+1
        lda #80
        sta lk_n
@step:  jsr advance
        jsr wave
        lda smooth              ; still rising?
        cmp lk_top
        lda smooth+1
        sbc lk_top+1
        bvc :+
        eor #$80
:       bmi @done
        lda smooth
        sta lk_top
        lda smooth+1
        sta lk_top+1
        dec lk_n
        bne @step
@done:  ldx #7
:       lda lk_save,x
        sta ph1,x
        dex
        bpl :-
        lda lk_save+8
        sta price
        lda lk_save+9
        sta price+1
        lda lk_cur
        sta smooth
        lda lk_cur+1
        sta smooth+1
        lda lk_top              ; profit = top - smooth - noise / 2
        sec
        sbc lk_cur
        sta t0
        lda lk_top+1
        sbc lk_cur+1
        sta t1
        lda noise+1
        cmp #$80                ; noise / 2 (arithmetic)
        ror
        sta t3
        lda noise
        ror
        sta t2
        lda t0
        sec
        sbc t2
        sta t0
        lda t1
        sbc t3
        sta t1
        bmi @no
        lda feeq+1              ; threshold = 100 + feeq / 2
        lsr
        lda feeq
        ror
        clc
        adc #100
        sta t2
        lda #0
        adc #0
        sta t3
        lda t0                  ; C=1: profit >= threshold
        cmp t2
        lda t1
        sbc t3
        rts
@no:    clc
        rts
.endif

finish:
        lda score
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; ---- maths -------------------------------------------------------------------------------------------

; m0..m1 × A -> m0..m2.
mul16x8:
        sta t2
        lda #0                  ; the top byte builds in A
        ldx #16
        lsr m0+1
        ror m0
@l:     bcc :+
        clc
        adc t2
:       ror
        ror m0+1
        ror m0
        dex
        bne @l
        sta m0+2
        rts

; m0..m1 × d0..d1 -> m0..m3.
mul16x16:
        lda #0
        sta m0+2
        sta m0+3
        ldx #16
        lsr m0+1
        ror m0
@l:     bcc :+
        lda m0+2
        clc
        adc d0
        sta m0+2
        lda m0+3
        adc d0+1
        sta m0+3
:       ror m0+3
        ror m0+2
        ror m0+1
        ror m0
        dex
        bne @l
        rts

; m0..m3 / d0..d1 -> m0..m3, remainder r0..r1. Keeps Y.
div32:
        sty dv_y
        lda #0
        sta r0
        sta r0+1
        ldx #32
@l:     asl m0
        rol m0+1
        rol m0+2
        rol m0+3
        rol r0
        rol r0+1
        lda r0
        sec
        sbc d0
        tay
        lda r0+1
        sbc d0+1
        bcc :+
        sta r0+1
        sty r0
        inc m0
:       dex
        bne @l
        ldy dv_y
        rts

; m0..m1 / A -> m0..m1.
div16x8:
        sta d0
        lda #0
        sta d0+1
        sta m0+2
        sta m0+3
        jmp div32

; A × X -> A = low byte, X = high byte (8 × 8).
mul8x8:
        stx t2
        sta t3
        lda #0
        ldx #8
        lsr t3
@l:     bcc :+
        clc
        adc t2
:       ror
        ror t3
        dex
        bne @l
        tax
        lda t3
        rts

; A × X -> A = high byte.
mul8:
        jsr mul8x8
        txa
        rts

; 16-bit random number 0 .. A/X - 1 -> m0..m1 (A/X < 512: two halves).
rand16:
        sta t0
        stx t1
        lsr t1
        ror t0                  ; half
        jsr API_RAND
        and #1
        beq :+
        lda t0
:       sta m0+1                ; (0 or half)
        lda t0
        jsr API_RMOD
        clc
        adc m0+1
        sta m0
        lda #0
        rol
        sta m0+1
        rts

; ---- text --------------------------------------------------------------------------------------------

; A/X = price -> A = pixel row on the chart (0 top .. PH - 1), clamped.
row_of:
        sta t0
        stx t1
        lda hi
        sec
        sbc t0
        sta t0
        lda hi+1
        sbc t1
        bcs :+
        lda #0                  ; above the top
        rts
:       ldx shift
        beq :++
:       lsr
        ror t0
        dex
        bne :-
:       cmp #0
        bne @low
        lda t0
        ldx kscale
        jsr mul8
        cmp #PH
        bcc :+
@low:   lda #PH - 1
:       rts

; buf building: Y = index (kept up to date by every routine).
bput:   sta buf,y
        iny
        rts
bend:   lda #0
        sta buf,y
        rts
bstr:   sta sp
        stx sp+1
        sty t3
        ldy #0
:       lda (sp),y
        beq :+
        sty t2
        ldy t3
        sta buf,y
        inc t3
        ldy t2
        iny
        bne :-
:       ldy t3
        rts

; A = 0..255 in decimal.
bnum8:  ldx #0
        jmp bnum16

; A/X = 0..65535 in decimal, no leading zeros (digits also left in dg, count in dn).
bnum16: sta n16
        stx n16+1
        sty t3
        lda #0
        sta dn
        ldx #4                  ; 10000, 1000, 100, 10, 1
@p:     ldy #'0'
@s:     lda n16
        cmp p10_lo,x
        lda n16+1
        sbc p10_hi,x
        bcc @d
        sta n16+1
        lda n16
        sbc p10_lo,x
        sta n16
        iny
        bne @s
@d:     tya
        ldy dn
        bne :+
        cmp #'0'                ; skip leading zeros (but not the last digit)
        bne :+
        cpx #0
        bne @n
:       sta dg,y
        inc dn
@n:     dex
        bpl @p
        ldy t3
        ldx #0
:       lda dg,x
        sta buf,y
        iny
        inx
        cpx dn
        bne :-
        rts

; A/X in tenths: "12.3" (at least "0.1").
bfix1:  pha
        lda #1
        sta places
        pla
        jmp bfix
; A/X in hundredths: "9.62".
bfix2:  pha
        lda #2
        sta places
        pla
; A/X with `places` decimals.
bfix:   sty t3
        ldy t3
        jsr bnum16              ; digits in dg (dn of them), copied to buf: redo with the point
        ldy t3
        lda dn                  ; pad with leading zeros to places + 1 digits
        sec
        sbc places
        sta t2                  ; digits before the point
        bcc @pad
        beq @pad
        bne @go
@pad:   lda #'0'                ; "0." and the missing zeros
        jsr bput
        lda #'.'
        jsr bput
        lda places
        sec
        sbc dn
        tax
        beq :++
:       lda #'0'
        jsr bput
        dex
        bne :-
:       ldx #0
        jmp @tail
@go:    ldx #0
:       lda dg,x
        jsr bput
        inx
        cpx t2
        bne :-
        lda #'.'
        jsr bput
@tail:  lda dg,x
        jsr bput
        inx
        cpx dn
        bne @tail
        rts

; Price A/X (cents): "104.23" / "104.2".
bprice2:
        jmp bfix2
bprice1:
        sta m0
        stx m0+1
        sty t3
        lda #10
        jsr div16x8
        ldy t3
        lda m0
        ldx m0+1
        jmp bfix1

; A/X = 0.1 EUR: rounded to whole euros.
beur:   clc
        adc #5
        sta m0
        txa
        adc #0
        sta m0+1
        sty t3
        lda #10
        jsr div16x8
        ldy t3
        lda m0
        ldx m0+1
        jmp bnum16

; A/X = shares × 100: "9.62".
bshares:
        jmp bfix2

; buf at X, row Y in COLOR.
print_buf:
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        jmp API_PRINT

; buf right-aligned to end at column X - 1 of row 0 / of row Y, in A (print_right0) / COLOR.
print_right0:
        sta COLOR
        ldx #39
        ldy #0
        jmp print_right_y
print_right:
        ldy #TICK_Y
print_right_y:
        stx t2
        sty t3
        ldy #0
:       lda buf,y
        beq :+
        iny
        bne :-
:       sty t1
        lda t2
        sec
        sbc t1
        tax
        ldy t3
        jmp print_buf

.rodata
s_name:     .byte "Quarterly Ticker", 0
s_help:     .byte "BUY when low, SELL when high. Reach the profit target!", 0
s_keys:     .byte "Up / 1: BUY   Down / 2: SELL", 0
s_target:   .byte "Target +", 0
s_btn_buy:  .byte "BUY  Up / 1", 0
s_btn_sell: .byte "SELL Down/2", 0
s_buy:      .byte "buy", 0
s_trades:   .byte "trades: ", 0
s_fee:      .byte "  fee ", 0
s_cash:     .byte "Cash ", 0
s_shares:   .byte " Shares ", 0
s_worth:    .byte " Worth ", 0
s_bought:   .byte "Bought @ ", 0
s_already:  .byte "Already holding", 0
s_nothing:  .byte "Nothing to sell", 0
btn_x:      .byte 4, 21
btn_lo:     .byte <s_btn_buy, <s_btn_sell
btn_hi:     .byte >s_btn_buy, >s_btn_sell
updown_col: .byte DOWN_COL, UP_COL      ; by "went up"
pat_tab:    .byte 1, 2, 4, 8            ; quarter-block bits: top left, top right, bottom left, bottom right
p10_lo:     .byte <1, <10, <100, <1000, <10000
p10_hi:     .byte >1, >10, >100, >1000, >10000
chrow_lo:   .repeat CH_H, r
            .byte <(SCREEN + 40 * (CH_Y + r) + CH_X)
            .endrep
chrow_hi:   .repeat CH_H, r
            .byte >(SCREEN + 40 * (CH_Y + r) + CH_X)
            .endrep
KEY_1 = 56                      ; KERNAL matrix codes
KEY_2 = 59
KEY_B = 28

.include "gen/mg_stocks_data.s"

.bss
h_lo:       .res NH             ; price ring, cents
h_hi:       .res NH
pyc:        .res NH             ; pixel row of each sample, oldest first
upc:        .res NH             ; 1 = up from the sample before
dif:        .res 1
target:     .res 2              ; gain to reach, 0.01%
feeq:       .res 2              ; fee × 65536
amp1:       .res 2              ; wave amplitudes, cents
amp2:       .res 2
ampn:       .res 1              ; noise step, cents
inc1:       .res 2              ; phase steps per sample
inc2:       .res 2
shares:     .res 2              ; × 100
trades:     .res 1
s_tick:     .res 5
col:        .res 1
sa0:        .res 1              ; the column's two spans (pixel rows)
sa1:        .res 1
sb0:        .res 1
sb1:        .res 1
ccol:       .res 1
pix:        .res 1
n16:        .res 2
dg:         .res 5
dn:         .res 1
places:     .res 1
bot_prev:   .res 2
bot_tr:     .res 1
cr_s:       .res 1              ; calc_rows: ring slot, time index
cr_i:       .res 1
.if .defined(AUTOPLAY)
lk_save:    .res 10
lk_top:     .res 2
lk_cur:     .res 2
lk_n:       .res 1
.endif
dv_y:       .res 1
tag_y:      .res 1
buf:        .res 41
