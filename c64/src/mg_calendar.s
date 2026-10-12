; Schedule the Meeting (src/minigames/calendar.js) as a disk-loaded overlay at $4000.
; Find the one time slot where every attendee is free and book it. Difficulty 0 (floors 1-2): 3 meetings,
; 3 attendees, 8 hourly slots (9:00-16:00), 14 s per meeting. Each attendee gets 2-3 busy blocks of 1-2 slots;
; every other slot is then made busy for someone. Score = meetings booked / 3.
; Content: the department's attendees and the busy labels (gen/mg_calendar_data.s).

.include "api.inc"

ROUNDS   = 3                    ; round(byDiff(d, 3, 5))
SLOTS    = 8                    ; round(byDiff(d, 8, 16)), hourly from 9:00
PEOPLE   = 3                    ; round(byDiff(d, 3, 6))
ROUND_T  = 14 * 50              ; byDiff(d, 14, 7.5) s
REVEAL_T = 55                   ; 1.1 s showing the answer
NO_PICK  = $ff                  ; the time ran out

; layout
GX       = 5                    ; grid: first column
SLOT_W   = 4                    ; columns per slot
HOUR_Y   = 5                    ; hour labels
PY       = 6                    ; first attendee: name row, then 3 bar rows
P_H      = 5                    ; rows per attendee
ARROW_Y  = PY + PEOPLE * P_H    ; cursor arrows under the grid
MSG_Y    = ARROW_Y + 1
BOOKED_Y = MSG_Y + 1
; quarter-block chars (240 + 1 top left, 2 top right, 4 bottom left, 8 bottom right) for the busy bars:
; a bar fills the bottom half of its top row, its middle row and the top half of its bottom row; each block
; starts with a half-cell gap
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
scr:      .res 2                ; screen / colour RAM pointers for tint_col
clr:      .res 2
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
        sta round
        sta correct
        sta reveal
        sta done
        lda #SLOTS/2
        sta cursor
        text 1, 0, s_name, 7
        text 1, 3, s_find, 1
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
        lda #ROUNDS
        ldx #39
        ldy #0
        jsr API_NUM
        jsr draw_booked
        lda #HOUR_Y
        ldx #MSG_Y - HOUR_Y + 1
        jsr clear_rows
        ; hour labels 9..16
        lda #0
        sta t0
:       jsr draw_hour
        inc t0
        lda t0
        cmp #SLOTS
        bne :-
        ; attendees
        lda #0
        sta t3
:       jsr draw_person
        inc t3
        lda t3
        cmp #PEOPLE
        bne :-
        lda cursor
        ldx #7
        jsr mark_col
        lda #<ROUND_T
        ldx #>ROUND_T
        jmp timer_start

; busy[p × SLOTS + s] = 0 free, else busy label + 1. One slot (free) is open for all, every other has a conflict.
make_round:
        lda #SLOTS
        jsr API_RMOD
        sta free
        ; roster: PEOPLE of the department's names (partial Fisher-Yates)
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
        cpx #PEOPLE
        bne @pick
        ldx #PEOPLE*SLOTS-1
        lda #0
:       sta busy,x
        dex
        bpl :-
        ; each attendee: 2-3 blocks (ceil(slots/6)..ceil(slots/3)) of 1-2 slots, a random label each
        lda #0
        sta t3
@person:
        lda #2
        jsr API_RMOD
        clc
        adc #2
        sta t2                  ; blocks
@block: lda #2
        jsr API_RMOD
        clc
        adc #1
        sta t1                  ; length
        lda #SLOTS+1
        sec
        sbc t1
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
        cmp #PEOPLE
        bne @person
        ; the free slot is free for all; any other slot free for all gets a random attendee busy
        lda #0
        sta t0                  ; slot
@slot:  ldx t0
        ldy #PEOPLE
        cpx free
        bne @check
:       lda #0
        sta busy,x
        txa                     ; same slot, next attendee
        clc
        adc #SLOTS
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
        adc #SLOTS
        tax
        dey
        bne :-
        lda t1
        bne @next
        lda #PEOPLE
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
        cmp #SLOTS
        bne @slot
        rts

; ---- drawing

; Hour label of slot t0 in its normal colour.
draw_hour:
        lda #HOUR_COL
        sta COLOR
        lda t0
        ; fall through

; A = slot: its hour (9..16) over the column, in COLOR.
put_hour:
        tax
        lda slot_x,x
        sta col
        inc col
        txa
        clc
        adc #9
        ldx col
        ldy #HOUR_Y
        jmp API_NUM

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
@slot:  lda t3
        tax
        lda row_base,x
        clc
        adc t0
        tax
        lda busy,x
        bne @busy
        ; free: checker dots, invisible (colour 0) until the cursor or the answer tints the column
        lda #0
        sta COLOR
        lda #SLOT_W
        sta FILL_W
        lda #3
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
        ; first column: the block's left gap, or a full bar cell
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
        lda #SLOT_W-1
        sta FILL_W
        lda #1
        sta FILL_H
        inc col
        ldx col
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
@next:  inc t0
        lda t0
        cmp #SLOTS
        beq :+
        jmp @slot
        ; then the labels, each at its block's start when it fits the block (after the half-cell gap)
:       lda #0
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
        cmp #SLOTS
        bne @label
        rts

; Label t1-1 of the block starting at slot t0 (attendee t3), if it fits.
block_label:
        lda t3
        tax
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
        cmp #SLOTS
        beq :+
        lda busy,x
        cmp t1
        beq :-
:       tya                     ; width = run × SLOT_W - 1 >= label length?
        asl
        asl
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
        text 28, BOOKED_Y, s_booked, 7
        lda #7
        sta COLOR
        lda correct
        ldx #35
        ldy #BOOKED_Y
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #BOOKED_Y
        jsr API_PUTC
        lda #ROUNDS
        ldx #39
        ldy #BOOKED_Y
        jmp API_NUM

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
        tax
        inx
        ldy #ARROW_Y
        pla
        jsr API_FILL
        ; tint_col: every checker cell of the column takes the colour
        ldx t0
        lda slot_x,x
        clc
        adc #<(SCREEN + PY*40)
        sta scr
        lda #>(SCREEN + PY*40)
        adc #0
        sta scr+1
        ldx #PEOPLE*P_H
@row:   lda scr
        sta clr
        lda scr+1
        clc
        adc #>(COLRAM - SCREEN)
        sta clr+1
        ldy #SLOT_W-1
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
        cmp #ROUNDS
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
        ldx #SLOTS-1
        bne @move
:       lda JOYP
        and #J_RIGHT
        beq :+
@right: ldx cursor
        inx
        cpx #SLOTS
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
        center MSG_Y, s_ok, 5
        clc
        rts
@wrong: cmp #NO_PICK
        beq @slow
        ldx #2
        jsr mark_col            ; the clash in red
        lda #SFX_BAD
        jsr API_SFX
        center MSG_Y, s_clash, 2
        clc
        rts
@slow:  lda #SFX_BAD
        jsr API_SFX
        center MSG_Y, s_slow, 2
        clc
        rts

; score = booked × 255 / 3
finish:
        ldx correct
        lda score_tab,x
        sta MG_SCORE
        lda #1
        sta done
        sec
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
score_tab: .byte 0, 85, 170, 255
slot_x:    .repeat SLOTS, i
           .byte GX + i * SLOT_W
           .endrep
row_y:     .repeat PEOPLE, i
           .byte PY + i * P_H
           .endrep
first_top: .byte Q_BOT, Q_BR     ; a bar's first column: inside a block, at its start
first_mid: .byte CH_BLOCK, Q_RIGHT
first_bot: .byte Q_TOP, Q_TR
row_base:  .repeat PEOPLE, i
           .byte i * SLOTS
           .endrep

.include "gen/mg_calendar_data.s"

.bss
pool:   .res P_NAMES
roster: .res PEOPLE
hair:   .res PEOPLE
busy:   .res PEOPLE * SLOTS
