; Inbox Triage (src/minigames/inbox.js) as a disk-loaded overlay at $4000.
; Mail slides in one item at a time: sort each into one of three bins before its timer runs out. Too slow or the
; wrong bin is a miss. Score = correct / items.
; Difficulty (d = MG_DIFF / 255), d=0 -> d=1: items 8 -> 16 (round(8 + 8 d)), 4.2 s -> 1.7 s per item.
; Content: the department's bins and items (src/minigames/inbox.js POOLS; sales, marketing, finance and exec use
; the default set), gen/mg_inbox_data.s.
; Differences from the JS: no screen shake (the border flashes red); the bins have no mouse; the round ends
; 0.4 s after the last item so its flash is seen.

.include "api.inc"

MAX_N     = 16                  ; items per round
PER_BASE  = 210                 ; byDiff(d, 4.2, 1.7) s per item = 210 - 0.49 × A frames
SLIDE_T   = 10                  ; 0.2 s: the card slides in from the right
SLIDE_W   = 16                  ; columns it travels
FLASH_T   = 12                  ; 0.25 s bin flash
MSG_T     = 40
BORDER_T  = 8                   ; red border on a miss (the JS screen shake)
END_T     = 20                  ; hold after the last item

WIN_Y     = 2                   ; the mail window: rows 2-14
WIN_H     = 13
CARD_Y    = 4                   ; the card: rows 4-8, columns 1-38
CARD_H    = 5
CARD_X    = 1
CARD_W    = 38
CARD_END  = 38                  ; text stops left of this column
NEXT_Y    = 10                  ; upcoming items: rows 10-12
NEXT_W    = 35
BIN_Y     = 15                  ; bins: rows 15-19, 12 wide
BIN_H     = 5
BIN_W     = 12
MSG_Y     = 21

C_WIN     = 6
C_FROM    = 4
C_ITEM    = 1
C_RECV    = 6
C_NEXT    = 3
C_BIN     = 1
C_KEYS    = 3

.zeropage
n:        .res 1                ; items this round
qi:       .res 1                ; current item
correct:  .res 1
left:     .res 1                ; frames left for this item
per_item: .res 1
slide:    .res 1                ; frames of slide-in left
flash_t:  .res 1
flash_b:  .res 1
border_t: .res 1
msg_t:    .res 1
end_t:    .res 1                ; > 0: the round is over, holding
done:     .res 1
pick:     .res 1
lastkey:  .res 1                ; number key held last frame
col:      .res 1                ; print_clip
row:      .res 1
sp:       .res 2
bufi:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- set-up

; A = difficulty
init:
        sta t0
        lsr                     ; items: round(8 + 8 d) = 8 + (A / 2 + 8) / 16
        clc
        adc #8
        lsr
        lsr
        lsr
        lsr
        clc
        adc #8
        sta n
        lda t0                  ; per item: 210 - (A / 2 - A / 64) frames
        lsr
        sta t1
        lda t0
        lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        sta t2
        lda t1
        sec
        sbc t2
        sta t1
        lda #PER_BASE
        sec
        sbc t1
        sta per_item
        lda #0
        sta qi
        sta correct
        sta flash_t
        sta border_t
        sta msg_t
        sta end_t
        sta done
        lda #$ff
        sta lastkey
        ; the queue: a random bin, then a random item of that bin
        ldx #0
@q:     stx t0
        lda #3
        jsr API_RMOD
        ldx t0
        sta q_cat,x
        tay
        lda cat_n,y
        jsr API_RMOD
        ldx t0
        ldy q_cat,x
        clc
        adc cat_first,y
        sta q_item,x
        inx
        cpx n
        bne @q
        ; screen
        text 1, 0, s_name, 7
        lda #C_WIN
        sta COLOR
        lda #40
        sta FILL_W
        lda #WIN_H
        sta FILL_H
        ldx #0
        ldy #WIN_Y
        jsr API_BOX
        ldx #0
:       stx t0
        lda #C_BIN
        jsr draw_bin
        ldx t0
        inx
        cpx #3
        bne :-
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        ; fall through

; Item qi arrives: a fresh sender, the timer, the card slides in.
begin:
        lda per_item
        sta left
        lda #SLIDE_T
        sta slide
.if .defined(AUTOPLAY)
        lda #0
        sta bot_t
.endif
        ; ext-NNNN: 1000-9999
        lda #9
        jsr API_RMOD
        clc
        adc #'1'
        sta from_d
        ldx #1
:       stx t0
        lda #10
        jsr API_RMOD
        ora #'0'
        ldx t0
        sta from_d,x
        inx
        cpx #4
        bne :-
        jsr draw_counter
        jsr draw_title
        jsr draw_next
        jsr draw_card
        lda per_item
        ldx #0
        jmp timer_start

; ---------------------------------------------------------------- drawing

; "N/M" right-aligned on the title row.
draw_counter:
        jsr buf_reset
        lda #' '
        jsr buf_c
        lda qi
        clc
        adc #1
        cmp n
        bcc :+
        lda n
:       jsr buf_n
        lda #'/'
        jsr buf_c
        lda n
        jsr buf_n
        jsr buf_end
        lda #1
        sta COLOR
        lda #40
        sec
        sbc bufi
        tax
        inx                     ; (bufi counts the 0)
        ldy #0
        jmp API_PRINT

; " Inbox - N unread " on the window's top edge.
draw_title:
        lda #C_WIN              ; the edge first (the count may lose a digit)
        sta COLOR
        lda #24
        sta FILL_W
        lda #1
        sta FILL_H
        lda #CH_T
        ldx #1
        ldy #WIN_Y
        jsr API_FILL
        jsr buf_reset
        lda #<s_inbox
        ldx #>s_inbox
        jsr buf_s
        lda n
        sec
        sbc qi
        jsr buf_n
        lda #<s_unread
        ldx #>s_unread
        jsr buf_s
        jsr buf_end
        lda #C_NEXT
        sta COLOR
        ldx #2
        ldy #WIN_Y
        jmp API_PRINT

; The next 3 items under the card.
draw_next:
        lda #0
        sta t1
@r:     lda t1
        clc
        adc #NEXT_Y
        sta row
        lda #38
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #1
        ldy row
        jsr API_FILL
        lda qi
        sec
        adc t1                  ; qi + 1 + t1
        cmp n
        bcs @next
        tax
        jsr buf_reset
        lda #'-'
        jsr buf_c
        lda #' '
        jsr buf_c
        ldy q_item,x
        lda item_hi,y
        tax
        lda item_lo,y
        jsr buf_s
        lda #NEXT_W
        jsr buf_cut
        lda #C_NEXT
        sta COLOR
        ldx #2
        ldy row
        jsr API_PRINT
@next:  inc t1
        lda t1
        cmp #3
        bne @r
        rts

; The card at its slide offset: a box from column CARD_X + offset, the texts cut at the window's edge. Cleared
; only when it starts (or after the last item); while it slides each frame overdraws the last (no flicker).
draw_card:
        lda slide
        cmp #SLIDE_T
        beq :+
        lda qi
        cmp n
        bcc @draw
:       lda #CARD_W
        sta FILL_W
        lda #CARD_H
        sta FILL_H
        lda #7
        sta COLOR
        lda #' '
        ldx #CARD_X
        ldy #CARD_Y
        jsr API_FILL
@draw:  ldx slide
        lda slide_off,x
        sta t2                  ; offset
        lda qi
        cmp n
        bcc :+
        rts
:       lda #CARD_W
        sec
        sbc t2
        sta FILL_W
        lda #CARD_H
        sta FILL_H
        lda #C_ITEM
        sta COLOR
        lda t2
        clc
        adc #CARD_X
        tax
        ldy #CARD_Y
        jsr API_BOX
        ; From: ext-NNNN@mail
        jsr buf_reset
        lda #<s_from
        ldx #>s_from
        jsr buf_s
        ldx #0
:       lda from_d,x
        jsr buf_c
        inx
        cpx #4
        bne :-
        lda #<s_mail
        ldx #>s_mail
        jsr buf_s
        lda #0
        jsr buf_c
        lda #C_FROM
        ldy #CARD_Y + 1
        jsr print_clip_buf
        ; the item
        ldx qi
        ldy q_item,x
        lda item_lo,y
        ldx item_hi,y
        sta sp
        stx sp+1
        jsr buf_reset
        ldy #0
:       lda (sp),y
        jsr buf_c
        iny
        cmp #0
        bne :-
        lda #C_ITEM
        ldy #CARD_Y + 2
        jsr print_clip_buf
        jsr buf_reset
        lda #<s_recv
        ldx #>s_recv
        jsr buf_s
        lda #0
        jsr buf_c
        lda #C_RECV
        ldy #CARD_Y + 3
        ; fall through

; A = colour, Y = row: the buffer printed from column 2 + offset (t2), cut at CARD_END.
print_clip_buf:
        sta COLOR
        sty row
        lda t2
        clc
        adc #CARD_X + 1
        sta col
        lda #CARD_END
        sec
        sbc col                 ; room: padded with spaces up to it, or cut
        tay
        ldx bufi
        dex                     ; (the 0)
        lda #' '
:       cpx #48 - 1
        bcs :+
        sta buf,x
        inx
        bne :-
:       lda #0
        sta buf,y
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        ldx col
        ldy row
        jmp API_PRINT

; X = bin, A = frame colour: the box, the colour stripe, the label, the keys.
draw_bin:
        sta COLOR
        stx t1
        lda #BIN_W
        sta FILL_W
        lda #BIN_H
        sta FILL_H
        lda bin_x,x
        tax
        ldy #BIN_Y
        jsr API_BOX
        ldx t1                  ; the stripe in a dark slot
        lda stripe_col,x
        sta COLOR
        lda #4
        sta FILL_W
        lda #1
        sta FILL_H
        lda bin_x,x
        clc
        adc #4
        tax
        ldy #BIN_Y + 1
        lda #CH_BLOCK
        jsr API_FILL
        ldx t1                  ; label, centred in the box
        lda bin_lo,x
        sta sp
        sta PTR
        lda bin_hi,x
        sta sp+1
        sta PTR+1
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #BIN_W
        lsr
        clc
        adc bin_x,x
        tax
        lda #1
        sta COLOR
        ldy #BIN_Y + 2
        jsr API_PRINT
        ldx t1
        lda key_lo,x
        sta PTR
        lda key_hi,x
        sta PTR+1
        lda bin_x,x
        clc
        adc key_dx,x
        tax
        lda #C_KEYS
        sta COLOR
        ldy #BIN_Y + 3
        jmp API_PRINT

; A/X = message, Y = colour, col = column (0 = centred): on the message row for a moment.
message:
        sty t0
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
        ldy col
        bne :+
        ldy #MSG_Y
        jsr API_CENTER
        jmp @t
:       sta PTR
        stx PTR+1
        ldx col
        ldy #MSG_Y
        jsr API_PRINT
@t:     lda #MSG_T
        sta msg_t
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
        lda #MSG_Y
        ldx #1
        jsr clear_rows
:       lda border_t
        beq :+
        dec border_t
        bne :+
        lda #0
        sta $d020
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        ldx flash_b
        lda #C_BIN
        jsr draw_bin
:       lda end_t
        beq :+
        dec end_t
        bne @out
        jmp finish
:       lda slide
        beq :+
        dec slide
        jsr draw_card
:       jsr timer_tick          ; (the bar; left decides)
        dec left
        ; the pick: left / down / right or keys 1-3
        lda #$ff
        sta pick
        jsr number_key          ; (held: act on the press only)
        cmp lastkey
        sta lastkey
        beq :+
        cmp #3
        bcs :+
        sta pick
:       lda JOYP
        and #J_LEFT
        beq :+
        lda #0
        sta pick
:       lda JOYP
        and #J_DOWN
        beq :+
        lda #1
        sta pick
:       lda JOYP
        and #J_RIGHT
        beq @pk
        lda #2
        sta pick
@pk:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #SLIDE_T + 4
        bne :+
        ldx qi
        lda q_cat,x
        sta pick
:
.endif
        lda pick
        bpl judge
        lda left
        beq judge
@out:   clc
        rts

; pick = bin, $ff = too slow.
judge:
        ldx qi
        lda pick
        cmp q_cat,x
        bne @wrong
        inc correct
        lda #SFX_GOOD
        jsr API_SFX
        ldx pick
        lda bin_x,x
        clc
        adc #5
        sta col
        lda #<s_plus1
        ldx #>s_plus1
        ldy #5
        jsr message
        ldx pick
        lda #5
        bne @flash
@wrong: lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #BORDER_T
        sta border_t
        lda #0
        sta col
        lda pick
        bmi :+
        lda #<s_wrong
        ldx #>s_wrong
        bne :++
:       lda #<s_slow
        ldx #>s_slow
:       ldy #2
        jsr message
        ldx pick                ; flash the wrong bin, or the right one when too slow
        bpl :+
        ldy qi
        ldx q_cat,y
:       lda #2
@flash: stx flash_b
        jsr draw_bin
        lda #FLASH_T
        sta flash_t
        inc qi
        lda qi
        cmp n
        bcs @end
        jsr begin
        clc
        rts
@end:   jsr draw_counter
        jsr draw_title
        jsr draw_next
        jsr draw_card
        lda #0
        jsr API_BAR
        lda #END_T
        sta end_t
        clc
        rts

; score = correct × 255 / n
finish:
        lda correct
        sta t0
        lda #0                  ; t1:A = correct × 255
        sec
        sbc t0
        pha
        lda t0
        sbc #0
        sta t1
        pla
        ldx #0
@div:   sec
        sbc n
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        tya
        inx
        bne @div
        dex
@q:     stx MG_SCORE
        lda #0
        sta $d020
        lda #1
        sta done
        sec
        rts

; ---- a small string builder
buf_reset:
        lda #0
        sta bufi
        rts
buf_c:  stx t0
        ldx bufi
        sta buf,x
        inc bufi
        ldx t0
        rts
; A/X = string: appended (without its 0)
buf_s:  sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        beq :+
        jsr buf_c
        iny
        bne :-
:       rts
; A = 0..99 in decimal
buf_n:  ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        beq :+
        ora #'0'
        jsr buf_c
:       pla
        ora #'0'
        jmp buf_c
; A = width: cut to it, then terminated (PTR = buf)
buf_cut:
        cmp bufi
        bcs buf_end
        sta bufi
buf_end:
        lda #0
        jsr buf_c
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        rts

.rodata
s_name:     .byte "Inbox Triage", 0
s_help:     .byte "Sort each item into the right bin.", 0
s_keys:     .byte "Left / down / right, or keys 1-3", 0
s_inbox:    .byte " Inbox - ", 0
s_unread:   .byte " unread ", 0
s_from:     .byte "From: ext-", 0
s_mail:     .byte "@mail", 0
s_recv:     .byte "Received just now", 0
s_plus1:    .byte "+1", 0
s_wrong:    .byte "Wrong bin!", 0
s_slow:     .byte "Too slow!", 0
s_key0:     .byte "Left / 1", 0
s_key1:     .byte "Down / 2", 0
s_key2:     .byte "Right / 3", 0
key_lo:     .byte <s_key0, <s_key1, <s_key2
key_hi:     .byte >s_key0, >s_key1, >s_key2
key_dx:     .byte 2, 2, 2
bin_x:      .byte 1, 14, 27
stripe_col: .byte 5, 3, 2       ; reply green, archive light blue, spam red
slide_off:  .repeat SLIDE_T + 1, I     ; columns still to travel with I frames left
            .byte I * SLIDE_W / SLIDE_T
            .endrepeat

.include "gen/mg_inbox_data.s"

.bss
q_cat:      .res MAX_N
q_item:     .res MAX_N
from_d:     .res 4
buf:        .res 48
