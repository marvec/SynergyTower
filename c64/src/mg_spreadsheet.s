; Fix the Spreadsheet (src/minigames/spreadsheet.js) as a disk-loaded overlay at $4000.
; A quarterly report: each row's Total should be the sum of its Q columns. Flag every wrong Total; the sheet
; submits itself once the flags match exactly, or pick SUBMIT to hand it in as it is.
; Difficulty (d = MG_DIFF / 255), as in the JS:
;   d = 0: 2 sheets, 32 s each, 5 rows, 2 Q columns, values 1-20, ~1.5 wrong rows, errors like #REF! (30%)
;          or totals off by 3-12 / 10
;   d = 1: 3 sheets (from d 0.5), 30 s each, 8 rows, 4 Q columns (3 from d 0.35, 4 from d 0.7), values 1-250,
;          ~3.5 wrong rows, totals off by 1-9 / 10 / 100 / 1-3 (no error codes from d 0.5)
; Sheet score = max(0, hits - false flags) / wrong rows; score = the mean over all sheets (unplayed = 0).
; Content: the department's row labels, gen/mg_spreadsheet_data.s (tools/mg/spreadsheet.js).

.include "api.inc"

MAX_ROWS  = 8
MAX_COLS  = 4
REVEAL_T  = 55                  ; 1.1 s showing the result before the next sheet
FILE_Y    = 2                   ; the file name
HEAD_Y    = 3                   ; column headers
LINE_Y    = 4
ROW_Y     = 5                   ; first data row, one every 2 screen rows
INFO_Y    = 22
MSG_Y     = 23
NUM_X     = 0                   ; row number
LABEL_X   = 2                   ; label (11 chars)
CUR_X     = 30                  ; cursor arrow
TOT_R     = 37                  ; right edge of the Total
FLAG_X    = 38                  ; '!' flagged / '?' missed
ERR_NONE  = $ff
BOT_STEP  = 6                   ; the bot acts every 6 frames

.zeropage
diff:     .res 1
sheets:   .res 1                ; 2 or 3
sheet_i:  .res 1
rows:     .res 1
cols:     .res 1
maxv:     .res 1
wrongc:   .res 1
cursor:   .res 1                ; 0..rows-1, rows = SUBMIT
reveal:   .res 1                ; frames left on the result, 0 = playing
done:     .res 1
sum:      .res 2                ; sum of the sheet scores
num:      .res 2                ; print16 / divide argument
prod:     .res 2                ; mul8 result
mb:       .res 1                ; mul8 multiplier
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
r_y:      .res 1                ; screen row being drawn
rr:       .res 1                ; data row being drawn / built
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif
zp_end:

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup

; A = difficulty 0-255
init:
        sta diff
        ldx #zp_end - sheets - 1
        lda #0
:       sta sheets,x
        dex
        bpl :-
        ; sheets: 2 below d 0.5, else 3
        ldx #2
        lda diff
        cmp #128
        bcc :+
        inx
:       stx sheets
        ; time: sheets × byDiff(32 s, 30 s) = sheets × (1600 - 100 d) frames
        lda #0
        ldx #100
        jsr byd
        sta t0
        lda #<1600
        sec
        sbc t0
        sta t1
        lda #>1600
        sbc #0
        sta t2
        lda t1
        sta num
        lda t2
        sta num+1
        ldx sheets
        dex
:       lda num
        clc
        adc t1
        sta num
        lda num+1
        adc t2
        sta num+1
        dex
        bne :-
        ; per-sheet constants: rows round(5..8), cols 2/3/4 at d 0.35/0.7, maxV round(20..250)
        lda #5
        ldx #8
        jsr byd
        sta rows
        ldx #2
        lda diff
        cmp #90                 ; d < 0.35
        bcc :+
        inx
        cmp #179                ; d < 0.7
        bcc :+
        inx
:       stx cols
        lda #20
        ldx #250
        jsr byd
        sta maxv
        ; the header and the timer
        lda #7
        sta COLOR
        lda #<s_name
        sta PTR
        lda #>s_name
        sta PTR+1
        ldx #1
        ldy #0
        jsr API_PRINT
        lda num
        ldx num+1
        jsr timer_start
        jsr make_sheet
        jmp draw_sheet

; byDiff: A = value at d 0, X = value at d 1 -> A = a + round((b - a) × d)
byd:
        sta t0
        stx t1
        cpx t0
        bcc @down
        txa
        sec
        sbc t0
        jsr mul_d
        clc
        adc t0
        rts
@down:  lda t0
        sec
        sbc t1
        jsr mul_d
        sta t1
        lda t0
        sec
        sbc t1
        rts

; A = round(A × diff / 255)
mul_d:
        ldx diff
        stx mb
        jsr mul8
        ; fall through
; A = round(prod / 255)
div255:
        lda prod
        clc
        adc #127
        sta prod
        bcc :+
        inc prod+1
:       lda prod+1              ; x / 255 = (x + (x >> 8) + 1) >> 8
        sec                     ; (the +1)
        adc prod
        lda prod+1
        adc #0
        rts

; prod = A × mb
mul8:
        sta t3
        lda #0
        sta prod
        sta prod+1
        ldx #8
:       asl prod
        rol prod+1
        asl mb
        bcc :+
        lda prod
        clc
        adc t3
        sta prod
        bcc :+
        inc prod+1
:       dex
        bne :--
        rts

; A = num / A (16 / 8 bit, quotient < 256)
divide:
        sta t3
        ldx #0
@sub:   lda num
        sec
        sbc t3
        tay
        lda num+1
        sbc #0
        bcc @done
        sta num+1
        sty num
        inx
        bne @sub
@done:  txa
        rts

; Build the sheet: labels, values, which totals are wrong and how.
make_sheet:
        lda #0
        sta cursor
        sta reveal
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; wrong rows: min(rows - 1, max(1, round(1.5 + 2 d + u))), u in [-0.5, 0.5): (384 + 2 d·256 + rand) >> 8
        jsr API_RAND
        sta t0
        lda diff
        asl
        sta t1                  ; low byte of 2 diff
        lda #1                  ; 384 = $180: high byte 1 (+ the bit shifted out of 2 diff)
        adc #0
        sta t2
        lda diff
        cmp #128                ; C = diff / 128
        lda t1
        adc #$80
        bcc :+
        inc t2
        clc
:       adc t0
        bcc :+
        inc t2
:       ldx t2
        bne :+
        inx
:       stx wrongc
        ldx rows
        dex
        cpx wrongc
        bcs :+
        stx wrongc
:       ; names: a partial shuffle of the 10 labels
        ldx #LABEL_N-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
        jsr shuffle_rows        ; pool[0..rows-1] = the names
        ldx #MAX_ROWS-1
:       lda pool,x
        sta r_name,x
        lda #0
        sta r_wrong,x
        sta r_flag,x
        dex
        bpl :-
        ; wrong rows: shuffle 0..rows-1, the first wrongc are wrong
        ldx rows
        dex
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
        jsr shuffle_n
        ldx #0
:       ldy pool,x
        lda #1
        sta r_wrong,y
        inx
        cpx wrongc
        bne :-
        ; the rows
        lda #0
        sta rr
@row:   lda rr                  ; vals: rng.int(1, maxV)
        asl
        asl
        sta t2                  ; rr × 4
        lda #0
        sta num
        sta num+1
        sta t1
@val:   lda maxv
        jsr API_RMOD
        clc
        adc #1
        pha
        lda t2
        clc
        adc t1
        tax
        pla
        sta r_vals,x
        clc
        adc num
        sta num
        bcc :+
        inc num+1
:       inc t1
        lda t1
        cmp cols
        bne @val
        ldx rr
        lda num
        sta r_sum_lo,x
        sta r_shown_lo,x
        lda num+1
        sta r_sum_hi,x
        sta r_shown_hi,x
        lda #ERR_NONE
        sta r_err,x
        lda r_wrong,x
        beq @next
        jsr make_wrong
@next:  inc rr
        lda rr
        cmp rows
        bne @row
        rts

; Row rr's shown total goes wrong: an error code (d < 0.5, 30%) or the sum ± a delta.
make_wrong:
        lda diff
        cmp #128
        bcs @delta
        jsr API_RAND
        cmp #77                 ; 30%
        bcs @easy
        lda #ERR_N
        jsr API_RMOD
        ldx rr
        sta r_err,x
        rts
@easy:  jsr API_RAND            ; [int(3, 12), 10]
        lsr
        lda #10
        bcc @sign
        lda #10
        jsr API_RMOD
        clc
        adc #3
        bne @sign
@delta: lda #4                  ; [int(1, 9), 10, 100, int(1, 3)]
        jsr API_RMOD
        tax
        lda delta_base,x
        ldy delta_rand,x
        beq @sign
        sta t0
        tya
        jsr API_RMOD
        clc
        adc t0
@sign:  sta t0                  ; delta
        jsr API_RAND
        ldx rr
        lsr
        bcc @plus
        lda r_sum_lo,x          ; minus, unless sum - delta < 0
        sec
        sbc t0
        tay
        lda r_sum_hi,x
        sbc #0
        bcc @plus
        sta r_shown_hi,x
        tya
        sta r_shown_lo,x
        rts
@plus:  lda r_sum_lo,x
        clc
        adc t0
        sta r_shown_lo,x
        lda r_sum_hi,x
        adc #0
        sta r_shown_hi,x
        rts
delta_base: .byte 1, 10, 100, 1
delta_rand: .byte 9, 0, 0, 3

; Fisher-Yates over pool[X..]: shuffle_rows does the first `rows` picks of LABEL_N, shuffle_n of `rows`.
shuffle_rows:
        lda #LABEL_N
        bne shuf
shuffle_n:
        lda rows
shuf:   sta t1                  ; n
@pick:  stx t0
        lda t1
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
        inx
        cpx rows
        bne @pick
        rts

; ---- drawing

draw_sheet:
        lda #2
        ldx #22
        jsr clear_rows
        jsr draw_counter
        lda #5
        sta COLOR
        lda #<s_file1
        sta PTR
        lda #>s_file1
        sta PTR+1
        ldx #5
        ldy #FILE_Y
        jsr API_PRINT
        lda sheet_i
        clc
        adc #'7'
        ldx #15
        ldy #FILE_Y
        jsr API_PUTC
        lda #<s_file2
        sta PTR
        lda #>s_file2
        sta PTR+1
        ldx #16
        ldy #FILE_Y
        jsr API_PRINT
        ; column headers
        lda #3
        sta COLOR
        lda #<s_item
        sta PTR
        lda #>s_item
        sta PTR+1
        ldx #LABEL_X
        ldy #HEAD_Y
        jsr API_PRINT
        lda #0
        sta t2
@q:     jsr col_edge
        dex
        stx t1
        lda #'Q'
        ldy #HEAD_Y
        jsr API_PUTC
        lda t2
        clc
        adc #'1'
        ldx t1
        inx
        ldy #HEAD_Y
        jsr API_PUTC
        inc t2
        lda t2
        cmp cols
        bne @q
        lda #<s_total
        sta PTR
        lda #>s_total
        sta PTR+1
        ldx #TOT_R-4
        ldy #HEAD_Y
        jsr API_PRINT
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #5
        sta COLOR
        lda #CH_B
        ldx #0
        ldy #LINE_Y
        jsr API_FILL
        lda #0
        sta rr
:       jsr draw_row
        inc rr
        lda rr
        cmp rows
        bne :-
        jsr draw_submit
        jsr draw_info
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; X = right edge column of Q column t2.
col_edge:
        lda cols
        asl
        asl
        adc t2                  ; (cols × 4 + c), cols 2-4
        tax
        lda edges-8,x
        tax
        rts
;                 2 cols          3 cols          4 cols
edges:     .byte 19, 27, 0, 0,  17, 22, 27, 0,  16, 20, 24, 28

draw_counter:
        lda #7
        sta COLOR
        lda #<s_sheet
        sta PTR
        lda #>s_sheet
        sta PTR+1
        ldx #31
        ldy #0
        jsr API_PRINT
        lda sheet_i
        clc
        adc #'1'
        ldx #37
        ldy #0
        jsr API_PUTC
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        lda sheets
        clc
        adc #'0'
        ldx #39
        ldy #0
        jmp API_PUTC

; Data row rr.
draw_row:
        lda rr
        asl
        adc #ROW_Y
        sta r_y
        ldx #1
        jsr clear_rows
        lda #3
        sta COLOR
        lda rr
        clc
        adc #'1'
        ldx #NUM_X
        ldy r_y
        jsr API_PUTC
        lda #1
        sta COLOR
        ldx rr
        ldy r_name,x
        lda label_lo,y
        sta PTR
        lda label_hi,y
        sta PTR+1
        ldx #LABEL_X
        ldy r_y
        jsr API_PRINT
        lda #0
        sta t2
@v:     lda rr
        asl
        asl
        adc t2
        tax
        lda r_vals,x
        sta num
        lda #0
        sta num+1
        jsr col_edge
        lda #1
        sta COLOR
        jsr print16
        inc t2
        lda t2
        cmp cols
        bne @v
        ; Total: colour by state
        ldx rr
        lda #1                  ; plain: white
        ldy r_flag,x
        beq :+
        lda #2                  ; flagged: red
:       ldy reveal
        beq @col
        lda r_wrong,x
        beq @right
        lda #5                  ; caught: green
        ldy r_flag,x
        bne @col
        lda #7                  ; missed: yellow
        bne @col
@right: lda #1
        ldy r_flag,x
        beq @col
        lda #4                  ; false flag: purple
@col:   sta COLOR
        lda r_err,x
        bmi @num
        tay
        lda err_lo,y
        sta PTR
        lda err_hi,y
        sta PTR+1
        ldx #TOT_R
        jsr print_right
        jmp @mark
@num:   lda r_shown_lo,x
        sta num
        lda r_shown_hi,x
        sta num+1
        ldx #TOT_R
        jsr print16
@mark:  ldx rr
        lda r_flag,x
        beq @miss
        lda #'!'
        bne @put
@miss:  lda reveal
        beq @cur
        lda r_wrong,x
        beq @cur
        lda #'?'
@put:   ldx #FLAG_X
        ldy r_y
        jsr API_PUTC
@cur:   lda rr
        ; fall through
; Cursor arrow at row A (data row or rows = SUBMIT), if it is the cursor's.
draw_cursor:
        cmp cursor
        bne @off
        ldx reveal
        bne @off
        ldx #7
        stx COLOR
        asl
        adc #ROW_Y
        tay
        lda #CH_ARROW
        ldx #CUR_X
        jmp API_PUTC
@off:   asl
        adc #ROW_Y
        tay
        lda #' '
        ldx #CUR_X
        jmp API_PUTC

draw_submit:
        lda rows
        asl
        adc #ROW_Y
        tay
        sty r_y
        lda #5
        sta COLOR
        lda #<s_submit
        sta PTR
        lda #>s_submit
        sta PTR+1
        ldx #TOT_R-5
        jsr API_PRINT
        lda rows
        jmp draw_cursor

draw_info:
        lda #1
        sta COLOR
        lda #<s_info
        sta PTR
        lda #>s_info
        sta PTR+1
        ldx #0
        ldy #INFO_Y
        jsr API_PRINT
        ldx #MAX_ROWS-1
        lda #0
:       clc
        adc r_flag,x
        dex
        bpl :-
        ldx #39
        ldy #INFO_Y
        jmp API_NUM

; num printed right-aligned with its last digit at column X, row r_y, in COLOR.
print16:
        stx t0
        ldy #0                  ; digits so far
        ldx #3
@pow:   lda #0
        sta t1
@sub:   lda num
        sec
        sbc pow_lo,x
        sta t3
        lda num+1
        sbc pow_hi,x
        bcc @dig
        sta num+1
        lda t3
        sta num
        inc t1
        bne @sub
@dig:   lda t1
        bne :+
        cpy #0
        beq @skip
:       ora #'0'
        sta nbuf,y
        iny
@skip:  dex
        bpl @pow
        lda num
        ora #'0'
        sta nbuf,y
        iny
        lda #0
        sta nbuf,y
        lda #<nbuf
        sta PTR
        lda #>nbuf
        sta PTR+1
        ldx t0
        ; fall through
; PTR string printed right-aligned to column X, row r_y.
print_right:
        stx t0
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       sty t1
        lda t0
        sec
        sbc t1
        tax
        inx
        ldy r_y
        jmp API_PRINT
pow_lo: .byte <10, <100, <1000, <10000
pow_hi: .byte >10, >100, >1000, >10000

; ---- playing

frame:
        lda done
        beq :+
        sec
        rts
:       jsr timer_tick
        bcc @run
        lda reveal              ; time's up: the open sheet counts as it stands
        bne :+
        jsr evaluate
:       jmp finish
@run:   lda reveal
        beq @play
        dec reveal
        bne @wait
        inc sheet_i
        lda sheet_i
        cmp sheets
        bne :+
        jmp finish
:       jsr make_sheet
        jsr draw_sheet
@wait:  clc
        rts
@play:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #BOT_STEP
        bcc @input
        lda #0
        sta bot_t
        ldx #0                  ; first row whose flag is not right yet
:       lda r_flag,x
        eor r_wrong,x
        bne :+
        inx
        bne :-
:       cpx cursor
        beq @fire
        bcc @up
        bcs @down
@input:
.endif
        lda JOYP
        and #J_DOWN
        bne @down
        lda JOYP
        and #J_UP
        bne @up
        lda JOYP
        and #J_FIRE
        beq @wait
@fire:  lda cursor
        cmp rows
        beq :+
        jmp toggle
:       jmp submit
@down:  ldx cursor
        inx
        cpx rows
        beq :+
        bcc :+
        ldx #0
:       jmp move
@up:    ldx cursor
        dex
        bpl move
        ldx rows
move:   lda cursor
        stx cursor
        jsr draw_cursor
        lda cursor
        jsr draw_cursor
        lda #SFX_BLIP
        jsr API_SFX
        clc
        rts

toggle:
        tax
        stx rr
        lda r_flag,x
        eor #1
        sta r_flag,x
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_row
        jsr draw_info
        ldx rows                ; flags == wrong rows: submit by itself
        dex
:       lda r_flag,x
        cmp r_wrong,x
        bne :+
        dex
        bpl :-
        jmp submit
:       clc
        rts

submit:
        jsr evaluate
        pha
        cmp #255
        bne @part
        lda #SFX_GOOD
        jsr API_SFX
        lda #5
        sta COLOR
        lda #<s_fixed
        ldx #>s_fixed
        ldy #MSG_Y
        jsr API_CENTER
        pla
        jmp @shown
@part:  lda #SFX_BAD
        jsr API_SFX
        pla
        pha
        ldx #100                ; percent = round(score × 100 / 255)
        stx mb
        jsr mul8
        jsr div255
        sta t2
        pla
        ldx #7
        cmp #128
        bcs :+
        ldx #2
:       stx COLOR
        lda t2
        sta num
        lda #0
        sta num+1
        lda #MSG_Y
        sta r_y
        ldx #16
        jsr print16
        lda #<s_pct
        sta PTR
        lda #>s_pct
        sta PTR+1
        ldx #17
        ldy #MSG_Y
        jsr API_PRINT
@shown: lda #REVEAL_T
        sta reveal
        lda #0
        sta rr
:       jsr draw_row
        inc rr
        lda rr
        cmp rows
        bne :-
        lda rows
        jsr draw_cursor
        clc
        rts

; A = this sheet's score: max(0, hits - false flags) × 255 / wrong rows, added to sum.
evaluate:
        lda #0
        sta t2                  ; hits - falses (signed)
        ldx rows
        dex
@r:     lda r_flag,x
        beq @n
        lda r_wrong,x
        beq @f
        inc t2
        jmp @n
@f:     dec t2
@n:     dex
        bpl @r
        lda t2
        bpl :+
        lda #0
:       sta num+1               ; × 256 - n = × 255
        sta t2
        lda #0
        sec
        sbc t2
        sta num
        bcs :+
        dec num+1
:       lda wrongc
        jsr divide
        pha
        clc
        adc sum
        sta sum
        bcc :+
        inc sum+1
:       pla
        rts

; score = sum / sheets
finish:
        lda sum
        sta num
        lda sum+1
        sta num+1
        lda sheets
        jsr divide
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:    .byte "Fix the Spreadsheet", 0
s_help:    .byte "Flag every wrong Total.", 0
s_sheet:   .byte "Sheet", 0
s_file1:   .byte "Q-Report_v", 0
s_file2:   .byte "_FINAL_final2.xlsx", 0
s_item:    .byte "Item", 0
s_total:   .byte "Total", 0
s_submit:  .byte "SUBMIT", 0
s_info:    .byte "Total = sum of the Q columns. Flagged:", 0
s_keys:    .byte "Up/down, FIRE flags. FIRE on SUBMIT: done", 0
s_fixed:   .byte "All fixed!", 0
s_pct:     .byte "% correct", 0

.include "gen/mg_spreadsheet_data.s"

.bss
pool:       .res LABEL_N
r_name:     .res MAX_ROWS
r_vals:     .res MAX_ROWS * MAX_COLS
r_sum_lo:   .res MAX_ROWS
r_sum_hi:   .res MAX_ROWS
r_shown_lo: .res MAX_ROWS
r_shown_hi: .res MAX_ROWS
r_err:      .res MAX_ROWS
r_wrong:    .res MAX_ROWS
r_flag:     .res MAX_ROWS
nbuf:       .res 6
