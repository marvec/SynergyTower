; Boot file: the only file the KERNAL loads (LOAD"*",8,1). It uploads the fast loader's drive code, copies
; the C64 side of the loader to $c400 and fast-loads the packed main program: part 2 to $9400, then part 1
; over itself.

.include "zp.inc"
.include "gen/boot.inc"         ; MAIN_T/S, MAIN2_T/S, FAR_T/S: first blocks of the main program's parts
.include "gen/files.inc"        ; DEPT_T/S

.import __LOADER_LOAD__, __LOADER_RUN__, __LOADER_SIZE__

PACKBUF    = $4000              ; up to 16 KB of packed data ($4000-$7fff)
MAIN_START = $080d              ; main.s: the jmp after its BASIC stub
DRIVE_ADDR = $0500
CHROUT = $ffd2
SETLFS = $ffba
SETNAM = $ffbd
OPEN   = $ffc0
CLOSE  = $ffc3

.segment "HEAD"
        .word $0801

.segment "CODE"
        .word @link, 10
        .byte $9e, "2061", 0
@link:  .word 0
        lda $dc0e               ; start the CIA time-of-day clock (50 Hz): the main program
        ora #$80                ; reports the boot time in test builds
        sta $dc0e
        lda #0
        sta $dc0b
        sta $dc0a
        sta $dc09
        sta $dc08
        sta $d020
        sta $d021
        ldx #0
:       lda s_boot,x
        beq :+
        jsr CHROUT
        inx
        bne :-
:       jsr fl_install
        ldx #0                  ; the loader to $c400
:       lda __LOADER_LOAD__,x
        sta __LOADER_RUN__,x
        lda __LOADER_LOAD__+256,x
        sta __LOADER_RUN__+256,x
        lda __LOADER_LOAD__+512,x
        sta __LOADER_RUN__+512,x
        inx
        bne :-
        .assert __LOADER_SIZE__ <= 768, error, "loader copy is more than three pages"
        jmp boot2

; Upload the drive code with M-W (32 bytes per command), then start it with M-E.
fl_install:
        lda #<drive_code
        sta SRC
        lda #>drive_code
        sta SRC+1
        lda #<DRIVE_ADDR
        sta DST
        lda #>DRIVE_ADDR
        sta DST+1
        lda #<DRIVE_BYTES
        sta T0
        lda #>DRIVE_BYTES
        sta T1                  ; bytes left (16-bit)
@chunk: lda #32
        ldx T1
        bne :+
        cmp T0
        bcc :+
        lda T0
:       sta T3
        lda #'M'
        sta cmdbuf
        lda #'-'
        sta cmdbuf+1
        lda #'W'
        sta cmdbuf+2
        lda DST
        sta cmdbuf+3
        lda DST+1
        sta cmdbuf+4
        lda T3
        sta cmdbuf+5
        ldy #0
:       lda (SRC),y
        sta cmdbuf+6,y
        iny
        cpy T3
        bne :-
        tya
        clc
        adc #6
        jsr drive_open
        lda #15
        jsr CLOSE
        lda SRC
        clc
        adc T3
        sta SRC
        bcc :+
        inc SRC+1
:       lda DST
        clc
        adc T3
        sta DST
        bcc :+
        inc DST+1
:       lda T0
        sec
        sbc T3
        sta T0
        bcs :+
        dec T1
:       ora T1
        bne @chunk
        lda #'E'
        sta cmdbuf+2
        lda #<DRIVE_ADDR
        sta cmdbuf+3
        lda #>DRIVE_ADDR
        sta cmdbuf+4
        lda #5
        jsr drive_open          ; no CLOSE: from now on the drive runs our code, not the DOS
        lda #0
        sta $98                 ; KERNAL: forget the open file
        rts

; A = length of the command in cmdbuf: OPEN 15,8,15,cmd
drive_open:
        ldx #<cmdbuf
        ldy #>cmdbuf
        jsr SETNAM
        lda #15
        ldx $ba
        bne :+
        ldx #8
:       ldy #15
        jsr SETLFS
        jmp OPEN

s_boot: .byte $93, $05, 13, 13, "  SYNERGY TOWER", 13, 13, "  LOADING...", 0   ; clear, white
drive_code:
        .incbin "obj/drive.bin"
DRIVE_BYTES = * - drive_code

; ---- runs at $c400 ----------------------------------------------------------------------------------
.segment "LOADER"
boot2:  lda #$36                    ; BASIC ROM out: part 2 unpacks to $9600-$bfff and reads back what it wrote
        sta $01
        lda #DEPT_T                 ; side 1's department image: the charset ($c800), the side's directory and the
        ldx #DEPT_S                 ; colleague lines ($d000, under the I/O)
        ldy #>$c800
        jsr load_prep
        sei
        lda #$34                    ; all RAM while unpacking
        sta $01
        jsr lz_unpack
        lda #$36
        sta $01
        cli
        lda #FAR_T                  ; part 3 (sprites + texts) to $e000, under the KERNAL
        ldx #FAR_S
        ldy #>$e000
        jsr load_prep
        sei
        lda #$35                    ; KERNAL out while unpacking (it reads back what it wrote)
        sta $01
        jsr lz_unpack
        lda #$36
        sta $01
        cli
        lda #MAIN2_T                ; part 2 to $9600
        ldx #MAIN2_S
        ldy #>$9600
        jsr load_unpack
        lda #MAIN3_T                ; part 3 to $6400
        ldx #MAIN3_S
        ldy #>$6400
        jsr load_unpack
        lda #MAIN_T                 ; part 1 over this boot file
        ldx #MAIN_S
        ldy #>$0801
        jsr load_unpack
        jmp MAIN_START

; A = track, X = sector, Y = page to unpack to ($xx00 or $0801): load the packed file to $4000 and unpack it.
load_unpack:
        jsr load_prep
        jmp lz_unpack

; ... load it and set SRC / DST for lz_unpack.
load_prep:
        sty MP                      ; (lz_unpack's match pointer is free until the unpack)
        pha
        lda #<PACKBUF
        sta DST
        lda #>PACKBUF
        sta DST+1
        pla
        jsr fl_load
        bcs @err
        lda #<PACKBUF
        sta SRC
        lda #>PACKBUF
        sta SRC+1
        lda MP
        sta DST+1
        ldy #0
        cmp #>$0801
        bne :+
        ldy #<$0801
:       sty DST
        rts
@err:   inc $d020
        jmp @err

.include "loader.s"

.segment "BSS"
cmdbuf: .res 40
