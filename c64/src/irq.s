; ---- IRQ + SID player ----------------------------------------------------------------------------
irq:
        lda #$ff
        sta $d019
        lda $d012
        cmp #MUSIC_LINE
        bcs @music
        cmp #SPLIT_LINE + 6
        bcc @split
        jmp mux_irq             ; inside the playfield: multiplexed sprites
@split:
        ; below the HUD (lines 51-74): playfield screen, then YSCROLL on line 74, the HUD's last line.
        ; YSCROLL = 2 would match line 74 itself and start a bad line there, so it goes 1 first, 2 a line later.
        lda NEXT_D018
        sta $d018
        lda NEXT_S
        ora #$18
        tay
@w74:   ldx $d012
        cpx #74
        bcc @w74
        cpy #$1a
        bne @set
        lda #$19
        sta $d011
@w75:   ldx $d012
        cpx #75
        bcc @w75
@set:   sty $d011
        lda #0
        sta MUXI
        lda #MUSIC_LINE
        ldx MUXN
        beq :+
        lda m_line              ; first multiplexed sprite
:       sta $d012
        jmp $febc               ; KERNAL: restore registers, RTI
@music: lda #$1b                ; YSCROLL 3 again for the HUD
        sta $d011
        lda #SPLIT_LINE
        sta $d012
        inc FRAME
        jsr clock_tick          ; CLOCK: seconds, for cooldowns and coffee
        jsr music_play
        jmp $ea31               ; KERNAL: jiffy clock + keyboard scan, then RTI

; X = song index
music_start:
        php
        sei
        lda $01                 ; the songs are under the KERNAL
        pha
        lda #$35
        sta $01
        cpx #0                  ; 0: this side's department song
        bne :+
        ldx dir + DIR_SONG
:       lda songs_lo,x
        sta MUS_SONG
        lda songs_hi,x
        sta MUS_SONG+1
        ldy #2
        lda (MUS_SONG),y
        sta MUS_LEN
        iny
        lda (MUS_SONG),y
        sta mus_w1
        sta $d404
        iny
        lda (MUS_SONG),y
        sta $d405
        iny
        lda (MUS_SONG),y
        sta $d406
        iny
        lda (MUS_SONG),y
        sta $d403
        iny
        lda (MUS_SONG),y
        sta mus_w2
        sta $d40b
        iny
        lda (MUS_SONG),y
        sta $d40c
        iny
        lda (MUS_SONG),y
        sta $d40d
        iny
        lda (MUS_SONG),y
        sta $d40a
        lda MUS_SONG
        clc
        adc #11
        sta MUS_DATA
        sta MUS_PTR
        lda MUS_SONG+1
        adc #0
        sta MUS_DATA+1
        sta MUS_PTR+1
        lda #0
        sta MUS_STEP
        sta $d402
        sta $d409
        lda #1
        sta MUS_TICK
        sta MUS_ON
        lda #$0f
        sta $d418
        pla
        sta $01
        plp
        rts

music_play:
        lda MUS_ON
        bne :+
        rts
:       lda $01                 ; the songs are under the KERNAL (I/O stays in for the SID)
        pha
        lda #$35
        sta $01
        jsr mp_step
        pla
        sta $01
        rts
mp_step:
        dec MUS_TICK
        beq @step
        lda MUS_TICK
        cmp #1
        bne @tick
        ; one frame before the next step: release voices that change there (lets the next note retrigger)
        ldy #0
        lda (MUS_PTR),y
        beq :+
        lda mus_w1
        sta $d404
:       iny
        lda (MUS_PTR),y
        beq @tick
        lda mus_w2
        sta $d40b
@tick:  jmp drum_tick
@step:  lda MUS_STEP
        and #1
        tay
        lda (MUS_SONG),y
        sta MUS_TICK
        ldy #0
        lda (MUS_PTR),y
        beq @v2
        cmp #1
        beq @off1
        tax
        lda freq_lo,x
        sta $d400
        lda freq_hi,x
        sta $d401
        lda mus_w1
        ora #1
        sta $d404
        bne @v2
@off1:  lda mus_w1
        sta $d404
@v2:    iny
        lda (MUS_PTR),y
        beq @v3
        cmp #1
        beq @off2
        tax
        lda freq_lo,x
        sta $d407
        lda freq_hi,x
        sta $d408
        lda mus_w2
        ora #1
        sta $d40b
        bne @v3
@off2:  lda mus_w2
        sta $d40b
@v3:    iny
        lda (MUS_PTR),y
        beq @adv
        ldx SFX_LOCK
        bne @adv
        jsr drum_start
@adv:   lda MUS_PTR
        clc
        adc #3
        sta MUS_PTR
        bcc :+
        inc MUS_PTR+1
:       inc MUS_STEP
        lda MUS_STEP
        cmp MUS_LEN
        bne @tick
        lda #0
        sta MUS_STEP
        lda MUS_DATA
        sta MUS_PTR
        lda MUS_DATA+1
        sta MUS_PTR+1
        jmp drum_tick

; A = drum / effect id (1..8) on voice 3.
drum_start:
        sta DT0
        asl
        adc DT0
        asl                     ; × 6
        tax
        lda #0
        sta $d412
        lda drum_tab-6,x
        sta mus_w3
        lda drum_tab-6+1,x
        sta $d413
        lda drum_tab-6+2,x
        sta $d414
        lda drum_tab-6+3,x
        sta mus_f3
        sta $d40f
        lda #0
        sta $d40e
        lda drum_tab-6+4,x
        sta mus_sweep
        lda drum_tab-6+5,x
        sta mus_t3
        lda mus_w3
        ora #1
        sta $d412
        rts

drum_tick:
        lda SFX_LOCK
        beq :+
        dec SFX_LOCK
:       lda mus_t3
        beq @done
        dec mus_t3
        bne :+
        lda mus_w3
        sta $d412               ; gate off
        rts
:       lda mus_f3
        clc
        adc mus_sweep
        sta mus_f3
        sta $d40f
@done:  rts

