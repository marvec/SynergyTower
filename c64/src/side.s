; ---- disk sides -----------------------------------------------------------------------------------------------
; The tower spans 9 disk sides (build.js SIDES). Each starts with its department image at the same track/sector:
; the charset with that department's floor tiles ($c800) and, at $d000 (under the I/O), the side's directory
; (gen/dir.inc: where its floors, games, terminal and save are) followed by the colleague lines. The directory is
; copied to `dir` when a side is loaded.

; Load the department image of the side in the drive. C=1 on a disk error.
load_dept:
        jsr set_loadbuf
        lda #DEPT_T
        ldx #DEPT_S
        jsr fl_load
        bcc :+
        rts                     ; (C=1)
:       jsr slot_src
        lda #<$c800
        sta DST
        lda #>$c800
        sta DST+1
        sei
        lda #$34                ; all RAM: the image reaches under the I/O
        sta $01
        jsr lz_unpack
        lda #$36
        sta $01
        cli
; The directory from $d000 to `dir`.
copy_dir:
        sei
        lda #$34
        sta $01
        ldy #0
:       lda FAR2,y
        sta dir,y
        iny
        cpy #DIR_SIZE
        bne :-
        lda #$36
        sta $01
        cli
        clc
        rts

; A = floor: make sure its side is in the drive (asking for it), and take over a newer save of this career found
; there (when a career continues on another side). st_floor is that floor (or the one of the save taken over).
ensure_side:
        tax
        lda side_of_floor-1,x
        cmp dir + DIR_SIDE
        bne :+
        rts
:       sta WANT_SIDE
        jsr plain_screen
        lda #0
        sta $d015
swap_prompt:                    ; (test builds: the disk is swapped from the VICE monitor here)
        lda #0
        sta COLOR
        jsr cls
        lda #7
        sta COLOR
        jsr sb_line             ; "Please insert disk 3, side A"
        lda #<s_insert
        ldx #>s_insert
        jsr sb_str
        lda WANT_SIDE
        jsr side_label
        jsr sb_end
        ldy #10
        jsr print_line_center
        lda #15
        sta COLOR
        ldy #13
        lda #<s_thenfire
        ldx #>s_thenfire
        jsr print_center
.ifdef AUTOPLAY
        ldx #50                 ; test builds: no FIRE needed
:       jsr wait_frame
        dex
        bne :-
.else
:       jsr wait_frame
        jsr read_input
        lda JOYP
        and #J_FIRE
        beq :-
.endif
        lda #3
        sta COLOR
        ldy #16
        lda #<s_loading
        ldx #>s_loading
        jsr print_center
        jsr load_dept
        bcs @wrong
        lda dir + DIR_MAGIC
        cmp #'S'
        bne @wrong
        lda dir + DIR_MAGIC + 1
        cmp #'T'
        bne @wrong
        lda dir + DIR_SIDE
        cmp WANT_SIDE
        beq @here
@wrong: jmp swap_prompt
@here:  lda #0                  ; (the overlay slot's file was on the other side)
        sta LOADED
        sta LOADED+1
        jsr newer_save
        php
        ldx #SONG_FLOOR
        jsr play_song
        plp
        bcs :+
        rts
:       lda st_floor            ; the save taken over may be on yet another side
        jmp ensure_side

; This side's save, if it is the same career and newer, replaces the state (C=1); else the state stays (C=0).
newer_save:
        ldx #0                  ; keep the state in the spill area
:       lda ST_BASE,x
        sta SPILL,x
        lda ST_BASE + $100,x
        sta SPILL + $100,x
        lda ST3_BASE,x
        sta SPILL + $200,x
        inx
        bne :-
        jsr load_game
        bcs @keep
        lda st_career           ; the same career?
        cmp SPILL + ST::career
        bne @keep
        lda st_career+1
        cmp SPILL + ST::career + 1
        bne @keep
        lda SPILL + ST::savecnt ; newer: more saves
        cmp st_savecnt
        lda SPILL + ST::savecnt + 1
        sbc st_savecnt+1
        bcs @keep
        sec                     ; (kept < this side's): taken
        rts
@keep:  ldx #0
:       lda SPILL,x
        sta ST_BASE,x
        lda SPILL + $100,x
        sta ST_BASE + $100,x
        lda SPILL + $200,x
        sta ST3_BASE,x
        inx
        bne :-
        sei
        lda st_clock
        sta CLOCK
        lda st_clock+1
        sta CLOCK+1
        lda st_clock+2
        sta CLOCK+2
        cli
        clc
        rts

; A = side 1-9: append "3, side A" (two sides per disk).
side_label:
        sec
        sbc #1
        pha
        lsr
        clc
        adc #1
        jsr sb_num
        lda #<s_sidelbl
        ldx #>s_sidelbl
        jsr sb_str
        pla
        and #1
        clc
        adc #'A'
        jmp sb_char

; X = colleague line (0.. common, then the department's) -> A/X = its address under the I/O.
line_addr:
        lda #<(FAR2 + DIR_SIZE)
        sta PTR
        lda #>(FAR2 + DIR_SIZE)
        sta PTR+1
        sei
        lda #$34
        sta $01
        ldy #0
@line:  cpx #0
        beq @done
:       lda (PTR),y             ; past the line's 0 and the empty paragraph's 0
        inc PTR
        bne :+
        inc PTR+1
:       cmp #0
        bne :--
        inc PTR
        bne :+
        inc PTR+1
:       dex
        jmp @line
@done:  lda #$36
        sta $01
        cli
        lda PTR
        ldx PTR+1
        rts

.segment "BSS"
WANT_SIDE: .res 1
.segment "CODE"
