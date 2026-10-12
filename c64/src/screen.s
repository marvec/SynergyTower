; ---- API ----------------------------------------------------------------------------------------------
wait_frame:
        lda FRAME
:       cmp FRAME
        beq :-
        rts

; Joystick port 2 merged with the keyboard (WASD / cursor keys, SPACE or RETURN = fire).
read_input:
.ifdef AUTOPLAY
        jsr autoplay
.else
        lda $dc00
        eor #$ff
        and #$1f
.endif
        sta TMP
        ldx $cb                 ; KERNAL: matrix code of the key held down, 64 = none
        lda #0
        cpx #9
        bne :+
        lda #J_UP
:       cpx #10
        bne :+
        lda #J_LEFT
:       cpx #13
        bne :+
        lda #J_DOWN
:       cpx #18
        bne :+
        lda #J_RIGHT
:       cpx #60
        bne :+
        lda #J_FIRE
:       cpx #1
        bne :+
        lda #J_FIRE
:       cpx #7
        bne :+
        lda $028d
        lsr
        lda #J_DOWN
        bcc :+
        lda #J_UP
:       cpx #2
        bne :+
        lda $028d
        lsr
        lda #J_RIGHT
        bcc :+
        lda #J_LEFT
:       ora TMP
        sta TMP
        lda JOY
        eor #$ff
        and TMP
        sta JOYP
        lda TMP
        sta JOY
        rts

.ifdef AUTOPLAY
; Scripted joystick for headless tests: walk to the station, press fire, then poke at things.
autoplay:
        lda AUTOCNT
        bne @run
        ldy #0
        lda (AUTOPTR),y
        beq @free
        sta AUTOCNT
        iny
        lda (AUTOPTR),y
        sta AUTOBITS
        lda AUTOPTR
        clc
        adc #2
        sta AUTOPTR
        bcc @run
        inc AUTOPTR+1
@run:   dec AUTOCNT
        lda AUTOBITS
        rts
@free:  lda FRAME                ; fire every 2.5 s, so the screens stay up long enough for screenshots
        and #127
        bne :+
        lda #J_FIRE
        rts
:       cmp #64
        bne :+
        lda #J_RIGHT
        rts
:       lda #0
        rts
.endif

; A = random byte (xorshift16, J. Metcalf)
rand:
        lda RNG+1
        lsr
        lda RNG
        ror
        eor RNG+1
        sta RNG+1
        ror
        eor RNG
        sta RNG
        eor RNG+1
        sta RNG+1
        rts

; Screen + colour pointers for column X, row Y. Colour RAM shares the low 10 bits with the screen.
set_pos:
        txa
        clc
        adc srow_lo,y
        sta SCR
        sta CLR
        lda srow_hi,y
        adc #0
        sta SCR+1
        and #$03
        ora #>COLRAM
        sta CLR+1
        rts

cls:
        ldx #0
:       lda #' '
        sta SCREEN,x
        sta SCREEN+250,x
        sta SCREEN+500,x
        sta SCREEN+750,x
        lda COLOR
        sta COLRAM,x
        sta COLRAM+250,x
        sta COLRAM+500,x
        sta COLRAM+750,x
        inx
        cpx #250
        bne :-
        rts

print:
        jsr set_pos
print_next:                     ; continue at SCR/CLR
        jsr expand_ptr
print_plain:
        ldy #0
:       lda (PTR),y
        beq @end
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        iny
        bne :-
@end:   tya
        clc
        adc SCR
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       rts

; A/X = string, Y = row: print centred.
print_center:
        sta PTR
        stx PTR+1
        sty T1
        jsr expand_ptr
        jmp pc_measure
; API_CENTER: overlays' plain strings.
print_center_raw:
        sta PTR
        stx PTR+1
        sty T1
pc_measure:
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #40                 ; 40 - length
        lsr
        tax
        ldy T1
        jsr set_pos
        jmp print_plain

putc:
        pha
        jsr set_pos
        pla
putc_next:
        ldy #0
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        inc SCR
        inc CLR
        bne :+
        inc SCR+1
        inc CLR+1
:       rts

fill:
        sta TMP+2
        jsr set_pos
        lda FILL_H
        sta TMP+3
@row:   ldy FILL_W
        dey
:       lda TMP+2
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        dey
        bpl :-
        lda SCR
        clc
        adc #40
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       dec TMP+3
        bne @row
        rts

; A = 0..255 at X, Y in decimal (no leading zeros).
print_num:
        pha
        jsr set_pos
        pla
print_num_next:
        ldy #0
        sty TMP+1               ; digits printed so far
        ldx #'0'
@h:     cmp #100
        bcc :+
        sbc #100
        inx
        bne @h
:       jsr @digit
        ldx #'0'
@t:     cmp #10
        bcc :+
        sbc #10
        inx
        bne @t
:       jsr @digit
        ora #'0'
        tax
        inc TMP+1               ; the last digit always prints
@digit: cpx #'0'                ; X = digit char, A = remainder (kept)
        bne :+
        ldy TMP+1
        beq @skip
:       sta TMP
        txa
        jsr putc_next
        lda TMP
        inc TMP+1
@skip:  rts

; A = next key from the KERNAL keyboard buffer (PETSCII), 0 = none. Z from A.
getkey:
        lda $c6
        beq @done
        sei
        ldy $0277
        ldx #0
:       lda $0278,x
        sta $0277,x
        inx
        cpx $c6
        bne :-
        dec $c6
        cli
        tya
@done:  rts

; X, Y = top left, FILL_W × FILL_H outer size, COLOR: a frame of line chars (the inside is left alone).
box:
        jsr set_pos
        lda FILL_W
        sec
        sbc #1
        sta TMP+2               ; offset of the right edge
        lda FILL_H
        sec
        sbc #2
        sta TMP+3               ; rows between top and bottom
        lda #CH_TL
        ldx #CH_T
        ldy #CH_TR
        jsr @line
:       lda TMP+3
        beq :+
        jsr @down
        ldy #0
        lda #CH_L
        jsr @put
        ldy TMP+2
        lda #CH_R
        jsr @put
        dec TMP+3
        jmp :-
:       jsr @down
        lda #CH_BL
        ldx #CH_B
        ldy #CH_BR
@line:  sty TMP+1               ; A = left, X = middle, Y = right char
        ldy #0
        jsr @put
        iny
:       cpy TMP+2
        bcs :+
        txa
        jsr @put
        iny
        bne :-
:       lda TMP+1
@put:   sta (SCR),y
        lda COLOR
        sta (CLR),y
        rts
@down:  lda SCR
        clc
        adc #40
        sta SCR
        sta CLR
        bcc :+
        inc SCR+1
        inc CLR+1
:       rts

; A = 0..38: timer bar on row 1, A cells of solid blocks in COLOR, the rest cleared.
bar:
        sta TMP+2
        ldx #1
        ldy #1
        jsr set_pos
        ldy #0
:       lda #' '
        cpy TMP+2
        bcs :+
        lda #CH_BLOCK
:       sta (SCR),y
        lda COLOR
        sta (CLR),y
        iny
        cpy #38
        bne :--
        rts

; A = n (1..255) -> A = random 0..n-1
rand_mod:
        sta TMP+2
        jsr rand
:       cmp TMP+2
        bcc :+
        sbc TMP+2
        bcs :-
:       rts

sfx:
        ldx st_sfx              ; the menu's "Sound effects: OFF"
        bne :+
        rts
:       php
        sei
        jsr drum_start
        lda #20
        sta SFX_LOCK
        plp
        rts


; API_PRINT: overlays print their own plain strings (which may hold multicolour char codes 128+).
print_raw:
        jsr set_pos
        jmp print_plain
