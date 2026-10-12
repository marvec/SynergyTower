; ---- menus: stats, pause menu, shop + demo checkout, perks, training ----------------------------------------
; (src/scenes/statsDialog.js, overlays.js PauseMenu, ShopOverlay, FakeCheckout, PerksOverlay, TrainOverlay)

; ---- "Your numbers": six pages, left/right flips through them -------------------------------------------
stats_dialog:
        lda #0
        sta STAT_TAB
stats_show:
        lda #<s_yournumbers
        ldx #>s_yournumbers
        jsr ui_open
        lda #1
        sta UI_LR
        jsr stat_tabs
        lda STAT_TAB
        asl
        tax
        lda stat_jump+1,x
        pha
        lda stat_jump,x
        pha
        rts
stat_done:
        lda #<s_close
        ldx #>s_close
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #$fe
        bne :+
        dec STAT_TAB
        bpl stats_show
        lda #5
        sta STAT_TAB
        bne stats_show
:       cmp #$fd
        bne :+
        inc STAT_TAB
        lda STAT_TAB
        cmp #6
        bcc stats_show
        lda #0
        sta STAT_TAB
        beq stats_show
:       jmp enter_floor
stat_jump:
        .word st_clips - 1, st_coffeepg - 1, st_options - 1, st_kpi - 1, st_levelpg - 1, st_games - 1

; The tab names on row 3 (the current one yellow), "<- ->" hint.
stat_tabs:
        ldx #0
        lda #2
        sta UI_COL
@t:     stx T2
        lda #15
        cpx STAT_TAB
        bne :+
        lda #7
:       sta COLOR
        lda stat_name_lo,x
        sta PTR
        lda stat_name_hi,x
        sta PTR+1
        ldx UI_COL
        ldy #3
        jsr print
        lda SCR                 ; next column: after the name + a space
        sec
        sbc #<(SCREEN + 3 * 40 - 1)
        sta UI_COL
        ldx T2
        inx
        cpx #6
        bne @t
        lda #5
        sta UI_ROW
        lda #1
        sta COLOR
        rts

st_clips:
        lda #<f_stclips
        ldx #>f_stclips
        jsr far_text
        jsr ui_gap
        lda st_max
        cmp #FLOORS_MAX
        bcs :+
        jsr sb_line             ; "Keycard fee for floor N+1"  "fee - covered" / "fee - X to go"
        ldx st_max
        jsr fee_num
        jsr sb_u24
        ldx st_max
        jsr fee_num
        jsr sp_ge
        bcc @togo
        lda #<s_covered
        ldx #>s_covered
        jsr sb_str
        jmp @kv
@togo:  lda #<s_dash
        ldx #>s_dash
        jsr sb_str
        lda NUM                 ; fee - paperclips
        sec
        sbc st_sp
        sta NUM
        lda NUM+1
        sbc st_sp+1
        sta NUM+1
        lda NUM+2
        sbc st_sp+2
        sta NUM+2
        jsr sb_u24
        lda #<s_togo
        ldx #>s_togo
        jsr sb_str
@kv:    jsr sb_end
        lda #<s_keycardfor
        ldx #>s_keycardfor
        jsr ui_kv
:       jmp stat_done

st_coffeepg:
        lda #<f_stcoffee
        ldx #>f_stcoffee
        jsr far_text
        jsr ui_gap
        jsr sb_line
        lda st_lobby
        bne :+
        lda #<s_checkinfd
        ldx #>s_checkinfd
        jsr sb_str
        jmp @kv
:       jsr coffee_max
        cmp st_coffee
        beq :+
        bcs @in
:       lda #<s_mugfull
        ldx #>s_mugfull
        jsr sb_str
        jmp @kv
@in:    lda #<s_in
        ldx #>s_in
        jsr sb_str
        jsr cup_left
        jsr sb_mmss
        lda #<s_oneevery
        ldx #>s_oneevery
        jsr sb_str
        jsr regen_secs
        jsr sb_mmss
        lda #')'
        jsr sb_char
@kv:    jsr sb_end
        lda #<s_nextcup
        ldx #>s_nextcup
        jsr ui_kv
        jsr sb_line
        lda #<st_machcd
        ldx #>st_machcd
        jsr floor_dl_ptr
        jsr time_left
        bne :+
        lda #<s_readyplus3
        ldx #>s_readyplus3
        jsr sb_str
        jmp :++
:       lda #<s_brewingc
        ldx #>s_brewingc
        jsr sb_str
        jsr sb_mmss
:       jsr sb_end
        lda #<s_coffeemachine
        ldx #>s_coffeemachine
        jsr ui_kv
        jmp stat_done

st_options:
        lda #<f_stoptions
        ldx #>f_stoptions
        jsr far_text
        jsr ui_gap
        jsr sb_line
        lda #<s_1option
        ldx #>s_1option
        jsr sb_str
        jsr sb_end
        lda #<s_skipcd
        ldx #>s_skipcd
        jsr ui_kv
        jsr sb_line
        lda #<s_3options
        ldx #>s_3options
        jsr sb_str
        jsr sb_end
        lda #<s_refillall
        ldx #>s_refillall
        jsr ui_kv
        jmp stat_done

st_kpi:
        lda st_floor
        cmp st_max
        bne :+
        lda #<f_stkpi
        ldx #>f_stkpi
        jsr far_text
        jsr ui_gap
        jsr promo_checklist
        jmp stat_done
:       lda #<f_stkpilow
        ldx #>f_stkpilow
        jsr far_text
        jmp stat_done

st_levelpg:
        lda #<f_stlevel
        ldx #>f_stlevel
        jsr far_text
        jsr ui_gap
        jsr sb_line             ; "x / y to Lv n+1"
        jsr xp_num
        jsr sb_u24
        lda #<s_slash
        ldx #>s_slash
        jsr sb_str
        jsr xpn_num
        jsr sb_u24
        lda #<s_tolv
        ldx #>s_tolv
        jsr sb_str
        ldx st_level
        inx
        txa
        jsr sb_num
        jsr sb_end
        lda #<s_experience
        ldx #>s_experience
        jsr ui_kv
        lda st_max
        cmp #FLOORS_TOP
        bcs :+
        jsr sb_line
        lda #'L'
        jsr sb_char
        lda #'v'
        jsr sb_char
        ldx st_max
        inx
        txa
        jsr sb_num
        jsr sb_end
        jsr sb_line2            ; "Needed for floor N+1"
        lda #<s_neededfor
        ldx #>s_neededfor
        jsr sb_str
        ldx st_max
        inx
        txa
        jsr sb_num
        jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        jsr ui_kv
:       jmp stat_done

st_games:
        jsr games_played
        sta T3
        jsr sb_line             ; "Games played: n / total"
        lda T3
        jsr sb_num
        lda #'/'
        jsr sb_char
        lda #G_COUNT - 1
        jsr sb_num
        jsr sb_end
        lda #<s_gamesplayed
        ldx #>s_gamesplayed
        jsr ui_kv
        jsr ui_gap
        lda #<f_stgames
        ldx #>f_stgames
        jsr far_text
        jsr ui_gap
        lda #<textbuf           ; the ones not tried yet on this floor
        ldx #>textbuf
        jsr sb_start
        lda #0
        sta T2
        ldx #0
@s:     cpx FL_HDR + HDR_STATIONS
        bcs @end
        stx T3
        txa
        jsr ia_ptr
        ldy #IA_ARG
        lda (IA),y
        jsr game_played
        bne @next
        lda T2
        beq :+
        lda #','
        jsr sb_char
        lda #' '
        jsr sb_char
:       inc T2
        ldy #IA_ARG
        lda (IA),y
        tax
        lda game_name_lo,x
        pha
        lda game_name_hi,x
        tax
        pla
        jsr sb_str
@next:  ldx T3
        inx
        bne @s
@end:   jsr sb_end
        lda T2
        bne :+
        lda #5
        sta COLOR
        lda #<s_alltried
        ldx #>s_alltried
        jsr ui_text
        jmp stat_done
:       lda #15
        sta COLOR
        lda #<s_nottried
        ldx #>s_nottried
        jsr ui_text
        lda #1
        sta COLOR
        lda #<textbuf
        ldx #>textbuf
        jsr ui_text
        jmp stat_done

sb_line2:
        lda #<lbuf0
        ldx #>lbuf0
        jmp sb_start

; A = game index -> Z=0 if played at least once.
game_played:
        tax
        lsr
        lsr
        lsr
        tay
        txa
        and #7
        tax
        lda st_played,y
        and bit_tab,x
        rts

; A = game index: mark it played.
mark_played:
        tax
        lsr
        lsr
        lsr
        tay
        txa
        and #7
        tax
        lda st_played,y
        ora bit_tab,x
        sta st_played,y
        rts

; A = how many station games have been played (the review doesn't count).
games_played:
        lda #0
        sta T2
        ldx #0
:       stx T3
        txa
        jsr game_played
        beq :+
        inc T2
:       ldx T3
        inx
        cpx #G_COUNT - 1
        bne :--
        lda T2
        rts

; ---- pause menu (RUN/STOP) -----------------------------------------------------------------------------------
pause_menu:
        lda #<s_menu
        ldx #>s_menu
        jsr ui_open
        lda #<s_resume
        ldx #>s_resume
        ldy #0
        jsr ui_btn
        lda #<s_musicon         ; Music: ON / OFF
        ldx #>s_musicon
        ldy st_music
        bne :+
        lda #<s_musicoff
        ldx #>s_musicoff
:       ldy #0
        jsr ui_btn
        lda #<s_sfxon
        ldx #>s_sfxon
        ldy st_sfx
        bne :+
        lda #<s_sfxoff
        ldx #>s_sfxoff
:       ldy #0
        jsr ui_btn
        lda #'S'
        sta UI_KEY
        lda #<s_mstats
        ldx #>s_mstats
        ldy #0
        jsr ui_btn
        lda #'B'
        sta UI_KEY
        lda #<s_mshop
        ldx #>s_mshop
        ldy #0
        jsr ui_btn
        lda #'P'
        sta UI_KEY
        lda #<s_mperks
        ldx #>s_mperks
        ldy #0
        jsr ui_btn
        lda #'T'
        sta UI_KEY
        lda #<s_mtrain
        ldx #>s_mtrain
        ldy #0
        jsr ui_btn
        lda #'H'
        sta UI_KEY
        lda #<s_howto
        ldx #>s_howto
        ldy #0
        jsr ui_btn
        lda #<s_sendfeedback
        ldx #>s_sendfeedback
        ldy #0
        jsr ui_btn
        lda #<s_buycoffee
        ldx #>s_buycoffee
        ldy #0
        jsr ui_btn
        lda #<s_savequit
        ldx #>s_savequit
        ldy #0
        jsr ui_btn
        lda #<s_reset
        ldx #>s_reset
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #$ff
        bne :+
        lda #0
:       asl
        tax
        lda menu_jump+1,x
        pha
        lda menu_jump,x
        pha
        rts
menu_jump:
        .word enter_floor - 1, m_music - 1, m_sfx - 1, stats_dialog - 1, shop - 1, perks - 1, train - 1
        .word m_howto - 1, m_feedback - 1, m_tip - 1, m_quit - 1, m_reset - 1

m_music:
        lda st_music
        eor #1
        sta st_music
        jsr music_apply
        jmp pause_menu
m_sfx:  lda st_sfx
        eor #1
        sta st_sfx
        jmp pause_menu
m_howto:
        jsr how_to
        jmp pause_menu
m_feedback:
        jsr feedback_page
        jmp pause_menu
m_tip:  jsr tip_page
        jmp pause_menu
m_quit: jsr save_game
        jmp title
m_reset:
        lda #<f_reallyerase
        sta PT
        lda #>f_reallyerase
        sta PT+1
        jsr far_ptr_text        ; PT -> farbuf
        lda #<farbuf
        sta PT
        lda #>farbuf
        sta PT+1
        lda #<s_reset
        ldx #>s_reset
        jsr ui_confirm
        bcs :+
        jmp pause_menu
:       lda #0                  ; erase: an empty save block
        sta st_magic
        jsr save_game_raw
        jmp title

; ---- Stock Option shop ----------------------------------------------------------------------------------------
shop:
        lda #<s_shoptitle
        ldx #>s_shoptitle
        jsr ui_open
        lda #<f_shop
        ldx #>f_shop
        jsr far_text
        jsr ui_gap
        lda #2
        sta COLOR
        lda #<s_demomode
        ldx #>s_demomode
        jsr ui_text
        lda #1
        sta COLOR
        jsr ui_gap
        jsr sb_line             ; "You have N Stock Options."
        lda #<s_youhave
        ldx #>s_youhave
        jsr sb_str
        lda st_so
        sta NUM
        lda st_so+1
        sta NUM+1
        jsr sb_u16
        lda #<s_sodot
        ldx #>s_sodot
        jsr sb_str
        jsr sb_end
        jsr ui_line
        ldx #0
:       stx T3
        lda pack_lbl_lo,x
        pha
        lda pack_lbl_hi,x
        tax
        pla
        ldy #0
        jsr ui_btn
        ldx T3
        inx
        cpx #4
        bne :-
        jsr coffee_max          ; refill (not when full)
        ldy #0
        cmp st_coffee
        bne :+
        ldy #B_OFF
:       lda st_so+1
        bne :+
        lda st_so
        cmp #3
        bcs :+
        ldy #B_OFF
:       lda #<s_refillcoffee
        ldx #>s_refillcoffee
        jsr ui_btn
        lda #<s_close
        ldx #>s_close
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #4
        bcc checkout
        bne :+
        jsr spend_refill
        jmp shop
:       jmp enter_floor

; A = pack 0-3: the demo checkout.
checkout:
        sta SHOP_P
        lda #<s_checkout
        ldx #>s_checkout
        jsr ui_open
        lda #<s_card
        ldx #>s_card
        jsr ui_str
        jsr sb_line
        lda #<s_nameoncard
        ldx #>s_nameoncard
        jsr sb_str
        lda #<st_name
        ldx #>st_name
        jsr sb_str
        jsr sb_end
        jsr ui_line
        jsr ui_gap
        ldx SHOP_P
        lda pack_name_lo,x
        pha
        lda pack_name_hi,x
        tax
        pla
        jsr ui_str
        jsr ui_gap
        lda #2
        sta COLOR
        lda #<s_nothingcharged
        ldx #>s_nothingcharged
        jsr ui_text
        ldx SHOP_P
        lda pack_pay_lo,x
        pha
        lda pack_pay_hi,x
        tax
        pla
        ldy #0
        jsr ui_btn
        lda #<s_cancel
        ldx #>s_cancel
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #0
        beq :+
        jmp shop
:       lda #<s_checkout
        ldx #>s_checkout
        jsr ui_open
        lda #<s_processing
        ldx #>s_processing
        jsr ui_str
        ldx #60                 ; 1.2 s
:       jsr wait_frame
        dex
        bne :-
        ldx SHOP_P              ; the (pretend) Stock Options really arrive
        lda pack_so_lo,x
        clc
        adc st_so
        sta st_so
        lda pack_so_hi,x
        adc st_so+1
        sta st_so+1
        lda pack_so_lo,x
        clc
        adc st_sobought
        sta st_sobought
        lda pack_so_hi,x
        adc st_sobought+1
        sta st_sobought+1
        jsr save_game
        lda #<s_checkout
        ldx #>s_checkout
        jsr ui_open
        lda #SFX_GOOD
        jsr sfx
        jsr sb_line
        lda #'+'
        jsr sb_char
        ldx SHOP_P
        lda pack_so_lo,x
        sta NUM
        lda pack_so_hi,x
        sta NUM+1
        jsr sb_u16
        lda #<s_plusso
        ldx #>s_plusso
        jsr sb_str
        jsr sb_end
        lda #7
        sta COLOR
        jsr ui_line
        lda #1
        sta COLOR
        lda #<s_pretend
        ldx #>s_pretend
        jsr ui_text
        lda #<s_great
        ldx #>s_great
        ldy #0
        jsr ui_btn
        jsr ui_run
        jmp shop

; ---- perks ------------------------------------------------------------------------------------------------------
perks:
        lda #<s_perkstitle
        ldx #>s_perkstitle
        jsr ui_open
        lda #<f_perks
        ldx #>f_perks
        jsr far_text
        jsr ui_gap
        ldx #0
@p:     stx PERK_I
        txa                     ; label buffer lbuf1 + 32 × i
        asl
        asl
        asl
        asl
        asl
        clc
        adc #<lbuf1
        sta T2
        lda #>lbuf1
        adc #0
        sta T3
        ldx T3
        lda T2
        jsr sb_start
        ldx PERK_I              ; "Bigger Mug  2/5  450 clips" / "... MAX"
        lda perk_name_lo,x
        pha
        lda perk_name_hi,x
        tax
        pla
        jsr sb_str
        lda #' '
        jsr sb_char
        ldx PERK_I
        lda st_perks,x
        jsr sb_num
        lda #'/'
        jsr sb_char
        ldx PERK_I
        lda perk_max,x
        jsr sb_num
        lda #' '
        jsr sb_char
        lda #' '
        jsr sb_char
        ldy #0
        ldx PERK_I
        lda st_perks,x
        cmp perk_max,x
        bcc :+
        lda #<s_max
        ldx #>s_max
        jsr sb_str
        ldy #B_OFF
        jmp @add
:       jsr perk_cost           ; NUM = cost, C=1 if affordable
        php
        jsr sb_u16
        ldx PERK_I
        lda perk_cur,x
        bne :+
        lda #<s_clipsword
        ldx #>s_clipsword
        bne :++
:       lda #<s_options
        ldx #>s_options
:       jsr sb_str
        ldy #0
        plp
        bcs @add
        ldy #B_OFF
@add:   sty T1
        jsr sb_end
        lda T2
        ldx T3
        ldy T1
        jsr ui_btn
        ldx PERK_I
        inx
        cpx #6
        beq :+
        jmp @p
:       jsr back_btn
        jsr ui_run
        cmp #6
        bcc :+
        jmp enter_floor
:       sta PERK_I              ; buy
        jsr perk_cost
        ldx PERK_I
        lda perk_cur,x
        bne @so
        jsr sp_sub
        jmp @bought
@so:    lda st_so
        sec
        sbc NUM
        sta st_so
        lda st_so+1
        sbc NUM+1
        sta st_so+1
@bought:
        ldx PERK_I
        inc st_perks,x
        lda #SFX_GOOD
        jsr sfx
        jsr save_game
        jmp perks

; PERK_I -> NUM = cost of its next level, C=1 if affordable.
perk_cost:
        ldx PERK_I
        lda st_perks,x
        sta T0
        txa
        asl
        asl
        adc PERK_I              ; × 5
        adc T0
        tay
        lda perkc_lo,y
        sta NUM
        lda perkc_hi,y
        sta NUM+1
        lda #0
        sta NUM+2
        lda perk_cur,x
        bne @so
        jmp sp_ge
@so:    lda st_so
        cmp NUM
        lda st_so+1
        sbc NUM+1
        rts

; ---- training ----------------------------------------------------------------------------------------------------
train:
        lda #<s_traintitle
        ldx #>s_traintitle
        jsr ui_open
        lda #<f_train
        ldx #>f_train
        jsr far_text
        jsr ui_gap
        jsr sb_line             ; "Lv n   xp / next"
        lda #'L'
        jsr sb_char
        lda #'v'
        jsr sb_char
        lda st_level
        jsr sb_num
        lda #' '
        jsr sb_char
        lda #' '
        jsr sb_char
        jsr xp_num
        jsr sb_u24
        lda #'/'
        jsr sb_char
        jsr xpn_num
        jsr sb_u24
        lda #<s_xp
        ldx #>s_xp
        jsr sb_str
        jsr sb_end
        lda #3
        sta COLOR
        jsr ui_line
        lda #1
        sta COLOR
        ldx #0
@o:     stx PERK_I
        jsr train_xp            ; TXP = XP of option X
        txa                     ; label buffer
        asl
        asl
        asl
        asl
        asl
        clc
        adc #<lbuf1
        sta T2
        lda #>lbuf1
        adc #0
        tax
        lda T2
        jsr sb_start
        ldx PERK_I
        lda train_name_lo,x
        pha
        lda train_name_hi,x
        tax
        pla
        jsr sb_str
        lda #<s_plus
        ldx #>s_plus
        jsr sb_str
        lda TXP
        sta NUM
        lda TXP+1
        sta NUM+1
        lda TXP+2
        sta NUM+2
        jsr sb_u24
        lda #<s_xpfor
        ldx #>s_xpfor
        jsr sb_str
        jsr train_cost          ; NUM = XP × 4
        jsr sb_u24
        lda #<s_clipsword
        ldx #>s_clipsword
        jsr sb_str
        jsr sb_end
        ldy #0                  ; affordable?
        jsr sp_ge
        bcs :+
        ldy #B_OFF
:       ldx PERK_I
        txa
        asl
        asl
        asl
        asl
        asl
        clc
        adc #<lbuf1
        pha
        lda #>lbuf1
        adc #0
        tax
        pla
        jsr ui_btn
        ldx PERK_I
        inx
        cpx #3
        beq :+
        jmp @o
:       jsr back_btn
        jsr ui_run
        cmp #3
        bcc :+
        jmp enter_floor
:       tax
        stx PERK_I
        jsr train_xp
        jsr train_cost
        jsr sp_sub
        lda TXP
        sta RXP
        lda TXP+1
        sta RXP+1
        lda TXP+2
        sta RXP+2
        jsr add_xp
        lda #SFX_GOOD
        jsr sfx
        jsr save_game
        jmp train

; X = option (0 webinar 25%, 1 workshop 50%, 2 certification 100% of the XP still needed) -> TXP:
; round(need × share), at least 1 (X kept).
train_xp:
        stx T3
        jsr xp_needed           ; NUM
        ldx T3
        cpx #2
        beq @min1
        lda #1                  ; + half the divisor, then shift: (need + 1) >> 1 or (need + 2) >> 2
        cpx #1
        beq :+
        lda #2
:       clc
        adc NUM
        sta NUM
        bcc :+
        inc NUM+1
        bne :+
        inc NUM+2
:       lsr NUM+2
        ror NUM+1
        ror NUM
        cpx #1
        beq @min1
        lsr NUM+2
        ror NUM+1
        ror NUM
@min1:  lda NUM
        ora NUM+1
        ora NUM+2
        bne :+
        inc NUM
:       lda NUM
        sta TXP
        lda NUM+1
        sta TXP+1
        lda NUM+2
        sta TXP+2
        ldx T3
        rts

; NUM = TXP × 4 paperclips.
train_cost:
        lda TXP
        asl
        sta NUM
        lda TXP+1
        rol
        sta NUM+1
        lda TXP+2
        rol
        sta NUM+2
        asl NUM
        rol NUM+1
        rol NUM+2
        rts
