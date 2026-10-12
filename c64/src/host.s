; ---- mini-game host (src/scenes/minigameScene.js) ------------------------------------------------------------
; Loads the overlay (unless it is still in memory), shows the ready page and a 3-2-1-GO countdown, runs the
; game (RUN/STOP pauses: give up?), then pays out (src/core/state.js completeTask) and shows the result.

; A = station on this floor: play its task.
play_station:
        sta HOST_I
        jsr ia_ptr
        ldy #IA_ARG
        lda (IA),y
        sta HOST_G
        jsr task_cost
        sta HOST_COST
        ldy #IA_ARG2
        lda (IA),y
        sta MG_DIFF
        ldy #IA_W
        lda (IA),y
        and #$80
        sta HOST_CHECKIN        ; the front-desk check-in (only counts while checking in)
        lda st_lobby
        beq :+
        lda #0
        sta HOST_CHECKIN
:       lda #0
        sta HOST_REVIEW
        lda QDESK               ; the quest's desk part: coffee was taken when the quest began
        beq :+
        lda #0
        sta HOST_COST
        sta QDESK
:       jsr host_run
        jsr pay_out
        jsr result_page
        jsr enter_floor
        lda HOST_CHECKIN
        beq @done
        lda #<s_welcomeaboard
        ldx #>s_welcomeaboard
        jsr recep_say
        lda #CHECKIN_TOAST_T
        sta CHECKIN_T           ; the coffee card toast follows the receptionist
@done:  rts                     ; (back to the floor loop, which called interact)

; ---- pay out (src/core/state.js completeTask): MG_SCORE, HOST_I (station), HOST_G (game) -> rewards, best,
; cooldown, stats, check-in; saved.
pay_out:
        jsr score_stars
        sta HOST_STARS
        jsr reward_calc
        jsr add_sp
        jsr add_xp
        lda LEVELUPS
        sta HOST_SO
        lda HOST_STARS          ; a perfect run: 5% chance of a bonus Stock Option
        cmp #3
        bne :+
        jsr rand
        cmp #13
        bcs :+
        inc HOST_SO
        lda #1
        jsr add_so
:       ldx st_floor
        lda st_stars-1,x
        clc
        adc HOST_STARS
        sta st_stars-1,x
        ldx HOST_I              ; personal best
        jsr station_best_index
        lda #0
        sta HOST_BEST
        lda st_best,y
        bmi :+
        cmp HOST_STARS
        bcs :++
:       lda HOST_STARS
        sta st_best,y
        inc HOST_BEST
:       ldx HOST_I              ; cooldown
        jsr station_cd_ptr
        ldx HOST_G
        lda game_tier,x
        jsr cooldown_secs
        jsr set_deadline
        lda HOST_G
        jsr mark_played
        inc st_tasks
        bne :+
        inc st_tasks+1
:       lda HOST_STARS
        cmp #3
        bne :+
        inc st_perfect
        bne :+
        inc st_perfect+1
:       lda HOST_CHECKIN        ; the check-in loads the coffee card
        beq :+
        lda #LOBBY_GATE
        sta st_lobby
        jsr coffee_max
        cmp st_coffee
        bcc :+
        sta st_coffee
        jsr coffee_tick         ; (starts the refill clock)
:       jmp save_game

; The HR performance review on st_max (coffee already taken).
play_review:
        lda #G_REVIEW
        sta HOST_G
        lda #1
        sta HOST_REVIEW
        lda #0
        sta HOST_CHECKIN
        sta MG_DIFF
        lda st_max              ; context for the personal question
        sta MG_FLOORNO
        tax
        lda st_stars-1,x
        sta MG_STARS
        jsr host_run
        inc st_nreviews
        lda MG_SCORE
        cmp #REVIEW_PASS
        bcc @fail
        ldx st_max
        lda st_reviews
        ora bit_tab-1,x
        sta st_reviews
        lda #<st_revcd
        ldx #>st_revcd
        jsr floor_dl_ptr
        lda #0
        sta T0
        sta T1
        jsr set_deadline
        jmp :+
@fail:  lda #<st_revcd
        ldx #>st_revcd
        jsr floor_dl_ptr
        lda #0
        jsr cooldown_secs
        jsr set_deadline
:       jsr save_game
        jsr review_result
        jsr enter_floor
        lda MG_SCORE
        cmp #REVIEW_PASS
        bcc :+
        lda #<s_reviewpassed_t
        ldx #>s_reviewpassed_t
        jsr toast
:       rts

; Load + ready page + countdown + the game. MG_SCORE = result (0 if given up).
host_run:
        jsr plain_screen
        lda #0
        sta $d015
        sta COLOR
        jsr cls
        ldx #SONG_MINIGAME
        jsr play_song
        lda #7
        sta COLOR
        ldx HOST_G
        lda game_name_lo,x
        pha
        lda game_name_hi,x
        tax
        pla
        ldy #10
        jsr print_center
        ldx HOST_G              ; already in memory?
        lda game_t,x
        cmp LOADED
        bne @load
        lda game_s,x
        cmp LOADED+1
        beq @ready
@load:  lda #3
        sta COLOR
        ldy #13
        lda #<s_loading
        ldx #>s_loading
        jsr print_center
        jsr set_loadbuf
        ldx HOST_G
        lda game_t,x
        sta LOADED
        lda game_s,x
        sta LOADED+1
        tax
        lda LOADED
        jsr fl_load
        bcc :+
        jmp disk_error
:       lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<OVERLAY
        sta DST
        lda #>OVERLAY
        sta DST+1
        jsr lz_unpack
@ready: lda #<textbuf           ; ready page: name, help, coffee
        ldx #>textbuf
        jsr sb_start
        ldx HOST_G
        lda game_name_lo,x
        pha
        lda game_name_hi,x
        tax
        pla
        jsr sb_str
        jsr sb_end
        lda #<textbuf
        ldx #>textbuf
        jsr ui_open
        ldx HOST_G
        lda game_help_lo,x
        pha
        lda game_help_hi,x
        tax
        pla
        jsr far_text
        jsr ui_gap
        lda HOST_REVIEW
        bne @nocost
        lda #15
        sta COLOR
        jsr sb_line
        lda HOST_COST
        bne :+
        lda #<s_freecheckin
        ldx #>s_freecheckin
        jsr sb_str
        jmp :++
:       lda #<s_costs
        ldx #>s_costs
        jsr sb_str
        lda HOST_COST
        jsr sb_num
        lda #<s_coffee
        ldx #>s_coffee
        jsr sb_str
:       jsr sb_end
        jsr ui_line
@nocost:
        lda #<s_startgame
        ldx #>s_startgame
        ldy #0
        jsr ui_btn
.ifndef AUTOPLAY
        jsr ui_run
.endif
        lda HOST_REVIEW         ; coffee: the review's was taken at the card
        bne :+
        lda HOST_COST
        jsr spend_coffee
:       jsr countdown
        lda #0
        sta COLOR
        jsr cls
        lda #0
        sta $c6
        lda MG_DIFF
        ldx #0                  ; department: lobby (floors 1-5)
        jsr MG_INIT
@frame: jsr wait_frame
        jsr read_input
.ifdef AUTOPLAY
        lda #0                  ; test builds: the overlay's bot plays, not the scripted joystick
        sta JOYP
.endif
        jsr getkey
        cmp #3                  ; RUN/STOP: pause
        bne :+
        jsr pause_game
        bcs @gaveup
:       jsr MG_FRAME
        bcc @frame
        jmp @end
@gaveup:
        lda #0
        sta MG_SCORE
@end:   lda #0                  ; sprites and border as the overlay may have left them
        sta $d015
        sta $d017
        sta $d01d
        sta $d01b
        sta $d020
        lda #$ff                ; (the floor's people are multicolour)
        sta $d01c
        ldx #SONG_FLOOR
        jmp play_song

; 3, 2, 1, GO!
countdown:
        lda #0
        sta COLOR
        jsr cls
        ldx #3
@n:     stx T3
        lda #12
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #14
        ldy #12
        jsr fill
        lda #7
        sta COLOR
        ldx T3
        beq @go
        txa
        ora #'0'
        ldx #19
        ldy #12
        jsr putc
        lda #SFX_BLIP
        jsr sfx
        jmp @wait
@go:    lda #5
        sta COLOR
        lda #<s_go
        ldx #>s_go
        ldy #12
        jsr print_center
        lda #SFX_GOOD
        jsr sfx
@wait:  ldx #30
:       jsr wait_frame
        dex
        bne :-
        ldx T3
        dex
        bpl @n
        rts

; RUN/STOP during a game: "Give up? Coffee is not refunded." C=1 to give up. The game's screen comes back.
pause_game:
        lda $d015
        pha
        lda #0
        sta $d015
        ldx #0                  ; keep the screen and colours in the load buffer
:       lda SCREEN,x
        sta LOADBUF,x
        lda SCREEN+$100,x
        sta LOADBUF+$100,x
        lda SCREEN+$200,x
        sta LOADBUF+$200,x
        lda SCREEN+$300,x
        sta LOADBUF+$300,x
        lda COLRAM,x
        sta LOADBUF+$400,x
        lda COLRAM+$100,x
        sta LOADBUF+$500,x
        lda COLRAM+$200,x
        sta LOADBUF+$600,x
        lda COLRAM+$300,x
        sta LOADBUF+$700,x
        inx
        bne :-
        lda #<s_paused
        ldx #>s_paused
        jsr ui_open
        lda #<s_giveup_q
        ldx #>s_giveup_q
        jsr ui_text
        lda #<s_keepgoing
        ldx #>s_keepgoing
        ldy #0
        jsr ui_btn
        lda #<s_giveup
        ldx #>s_giveup
        ldy #0
        jsr ui_btn
        jsr ui_run
        sta T3
        ldx #0
:       lda LOADBUF,x
        sta SCREEN,x
        lda LOADBUF+$100,x
        sta SCREEN+$100,x
        lda LOADBUF+$200,x
        sta SCREEN+$200,x
        lda LOADBUF+$300,x
        sta SCREEN+$300,x
        lda LOADBUF+$400,x
        sta COLRAM,x
        lda LOADBUF+$500,x
        sta COLRAM+$100,x
        lda LOADBUF+$600,x
        sta COLRAM+$200,x
        lda LOADBUF+$700,x
        sta COLRAM+$300,x
        inx
        bne :-
        pla
        sta $d015
        lda #0
        sta $c6
        lda T3
        cmp #1
        beq :+
        clc
        rts
:       sec
        rts

; MG_SCORE -> A = stars (<0.35 0, <0.6 1, <0.85 2, else 3).
score_stars:
        lda MG_SCORE
        ldx #0
        cmp #89
        bcc :+
        inx
        cmp #153
        bcc :+
        inx
        cmp #217
        bcc :+
        inx
:       txa
        rts

; A = MG_SCORE as a percentage (score × 100 / 255, rounded).
score_pct:
        lda MG_SCORE
        sta NUM
        lda #0
        sta NUM+1
        ldx #100                ; NUM = score × 100 + 127
        lda #127
        sta T0
        lda #0
        sta T1
:       lda T0
        clc
        adc NUM
        sta T0
        lda T1
        adc #0
        sta T1
        dex
        bne :-
        ldx #0                  ; / 255
:       lda T0
        sec
        sbc #255
        tay
        lda T1
        sbc #0
        bcc :+
        sta T1
        sty T0
        inx
        bne :-
:       txa
        rts

; ---- result pages ---------------------------------------------------------------------------------------------
result_page:
        ldx HOST_STARS
        lda rtitle_lo,x
        pha
        lda rtitle_hi,x
        tax
        pla
        jsr ui_open
        ldx HOST_G              ; game name
        lda game_name_lo,x
        pha
        lda game_name_hi,x
        tax
        pla
        ldy #3
        lda #3
        sta COLOR
        ldx HOST_G
        lda game_name_lo,x
        pha
        lda game_name_hi,x
        tax
        pla
        jsr print_center
        ldx #0                  ; three stars
@st:    stx T2
        lda #7
        sta COLOR
        lda #CH_STAR
        cpx HOST_STARS
        bcc :+
        lda #11
        sta COLOR
        lda #CH_STAROFF
:       pha
        txa
        asl
        clc
        adc #17
        tax
        ldy #5
        pla
        jsr putc
        ldx T2
        inx
        cpx #3
        bne @st
        lda #7
        sta UI_ROW
        lda #1
        sta COLOR
        jsr sb_line             ; score %
        jsr score_pct
        jsr sb_num
        lda #'%'
        jsr sb_char
        jsr sb_end
        lda #<s_score
        ldx #>s_score
        jsr ui_kv
        jsr sb_line
        lda #'+'
        jsr sb_char
        jsr sb_rsp
        jsr sb_end
        lda #<s_paperclips
        ldx #>s_paperclips
        jsr ui_kv
        jsr sb_line
        lda #'+'
        jsr sb_char
        jsr sb_rxp
        jsr sb_end
        lda #<s_experience
        ldx #>s_experience
        jsr ui_kv
        jsr sb_line
        lda #'+'
        jsr sb_char
        lda HOST_STARS
        jsr sb_num
        jsr sb_end
        lda #<s_kpistars
        ldx #>s_kpistars
        jsr ui_kv
        lda HOST_SO
        beq :+
        jsr sb_line
        lda #'+'
        jsr sb_char
        lda HOST_SO
        jsr sb_num
        jsr sb_end
        lda #<s_stockoptions
        ldx #>s_stockoptions
        jsr ui_kv
:       jsr ui_gap
        lda LEVELUPS
        beq :+
        lda #7
        sta COLOR
        jsr sb_line
        lda #<s_levelup
        ldx #>s_levelup
        jsr sb_str
        lda st_level
        jsr sb_num
        jsr sb_end
        jsr ui_line
:       lda HOST_BEST
        beq :+
        lda #5
        sta COLOR
        lda #<s_newbest
        ldx #>s_newbest
        jsr ui_str
:       jsr ui_gap
        jsr kpi_bar
        ; the next step
        lda st_floor
        cmp st_max
        bne @btn
        jsr promo_status
        lda PROMO
        and #PROMO_STARS
        beq @btn
        lda #5
        sta COLOR
        lda PROMO
        and #PROMO_REVIEW
        bne :+
        lda #<s_quotahr
        ldx #>s_quotahr
        jsr ui_str
        jmp @btn
:       lda #<s_quotalift
        ldx #>s_quotalift
        jsr ui_str
@btn:   lda #<s_continue
        ldx #>s_continue
        ldy #0
        jsr ui_btn
.ifdef AUTOPLAY
        ldx #250
:       jsr wait_frame
        dex
        bne :-
        rts
.else
        jmp ui_run
.endif

; "KPI 5/8" with a bar of 20 cells on UI_ROW.
kpi_bar:
        jsr sb_line
        lda #<s_kpi
        ldx #>s_kpi
        jsr sb_str
        ldx st_floor
        lda st_stars-1,x
        jsr sb_num
        lda #'/'
        jsr sb_char
        lda st_floor
        jsr quota
        sta T3
        jsr sb_num
        jsr sb_end
        lda #1
        sta COLOR
        lda #<linebuf
        sta PTR
        lda #>linebuf
        sta PTR+1
        ldx #UI_LEFT
        ldy UI_ROW
        jsr print
        ldx st_floor            ; cells = min(20, stars × 20 / quota)
        lda st_stars-1,x
        sta T0
        lda #0
        sta T1
        ldx #20
:       lda T1
        clc
        adc T0
        sta T1
        dex
        bne :-                  ; T1 = stars × 20 (stars < 13)
        ldx #0
        lda T1
:       cmp T3
        bcc :+
        sbc T3
        inx
        cpx #20
        bne :-
:       stx T2
        ldx #0
@c:     stx T1
        lda #5
        ldy #CH_BLOCK
        cpx T2
        bcc :+
        lda #11
        ldy #CH_CHECKER
:       sta COLOR
        tya
        pha
        txa
        clc
        adc #16
        tax
        ldy UI_ROW
        pla
        jsr putc
        ldx T1
        inx
        cpx #20
        bne @c
        inc UI_ROW
        rts

review_result:
        lda MG_SCORE
        cmp #REVIEW_PASS
        bcc @fail
        lda #<s_revpassed
        ldx #>s_revpassed
        jsr ui_open
        lda #5
        sta COLOR
        lda #<s_approved
        ldx #>s_approved
        ldy #5
        jsr print_center
        lda #7
        sta UI_ROW
        lda #<s_approvedline
        ldx #>s_approvedline
        jsr hr_line
        jmp @score
@fail:  lda #<s_revfailed
        ldx #>s_revfailed
        jsr ui_open
        lda #2
        sta COLOR
        lda #<s_needsimpr
        ldx #>s_needsimpr
        ldy #5
        jsr print_center
        lda #7
        sta UI_ROW
        lda #<s_revisit
        ldx #>s_revisit
        jsr hr_line
        lda #1
        sta COLOR
        jsr sb_line
        lda #<s_retryin2
        ldx #>s_retryin2
        jsr sb_str
        lda #0
        jsr cooldown_secs
        jsr sb_mmss
        lda #'.'
        jsr sb_char
        jsr sb_end
        jsr ui_line
        lda #15
        sta COLOR
        lda #<s_soskip
        ldx #>s_soskip
        jsr ui_str
@score: jsr ui_gap
        lda #1
        sta COLOR
        jsr sb_line
        jsr score_pct
        jsr sb_num
        lda #<s_pctneed
        ldx #>s_pctneed
        jsr sb_str
        jsr sb_end
        lda #<s_score
        ldx #>s_score
        jsr ui_kv
        lda #<s_continue
        ldx #>s_continue
        ldy #0
        jsr ui_btn
.ifdef AUTOPLAY
        ldx #250
:       jsr wait_frame
        dex
        bne :-
        rts
.else
        jmp ui_run
.endif
