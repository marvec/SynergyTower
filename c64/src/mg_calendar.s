; Schedule the Meeting (src/minigames/calendar.js) as a disk-loaded overlay at $4000.
; Find the one time slot where every attendee is free and book it. Each attendee gets ceil(slots/6) ..
; ceil(slots/3) busy blocks of 1-2 slots (1-3 with more than 8 slots); every other slot is then made busy for
; someone. Score = meetings booked / meetings.
; Difficulty d = MG_DIFF / 255 (JS byDiff(d, a, b) = a + (b - a) × d, rounded):
;   d = 0: 3 meetings, 3 attendees, 8 hourly slots (9:00-16:00), 14 s per meeting
;   d = 1: 5 meetings, 6 attendees, 16 half-hour slots (9:00-16:30), 7.5 s per meeting
;   (hourly up to 9 slots; the hours are labelled every other slot from 9 slots on, as in the JS)
; The layout follows: 4 / 3 / 2 columns per slot (up to 9 / 12 / 16 slots), 5 / 4 / 3 rows per attendee
; (3 / 4 / 5-6 attendees; 3-row bars carry their labels, 2-row bars don't have the room).
; Content: the department's attendees and the busy labels (gen/mg_calendar_data.s).

.include "api.inc"

MAX_SLOTS  = 16
MAX_PEOPLE = 6
REVEAL_T   = 55                 ; 1.1 s showing the answer
NO_PICK    = $ff                ; the time ran out

; layout
GX       = 3                    ; grid: first column
FIND_Y   = 2
HOUR_Y   = 3                    ; hour labels
PY       = 4                    ; first attendee: name row, then 3 (or 2) bar rows
MSG_Y    = 23                   ; messages (left), "Booked n/m" (right)
BOOKED_X = 28
; quarter-block chars (240 + 1 top left, 2 top right, 4 bottom left, 8 bottom right) for the busy bars:
; a 3-row bar fills the bottom half of its top row, its middle row and the top half of its bottom row; a 2-row
; bar the bottom half of its top row and the top half of the other. Each block starts with a half-cell gap.
Q_BOT    = 240 + 4 + 8
Q_TOP    = 240 + 1 + 2
Q_RIGHT  = 240 + 2 + 8
Q_BR     = 240 + 8
Q_TR     = 240 + 2
BAR_COL  = 6                    ; busy blocks: blue
HOUR_COL = 3                    ; hour labels: cyan

.zeropage
round:    .res 1
cursor:   .res 1
correct:  .res 1
reveal:   .res 1                ; frames left on the answer, 0 = choosing
free:     .res 1                ; the slot free for everyone
done:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
row:      .res 1
col:      .res 1
tint:     .res 1
scr:      .res 2                ; screen / colour RAM pointers for mark_col
clr:      .res 2
; from the difficulty
rounds:   .res 1
slots:    .res 1
people:   .res 1
round_t:  .res 2
slot_w:   .res 1                ; columns per slot
p_h:      .res 1                ; rows per attendee
bar_h:    .res 1                ; bar rows: 3 or 2
arrow_y:  .res 1
blk_lo:   .res 1                ; busy blocks per attendee: lo .. hi
blk_n:    .res 1                ; hi - lo + 1
blk_len:  .res 1                ; longest block
hour_dx:  .res 1                ; hour label offset in its column
arrow_dx: .res 1
bd_a:     .res 2                ; bydiff
bd_b:     .res 2
bd_m:     .res 2
bd_p:     .res 3
bd_t:     .res 1
bd_h:     .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A/X = byDiff(a, b), rounded (16 bit).
.macro bydiff_w aa, bb
        lda #<(aa)
        sta bd_a
        lda #>(aa)
        sta bd_a+1
        lda #<(bb)
        sta bd_b
        lda #>(bb)
        sta bd_b+1
        jsr bydiff
.endmacro

; ---- setup

init:
        sta MG_DIFF
        lda #0
        sta round
        sta correct
        sta reveal
        sta done
        bydiff_w 3, 5
        sta rounds
        bydiff_w 8, 16
        sta slots
        bydiff_w 3, 6
        sta people
        bydiff_w 14 * 50, 15 * 25
        sta round_t
        stx round_t+1
        ; columns per slot: 4 up to 9 slots, 3 up to 12, then 2
        lda slots
        ldx #4
        cmp #10
        bcc :+
        dex
        cmp #13
        bcc :+
        dex
:       stx slot_w
        ldy #1                  ; hour labels one column in, except in 2-column slots
        lda #1                  ; cursor arrows (2 wide) centred
        cpx #4
        beq :+
        lda #0
        cpx #3
        beq :+
        dey
:       sty hour_dx
        sta arrow_dx
        ; rows per attendee: 5 for 3, 4 for 4, 3 for 5-6
        ldx #5
        lda people
        cmp #4
        bcc :+
        ldx #4
        cmp #4
        beq :+
        ldx #3
:       stx p_h
        ldy #3
        cpx #4
        bcs :+
        dey
:       sty bar_h
        ; tables: slot columns, attendee rows, attendee rows in busy[]
        lda #GX
        ldx #0
:       sta slot_x,x
        clc
        adc slot_w
        inx
        cpx slots
        bne :-
        lda #PY
        ldx #0
:       sta row_y,x
        clc
        adc p_h
        inx
        cpx people
        bne :-
        sta arrow_y
        lda #0
        ldx #0
:       sta row_base,x
        clc
        adc slots
        inx
        cpx people
        bne :-
        ; busy blocks: ceil(slots / 6) .. ceil(slots / 3), up to 2 slots long (3 with more than 8 slots)
        lda slots
        clc
        adc #5
        ldx #6
        jsr div_small
        sta blk_lo
        lda slots
        clc
        adc #2
        ldx #3
        jsr div_small
        sec
        sbc blk_lo
        clc
        adc #1
        sta blk_n
        ldx #2
        lda slots
        cmp #9
        bcc :+
        inx
:       stx blk_len
        lda slots
        lsr
        sta cursor
        text 1, 0, s_name, 7
        text 1, FIND_Y, s_find, 1
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        ; fall through

; Make and draw meeting `round`.
new_round:
.if .defined(AUTOPLAY)
        lda #0
        sta bot_t
.endif
        jsr make_round
        text 29, 0, s_meeting, 7
        lda #7
        sta COLOR
        lda round
        clc
        adc #1
        ldx #37
        ldy #0
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        lda rounds
        ldx #39
        ldy #0
        jsr API_NUM
        lda #HOUR_Y
        ldx #MSG_Y - HOUR_Y + 1
        jsr clear_rows
        jsr draw_booked
        ; hour labels
        lda #0
        sta t0
:       jsr draw_hour
        inc t0
        lda t0
        cmp slots
        bne :-
        ; attendees
        lda #0
        sta t3
:       jsr draw_person
        inc t3
        lda t3
        cmp people
        bne :-
        lda cursor
        ldx #7
        jsr mark_col
        lda round_t
        ldx round_t+1
        jmp timer_start

; A / X -> A (small numbers).
div_small:
        stx t0
        ldx #0
:       cmp t0
        bcc :+
        sbc t0
        inx
        bne :-
:       txa
        rts

; busy[row_base(p) + s] = 0 free, else busy label + 1. One slot (free) is open for all, every other has a
; conflict.
make_round:
        lda slots
        jsr API_RMOD
        sta free
        ; roster: `people` of the department's names (partial Fisher-Yates)
        ldx #P_NAMES-1
:       txa
        sta pool,x
        dex
        bpl :-
        ldx #0
@pick:  stx t0
        lda #P_NAMES
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
        sta roster,x
        jsr API_RAND
        and #7
        tay
        lda hair_tab,y
        ldx t0
        sta hair,x
        inx
        cpx people
        bne @pick
        ldx #MAX_PEOPLE * MAX_SLOTS - 1
        lda #0
:       sta busy,x
        dex
        bpl :-
        ; each attendee: blk_lo + random(blk_n) blocks of 1..blk_len slots, a random label each
        lda #0
        sta t3
@person:
        lda blk_n
        jsr API_RMOD
        clc
        adc blk_lo
        sta t2                  ; blocks
@block: lda blk_len
        jsr API_RMOD
        clc
        adc #1
        sta t1                  ; length
        lda slots
        sec
        sbc t1
        clc
        adc #1
        jsr API_RMOD            ; start 0..slots-len
        ldx t3
        clc
        adc row_base,x
        sta t0
        lda #B_LABELS
        jsr API_RMOD
        clc
        adc #1
        ldx t0
        ldy t1
:       sta busy,x
        inx
        dey
        bne :-
        dec t2
        bne @block
        inc t3
        lda t3
        cmp people
        bne @person
        ; the free slot is free for all; any other slot free for all gets a random attendee busy
        lda #0
        sta t0                  ; slot
@slot:  ldx t0
        ldy people
        cpx free
        bne @check
:       lda #0
        sta busy,x
        txa                     ; same slot, next attendee
        clc
        adc slots
        tax
        dey
        bne :-
        beq @next
@check: lda #0
        sta t1
:       lda busy,x
        ora t1
        sta t1
        txa
        clc
        adc slots
        tax
        dey
        bne :-
        lda t1
        bne @next
        lda people
        jsr API_RMOD
        tax
        lda row_base,x
        clc
        adc t0
        sta t1
        lda #B_LABELS
        jsr API_RMOD
        clc
        adc #1
        ldx t1
        sta busy,x
@next:  inc t0
        lda t0
        cmp slots
        bne @slot
        rts

; ---- drawing

; Hour label of slot t0 in its normal colour.
draw_hour:
        lda #HOUR_COL
        sta COLOR
        lda t0
        ; fall through

; A = slot: its hour over the column, in COLOR. Every slot is labelled up to 8 slots, then every other one;
; hourly slots up to 9, half hours from 10 (only the full hours get a label).
put_hour:
        tax
        lda slots
        cmp #9
        bcc :+
        txa
        lsr
        bcs @out                ; odd slot: no label
:       lda slot_x,x
        clc
        adc hour_dx
        sta col
        txa
        ldy slots
        cpy #10
        bcc :+
        lsr                     ; half hours: slot / 2
:       clc
        adc #9
        ldx col
        ldy #HOUR_Y
        jmp API_NUM
@out:   rts

; Attendee t3: name, face and the busy bars of their row.
draw_person:
        ldx t3
        lda row_y,x
        sta row
        ldy roster,x
        lda pn_lo,y
        sta PTR
        lda pn_hi,y
        sta PTR+1
        lda #1
        sta COLOR
        ldx #1
        ldy row
        jsr API_PRINT
        ldx t3
        lda hair,x
        ldx #1
        ldy row
        iny
        jsr face
        lda #0
        sta t0                  ; slot
@slot:  ldx t3
        lda row_base,x
        clc
        adc t0
        tax
        lda busy,x
        bne @busy
        ; free: checker dots, invisible (colour 0) until the cursor or the answer tints the column
        lda #0
        sta COLOR
        lda slot_w
        sta FILL_W
        lda bar_h
        sta FILL_H
        ldx t0
        lda slot_x,x
        tax
        ldy row
        iny
        lda #CH_CHECKER
        jsr API_FILL
        jmp @next
@busy:  sta t1                  ; label + 1
        ldy #1                  ; t2 = 1: the slot starts a block
        lda t0
        beq :+
        lda busy-1,x
        cmp t1
        bne :+
        dey
:       sty t2
        lda #BAR_COL
        sta COLOR
        ldx t0
        lda slot_x,x
        sta col
        lda bar_h
        cmp #3
        bne @two
        ; 3-row bar. First column: the block's left gap, or a full bar cell
        ldy t2
        lda first_top,y
        ldx col
        ldy row
        iny
        jsr API_PUTC
        ldy t2
        lda first_mid,y
        ldx col
        ldy row
        iny
        iny
        jsr API_PUTC
        ldy t2
        lda first_bot,y
        ldx col
        ldy row
        iny
        iny
        iny
        jsr API_PUTC
        ; the other columns
        jsr rest_cols
        ldy row
        iny
        lda #Q_BOT
        jsr kfill
        iny
        ldx col
        lda #CH_BLOCK
        jsr kfill
        iny
        ldx col
        lda #Q_TOP
        jsr kfill
        jmp @next
@two:   ldy t2                  ; 2-row bar
        lda first_top,y
        ldx col
        ldy row
        iny
        jsr API_PUTC
        ldy t2
        lda first_bot,y
        ldx col
        ldy row
        iny
        iny
        jsr API_PUTC
        jsr rest_cols
        ldy row
        iny
        lda #Q_BOT
        jsr kfill
        iny
        ldx col
        lda #Q_TOP
        jsr kfill
@next:  inc t0
        lda t0
        cmp slots
        beq :+
        jmp @slot
        ; then the labels (3-row bars), each at its block's start when it fits the block (after the gap)
:       lda bar_h
        cmp #3
        bne @done
        lda #0
        sta t0
@label: ldx t3
        lda row_base,x
        clc
        adc t0
        tax
        lda busy,x
        beq @nol
        sta t1
        ldy t0
        beq :+
        cmp busy-1,x
        beq @nol
:       jsr block_label
@nol:   inc t0
        lda t0
        cmp slots
        bne @label
@done:  rts

; FILL_W = slot_w - 1, FILL_H = 1, col / X = the column after the first. Keeps nothing.
rest_cols:
        ldx slot_w
        dex
        stx FILL_W
        lda #1
        sta FILL_H
        inc col
        ldx col
        rts

; Label t1-1 of the block starting at slot t0 (attendee t3), if it fits.
block_label:
        ldx t3
        lda row_base,x
        clc
        adc t0
        tax
        ldy #0                  ; run length in slots
:       iny
        inx
        tya
        clc
        adc t0
        cmp slots
        beq :+
        lda busy,x
        cmp t1
        beq :-
:       lda #0                  ; width = run × slot_w - 1 >= label length?
        clc
:       adc slot_w
        dey
        bne :-
        sec
        sbc #1
        ldx t1
        cmp bl_len-1,x
        bcc @out
        lda bl_lo-1,x
        sta PTR
        lda bl_hi-1,x
        sta PTR+1
        lda #1
        sta COLOR
        ldx t0
        lda slot_x,x
        tax
        inx
        ldy row
        iny
        iny
        jmp API_PRINT
@out:   rts

draw_booked:
        text BOOKED_X, MSG_Y, s_booked, 7
        lda #7
        sta COLOR
        lda correct
        ldx #BOOKED_X + 7
        ldy #MSG_Y
        jsr API_NUM
        lda #'/'
        ldx #BOOKED_X + 9
        ldy #MSG_Y
        jsr API_PUTC
        lda rounds
        ldx #BOOKED_X + 11
        ldy #MSG_Y
        jmp API_NUM

; A/X = message, Y = colour: centred in the left part of the message row.
message:
        sty t1
        pha
        txa
        pha
        lda #BOOKED_X
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #0
        ldy #MSG_Y
        jsr API_FILL
        lda t1
        sta COLOR
        pla
        sta PTR+1
        pla
        sta PTR
        ldy #0                  ; column (BOOKED_X - length) / 2
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #BOOKED_X
        lsr
        tax
        ldy #MSG_Y
        jmp API_PRINT

; A = slot, X = colour: the free cells of its column dotted in that colour, its hour label too; arrows under
; it for the cursor (colour 7), none otherwise. Colour 0 = back to normal.
mark_col:
        sta t0
        stx tint
        txa
        bne :+
        lda #HOUR_COL
:       sta COLOR
        lda t0
        jsr put_hour
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        lda #CH_UP
        ldx tint
        cpx #7
        beq :+
        lda #' '
:       pha
        ldx t0
        lda slot_x,x
        clc
        adc arrow_dx
        tax
        ldy arrow_y
        pla
        jsr API_FILL
        ; every checker cell of the column takes the colour
        ldx t0
        lda slot_x,x
        clc
        adc #<(SCREEN + PY*40)
        sta scr
        lda #>(SCREEN + PY*40)
        adc #0
        sta scr+1
        lda arrow_y
        sec
        sbc #PY
        tax                     ; rows: people × p_h
@row:   lda scr
        sta clr
        lda scr+1
        clc
        adc #>(COLRAM - SCREEN)
        sta clr+1
        ldy slot_w
        dey
:       lda (scr),y
        cmp #CH_CHECKER
        bne :+
        lda tint
        sta (clr),y
:       dey
        bpl :--
        lda scr
        clc
        adc #40
        sta scr
        bcc :+
        inc scr+1
:       dex
        bne @row
        rts

; ---- play

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda reveal
        beq @choose
        dec reveal
        bne @out
        inc round
        lda round
        cmp rounds
        bne :+
        jmp finish
:       jsr new_round
@out:   clc
        rts
@choose:
        jsr timer_tick
        bcc :+
        lda #NO_PICK
        jmp pick
:
.if .defined(AUTOPLAY)
        inc bot_t               ; perfect player: walk the cursor to the free slot, then book it
        lda bot_t
        and #7
        bne @input
        lda cursor
        cmp free
        bne :+
        jmp pick
:       bcc @right
        bcs @left
.endif
@input: lda JOYP
        and #J_LEFT
        beq :+
@left:  ldx cursor
        dex
        bpl @move
        ldx slots
        dex
        bne @move
:       lda JOYP
        and #J_RIGHT
        beq :+
@right: ldx cursor
        inx
        cpx slots
        bcc @move
        ldx #0
        beq @move
:       lda JOYP
        and #J_FIRE
        beq @out
        lda cursor
        jmp pick
@move:  stx t3
        lda cursor
        ldx #0
        jsr mark_col
        lda t3
        sta cursor
        ldx #7
        jsr mark_col
        lda #SFX_BLIP
        jsr API_SFX
        clc
        rts

; A = slot booked, NO_PICK = time ran out: show the answer for 1.1 s.
pick:
        sta t3
        lda cursor
        ldx #0
        jsr mark_col
        lda free
        ldx #5
        jsr mark_col
        lda #0
        jsr API_BAR             ; the timer shows empty meanwhile
        lda #REVEAL_T
        sta reveal
        lda t3
        cmp free
        bne @wrong
        inc correct
        jsr draw_booked
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_ok
        ldx #>s_ok
        ldy #5
        jsr message
        clc
        rts
@wrong: cmp #NO_PICK
        beq @slow
        ldx #2
        jsr mark_col            ; the clash in red
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_clash
        ldx #>s_clash
        ldy #2
        jsr message
        clc
        rts
@slow:  lda #SFX_BAD
        jsr API_SFX
        lda #<s_slow
        ldx #>s_slow
        ldy #2
        jsr message
        clc
        rts

; score = booked × 255 / meetings
finish:
        lda correct
        beq @set
        sta bd_m+1              ; correct × 256 - correct
        lda #0
        sec
        sbc correct
        sta bd_m
        dec bd_m+1
        lda #0
        sta t0
        ldx #16
@d:     asl bd_m
        rol bd_m+1
        rol t0
        lda t0
        cmp rounds
        bcc :+
        sbc rounds
        sta t0
        inc bd_m
:       dex
        bne @d
        lda bd_m
@set:   sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; A/X = round(bd_a + (bd_b - bd_a) × MG_DIFF / 255), 16 bit.
bydiff:
        lda bd_b
        sec
        sbc bd_a
        sta bd_m
        lda bd_b+1
        sbc bd_a+1
        sta bd_m+1
        php                     ; N: b < a
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda MG_DIFF             ; p = |b - a| × diff (24 bit)
        sta bd_t
        lda #0
        sta bd_p+1
        sta bd_p+2
        ldy #8
@l:     lsr bd_t
        bcc :+
        lda bd_p+1
        clc
        adc bd_m
        sta bd_p+1
        lda bd_p+2
        adc bd_m+1
        sta bd_p+2
:       ror bd_p+2
        ror bd_p+1
        ror bd_p
        dey
        bne @l
        ; p / 255 ~ (p + p / 256 + 128) / 256 = p2:(p1 + p2) + carry of (p0 + p1 + 128)
        lda #0
        sta bd_h
        lda bd_p
        clc
        adc #$80
        bcc :+
        inc bd_h
        clc
:       adc bd_p+1
        bcc :+
        inc bd_h
:       lda bd_p+1
        clc
        adc bd_p+2
        sta bd_m
        lda bd_p+2
        adc #0
        sta bd_m+1
        lda bd_m
        clc
        adc bd_h
        sta bd_m
        bcc :+
        inc bd_m+1
:       plp
        bpl :+
        lda #0
        sec
        sbc bd_m
        sta bd_m
        lda #0
        sbc bd_m+1
        sta bd_m+1
:       lda bd_m
        clc
        adc bd_a
        pha
        lda bd_m+1
        adc bd_a+1
        tax
        pla
        rts

.rodata
s_name:    .byte "Schedule the Meeting", 0
s_help:    .byte "Find the slot where everyone is free.", 0
s_find:    .byte "Find a slot free for ALL attendees", 0
s_keys:    .byte "Left/right choose, FIRE book", 0
s_meeting: .byte "Meeting", 0
s_booked:  .byte "Booked", 0
s_ok:      .byte "Booked!", 0
s_clash:   .byte "Conflict!", 0
s_slow:    .byte "Too slow!", 0
hair_tab:  .byte 2, 7, 1, 4, 3, 5, 2, 1
first_top: .byte Q_BOT, Q_BR     ; a bar's first column: inside a block, at its start
first_mid: .byte CH_BLOCK, Q_RIGHT
first_bot: .byte Q_TOP, Q_TR

.include "gen/mg_calendar_data.s"

.bss
pool:     .res P_NAMES
roster:   .res MAX_PEOPLE
hair:     .res MAX_PEOPLE
slot_x:   .res MAX_SLOTS
row_y:    .res MAX_PEOPLE
row_base: .res MAX_PEOPLE
busy:     .res MAX_PEOPLE * MAX_SLOTS
