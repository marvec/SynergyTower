; Expense Report (src/minigames/math.js) as a disk-loaded overlay at $4000.
; Add up the receipts and pick the right total (or, from d > 0.4, 30 % of the reports: work out how much of the
; budget is left). One clock runs for the whole game. Score = correct / reports.
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   reports             round(5 + 4d)        5          9
;   receipts per report round(2 + 2.6d)      2          5
;   receipt value       1..round(12 + 48d)   $1-12      $1-60
;   options             3 below d = 0.4, else 4
;   time limit          65 - 15d s           65 s       50 s
;   budget questions    d > 0.4, 30 % of the reports: budget = ceil((sum + 5..40) / 10) × 10, answer = budget - sum
; Wrong options as in the JS: the digits reversed (half the time), answer ± 1, 2, 3, 5, 10, then + 7, 14...
; Content: the department's receipt items (src/minigames/math.js ITEMS, gen/mg_math_data.s).

.include "api.inc"

MAX_REC   = 5
MAX_OPT   = 4
REVEAL_T  = 35                  ; 0.7 s
CARD_W    = 19                  ; receipt cards: 2 columns of 19 × 3, rows 3, 7, 11
CARD_Y    = 3
QUEST_Y   = 15
MSG_Y     = 16
OPT_Y     = 17                  ; option boxes: 2 columns of 14 × 3, rows 17 and 20
OPT_W     = 14
.if .defined(AUTOPLAY)
BOT_T     = 40                  ; the bot answers after 0.8 s
.endif

.zeropage
diff:     .res 1
nrep:     .res 1                ; reports
nopt:     .res 1                ; options per report
nrec:     .res 1                ; receipts per report
maxv:     .res 1                ; highest receipt value
ri:       .res 1                ; current report
correct:  .res 1
focus:    .res 1
right:    .res 1
chosen:   .res 1
reveal:   .res 1                ; frames left on the answer screen, 0 = asking
done:     .res 1
last_key: .res 1                ; number_key of the last frame ($ff = none)
ncards:   .res 1                ; cards on screen (receipts + budget)
n16:      .res 2                ; number scratch (decimal output, digit reversal)
sum:      .res 2
budget:   .res 2                ; 0 = a plain total
answer:   .res 2
cand:     .res 2                ; option candidate
rev:      .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
cx:       .res 1
cy:       .res 1
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department (the content is the department's anyway)
init:
        sta diff
        lda #$ff
        sta last_key
        lda #0
        sta ri
        sta correct
        sta done
        ; reports = 5 + round(4d)
        lda diff
        ldy #4
        jsr mulr
        clc
        adc #5
        sta nrep
        ; options: 3 below d = 0.4 (102 / 255)
        ldx #3
        lda diff
        cmp #102
        bcc :+
        inx
:       stx nopt
        ; receipts = round(2 + 2.6d): 3 from d = 0.196 (D 50), 4 from 0.58 (148), 5 from 0.965 (246)
        ldx #0
:       lda diff
        cmp rec_step,x
        bcc :+
        inx
        cpx #3
        bne :-
:       txa
        clc
        adc #2
        sta nrec
        ; highest value = round(12 + 48d)
        lda diff
        ldy #48
        jsr mulr
        clc
        adc #12
        sta maxv
        ; time = 3250 - 750d frames (750d ~ D × 188 / 64)
        lda diff
        ldy #188
        jsr mul8
        ldx #6
:       lsr
        ror m_lo
        dex
        bne :-
        sta t0
        lda #<3250
        sec
        sbc m_lo
        tay
        lda #>3250
        sbc t0
        tax
        tya
        jsr timer_start
        ; the item pool for sampling receipts
        ldx #I_COUNT-1
:       txa
        sta pool,x
        dex
        bpl :-
        text 1, 0, s_name, 7
        jmp ask

rec_step:  .byte 50, 148, 246

; A × Y -> A = round(A × Y / 256)
mulr:   jsr mul8
        ldx m_lo
        cpx #$80
        adc #0
        rts

; A × Y -> A = high byte, m_lo = low byte (X = 0)
mul8:   sta m_a
        sty m_b
        lda #0
        ldx #8
@l:     lsr m_a
        bcc :+
        clc
        adc m_b
:       ror
        ror m_lo
        dex
        bne @l
        rts

; n16 /= 10, A = remainder (keeps X)
div10:  lda #0
        ldy #16
@l:     asl n16
        rol n16+1
        rol
        cmp #10
        bcc :+
        sbc #10
        inc n16
:       dey
        bne @l
        rts

; rev ×= 10
x10:    lda rev
        ldx rev+1
        asl rev
        rol rev+1               ; × 4
        asl rev
        rol rev+1
        clc
        adc rev                 ; × 5
        sta rev
        txa
        adc rev+1
        sta rev+1
        asl rev                 ; × 10
        rol rev+1
        rts

; ---- a new report
make_report:
        ; receipts: nrec distinct items (partial Fisher-Yates), values 1..maxv
        lda #0
        sta sum
        sta sum+1
        sta budget
        sta budget+1
        ldx #0
@rec:   stx t0
        lda #I_COUNT
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
        sta rec_item,x
        lda maxv
        jsr API_RMOD
        ldx t0
        clc
        adc #1
        sta rec_val,x
        adc sum
        sta sum
        bcc :+
        inc sum+1
:       inx
        cpx nrec
        bne @rec
        lda sum
        sta answer
        lda sum+1
        sta answer+1
        ; d > 0.4 and a 30 % chance: how much budget is left?
        lda diff
        cmp #103
        bcc @opts
        jsr API_RAND
        cmp #77
        bcs @opts
        lda #36
        jsr API_RMOD
        clc
        adc #5 + 9              ; sum + 5..40, + 9 to round up
        adc sum
        sta n16
        lda sum+1
        adc #0
        sta n16+1
        jsr div10
        lda n16                 ; × 10
        sta rev
        lda n16+1
        sta rev+1
        jsr x10
        lda rev
        sta budget
        lda rev+1
        sta budget+1
        lda budget              ; answer = budget - sum
        sec
        sbc sum
        sta answer
        lda budget+1
        sbc sum+1
        sta answer+1
@opts:  ; options: the answer first
        lda answer
        sta opt_lo
        lda answer+1
        sta opt_hi
        lda #1
        sta nopts
        ; the digits reversed, half the time
        lda answer
        sta n16
        lda answer+1
        sta n16+1
        lda #0
        sta rev
        sta rev+1
:       jsr div10
        pha
        jsr x10                 ; rev × 10 + digit
        pla
        clc
        adc rev
        sta rev
        bcc :+
        inc rev+1
:       lda n16
        ora n16+1
        bne :--
        lda rev
        cmp answer
        bne :+
        lda rev+1
        cmp answer+1
        beq @deltas
:       lda rev
        ora rev+1
        beq @deltas
        jsr API_RAND
        bmi @deltas
        lda rev
        sta cand
        lda rev+1
        sta cand+1
        jsr add_opt
@deltas:
        ; answer + each delta in random order while it is positive and new
        ldx #DELTAS-1
:       lda delta_tab,x
        sta deltas,x
        dex
        bpl :-
        ldx #DELTAS-1
@sh:    stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda deltas,x
        pha
        lda deltas,y
        sta deltas,x
        pla
        sta deltas,y
        dex
        bne @sh
        lda #0
        sta t2
@dl:    lda nopts
        cmp nopt
        bcs @fill
        ldx t2
        lda deltas,x
        ldy #0
        ora #0
        bpl :+
        dey                     ; sign extension
:       clc
        adc answer
        sta cand
        tya
        adc answer+1
        sta cand+1
        bmi @dn                 ; <= 0: skip
        ora cand
        beq @dn
        jsr add_opt
@dn:    inc t2
        lda t2
        cmp #DELTAS
        bne @dl
@fill:  ; still short: answer + 7, + 14...
        lda answer
        sta cand
        lda answer+1
        sta cand+1
@f7:    lda nopts
        cmp nopt
        bcs @shuf
        lda cand
        clc
        adc #7
        sta cand
        bcc :+
        inc cand+1
:       jsr add_opt
        jmp @f7
@shuf:  ; shuffle the options, then find the answer
        ldx nopt
        dex
@so:    stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda opt_lo,x
        pha
        lda opt_lo,y
        sta opt_lo,x
        pla
        sta opt_lo,y
        lda opt_hi,x
        pha
        lda opt_hi,y
        sta opt_hi,x
        pla
        sta opt_hi,y
        dex
        bne @so
        ldx nopt
        dex
:       lda opt_lo,x
        cmp answer
        bne @nx
        lda opt_hi,x
        cmp answer+1
        beq :+
@nx:    dex
        bpl :-
:       stx right
        rts

; cand -> the options, unless it is already there
add_opt:
        ldx nopts
        dex
:       lda opt_lo,x
        cmp cand
        bne @no
        lda opt_hi,x
        cmp cand+1
        beq @dup
@no:    dex
        bpl :-
        ldx nopts
        lda cand
        sta opt_lo,x
        lda cand+1
        sta opt_hi,x
        inc nopts
@dup:   rts

; ---- screen

; Set up and draw report ri.
ask:
        lda #0
        sta reveal
        sta focus
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        jsr make_report
        lda #2
        ldx #22
        jsr clear_rows
        jsr draw_counter
        ; the cards: the budget first (if any), then the receipts
        lda nrec
        ldx budget
        bne :+
        ldx budget+1
        beq :++
:       clc
        adc #1
:       sta ncards
        lda #0
        sta t2                  ; card number
        lda budget
        ora budget+1
        beq @recs
        jsr card_pos
        lda #5
        jsr card_box
        lda #<s_budget
        ldx #>s_budget
        jsr card_label
        lda budget
        sta n16
        lda budget+1
        sta n16+1
        lda #1
        jsr card_value
        inc t2
@recs:  lda #0
        sta t1                  ; receipt
@r:     jsr card_pos
        lda #1
        jsr card_box
        lda #<s_receipt
        ldx #>s_receipt
        jsr card_label
        ldx t1                  ; item name
        ldy rec_item,x
        lda item_lo,y
        sta PTR
        lda item_hi,y
        sta PTR+1
        lda #1
        sta COLOR
        ldx cx
        inx
        ldy cy
        iny
        jsr API_PRINT
        ldx t1
        lda rec_val,x
        sta n16
        lda #0
        sta n16+1
        lda #7
        jsr card_value
        inc t2
        inc t1
        lda t1
        cmp nrec
        bne @r
        ; the question
        lda #<s_total
        ldx #>s_total
        ldy budget
        bne :+
        ldy budget+1
        beq :++
:       lda #<s_left
        ldx #>s_left
:       ldy #1
        sty COLOR
        ldy #QUEST_Y
        jsr API_CENTER
        jsr draw_options
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; cx, cy = position of card t2: 2 columns, an odd last card centred
card_pos:
        lda ncards              ; rows of cards, centred vertically: 1 -> 7, 2 -> 5 9, 3 -> 3 7 11
        clc
        adc #1
        lsr
        eor #$ff
        sec
        adc #3                  ; 3 - rows
        asl
        adc #CARD_Y
        sta cy
        lda t2
        lsr
        tax
        lda card_row,x
        clc
        adc cy
        sta cy
        lda t2
        and #1
        tax
        lda card_col,x
        sta cx
        lda t2                  ; the last card of an odd count
        clc
        adc #1
        cmp ncards
        bne :+
        lda ncards
        lsr
        bcc :+
        lda #(40 - CARD_W) / 2
        sta cx
:       rts
card_row:  .byte 0, 4, 8
card_col:  .byte 1, 21

; A = colour: the card's frame
card_box:
        sta COLOR
        lda #CARD_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldx cx
        ldy cy
        jmp API_BOX

; A/X = label, printed into the card's top edge (cyan)
card_label:
        sta PTR
        stx PTR+1
        lda #3
        sta COLOR
        ldx cx
        inx
        inx
        ldy cy
        jmp API_PRINT

; n16 = value, A = colour: "$n" right-aligned in the card's middle row
card_value:
        sta COLOR
        jsr fmt_money
        eor #$ff
        sec
        adc cx
        clc
        adc #CARD_W - 1
        tax
        ldy cy
        iny
        jmp print_buf

; n16 -> buf = "$" and the decimal digits; A = length
fmt_money:
        ldx #0
:       jsr div10
        pha
        inx
        lda n16
        ora n16+1
        bne :-
        lda #'$'
        sta buf
        ldy #1
:       pla
        ora #'0'
        sta buf,y
        iny
        dex
        bne :-
        lda #0
        sta buf,y
        tya
        rts

; X, Y = position: print buf in COLOR
print_buf:
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        jmp API_PRINT

; Option boxes: idle blue, focus yellow; after the answer the right one green, a wrong pick red.
draw_options:
        lda #0
        sta t1
@o:     ldx t1
        lda #6
        cpx focus
        bne :+
        ldy reveal
        bne :+
        lda #7
:       ldy reveal
        beq @col
        lda #6
        cpx right
        bne :+
        lda #5
        bne @col
:       cpx chosen
        bne @col
        lda #2
@col:   sta COLOR
        lda t1
        and #1
        tax
        lda opt_col,x
        sta cx
        lda t1
        lsr
        tax
        lda opt_row,x
        sta cy
        lda #OPT_W
        sta FILL_W
        lda #3
        sta FILL_H
        ldx cx
        ldy cy
        jsr API_BOX
        lda #3                  ; the key number (cyan)
        sta COLOR
        lda t1
        clc
        adc #'1'
        ldx cx
        inx
        inx
        ldy cy
        iny
        jsr API_PUTC
        ldx t1                  ; the amount
        lda opt_lo,x
        sta n16
        lda opt_hi,x
        sta n16+1
        jsr fmt_money
        lda #1
        sta COLOR
        lda cx
        clc
        adc #6
        tax
        ldy cy
        iny
        jsr print_buf
        inc t1
        lda t1
        cmp nopt
        bne @o
        rts
opt_col:   .byte 5, 21
opt_row:   .byte OPT_Y, OPT_Y + 3

; "r/n  ok c" top right
draw_counter:
        lda #1
        sta COLOR
        ldx #31
        ldy #0
        lda ri
        clc
        adc #1
        jsr API_NUM
        lda #'/'
        ldx #32
        ldy #0
        jsr API_PUTC
        ldx #33
        ldy #0
        lda nrep
        jsr API_NUM
        text 35, 0, s_ok, 1
        ldx #38
        ldy #0
        lda correct
        jmp API_NUM

; ---- the game loop

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       jsr timer_tick          ; one clock for the whole game, also while showing an answer
        bcc :+
        jmp finish
:       lda reveal
        beq @ask
        dec reveal
        bne @wait
        inc ri
        lda ri
        cmp nrep
        bne :+
        jmp finish
:       jsr ask
@wait:  clc
        rts
@ask:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #BOT_T
        bne :+
        lda right
        jmp pick
:
.endif
        jsr number_key          ; keys 1-4, on the press only
        cmp last_key
        sta last_key
        beq :+
        cmp nopt
        bcs :+
        jmp pick
:       lda focus
        sta t0
        lda JOYP
        and #J_RIGHT
        beq :+
        lda focus               ; right: 0 -> 1, 2 -> 3
        ora #1
        bne @set
:       lda JOYP
        and #J_LEFT
        beq :+
        lda focus
        and #2
        bpl @set
:       lda JOYP
        and #J_DOWN
        beq :+
        lda focus
        ora #2
        bne @set
:       lda JOYP
        and #J_UP
        beq :+
        lda focus
        and #1
        bpl @set
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp pick
@set:   cmp nopt                ; (3 options: no box 3)
        bcs @out
        cmp t0
        beq @out
        sta focus
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_options
@out:   clc
        rts

; A = picked option
pick:
        sta chosen
        cmp right
        bne @wrong
        inc correct
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_good
        ldx #>s_good
        ldy #5
        bne @msg
@wrong: lda #SFX_BAD
        jsr API_SFX
        lda #<s_bad
        ldx #>s_bad
        ldy #2
@msg:   sty t0
        pha
        txa
        pha
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #MSG_Y
        jsr API_CENTER
        lda #REVEAL_T
        sta reveal
        jsr draw_options
        jsr draw_counter
        clc
        rts

; score = correct × 255 / nrep
finish:
        lda correct
        ldy #255
        jsr mul8                ; A:m_lo = correct × 255
        ldx #8                  ; 16 / 8 division, quotient in m_lo
@div:   asl m_lo
        rol
        bcs @sub
        cmp nrep
        bcc :+
@sub:   sbc nrep
        inc m_lo
:       dex
        bne @div
        lda m_lo
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Expense Report", 0
s_help:    .byte "Add up the receipts and pick the right amount.", 0
s_keys:    .byte "Joystick + FIRE, or keys 1-4", 0
s_ok:      .byte "ok", 0
s_receipt: .byte "RECEIPT", 0
s_budget:  .byte "BUDGET", 0
s_total:   .byte "What is the total?", 0
s_left:    .byte "How much budget is left?", 0
s_good:    .byte "Approved!", 0
s_bad:     .byte "Audit flag!", 0
DELTAS = 10
delta_tab: .byte 1, <-1, 2, <-2, 10, <-10, 5, <-5, 3, <-3

.include "gen/mg_math_data.s"

.bss
pool:      .res I_COUNT
rec_item:  .res MAX_REC
rec_val:   .res MAX_REC
opt_lo:    .res MAX_OPT + 1
opt_hi:    .res MAX_OPT + 1
nopts:     .res 1
deltas:    .res DELTAS
buf:       .res 8
