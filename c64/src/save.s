; ---- save game, far texts, music settings ------------------------------------------------------------------

; Write the three state pages to the save file's two blocks and the "save3" block (with the clock and one more
; save count).
save_game:
        sei
        lda CLOCK
        sta st_clock
        lda CLOCK+1
        sta st_clock+1
        lda CLOCK+2
        sta st_clock+2
        cli
        inc st_savecnt
        bne save_game_raw
        inc st_savecnt+1
save_game_raw:
        lda #<ST3_BASE          ; page 3: its own one-block file (it lives away from the other two)
        sta SRC
        lda #>ST3_BASE
        sta SRC+1
        lda #0
        sta LINK_T
        lda #$ff
        sta LINK_S
        lda dir + DIR_SAVE3_T
        ldx dir + DIR_SAVE3_S
        jsr fl_save
        lda #<ST2_BASE
        sta SRC
        lda #>ST2_BASE
        sta SRC+1
        lda #0                  ; the file's last block
        sta LINK_T
        lda #$ff
        sta LINK_S
        lda dir + DIR_SAVE2_T
        ldx dir + DIR_SAVE2_S
        jsr fl_save
        lda #<ST_START
        sta SRC
        lda #>ST_START
        sta SRC+1
        lda dir + DIR_SAVE2_T   ; the first block links to the second
        sta LINK_T
        lda dir + DIR_SAVE2_S
        sta LINK_S
        lda dir + DIR_SAVE_T
        ldx dir + DIR_SAVE_S
; A = track, X = sector: write LINK_T/LINK_S and the 254 bytes at SRC there (a block the build reserved).
; C=1 on an error.
fl_save:
        ora #$80                ; the drive's write command
        jsr fl_cmd
        lda LINK_T
        jsr fl_send
        lda LINK_S
        jsr fl_send
        ldy #0
:       lda (SRC),y
        jsr fl_send
        iny
        cpy #254
        bne :-
        lda ATNOFF
        sta $dd00               ; release DATA
        jsr w64
        jsr w64
:       bit $dd00
        bpl :-                  ; the drive is writing the block
        jsr fl_get              ; 0 = fine, $ff = error
        pha
        jsr fl_ack
        pla
        cmp #1                  ; C=1 for $ff
        rts

; Read the save file into the state pages (both blocks: it is one file), then page 3. C=0 if it holds a career.
load_game:
        lda #<ST_START
        sta DST
        lda #>ST_START
        sta DST+1
        lda dir + DIR_SAVE_T
        ldx dir + DIR_SAVE_S
        jsr fl_load
        bcs @none
        lda st_magic
        cmp #'S'
        bne @none
        lda st_magic+1
        cmp #'T'
        bne @none
        lda st_ver
        cmp #ST_VER
        bne @none
        lda #<ST3_BASE          ; and page 3
        sta DST
        lda #>ST3_BASE
        sta DST+1
        lda dir + DIR_SAVE3_T
        ldx dir + DIR_SAVE3_S
        jsr fl_load
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
@none:  sec
        rts

; ---- texts in the RAM under the KERNAL ($e000) and under the I/O ($d000, the side's colleague lines) -----------
; A far text is one or more paragraphs (byte-pair encoded, each ending in 0), then an empty one.

; A/X = far text: its first paragraph, expanded into farbuf. FARLEN = its packed length.
far_str:
        sta PTR
        stx PTR+1
        ldy #0                  ; its packed length (read with the KERNAL out)
        sei
        lda #$34                ; all RAM (KERNAL and I/O out): the expansion reads the text straight from there
        sta $01
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       sty FARLEN
        jsr expand_ptr
        lda #$36
        sta $01
        cli
        ldy #0
:       lda xbuf,y
        sta farbuf,y
        beq :+
        iny
        bne :-
:       rts

; A/X = far text: all its paragraphs, wrapped onto the dialog page.
far_text:
        sta FARP
        stx FARP+1
@para:  lda FARP
        ldx FARP+1
        jsr far_str
        lda FARLEN
        beq @done               ; the empty paragraph: the end
        sec                     ; next paragraph: after this one's 0
        adc FARP
        sta FARP
        bcc :+
        inc FARP+1
:       lda #<farbuf
        ldx #>farbuf
        jsr ui_text
        jmp @para
@done:  rts

; A/Y = far text, X = paragraph number -> A/X = that paragraph.
para_addr:
        sta PTR
        sty PTR+1
        sei
        lda #$34
        sta $01
        ldy #0
@para:  cpx #0
        beq @done
:       lda (PTR),y
        inc PTR
        bne :+
        inc PTR+1
:       cmp #0
        bne :--
        dex
        jmp @para
@done:  lda #$36
        sta $01
        cli
        lda PTR
        ldx PTR+1
        rts

; PT = far string -> farbuf.
far_ptr_text:
        lda PT
        ldx PT+1
        jmp far_str

.segment "BSS"
LINK_T:  .res 1
LINK_S:  .res 1
FARP:    .res 2
FARLEN:  .res 1
.segment "CODE"

; ---- music + sound settings ------------------------------------------------------------------------------------
; X = song: play it if music is on, else keep quiet (sound effects still work).
play_song:
        stx CUR_SONG
        lda st_music
        beq :+
        jmp music_start
:       sei
        lda #0
        sta MUS_ON
        sta $d404
        sta $d40b
        cli
        rts

music_apply:
        ldx CUR_SONG
        jmp play_song
