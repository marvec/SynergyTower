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
        sta NUM+2
; NUM (24 bit) in decimal, no leading zeros.
sb_u24:
        lda #0
        sta SBZ                 ; digits so far
        ldx #0
@pow:   ldy #'0'
@sub:   lda NUM
        sec
        sbc pow10_lo,x
        sta SBT
        lda NUM+1
        sbc pow10_md,x
        sta SBT+1
        lda NUM+2
        sbc pow10_hi,x
        bcc @out
        sta NUM+2
        lda SBT+1
        sta NUM+1
        lda SBT
        sta NUM
        iny
        bne @sub
@out:   tya
        cpx #7
        beq :+                  ; the last digit always shows
        cmp #'0'
        bne :+
        ldy SBZ
        beq @next
:       jsr sb_char
        inc SBZ
@next:  inx
        cpx #8
        bne @pow
        rts

; NUM (24 bit) the way the browser's formatNum shortens it: 9999, 12.3k, 123k, 1.23M, 12.3M.
sb_fmt:
        ldx #3                  ; x = the first range NUM is below (fmt_*): 4 = 1e5 .. 7 = above 1e7
:       lda NUM
        cmp fmt_lo,x
        lda NUM+1
        sbc fmt_md,x
        lda NUM+2
        sbc fmt_hi,x
        bcc :+
        inx
        cpx #7
        bne :-
:       cpx #4
        bcs :+
        jmp sb_u24              ; < 10000: as it is
:       stx SBZ
        lda NUM                 ; q = round(NUM / 10^k): + half, then divide
        clc
        adc fmt_half_lo-4,x
        sta NUM
        lda NUM+1
        adc fmt_half_md-4,x
        sta NUM+1
        bcc :+
        inc NUM+2
:       lda fmt_dlo-4,x
        sta SBT
        lda fmt_dmd-4,x
        sta SBT+1
        jsr div24               ; NUM = 100..999 (1000 when it rounds up: printed as is)
        lda NUM+1
        cmp #>1000
        bcc @digits
        lda NUM
        cmp #<1000
        bcc @digits
        jsr sb_u24
        jmp @unit
@digits:
        lda #'0'                ; hundreds, tens, ones
        sta SBR
        sta SBR+1
:       lda NUM
        sec
        sbc #100
        tay
        lda NUM+1
        sbc #0
        bcc :+
        sta NUM+1
        sty NUM
        inc SBR
        bne :-
:       lda NUM
        sec
        sbc #10
        bcc :+
        sta NUM
        inc SBR+1
        bne :-
:       lda SBR
        jsr sb_char
        ldx SBZ
        lda fmt_point-4,x
        cmp #2
        bne :+
        lda #'.'
        jsr sb_char
:       lda SBR+1
        jsr sb_char
        ldx SBZ
        lda fmt_point-4,x
        cmp #1
        bne :+
        lda #'.'
        jsr sb_char
:       lda NUM
        ora #'0'
        jsr sb_char
@unit:  ldx SBZ
        lda fmt_unit-4,x
        jmp sb_char

; NUM (24 bit) /= SBT/SBT+1 (16 bit).
div24:
        lda #0
        sta SBR
        sta SBR+1
        ldx #24
:       asl NUM
        rol NUM+1
        rol NUM+2
        rol SBR
        rol SBR+1
        lda SBR
        sec
        sbc SBT
        tay
        lda SBR+1
        sbc SBT+1
        bcc :+
        sta SBR+1
        sty SBR
        inc NUM
:       dex
        bne :--
        rts

pow10_lo: .byte <10000000, <1000000, <100000, <10000, <1000, <100, <10, <1
pow10_md: .byte >10000000 & $ff, >1000000 & $ff, >100000 & $ff, >10000, >1000, >100, >10, >1
pow10_hi: .byte ^10000000, ^1000000, ^100000, 0, 0, 0, 0, 0
; ranges: x = 4 below 1e5, 5 below 1e6, 6 below 1e7, 7 above (NUM < 10000 stops at x = 3)
fmt_lo:   .byte 0, 0, 0, <10000, <100000, <1000000, <10000000
fmt_md:   .byte 0, 0, 0, >10000, >100000 & $ff, >1000000 & $ff, >10000000 & $ff
fmt_hi:   .byte 0, 0, 0, 0, ^100000, ^1000000, ^10000000
fmt_dlo:  .byte <100, <1000, <10000, <100000
fmt_dmd:  .byte >100, >1000, >10000, >100000 & $ff
fmt_half_lo: .byte <50, <500, <5000, <50000
fmt_half_md: .byte >50, >500, >5000, >50000
fmt_half_hi: .byte 0, 0, 0, 0
fmt_point: .byte 1, 0, 2, 1     ; digits after the point: 12.3k, 123k, 1.23M, 12.3M
fmt_unit:  .byte 'k', 'k', 'M', 'M'

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
SBT:     .res 2
SBR:     .res 2
SBX:     .res 1
SBROW:   .res 1
SBM:     .res 2
NUM:     .res 3
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
