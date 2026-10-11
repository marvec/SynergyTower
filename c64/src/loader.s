; Fast loader, C64 side (protocol in src/drive.s), and the LZ unpacker. Included by the boot file, which runs
; a copy at $c400 to load the main program, and by the main program for floors and mini-games.
; Needs zp.inc. The drive code must already be running (the boot file uploads it).

; A = track, X = sector of the file's first block. Loads it to DST. C=1 on a read error.
fl_load:
        sta T0
        stx T1
        lda $dd00
        and #$07                ; VIC bank + RS-232 out stay, ATN / CLK / DATA released
        sta ATNOFF
        ora #$08
        sta ATNON
        lda ATNOFF
        ora #$10                ; attention: pull CLK
        sta $dd00
:       bit $dd00
        bmi :-                  ; wait for the drive's ack (DATA low)
        lda ATNOFF
        sta $dd00               ; release CLK
        jsr w64
        lda T0
        jsr fl_send
        lda T1
        jsr fl_send
        lda ATNOFF
        sta $dd00               ; release DATA
.ifdef AUTOPLAY
        lda #0
        sta blk_n
        lda FRAME
        sta blk_t
.endif
@block: jsr w64
        jsr w64
:       bit $dd00
        bpl :-                  ; drive reading the sector: interrupts (music) keep running here
.ifdef AUTOPLAY
        jsr blk_mark            ; timing log for the test build
.endif
        jsr fl_get              ; count
        bne :+
        clc                     ; 0 = end of file
        bcc @end
:       cmp #$ff
        beq @end                ; read error, C=1
        sta T2
        ldy #0
:       jsr fl_get
        sta (DST),y
        iny
        cpy T2
        bne :-
        tya
        clc
        adc DST
        sta DST
        bcc :+
        inc DST+1
:       jsr fl_ack              ; block received
.ifdef AUTOPLAY
        jsr blk_mark
.endif
        jmp @block
@end:   php
        jsr fl_ack
        plp
        rts

; Receive a byte: 4 ATN edges, 2 bits each (DATA = even bit, CLK = odd bit, released = 1), LSB first.
; The drive answers within 13 us, so each read comes 20 cycles after its edge; the 20 cycles from a read
; to the next edge give the drive time to prepare the next pair. Interrupts and bad lines only add time.
.macro get_pair on_off
        lda on_off
        sta $dd00
        jsr w12
        nop
        nop
        lda $dd00
        asl                     ; C = DATA
        ror T3
        asl                     ; C = CLK
        ror T3
.endmacro
fl_get:
        get_pair ATNON
        get_pair ATNOFF
        get_pair ATNON
        get_pair ATNOFF
        lda T3
        rts

; Block acknowledge: two more ATN edges, which the drive answers with "busy".
fl_ack:
        lda ATNON
        sta $dd00
        jsr w12
        nop
        nop
        lda ATNOFF
        sta $dd00
        rts

; Send A to the drive: 1 bit per CLK edge, DATA pulled = 0.
fl_send:
        sta T3
        ldx #8
@bit:   lsr T3
        lda $dd00
        and #$df
        bcs :+
        ora #$20
:       sta $dd00
        eor #$10
        sta $dd00
        jsr w64
        dex
        bne @bit
        rts

; ~60 cycles including the JSR (interrupts and bad lines only make it longer, which is safe).
w64:    pha
        pla
        pha
        pla
        pha
        pla
        pha
        pla
        pha
        pla
        pha
        pla
        nop
        nop
w12:    rts

; Unpack the LZ stream at SRC to DST (format: tools/lz.js).
lz_unpack:
        ldy #0
@token: lda (SRC),y
        inc SRC
        bne :+
        inc SRC+1
:       tax
        beq @done
        bmi @match
@lit:   lda (SRC),y
        sta (DST),y
        inc SRC
        bne :+
        inc SRC+1
:       inc DST
        bne :+
        inc DST+1
:       dex
        bne @lit
        beq @token
@match: cpx #$c0
        bcs @long
        txa
        and #$3f
        adc #3                  ; C=0 here (cpx < $c0)
        tax
        lda (SRC),y             ; distance - 1
        eor #$ff
        clc
        adc DST                 ; DST + 255 - (distance - 1) = DST - distance (+ carry)
        sta MP
        lda DST+1
        adc #$ff
        sta MP+1
        jmp @adv1
@long:  txa
        and #$3f
        clc
        adc #4
        tax
        lda DST
        sec
        sbc (SRC),y
        sta MP
        inc SRC
        bne :+
        inc SRC+1
:       lda DST+1
        sbc (SRC),y
        sta MP+1
@adv1:  inc SRC
        bne @copy
        inc SRC+1
@copy:  lda (MP),y
        sta (DST),y
        inc MP
        bne :+
        inc MP+1
:       inc DST
        bne :+
        inc DST+1
:       dex
        bne @copy
        beq @token
@done:  rts
