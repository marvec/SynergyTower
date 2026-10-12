; ---- text builder ----------------------------------------------------------------------------------------
; Composes a line in memory at SB: strings, numbers, m:ss times. sb_end terminates it.
;   lda #<buf / ldx #>buf / jsr sb_start ... jsr sb_end      then print it like any string.

; A/X = buffer.
sb_start:
        sta SB
        stx SB+1
        rts

; A/X = zero-terminated string to append.
sb_str:
        sta PTR
        stx PTR+1
sb_ptr:                         ; append the string at PTR
        jsr expand_ptr
        ldy #0
:       lda (PTR),y
        beq :+
        jsr sb_char
        iny
        bne :-
:       rts

; Append the char in A (Y kept).
sb_char:
        sty SBY
        ldy #0
        sta (SB),y
        inc SB
        bne :+
        inc SB+1
:       ldy SBY
        rts

sb_end:
        lda #0
        tay
        sta (SB),y
        rts

; A = 0..255 in decimal.
sb_num:
        sta NUM
        lda #0
        sta NUM+1
; NUM (16 bit) in decimal, no leading zeros.
sb_u16:
        lda #0
        sta SBZ                 ; digits so far
        ldx #0
@pow:   ldy #'0'
@sub:   lda NUM
        sec
        sbc pow10_lo,x
        sta SBT
        lda NUM+1
        sbc pow10_hi,x
        bcc @out
        sta NUM+1
        lda SBT
        sta NUM
        iny
        bne @sub
@out:   tya
        cpx #4
        beq :+                  ; the last digit always shows
        cmp #'0'
        bne :+
        ldy SBZ
        beq @next
:       jsr sb_char
        inc SBZ
@next:  inx
        cpx #5
        bne @pow
        rts

; T0/T1 seconds as m:ss.
sb_mmss:
        lda T0
        sta NUM
        lda T1
        sta NUM+1
        lda #0
        sta SBM
        sta SBM+1
@m:     lda NUM                 ; minutes = seconds / 60, remainder in NUM
        sec
        sbc #60
        tay
        lda NUM+1
        sbc #0
        bcc @mdone
        sta NUM+1
        sty NUM
        inc SBM
        bne @m
        inc SBM+1
        bne @m
@mdone: lda NUM
        pha
        lda SBM
        sta NUM
        lda SBM+1
        sta NUM+1
        jsr sb_u16
        lda #':'
        jsr sb_char
        pla
        cmp #10
        bcs :+
        pha
        lda #'0'
        jsr sb_char
        pla
:       jmp sb_num

; Clear A columns at X, Y and print linebuf there in COLOR.
print_field:
        stx SBX
        sty SBROW
        sta FILL_W
        tax                     ; clip the text to the field
        lda #0
        sta linebuf,x
        lda #1
        sta FILL_H
        lda #' '
        jsr fill
        lda #<linebuf
        sta PTR
        lda #>linebuf
        sta PTR+1
        ldx SBX
        ldy SBROW
        jmp print

; linebuf, centred on row Y in COLOR.
print_line_center:
        lda #<linebuf
        ldx #>linebuf
        jmp print_center

; Start composing into linebuf.
sb_line:
        lda #<linebuf
        ldx #>linebuf
        jmp sb_start

.segment "BSS"
linebuf: .res 96              ; (a line with a 16-letter name can reach ~70 chars)
SBY:     .res 1
SBZ:     .res 1
SBT:     .res 1
SBX:     .res 1
SBROW:   .res 1
SBM:     .res 2
NUM:     .res 2
.segment "CODE"

; ---- byte-pair texts (tools/bpe.js) ---------------------------------------------------------------------------
; PTR -> its expansion in xbuf; PTR = xbuf. Bytes 128-255 stand for two symbols each (which may be pairs again).
; Plain text passes through unchanged (also in place, when PTR already is xbuf).
expand_ptr:
        lda #0
        sta XW
        tay
@next:  lda (PTR),y
        beq @end
        iny
        sty XR
        jsr @emit
        ldy XR
        jmp @next
@end:   ldx XW
        sta xbuf,x
        lda #<xbuf
        sta PTR
        lda #>xbuf
        sta PTR+1
        rts
@emit:  cmp #$80
        bcc @lit
        tax
        lda bpe_b - 128,x
        pha
        lda bpe_a - 128,x
        jsr @emit
        pla
        jmp @emit
@lit:   ldx XW
        sta xbuf,x
        inc XW
        rts

.segment "BSS"
XW:      .res 1
XR:      .res 1
xbuf:    .res 256
.segment "CODE"
