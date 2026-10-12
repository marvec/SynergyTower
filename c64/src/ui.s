; ---- full-screen dialogs ------------------------------------------------------------------------------
; The browser game's modal dialogs become full pages on the plain screen: a frame with the title on top,
; wrapped text and "label .... value" rows, then a list of buttons at the bottom. Joystick up/down (or the
; cursor keys) moves the focus, FIRE / RETURN / SPACE picks, RUN/STOP goes back, a button's hotkey picks it.
;
;   lda #<title / ldx #>title / jsr ui_open
;   lda #<text / ldx #>text / jsr ui_text            (COLOR; "\n" = 10 breaks the line)
;   ... jsr ui_btn for each button ...
;   jsr ui_run          -> A = button index, $ff = back (RUN/STOP), UI_LR set: $fe = left, $fd = right

UI_MAXB  = 9
UI_LEFT  = 2                    ; text columns 2..37
UI_RIGHT = 38
B_OFF    = 1                    ; ui_btn flags: disabled

; A/X = title.
ui_open:
        sta UI_TITLE
        stx UI_TITLE+1
        jsr plain_screen
        lda #0
        sta $d015
        sta COLOR
        sta UI_NB
        sta UI_LR
        sta UI_CB+1
        sta $c6                 ; KERNAL keyboard buffer: forget keys pressed before
        jsr cls
        lda #14
        sta COLOR
        lda #40
        sta FILL_W
        lda #25
        sta FILL_H
        ldx #0
        ldy #0
        jsr box
        lda #7
        sta COLOR
        ldy #1
        lda UI_TITLE
        ldx UI_TITLE+1
        jsr print_center
        lda #3
        sta UI_ROW
        lda #UI_LEFT
        sta UI_COL
        lda #1
        sta COLOR
        rts

; Next text row (blank line).
ui_gap:
        inc UI_ROW
        rts

; A/X = text, word-wrapped from UI_ROW in COLOR. UI_ROW ends on the row after it.
ui_text:
        sta PTR
        stx PTR+1
        jsr expand_ptr
        lda #UI_LEFT
        sta UI_COL
        ldy #0
@word:  sty UI_WS               ; measure the next word
        ldx #0
@m:     lda (PTR),y
        beq @me
        cmp #' '
        beq @me
        cmp #10
        beq @me
        inx
        iny
        bne @m
@me:    txa
        clc
        adc UI_COL
        cmp #UI_RIGHT + 1
        bcc @fits
        lda UI_COL
        cmp #UI_LEFT + 1
        bcc @fits               ; a word longer than the line: just print it
        jsr @nl
@fits:  ldy UI_WS
@p:     cpx #0
        beq @sep
        lda (PTR),y
        jsr ui_putc
        iny
        dex
        jmp @p
@sep:   lda (PTR),y
        beq @end
        iny
        cmp #10
        bne :+
        jsr @nl
        jmp @word
:       lda UI_COL              ; a space (none at the start of a line)
        cmp #UI_LEFT
        beq @word
        inc UI_COL
        jmp @word
@end:   lda UI_COL
        cmp #UI_LEFT
        beq :+
        inc UI_ROW
:       lda #UI_LEFT
        sta UI_COL
        rts
@nl:    lda #UI_LEFT
        sta UI_COL
        inc UI_ROW
        rts

; A = char at UI_COL, UI_ROW in COLOR; next column. X and Y kept.
ui_putc:
        stx UI_SX
        sty UI_SY
        ldx UI_COL
        ldy UI_ROW
        jsr putc
        inc UI_COL
        ldx UI_SX
        ldy UI_SY
        rts

; linebuf as a text line at UI_ROW (no wrapping), in COLOR.
ui_line:
        lda #<linebuf
        ldx #>linebuf
        jmp ui_text
; A/X = string from UI_ROW, column 2 (wrapped if it is longer than the frame).
ui_str = ui_text

; A/X = label (grey) at column 2, linebuf (COLOR) right-aligned to column 37, on UI_ROW.
ui_kv:
        sta PTR
        stx PTR+1
        lda COLOR
        pha
        lda #15
        sta COLOR
        ldx #UI_LEFT
        ldy UI_ROW
        jsr print
        pla
        sta COLOR
        ldy #0                  ; length of linebuf
:       lda linebuf,y
        beq :+
        iny
        bne :-
:       sty UI_SX
        lda #UI_RIGHT
        sec
        sbc UI_SX
        tax
        ldy UI_ROW
        lda #<linebuf
        sta PTR
        lda #>linebuf
        sta PTR+1
        jsr print
        inc UI_ROW
        rts

; A/X = label, Y = flags (B_OFF), UI_KEY = hotkey (PETSCII, 0 = none; cleared after the call).
ui_btn:
        stx UI_SX
        ldx UI_NB
        sta ui_blo,x
        lda UI_SX
        sta ui_bhi,x
        tya
        sta ui_bfl,x
        lda UI_KEY
        sta ui_bkey,x
        lda #0
        sta UI_KEY
        inc UI_NB
        rts

; Run the button list (drawn on the rows above the frame's bottom). Returns A = choice.
ui_run:
        lda #24
        sec
        sbc UI_NB
        sta UI_BROW
        ldx #0                  ; focus: the first enabled button
        stx UI_FOCUS
:       cpx UI_NB
        bcs @draw
        lda ui_bfl,x
        and #B_OFF
        beq :+
        inx
        bne :-
:       stx UI_FOCUS
@draw:  jsr ui_draw_buttons
@loop:  jsr wait_frame
        jsr ui_tick
        jsr read_input
        jsr GETIN
        beq @joy
        cmp #3                  ; RUN/STOP
        beq @back
        cmp #95                 ; <- (back arrow)
        beq @back
        ldx #0                  ; a hotkey?
:       cpx UI_NB
        bcs @joy
        cmp ui_bkey,x
        beq @hot
        inx
        bne :-
@hot:   lda ui_bfl,x
        and #B_OFF
        bne @joy
        stx UI_FOCUS
        jmp @pick
@joy:   lda JOYP
        and #J_FIRE
        bne @fire
        lda JOYP
        and #J_UP
        bne @up
        lda JOYP
        and #J_DOWN
        bne @down
        lda UI_LR
        beq @loop
        lda JOYP
        and #J_LEFT
        bne @left
        lda JOYP
        and #J_RIGHT
        beq @loop
        lda #$fd
        rts
@left:  lda #$fe
        rts
@back:  lda #SFX_BLIP
        jsr sfx
        lda #$ff
        rts
@fire:  ldx UI_FOCUS
        cpx UI_NB
        bcs @loop               ; no buttons
        lda ui_bfl,x
        and #B_OFF
        bne @loop
@pick:  lda #SFX_BLIP
        jsr sfx
        lda UI_FOCUS
        rts
@up:    ldx UI_FOCUS
:       dex
        bmi @none
        lda ui_bfl,x
        and #B_OFF
        bne :-
        beq @moved
@down:  ldx UI_FOCUS
:       inx
        cpx UI_NB
        bcs @none
        lda ui_bfl,x
        and #B_OFF
        bne :-
@moved: stx UI_FOCUS
        lda #SFX_BLIP
        jsr sfx
        jmp @draw
@none:  jmp @loop

ui_draw_buttons:
        ldx #0
@b:     cpx UI_NB
        bcs @done
        stx UI_SX
        txa
        clc
        adc UI_BROW
        tay
        sty UI_SY
        lda #36                 ; clear the row
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #2
        jsr fill
        ldx UI_SX
        lda #11                 ; disabled: dark grey
        ldy ui_bfl,x
        bne :+
        lda #1                  ; enabled: white
        cpx UI_FOCUS
        bne :+
        lda #7                  ; focus: yellow, with the arrow
:       sta COLOR
        cpx UI_FOCUS
        bne :+
        lda #CH_ARROW
        ldx #4
        ldy UI_SY
        jsr putc
:       ldx UI_SX
        lda ui_blo,x
        sta PTR
        lda ui_bhi,x
        sta PTR+1
        ldx #6
        ldy UI_SY
        jsr print
        ldx UI_SX
        inx
        bne @b
@done:  rts

; Per-frame hook for live values (UI_CB = routine, high byte 0 = none).
ui_tick:
        lda UI_CB+1
        beq :+
        jmp (UI_CB)
:       rts

; A message page: A/X = title, PT = text, one OK button labelled by UI_OKLBL (A/X in ui_msg_btn). Waits.
ui_message:
        jsr ui_open
        lda PT
        ldx PT+1
        jsr ui_text
        lda #<s_ok
        ldx #>s_ok
        ldy #0
        jsr ui_btn
        jmp ui_run

; Yes/no page: A/X = title, PT = question. C=1 for yes.
ui_confirm:
        jsr ui_open
        lda PT
        ldx PT+1
        jsr ui_text
        lda #<s_no
        ldx #>s_no
        ldy #0
        jsr ui_btn
        lda #<s_yes
        ldx #>s_yes
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #1
        beq :+
        clc
        rts
:       sec
        rts

GETIN = $ffe4
