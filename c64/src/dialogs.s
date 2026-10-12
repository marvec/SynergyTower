; ---- dialogs: task card, HR desk, elevator, welcome, how to play, links -----------------------------------
; (src/scenes/overlays.js: TaskCard, ReviewCard, hrNotice, ElevatorPanel, Dialog)

; review_state results (state.reviewStatus)
RS_AVAILABLE = 0
RS_COFFEE    = 1
RS_COOLDOWN  = 2                ; T0/T1 = seconds left
RS_PASSED    = 3
RS_NOTREADY  = 4
RS_WRONGFLOOR = 5

; A = review state for st_max. RS_COOLDOWN leaves the seconds in T0/T1.
review_state:
        lda st_floor
        cmp st_max
        beq :+
        lda #RS_WRONGFLOOR
        rts
:       jsr promo_ready
        lda PROMO
        and #PROMO_REVIEW
        beq :+
        lda #RS_PASSED
        rts
:       jsr promo_ready
        bcs :+
        lda #RS_NOTREADY
        rts
:       lda #<st_revcd
        ldx #>st_revcd
        jsr floor_dl_ptr
        jsr time_left
        beq :+
        lda #RS_COOLDOWN
        rts
:       lda st_coffee
        cmp #2
        bcs :+
        lda #RS_COFFEE
        rts
:       lda #RS_AVAILABLE
        rts

; ---- task card ---------------------------------------------------------------------------------------------
; NEAR = station, IA = its entry.
task_card:
        lda NEAR
        sta CARD_I
@show:  lda CARD_I
        jsr ia_ptr
        ldy #IA_ARG
        lda (IA),y
        sta CARD_G
        ldy #IA_STR
        lda (IA),y
        pha
        iny
        lda (IA),y
        tax
        pla
        jsr ui_open
        ; game name + difficulty pips (round(d × 4) + 1)
        lda #3
        sta COLOR
        ldx CARD_G
        lda game_name_lo,x
        sta PTR
        lda game_name_hi,x
        sta PTR+1
        ldx #UI_LEFT
        ldy UI_ROW
        jsr print
        ldy #IA_ARG2
        lda (IA),y
        clc
        adc #32                 ; d × 4 rounded: (d255 + 32) / 64
        bcc :+
        lda #255
:       lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        sta T3                  ; 0..3 (+1 below)
        ldx #0
:       lda #CH_PIP
        cpx T3
        beq :+
        bcc :+
        lda #CH_PIPOFF
:       stx T2
        pha
        txa
        clc
        adc #33
        tax
        ldy UI_ROW
        lda #7
        sta COLOR
        pla
        jsr putc
        ldx T2
        inx
        cpx #5
        bne :--
        inc UI_ROW
        jsr ui_gap
        lda #1
        sta COLOR
        ldx CARD_G
        lda game_help_lo,x
        pha
        lda game_help_hi,x
        tax
        pla
        jsr far_text
        jsr ui_gap
        ; check-in desk: the receptionist's line
        lda st_lobby
        bne :+
        ldy #IA_W
        lda (IA),y
        bpl :+
        lda #7
        sta COLOR
        lda #<s_quicktest
        ldx #>s_quicktest
        jsr ui_text
:       lda #1
        sta COLOR
        ; best
        jsr sb_line
        ldx CARD_I
        jsr station_best_index
        lda st_best,y
        bpl :+
        lda #<s_notattempted
        ldx #>s_notattempted
        jsr sb_str
        jmp @best
:       jsr sb_stars
@best:  jsr sb_end
        lda #<s_best
        ldx #>s_best
        jsr ui_kv
        ; coffee
        jsr sb_line
        jsr task_cost
        bne :+
        lda #<s_free
        ldx #>s_free
        jsr sb_str
        jmp @cof
:       jsr sb_num
        lda #<s_cups
        ldx #>s_cups
        jsr sb_str
@cof:   jsr sb_end
        lda #<s_coffeecost
        ldx #>s_coffeecost
        jsr ui_kv
        ; rewards (1-3 stars)
        lda #1
        jsr reward_calc
        jsr sb_line
        jsr sb_rsp
        lda #'-'
        jsr sb_char
        lda #3
        jsr reward_calc
        jsr sb_rsp
        lda #<s_clipsword
        ldx #>s_clipsword
        jsr sb_str
        jsr sb_end
        lda #<s_rewards
        ldx #>s_rewards
        jsr ui_kv
        lda #1
        jsr reward_calc
        jsr sb_line
        jsr sb_rxp
        lda #'-'
        jsr sb_char
        lda #3
        jsr reward_calc
        jsr sb_rxp
        lda #<s_xpkpi
        ldx #>s_xpkpi
        jsr sb_str
        jsr sb_end
        lda #<s_empty
        ldx #>s_empty
        jsr ui_kv
        ; cooldown, or the check-in line
        lda st_lobby
        bne :+
        ldy #IA_W
        lda (IA),y
        bpl :+
        lda #5
        sta COLOR
        lda #<s_checkinline
        ldx #>s_checkinline
        jsr ui_str
        jmp @buttons
:       jsr sb_line
        ldx CARD_G
        lda game_tier,x
        jsr cooldown_secs
        jsr sb_mmss
        jsr sb_end
        lda #<s_cooldownafter
        ldx #>s_cooldownafter
        jsr ui_kv
@buttons:
        ldx CARD_G              ; a game not on this disk yet
        lda game_t,x
        bne :+
        lda #<s_notondisk
        ldx #>s_notondisk
        ldy #B_OFF
        jsr ui_btn
        jsr back_btn
        jsr ui_run
        jmp enter_floor
:       lda CARD_I
        jsr ia_ptr
        ldx CARD_I
        jsr station_cd_ptr
        jsr time_left
        beq @nocd
        lda #<lbuf0             ; "Busy m:ss"
        ldx #>lbuf0
        jsr sb_start
        lda #<s_busycap
        ldx #>s_busycap
        jsr sb_str
        jsr sb_mmss
        jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        ldy #B_OFF
        jsr ui_btn
        jsr skip_btn
        lda #CARD_SKIP
        bne @back
@nocd:  jsr task_cost
        sta CARD_COST
        cmp st_coffee
        beq @start
        bcc @start
        lda #<lbuf0             ; "Need N coffee"
        ldx #>lbuf0
        jsr sb_start
        lda #<s_need
        ldx #>s_need
        jsr sb_str
        lda CARD_COST
        jsr sb_num
        lda #<s_coffee
        ldx #>s_coffee
        jsr sb_str
        jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        ldy #B_OFF
        jsr ui_btn
        jsr refill_btn
        lda #CARD_REFILL
        bne @back
@start: lda #<lbuf0             ; "Start  (-N coffee)" / "Start  (free)"
        ldx #>lbuf0
        jsr sb_start
        lda #<s_start
        ldx #>s_start
        jsr sb_str
        lda CARD_COST
        bne :+
        lda #<s_freep
        ldx #>s_freep
        jsr sb_str
        jmp :++
:       lda #'-'
        jsr sb_char
        lda CARD_COST
        jsr sb_num
        lda #<s_coffeep
        ldx #>s_coffeep
        jsr sb_str
:       jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        ldy #0
        jsr ui_btn
        lda #CARD_START
@back:  sta CARD_ACT
        jsr back_btn
        jsr ui_run
        ldx CARD_ACT            ; the action button: 0 for Start, 1 for Skip / Refill
        beq :+
        ldx #1
:       stx T3
        cmp T3
        beq @act
        jmp enter_floor         ; Back / RUN-STOP
@act:   lda CARD_ACT
        cmp #CARD_START
        bne :++
        lda CARD_G              ; Lost Password: its search on the floor comes first
        cmp #G_LOSTPW
        bne :+
        lda CARD_COST
        jsr spend_coffee
        jmp quest_start
:       lda CARD_I
        jmp play_station
:       cmp #CARD_SKIP
        bne @refill
        jsr spend_skip
        ldx CARD_I
        jsr station_cd_ptr
        lda #0
        sta T0
        sta T1
        jsr set_deadline
        jsr update_markers
        jmp @show
@refill:
        jsr spend_refill
        jmp @show

CARD_START  = 0
CARD_SKIP   = 1
CARD_REFILL = 2

; "Skip  (1 Stock Option)" (disabled without one), "Refill coffee  (3 Stock Options)", "Back".
skip_btn:
        ldy #0
        lda st_so+1
        bne :+
        lda st_so
        cmp #1
        bcs :+
        ldy #B_OFF
:       lda #<s_skip
        ldx #>s_skip
        jmp ui_btn
refill_btn:
        ldy #0
        lda st_so+1
        bne :+
        lda st_so
        cmp #3
        bcs :+
        ldy #B_OFF
:       lda #<s_refill
        ldx #>s_refill
        jmp ui_btn
back_btn:
        lda #<s_back
        ldx #>s_back
        ldy #0
        jmp ui_btn

spend_skip:
        lda #1
        bne spend_so
spend_refill:
        jsr coffee_max
        sta st_coffee
        lda #3
; A = Stock Options to take.
spend_so:
        sta T3
        lda st_so
        sec
        sbc T3
        sta st_so
        bcs :+
        dec st_so+1
:       lda #SFX_GOOD
        jsr sfx
        jmp save_game

; Stars as "***" (A = 0-3) into the builder.
sb_stars:
        sta T3
        ldx #0
:       cpx T3
        beq :+
        lda #CH_STAR
        jsr sb_char
        inx
        bne :-
:       cpx #3
        beq :+
        lda #CH_STAROFF
        jsr sb_char
        inx
        bne :-
:       rts

sb_rsp: lda RSP
        sta NUM
        lda RSP+1
        sta NUM+1
        jmp sb_u16
sb_rxp: lda RXP
        sta NUM
        lda RXP+1
        sta NUM+1
        jmp sb_u16

; ---- HR desk -----------------------------------------------------------------------------------------------
hr_desk:
        jsr review_state
        cmp #RS_PASSED
        bcc review_card
        jmp hr_notice
review_card:
        lda #<s_reviewtitle
        ldx #>s_reviewtitle
        jsr ui_open
        lda #<s_haveaseat       ; the HR rep
        ldx #>s_haveaseat
        jsr hr_line
        jsr sb_line             ; "Promotion to floor N+1: <title>"
        lda #<s_promoto
        ldx #>s_promoto
        jsr sb_str
        ldx st_max
        inx
        txa
        jsr sb_num
        lda #':'
        jsr sb_char
        lda #' '
        jsr sb_char
        ldx st_max
        lda title_lo,x
        pha
        lda title_hi,x
        tax
        pla
        jsr sb_str
        jsr sb_end
        lda #7
        sta COLOR
        jsr ui_line
        jsr ui_gap
        lda #1
        sta COLOR
        lda #<f_reviewblurb
        ldx #>f_reviewblurb
        jsr far_text
        jsr ui_gap
        jsr sb_line             ; "Pass mark: 60%, retry wait if you fail: m:ss"
        lda #<s_passmark
        ldx #>s_passmark
        jsr sb_str
        lda #0
        jsr cooldown_secs       ; tier 0 = the review
        jsr sb_mmss
        jsr sb_end
        lda #15
        sta COLOR
        jsr ui_line
        lda #<s_onequestion
        ldx #>s_onequestion
        jsr ui_str
        jsr review_state
        sta CARD_ACT
        cmp #RS_COOLDOWN
        bne :+
        lda #<lbuf0             ; "Retry in m:ss"
        ldx #>lbuf0
        jsr sb_start
        lda #<s_retryin
        ldx #>s_retryin
        jsr sb_str
        jsr sb_mmss
        jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        ldy #B_OFF
        jsr ui_btn
        jsr skip_btn
        jmp @run
:       cmp #RS_COFFEE
        bne :+
        lda #<s_need2
        ldx #>s_need2
        ldy #B_OFF
        jsr ui_btn
        jsr refill_btn
        jmp @run
:       lda #<s_startreview
        ldx #>s_startreview
        ldy #0
        jsr ui_btn
@run:   jsr back_btn
        jsr ui_run
        ldx CARD_ACT
        bne :+
        cmp #0                  ; available: Start, Back
        beq @first
        jmp enter_floor
:       cmp #1                  ; cooldown / coffee: (disabled), Skip / Refill, Back
        beq @second
        jmp enter_floor
@first: lda #2
        jsr spend_coffee
        jmp play_review
@second:
        cpx #RS_COOLDOWN
        bne :+
        jsr spend_skip
        lda #<st_revcd
        ldx #>st_revcd
        jsr floor_dl_ptr
        lda #0
        sta T0
        sta T1
        jsr set_deadline
        jmp review_card
:       jsr spend_refill
        jmp review_card

; A/X = what the HR rep says, as a quote line with their name.
hr_line:
        sta TMPW
        stx TMPW+1
        lda #4
        sta COLOR
        lda TMPW
        ldx TMPW+1
        jsr ui_text
        jmp ui_gap

hr_notice:
        sta CARD_ACT
        lda #<s_hroffice2
        ldx #>s_hroffice2
        jsr ui_open
        lda CARD_ACT
        cmp #RS_PASSED
        bne :+
        lda #<s_congrats
        ldx #>s_congrats
        jsr hr_line
        lda #1
        sta COLOR
        lda #<s_aced
        ldx #>s_aced
        jsr ui_text
        jmp @ok
:       cmp #RS_WRONGFLOOR
        bne :+
        lda #1
        sta COLOR
        jsr sb_line
        lda #<s_wrongfloor
        ldx #>s_wrongfloor
        jsr sb_str
        lda st_max
        jsr sb_num
        lda #<s_wrongfloor2
        ldx #>s_wrongfloor2
        jsr sb_str
        jsr sb_end
        lda #<linebuf
        ldx #>linebuf
        jsr ui_text
        jmp @ok
:       lda #<s_appointment     ; not promotion-ready: what's missing
        ldx #>s_appointment
        jsr hr_line
        lda #1
        sta COLOR
        lda #<s_byappt
        ldx #>s_byappt
        jsr ui_text
        jsr promo_status
        lda PROMO
        and #PROMO_STARS
        bne :+
        jsr sb_line
        lda #<s_mstars
        ldx #>s_mstars
        jsr sb_str
        ldx st_max
        lda st_stars-1,x
        jsr sb_num
        lda #'/'
        jsr sb_char
        lda st_max
        jsr quota
        jsr sb_num
        jsr sb_end
        jsr ui_line
:       lda PROMO
        and #PROMO_LEVEL
        bne :+
        jsr sb_line
        lda #<s_mlevel
        ldx #>s_mlevel
        jsr sb_str
        lda st_level
        jsr sb_num
        lda #'/'
        jsr sb_char
        ldx st_max
        inx
        txa
        jsr sb_num
        jsr sb_end
        jsr ui_line
:       lda PROMO
        and #PROMO_SP
        bne @ok
        jsr sb_line
        lda #<s_mfee
        ldx #>s_mfee
        jsr sb_str
        lda st_sp
        sta NUM
        lda st_sp+1
        sta NUM+1
        jsr sb_u16
        lda #'/'
        jsr sb_char
        ldx st_max
        lda fee_lo,x
        sta NUM
        lda fee_hi,x
        sta NUM+1
        jsr sb_u16
        lda #<s_mfee2
        ldx #>s_mfee2
        jsr sb_str
        jsr sb_end
        jsr ui_line
@ok:    lda #<s_understood
        ldx #>s_understood
        ldy #0
        jsr ui_btn
        jsr ui_run
        jmp enter_floor

; ---- elevator ----------------------------------------------------------------------------------------------
elevator_panel:
        lda #<s_elevator
        ldx #>s_elevator
        jsr ui_open
        lda st_max
        cmp #FLOORS_DISK
        bcc :+
        lda #7                  ; the last floor on this disk
        sta COLOR
        lda #<s_diskend
        ldx #>s_diskend
        jsr ui_text
        lda #3
        sta COLOR
        lda #<s_url_site
        ldx #>s_url_site
        jsr ui_text
        jmp @floors
:       jsr sb_line             ; "Next: F2 Mailroom - Paid Intern"
        lda #<s_next
        ldx #>s_next
        jsr sb_str
        ldx st_max
        inx
        txa
        jsr sb_num
        lda #' '
        jsr sb_char
        ldx st_max
        lda fname_lo,x
        pha
        lda fname_hi,x
        tax
        pla
        jsr sb_str
        lda #<s_dash
        ldx #>s_dash
        jsr sb_str
        ldx st_max
        lda title_lo,x
        pha
        lda title_hi,x
        tax
        pla
        jsr sb_str
        jsr sb_end
        lda #7
        sta COLOR
        jsr ui_line
        jsr ui_gap
        jsr promo_checklist
        lda st_floor
        cmp st_max
        beq :+
        lda #15
        sta COLOR
        jsr sb_line
        lda #<s_promohighest
        ldx #>s_promohighest
        jsr sb_str
        lda st_max
        jsr sb_num
        lda #<s_promohighest2
        ldx #>s_promohighest2
        jsr sb_str
        jsr sb_end
        lda #<linebuf
        ldx #>linebuf
        jsr ui_text
:       ; the promotion button
        jsr promo_status
        lda #<lbuf0
        ldx #>lbuf0
        jsr sb_start
        ldy #B_OFF
        lda PROMO
        cmp #PROMO_STARS | PROMO_LEVEL | PROMO_SP | PROMO_REVIEW
        bne @locked
        lda st_floor
        cmp st_max
        bne @locked
        lda #<s_getpromoted
        ldx #>s_getpromoted
        jsr sb_str
        ldx st_max
        inx
        txa
        jsr sb_num
        lda #'!'
        jsr sb_char
        ldy #0
        beq @pb
@locked:
        and #PROMO_STARS | PROMO_LEVEL | PROMO_SP
        cmp #PROMO_STARS | PROMO_LEVEL | PROMO_SP
        bne :+
        lda #<s_passfirst
        ldx #>s_passfirst
        jsr sb_str
        ldy #B_OFF
        bne @pb
:       lda #<s_promolocked
        ldx #>s_promolocked
        jsr sb_str
        ldx st_max
        inx
        txa
        jsr sb_num
        lda #<s_locked
        ldx #>s_locked
        jsr sb_str
        ldy #B_OFF
@pb:    sty T3
        jsr sb_end
        lda #<lbuf0
        ldx #>lbuf0
        ldy T3
        jsr ui_btn
        lda #1
        bne :+
@floors:
        lda #0
:       sta LIFT_PB             ; 1 if button 0 is the promotion
        ; ride to the other unlocked floors on this disk
        lda #1
        sta LIFT_F
@fl:    lda LIFT_F
        cmp st_max
        beq :+
        bcs @fdone
:       jsr lift_label          ; "Ride to floor N ..." / "Floor N (you are here)"
        inc LIFT_F
        lda LIFT_F
        cmp #FLOORS_DISK + 1
        bcc @fl
@fdone: jsr back_btn
        jsr ui_run
        cmp #$ff
        bne :+
        jmp enter_floor
:       ldx LIFT_PB
        beq @ride
        cmp #0
        bne :+
        jmp do_promotion
:       sec
        sbc #1
@ride:  clc                     ; button k = floor k + 1 (after the promotion button, if any)
        adc #1
        cmp st_max
        beq :+
        bcc :+
        jmp enter_floor         ; Back
:       cmp st_floor
        bne :+
        jmp enter_floor
:       jmp ride_to

; LIFT_F = floor: add its ride button (label built in its own buffer).
lift_label:
        lda LIFT_F
        sec
        sbc #1
        asl
        asl
        asl
        asl
        asl                     ; × 32
        clc
        adc #<lbuf1
        sta T2
        lda #>lbuf1
        adc #0
        tax
        lda T2
        stx T3
        jsr sb_start
        lda LIFT_F
        cmp st_floor
        bne :+
        lda #<s_floor
        ldx #>s_floor
        jsr sb_str
        lda LIFT_F
        jsr sb_num
        lda #<s_youarehere
        ldx #>s_youarehere
        jsr sb_str
        jsr sb_end
        ldy #B_OFF
        bne :++
:       lda #<s_rideto
        ldx #>s_rideto
        jsr sb_str
        lda LIFT_F
        jsr sb_num
        ldx LIFT_F
        lda #' '
        jsr sb_char
        ldx LIFT_F
        lda fname_lo-1,x
        pha
        lda fname_hi-1,x
        tax
        pla
        jsr sb_str
        jsr sb_end
        ldy #0
:       lda T2
        ldx T3
        jmp ui_btn

; The four promotion checks with a tick or a lock.
promo_checklist:
        jsr promo_status
        jsr sb_line             ; KPI stars x/y
        ldx st_max
        lda st_stars-1,x
        jsr sb_num
        lda #'/'
        jsr sb_char
        lda st_max
        jsr quota
        jsr sb_num
        jsr sb_end
        lda #PROMO_STARS
        ldx #<s_ckstars
        ldy #>s_ckstars
        jsr check_row
        jsr sb_line             ; Seniority level Lv x / y
        lda #'L'
        jsr sb_char
        lda #'v'
        jsr sb_char
        lda st_level
        jsr sb_num
        lda #'/'
        jsr sb_char
        ldx st_max
        inx
        txa
        jsr sb_num
        jsr sb_end
        lda #PROMO_LEVEL
        ldx #<s_cklevel
        ldy #>s_cklevel
        jsr check_row
        jsr sb_line             ; Keycard fee
        ldx st_max
        lda fee_lo,x
        sta NUM
        lda fee_hi,x
        sta NUM+1
        jsr sb_u16
        lda #<s_clipsword
        ldx #>s_clipsword
        jsr sb_str
        jsr sb_end
        lda #PROMO_SP
        ldx #<s_ckfee
        ldy #>s_ckfee
        jsr check_row
        jsr sb_line             ; review
        lda PROMO
        and #PROMO_REVIEW
        beq :+
        lda #<s_passedcap
        ldx #>s_passedcap
        bne :++
:       lda #<s_pending
        ldx #>s_pending
:       jsr sb_str
        jsr sb_end
        lda #PROMO_REVIEW
        ldx #<s_ckreview
        ldy #>s_ckreview
; A = PROMO bit, X/Y = label: tick or lock, label, value (linebuf).
check_row:
        stx TMPW
        sty TMPW+1
        and PROMO
        beq :+
        lda #5
        sta COLOR
        lda #CH_CHECK
        bne :++
:       lda #2
        sta COLOR
        lda #CH_LOCK
:       ldx #UI_LEFT
        ldy UI_ROW
        jsr putc
        lda #1
        sta COLOR
        lda TMPW
        sta PTR
        lda TMPW+1
        sta PTR+1
        ldx #UI_LEFT + 2
        ldy UI_ROW
        jsr print
        lda #<s_empty
        ldx #>s_empty
        jmp ui_kv               ; (prints the value right-aligned; the empty label keeps the text)

; ---- welcome, how to play, links ---------------------------------------------------------------------------
welcome:
        jsr sb_line             ; "Welcome to <corp>!"
        lda #<s_welcometo
        ldx #>s_welcometo
        jsr sb_str
        lda #<st_corp
        ldx #>st_corp
        jsr sb_str
        lda #'!'
        jsr sb_char
        jsr sb_end
        lda #<linebuf
        ldx #>linebuf
        jsr ui_open
        lda #<textbuf           ; "Congratulations, <name>! You are our newest Unpaid Intern."
        ldx #>textbuf
        jsr sb_start
        lda #<s_congrats2
        ldx #>s_congrats2
        jsr sb_str
        lda #<st_name
        ldx #>st_name
        jsr sb_str
        lda #<s_newest
        ldx #>s_newest
        jsr sb_str
        ldx #1
        lda title_lo-1,x
        pha
        lda title_hi-1,x
        tax
        pla
        jsr sb_str
        lda #'.'
        jsr sb_char
        jsr sb_end
        lda #<textbuf
        ldx #>textbuf
        jsr ui_text
        jsr ui_gap
        lda #<f_welcome
        ldx #>f_welcome
        jsr far_text
        lda st_lobby
        bne :+
        jsr ui_gap
        lda #7
        sta COLOR
        lda #<s_firststop
        ldx #>s_firststop
        jsr ui_text
:       lda #<s_synergize
        ldx #>s_synergize
        ldy #0
        jsr ui_btn
        jmp ui_run

how_to:
        lda #<s_howto
        ldx #>s_howto
        jsr ui_open
        lda #<f_howto
        ldx #>f_howto
        jsr far_text
        lda #<s_ok
        ldx #>s_ok
        ldy #0
        jsr ui_btn
        jmp ui_run

; A link page: A/X = title, PT = intro text (far), TMPW = URL (main).
link_page:
        jsr ui_open
        lda PT
        ldx PT+1
        jsr far_text
        jsr ui_gap
        lda #3
        sta COLOR
        lda TMPW
        ldx TMPW+1
        jsr ui_text
        lda #1
        sta COLOR
        rts

feedback_page:
        lda #<f_feedback
        sta PT
        lda #>f_feedback
        sta PT+1
        lda #<s_url_feedback
        sta TMPW
        lda #>s_url_feedback
        sta TMPW+1
        lda #<s_sendfeedback
        ldx #>s_sendfeedback
        jsr link_page
        jsr ui_gap
        lda #15                 ; context, as the browser form sends it
        sta COLOR
        lda #<textbuf
        ldx #>textbuf
        jsr sb_start
        lda #<s_context
        ldx #>s_context
        jsr sb_str
        lda st_floor
        jsr sb_num
        lda #<s_ctxlevel
        ldx #>s_ctxlevel
        jsr sb_str
        lda st_level
        jsr sb_num
        lda #','
        jsr sb_char
        lda #' '
        jsr sb_char
        lda #<st_name
        ldx #>st_name
        jsr sb_str
        lda #<s_at
        ldx #>s_at
        jsr sb_str
        lda #<st_corp
        ldx #>st_corp
        jsr sb_str
        jsr sb_end
        lda #<textbuf
        ldx #>textbuf
        jsr ui_text
        jmp ok_run

tip_page:
        lda #<f_tip
        sta PT
        lda #>f_tip
        sta PT+1
        lda #<s_url_coffee
        sta TMPW
        lda #>s_url_coffee
        sta TMPW+1
        lda #<s_buycoffee
        ldx #>s_buycoffee
        jsr link_page
ok_run: lda #<s_ok
        ldx #>s_ok
        ldy #0
        jsr ui_btn
        jmp ui_run
