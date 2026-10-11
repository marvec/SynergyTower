; Fast loader, 1541 side. Uploaded to $0500 with M-W and started with M-E by the boot file (src/boot.s).
;
; The C64 is the bus master: it toggles a line for every transfer step and the drive answers within
; 13 cycles, so the C64 may be interrupted (music IRQ, bad lines) at any time without breaking a transfer.
;   attention   C64 pulls CLK -> drive pulls DATA (ack) -> C64 releases CLK -> drive releases DATA
;   command     track, sector: 1 bit per CLK edge, the C64 puts the bit on DATA (pulled = 0), LSB first
;   per block   drive holds DATA low while it reads the sector and releases it when ready. Then it sends
;               count (1..254, 0 = end of file, $ff = read error) and the bytes, 2 bits per ATN edge:
;               DATA carries the even bit, CLK the odd one (released = 1), LSB first, 4 edges per byte.
;               Two more ATN edges acknowledge the block; the drive answers both with "busy".
; The drive keeps interrupts off while it is on the clock (its job loop runs in the IRQ, so they are back
; on while a sector is read).
;
; ATN has a hardware auto-acknowledge: the drive pulls DATA whenever ATN differs from the ATNA bit, so
; every value written while ATN is asserted carries ATNA ($10).

VIA1    = $1800                 ; bit 0 DATA in, 1 DATA out, 2 CLK in, 3 CLK out, 4 ATNA, 7 ATN in
JOB0    = $00                   ; job code for buffer 0 ($0300)
HDR0    = $06                   ; track/sector for buffer 0
BUF     = $0300
DATA_OUT = $02
ATNA    = $10
; variables in buffer 3 (not uploaded)
clk     = $06f0
cur     = $06f1
bits    = $06f2
trk     = $06f3
sector  = $06f4
count   = $06f5

; A = byte -> 4 bit pairs, one per ATN edge. 20 cycles between edges, ~35 from the last pair of one byte
; to the first of the next in the block loop. Uses X.
.macro send_byte
        .local w0, w1, w2, w3
        eor #$ff                ; a 1 bit releases its line
        sta cur
        and #3
        tax
        lda pair_on,x
w0:     bit VIA1
        bpl w0                  ; ATN asserted
        sta VIA1
        lda cur
        lsr
        lsr
        sta cur
        and #3
        tax
        lda pair_off,x
w1:     bit VIA1
        bmi w1                  ; ATN released
        sta VIA1
        lda cur
        lsr
        lsr
        sta cur
        and #3
        tax
        lda pair_on,x
w2:     bit VIA1
        bpl w2
        sta VIA1
        lda cur
        lsr
        lsr
        tax
        lda pair_off,x
w3:     bit VIA1
        bmi w3
        sta VIA1
.endmacro

.segment "CODE"
start:  cli
idle:   lda #0
        sta VIA1                ; release DATA and CLK
@att:   lda VIA1
        and #$04
        beq @att                ; wait for the C64 to pull CLK
        sei
        lda #DATA_OUT
        sta VIA1                ; ack
@rel:   lda VIA1
        and #$04
        bne @rel                ; wait for CLK released
        lda #0
        sta VIA1
        sta clk
        jsr recv
        sta trk
        jsr recv
        sta sector

block:  lda #DATA_OUT
        sta VIA1                ; busy
        lda trk
        sta HDR0
        lda sector
        sta HDR0+1
        lda #$80                ; READ
        sta JOB0
        cli
@job:   lda JOB0
        bmi @job
        sei
        cmp #$01
        beq :+
        jmp fail
:       ldy #254
        lda BUF
        bne :+
        ldy BUF+1               ; last block: bytes 2..BUF+1
        dey
:       sty count
        lda #0
        sta VIA1                ; ready
        tya
        send_byte
        ldy #2
byteloop: lda BUF,y
        send_byte
        iny
        dec count
        bne byteloop
        jsr ack                 ; the C64 has the block
        lda BUF
        beq eof
        sta trk
        lda BUF+1
        sta sector
        jmp block

eof:    lda #0
        .byte $2c               ; BIT abs: skip the next instruction
fail:   lda #$ff
        ldx #0
        stx VIA1                ; ready
        send_byte
        jsr ack
        jmp idle

; Two ATN edges, both answered with "busy" (DATA pulled).
ack:    lda #DATA_OUT | ATNA
:       bit VIA1
        bpl :-
        sta VIA1
        lda #DATA_OUT
:       bit VIA1
        bmi :-
        sta VIA1
        rts

; Receive a byte from the C64 (DATA pulled = 0).
recv:   lda #8
        sta bits
@bit:   lda VIA1
        and #$04
        cmp clk
        beq @bit
        sta clk
        lda VIA1
        lsr                     ; C = DATA in (1 = pulled)
        ror cur
        dec bits
        bne @bit
        lda cur
        eor #$ff
        rts

; Bit pair (already inverted: 1 = pull) -> VIA1 value. Bit 0 drives DATA, bit 1 CLK.
pair_off: .byte 0, DATA_OUT, $08, DATA_OUT | $08
pair_on:  .byte ATNA, ATNA | DATA_OUT, ATNA | $08, ATNA | DATA_OUT | $08
