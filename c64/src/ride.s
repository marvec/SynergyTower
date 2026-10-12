; ---- elevator: ride, promotion, warp (src/scenes/elevatorRide.js, src/core/state.js promote / warpToFloor) ------

; Promotion from st_max (checked by the panel): fee, next floor, signing bonus, coffee top-up.
do_promotion:
        ldx st_max
        lda st_sp
        sec
        sbc fee_lo,x
        sta st_sp
        lda st_sp+1
        sbc fee_hi,x
        sta st_sp+1
        lda st_floor
        sta RIDE_FROM
        inc st_max
        lda st_max
        sta st_floor
        sta RIDE_TO
        lda #1
        jsr add_so
        inc st_promos
        jsr coffee_max          ; the new floor raises max coffee: topped up as a gift
        cmp st_coffee
        bcc :+
        sta st_coffee
:       jsr coffee_tick
        jsr save_game
        jsr ride_anim
        lda #0
        jsr promo_card
        jmp arrive

; A = floor: ride there (an unlocked floor).
ride_to:
        ldx st_floor
        stx RIDE_FROM
        sta st_floor
        sta RIDE_TO
        jsr save_game
        jsr ride_anim
        jmp arrive

; A = floor from the terminal's "systemctl isolate": no fee, no review; a new highest floor shows the card.
warp:
        sta RIDE_TO
        ldx st_floor
        stx RIDE_FROM
        sta st_floor
        inc st_warps
        cmp st_max
        beq :+
        bcc :+
        sta st_max
        jsr save_game
        jsr ride_anim
        lda #1
        jsr promo_card
        jmp arrive
:       jsr save_game
        jsr ride_anim
; Into the floor: load it, place everyone, banner.
arrive:
        jsr load_floor
        jsr init_actors
        jsr enter_floor
        jmp arrival_banner

; "FLOOR n  NAME" / "<Dept> department" in the HUD panel.
arrival_banner:
        jsr sb_line
        lda #<s_floorcap
        ldx #>s_floorcap
        jsr sb_str
        lda st_floor
        jsr sb_num
        lda #' '
        jsr sb_char
        jsr sb_char
        ldy #0                  ; the floor name in capitals
:       lda FL_HDR + HDR_NAME,y
        beq :++
        cmp #'a'
        bcc :+
        cmp #'z' + 1
        bcs :+
        and #$df
:       jsr sb_char
        iny
        bne :--
:       lda #'.'
        jsr sb_char
        lda #' '
        jsr sb_char
        lda #<(FL_HDR + HDR_DEPT)
        ldx #>(FL_HDR + HDR_DEPT)
        jsr sb_str
        lda #<s_department
        ldx #>s_department
        jsr sb_str
        jsr sb_end
        jmp toast_line

; ---- the ride: doors close, the display counts, ding, doors open ------------------------------------------------
DOOR_L = 8                      ; door columns 8..31, rows 5..21
DOOR_W = 12                     ; each panel

ride_anim:
        jsr plain_screen
        lda #0
        sta $d015
        sta COLOR
        jsr cls
        lda #MC_A | 0           ; the car's walls (dark grey)
        lda #8
        sta COLOR
        lda #40
        sta FILL_W
        lda #25
        sta FILL_H
        lda #MC_A
        ldx #0
        ldy #0
        jsr fill
        lda #0                  ; the doorway: black inside
        sta COLOR
        lda #DOOR_W * 2
        sta FILL_W
        lda #17
        sta FILL_H
        lda #' '
        ldx #DOOR_L
        ldy #5
        jsr fill
        lda RIDE_FROM
        sta RIDE_SHOW
        jsr ride_display
        lda #0                  ; close
        sta RIDE_K
:       jsr ride_doors
        jsr wait_frame
        jsr wait_frame
        inc RIDE_K
        lda RIDE_K
        cmp #DOOR_W + 1
        bcc :-
        ; travel: min(3, 0.6 + 0.12 × floors) s, the display stepping through the floors
        lda RIDE_TO
        sec
        sbc RIDE_FROM
        bcs :+
        eor #$ff
        adc #1
:       tax
        lda #30
:       cpx #0
        beq :+
        clc
        adc #6
        dex
        bne :-
:       cmp #150
        bcc :+
        lda #150
:       sta RIDE_T
@travel:
        jsr wait_frame
        lda RIDE_T
        and #15
        bne :+
        lda RIDE_SHOW
        cmp RIDE_TO
        beq :+
        bcc @upw
        dec RIDE_SHOW
        jmp @disp
@upw:   inc RIDE_SHOW
@disp:  jsr ride_display
:       dec RIDE_T
        bne @travel
        lda RIDE_TO
        sta RIDE_SHOW
        jsr ride_display
        lda #SFX_GOOD           ; ding
        jsr sfx
        lda #DOOR_W             ; open
        sta RIDE_K
:       jsr ride_doors
        jsr wait_frame
        jsr wait_frame
        dec RIDE_K
        bpl :-
        rts

; Door panels RIDE_K columns wide from each side (mid grey), the gap black.
ride_doors:
        ldx #0
@col:   stx T2
        lda #8 | 0              ; panel: multicolour mid grey
        ldy #MC_B
        cpx RIDE_K
        bcc :+
        lda #0
        ldy #' '
:       sta COLOR
        sty T3
        lda #1
        sta FILL_W
        lda #17
        sta FILL_H
        lda T2                  ; left panel column
        clc
        adc #DOOR_L
        tax
        ldy #5
        lda T3
        jsr fill
        lda #DOOR_L + DOOR_W * 2 - 1 ; right panel column
        sec
        sbc T2
        tax
        ldy #5
        lda T3
        jsr fill
        ldx T2
        inx
        cpx #DOOR_W
        bne @col
        rts

; The floor display above the doors: arrow + number.
ride_display:
        lda #2
        sta COLOR
        lda #CH_UP
        ldy RIDE_TO
        cpy RIDE_FROM
        bcs :+
        lda #'v'
:       ldx #18
        ldy #2
        jsr putc
        lda #' '
        jsr putc_next
        lda RIDE_SHOW
        jsr print_num_next
        lda #' '
        jmp putc_next

; A = 0 promotion, 1 warp: the card for the new floor.
promo_card:
        sta RIDE_WARP
        lda #<s_promoted
        ldx #>s_promoted
        ldy RIDE_WARP
        beq :+
        lda #<s_targetreached
        ldx #>s_targetreached
:       jsr ui_open
        ldx st_floor            ; new title
        lda title_lo-1,x
        pha
        lda title_hi-1,x
        tax
        pla
        ldy #4
        lda #7
        sta COLOR
        ldx st_floor
        lda title_lo-1,x
        pha
        lda title_hi-1,x
        tax
        pla
        jsr print_center
        jsr sb_line             ; "Floor n - name - dept"
        lda #<s_floor
        ldx #>s_floor
        jsr sb_str
        lda st_floor
        jsr sb_num
        lda #<s_dash
        ldx #>s_dash
        jsr sb_str
        lda #<(FL_HDR + HDR_NAME)
        ldx #>(FL_HDR + HDR_NAME)
        ldy st_floor            ; (the floor isn't loaded yet: names from the table)
        lda fname_lo-1,y
        ldx fname_hi-1,y
        jsr sb_str
        jsr sb_end
        lda #3
        sta COLOR
        ldy #6
        jsr print_line_center
        lda #9
        sta UI_ROW
        lda #1
        sta COLOR
        jsr sb_line             ; New KPI quota
        lda #<s_newquota
        ldx #>s_newquota
        jsr sb_str
        lda st_floor
        jsr quota
        jsr sb_num
        lda #<s_starsdot
        ldx #>s_starsdot
        jsr sb_str
        jsr sb_end
        jsr ui_line
        lda #2                  ; Tasks now pay X paperclips at 2 stars
        jsr reward_calc
        jsr sb_line
        lda #<s_nowpay
        ldx #>s_nowpay
        jsr sb_str
        jsr sb_rsp
        lda #<s_at2
        ldx #>s_at2
        jsr sb_str
        jsr sb_end
        lda #<linebuf           ; (wrapped: it can be wider than the frame)
        ldx #>linebuf
        jsr ui_text
        jsr sb_line             ; Max coffee X, tasks cost 1-3
        lda #<s_maxcoffee
        ldx #>s_maxcoffee
        jsr sb_str
        jsr coffee_max
        jsr sb_num
        lda #<s_cost13
        ldx #>s_cost13
        jsr sb_str
        jsr sb_end
        jsr ui_line
        lda RIDE_WARP
        beq :+
        lda #<s_nokeycard
        ldx #>s_nokeycard
        bne :++
:       lda #<s_signing
        ldx #>s_signing
:       jsr ui_str
        jsr sb_line             ; Task cooldowns: a-b min
        lda #<s_cooldowns
        ldx #>s_cooldowns
        jsr sb_str
        lda st_perks + PERK_PLANT
        asl
        clc
        adc st_floor
        tax
        stx RIDE_K              ; (sb_num uses X)
        lda pcd_min-1,x
        jsr sb_num
        lda #'-'
        jsr sb_char
        ldx RIDE_K
        lda pcd_max-1,x
        jsr sb_num
        lda #<s_min
        ldx #>s_min
        jsr sb_str
        jsr sb_end
        jsr ui_line
        jsr ui_gap
        lda #15
        sta COLOR
        lda #<s_judging
        ldx #>s_judging
        jsr ui_text
        lda #<s_newdesk
        ldx #>s_newdesk
        ldy #0
        jsr ui_btn
        jmp ui_run
