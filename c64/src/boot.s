; Boot file: the only file the KERNAL loads (LOAD"*",8,1). It uploads the fast loader's drive code, copies
; the C64 side of the loader to $c400 and fast-loads the packed main program over itself.

.include "zp.inc"
.include "gen/boot.inc"         ; MAIN_T, MAIN_S: first block of the main program

.import __LOADER_LOAD__, __LOADER_RUN__, __LOADER_SIZE__

LOADBUF    = $6000
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
        inx
        bne :-
        .assert __LOADER_SIZE__ <= 512, error, "loader copy is more than two pages"
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
boot2:  lda #<LOADBUF
        sta DST
        lda #>LOADBUF
        sta DST+1
        lda #MAIN_T
        ldx #MAIN_S
        jsr fl_load
        bcs @err
        lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<$0801
        sta DST
        lda #>$0801
        sta DST+1
        jsr lz_unpack           ; over this boot file
        jmp MAIN_START
@err:   inc $d020
        jmp @err

.include "loader.s"

.segment "BSS"
cmdbuf: .res 40
