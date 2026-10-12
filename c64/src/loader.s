; Fast loader, C64 side (protocol in src/drive.s), and the LZ unpacker. Included by the boot file, which runs
; a copy at $c400 to load the main program, and by the main program for floors and mini-games.
; Needs zp.inc. The drive code must already be running (the boot file uploads it).

; A = track, X = sector of the file's first block. Loads it to DST. C=1 on a read error.
fl_load:
        jsr fl_cmd
@block: jsr w64
        jsr w64
:       bit $dd00
        bpl :-                  ; drive reading the sector: interrupts (music) keep running here
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
        jmp @block
@end:   php
        jsr fl_ack
        plp
        rts

; Get the drive's attention and send it A = track, X = sector.
fl_cmd:
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

; Unpack the bit-packed LZ stream at SRC to DST (format: tools/lz.js). Y stays 0.
lz_unpack:
        ldy #0
        lda #$80                ; no bits yet
        sta LZBITS
        lda #1                  ; last offset
        sta LZOFF
        sty LZOFF+1
@match_done:                    ; after a match (and at the start): 0 = literals, 1 = new offset
        jsr lz_bit
        bcs @newoff
        jsr lz_gamma
@lit:   lda (SRC),y
        sta (DST),y
        inc SRC
        bne :+
        inc SRC+1
:       inc DST
        bne :+
        inc DST+1
:       jsr lz_declen
        bne @lit
        jsr lz_bit              ; after literals: 0 = repeat the last offset, 1 = new offset
        bcs @newoff
        jsr lz_gamma
        jsr lz_copy
        jmp @match_done
@newoff:
        jsr lz_gamma            ; high part + 1 (256: the end)
        lda LZLEN+1
        bne @done
        ldx LZLEN
        dex
        stx LZOFF+1
        lda (SRC),y             ; low part
        inc SRC
        bne :+
        inc SRC+1
:       clc                     ; offset = that + 1
        adc #1
        sta LZOFF
        bcc :+
        inc LZOFF+1
:       jsr lz_gamma            ; length - 1
        inc LZLEN
        bne :+
        inc LZLEN+1
:       jsr lz_copy
        jmp @match_done
@done:  rts

; Copy LZLEN bytes from DST - LZOFF.
lz_copy:
        lda DST
        sec
        sbc LZOFF
        sta MP
        lda DST+1
        sbc LZOFF+1
        sta MP+1
@copy:  lda (MP),y
        sta (DST),y
        inc MP
        bne :+
        inc MP+1
:       inc DST
        bne :+
        inc DST+1
:       jsr lz_declen
        bne @copy
        rts

; LZLEN - 1, Z=1 at 0.
lz_declen:
        lda LZLEN
        bne :+
        dec LZLEN+1
:       dec LZLEN
        lda LZLEN
        ora LZLEN+1
        rts

; C = the next bit (a new byte of 8 when they run out: the 1 shifted in marks the end).
lz_bit: asl LZBITS
        bne @ok
        lda (SRC),y
        inc SRC
        bne :+
        inc SRC+1
:       rol a                   ; (C=1 from the old marker)
        sta LZBITS
@ok:    rts

; LZLEN = an Elias gamma number: n zero bits, then n more bits after the leading 1.
lz_gamma:
        ldx #0
:       jsr lz_bit
        bcs :+
        inx
        bne :-
:       lda #1
        sta LZLEN
        lda #0
        sta LZLEN+1
        txa
        beq @done
@b:     jsr lz_bit
        rol LZLEN
        rol LZLEN+1
        dex
        bne @b
@done:  rts
