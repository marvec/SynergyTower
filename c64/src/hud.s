; ---- HUD ------------------------------------------------------------------------------------------------
; Row 0: corp name | paperclips | KPI stars / quota | Stock Options
; Row 1: floor + title | coffee / max, "+1 m:ss" while refilling | level
; Row 2: what FIRE does here, else the keys (and "PROMOTION READY" / "SEE HR FOR REVIEW" on the top floor)

hud_clear:
        lda #HUD_ROWS
        sta FILL_H
        lda #40
        sta FILL_W
        ldx #0
        ldy #0
        lda #' '
        jmp fill

draw_hud:
        lda #0
        sta PANEL_T
        sta COLOR
        jsr hud_clear
        lda #7
        sta COLOR
        lda #<st_corp
        sta PTR
        lda #>st_corp
        sta PTR+1
        ldx #1
        ldy #0
        jsr print_max18
        jsr sb_line             ; "F1 Unpaid Intern"
        lda #'F'
        jsr sb_char
        lda st_floor
        jsr sb_num
        lda #' '
        jsr sb_char
        ldx st_max
        lda title_lo-1,x
        pha
        lda title_hi-1,x
        tax
        pla
        jsr sb_str
        jsr sb_end
        lda #3
        sta COLOR
        lda #<linebuf
        sta PTR
        lda #>linebuf
        sta PTR+1
        ldx #1
        ldy #1
        jsr print_max18
        lda #7
        sta COLOR
        lda #CH_CLIP
        ldx #20
        ldy #0
        jsr putc
        lda #CH_STAR
        ldx #27
        ldy #0
        jsr putc
        lda #5
        sta COLOR
        lda #CH_SO
        ldx #34
        ldy #0
        jsr putc
        lda #1
        sta COLOR
        lda #CH_COFFEE
        ldx #20
        ldy #1
        jsr putc
        jsr hud_values
        jsr draw_status
        lda QACT
        beq :+
        jmp quest_hud
:       rts

; PTR = string, printed at X, Y, at most 18 chars.
print_max18:
        jsr set_pos
        ldy #0
:       lda (PTR),y
        beq :+
        sta (SCR),y
        lda COLOR
        sta (CLR),y
        iny
        cpy #18
        bne :-
:       rts

; The numbers (redrawn when they change and every second for the coffee timer).
hud_values:
        lda PANEL_T
        beq :+
        rts
:       jsr sb_line             ; paperclips
        lda st_sp
        sta NUM
        lda st_sp+1
        sta NUM+1
        jsr sb_u16
        jsr sb_end
        lda #1
        sta COLOR
        lda #5
        ldx #21
        ldy #0
        jsr print_field
        jsr sb_line             ; stars / quota (green when met)
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
        ldx st_floor
        lda st_stars-1,x
        ldx #1
        cmp T3
        bcc :+
        ldx #5
:       stx COLOR
        lda #5
        ldx #28
        ldy #0
        jsr print_field
        jsr sb_line             ; Stock Options
        lda st_so
        sta NUM
        lda st_so+1
        sta NUM+1
        jsr sb_u16
        jsr sb_end
        lda #1
        sta COLOR
        lda #5
        ldx #35
        ldy #0
        jsr print_field
        lda QACT                ; row 1 belongs to the quest meanwhile
        beq :+
        rts
:       jsr sb_line             ; coffee / max
        lda st_coffee
        jsr sb_num
        lda #'/'
        jsr sb_char
        jsr coffee_max
        jsr sb_num
        jsr sb_end
        ldx #1                  ; red: can't afford any task here, yellow: not the priciest
        lda st_coffee
        cmp FL_MAXCOST
        bcs :+
        ldx #7
:       cmp FL_MINCOST
        bcs :+
        ldx #2
:       stx COLOR
        lda #5
        ldx #21
        ldy #1
        jsr print_field
        jsr sb_line             ; "+1 m:ss" while refilling
        lda st_lobby
        beq @nocup
        jsr coffee_max
        cmp st_coffee
        beq @nocup
        bcc @nocup
        lda #'+'
        jsr sb_char
        lda #'1'
        jsr sb_char
        lda #' '
        jsr sb_char
        jsr cup_left
        jsr sb_mmss
@nocup: jsr sb_end
        lda #15
        sta COLOR
        lda #7
        ldx #26
        ldy #1
        jsr print_field
        jsr sb_line             ; level
        lda #'L'
        jsr sb_char
        lda #'v'
        jsr sb_char
        lda st_level
        jsr sb_num
        jsr sb_end
        lda #3
        sta COLOR
        lda #5
        ldx #34
        ldy #1
        jmp print_field

; Row 2: what FIRE does here ("[FIRE] text  sub"), else the key hints / promotion status.
draw_status:
        lda PANEL_T
        beq :+
        rts
:       jsr sb_line
        lda NEAR
        cmp #$ff
        bne :+
        jmp status_idle
:       bpl @ia
        and #$7f                ; a whiteboard (quest)
        tax
        lda akind,x
        cmp #ACTOR_BOARD
        bne @col
        lda #<s_whiteboard
        ldx #>s_whiteboard
        jsr sb_str
        ldx NEAR
        lda abase - $80,x
        cmp #QB_SPRITE
        bne :+
        lda #<s_qtake
        ldx #>s_qtake
        bne :++
:       lda #<s_qagain
        ldx #>s_qagain
:       jsr sb_str
        jmp status_show
@col:   jsr actor_who           ; a colleague: "Talk  <name>"
        lda #<s_talk
        ldx #>s_talk
        jsr sb_str
        lda PT
        ldx PT+1
        jsr sb_str
        jmp status_show
@ia:    jsr ia_ptr
        ldy #IA_KIND
        lda (IA),y
        asl
        tax
        lda prompt_jump+1,x
        pha
        lda prompt_jump,x
        pha
        rts
status_show:
        jsr sb_end
        lda #7
        sta COLOR
        lda #<s_fire
        sta PTR
        lda #>s_fire
        sta PTR+1
        ldx #1
        ldy #2
        jsr print
        lda #1
        sta COLOR
        lda #33
        ldx #7
        ldy #2
        jmp print_field
status_idle:
        jsr promo_hint
        jsr sb_end
        lda #0                  ; clear the [FIRE] part
        sta COLOR
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #0
        ldy #2
        jsr fill
        lda STATUS_COL
        sta COLOR
        lda #40
        ldx #0
        ldy #2
        jmp print_field
prompt_jump:
        .word pr_task - 1, pr_lift - 1, pr_hr - 1, pr_term - 1, pr_coffee - 1, pr_gate - 1, pr_poster - 1

; Idle status: on the top floor reached, "PROMOTION READY" / "SEE HR FOR REVIEW", else the key hints.
promo_hint:
        lda #15
        sta STATUS_COL
        lda st_floor
        cmp st_max
        bne @keys
        jsr promo_ready
        bcc @keys
        lda PROMO
        and #PROMO_REVIEW
        beq @hr
        lda st_max              ; ready on the last floor of the disk: nothing to blink
        cmp #FLOORS_DISK
        bcs @keys
        lda #5
        sta STATUS_COL
        lda #<s_promoready
        ldx #>s_promoready
        jmp sb_str
@hr:    lda #7
        sta STATUS_COL
        lda #<s_seehr
        ldx #>s_seehr
        jmp sb_str
@keys:  lda #<s_keys
        ldx #>s_keys
        jmp sb_str

; Prompt pieces: text, two spaces, sub (in linebuf), then @show.
pr_task:
        ldy #IA_STR
        lda (IA),y
        pha
        iny
        lda (IA),y
        tax
        pla
        jsr sb_str
        jsr sb_2sp
        lda QACT                ; during a quest
        beq @nq
        lda NEAR
        cmp QSTATION
        beq :+
        lda #<s_qfinish
        ldx #>s_qfinish
        bne @qs
:       lda #<s_qtry
        ldx #>s_qtry
        ldy QPHASE
        beq @qs
        lda #<s_qlogin
        ldx #>s_qlogin
@qs:    jsr sb_str
        jmp status_show
@nq:    ldx NEAR
        jsr station_cd_ptr
        jsr time_left
        beq :+
        lda #<s_busy            ; "busy m:ss"
        ldx #>s_busy
        jsr sb_str
        jsr sb_mmss
        jmp status_show
:       jsr task_cost
        bne :+
        lda #<s_checkinfree
        ldx #>s_checkinfree
        jsr sb_str
        jmp status_show
:       pha                     ; "-N coffee"
        lda #'-'
        jsr sb_char
        pla
        jsr sb_num
        lda #<s_coffee
        ldx #>s_coffee
        jsr sb_str
        jmp status_show

pr_lift:
        lda #<s_elevator
        ldx #>s_elevator
        jsr sb_str
        jmp status_show

pr_hr:  lda #<s_hroffice
        ldx #>s_hroffice
        jsr sb_str
        jsr sb_2sp
        jsr review_state
        cmp #RS_COOLDOWN
        bne :+
        lda #<s_retry
        ldx #>s_retry
        jsr sb_str
        jsr sb_mmss
        jmp status_show
:       tax
        lda rs_sub_lo,x
        pha
        lda rs_sub_hi,x
        tax
        pla
        jsr sb_str
        jmp status_show

pr_term:
        lda #<s_workstation
        ldx #>s_workstation
        jsr sb_str
        jmp status_show

pr_coffee:
        lda #<s_coffeemachine
        ldx #>s_coffeemachine
        jsr sb_str
        jmp status_show

pr_gate:
        lda #<s_turnstiles
        ldx #>s_turnstiles
        jsr sb_str
        jsr sb_2sp
        lda st_lobby
        bne :+
        lda #<s_checkinfirst
        ldx #>s_checkinfirst
        jsr sb_str
        jmp status_show
:       lda #<s_minus1coffee
        ldx #>s_minus1coffee
        jsr sb_str
        jmp status_show

pr_poster:
        ldy #IA_ARG
        lda (IA),y
        bne :+
        lda #<s_adspace
        ldx #>s_adspace
        jsr sb_str
        jmp status_show
:       ldy #IA_STR
        lda (IA),y
        pha
        iny
        lda (IA),y
        tax
        pla
        jsr sb_str
        jsr sb_2sp
        lda #<s_advert
        ldx #>s_advert
        jsr sb_str
        jmp status_show

sb_2sp:
        lda #' '
        jsr sb_char
        jmp sb_char

; IA = station -> A = its coffee cost now (0 for the check-in while checking in). Z from A.
task_cost:
        ldy #IA_W
        lda (IA),y
        bpl :+
        lda st_lobby
        bne :+
        lda #0
        rts
:       ldy #IA_ARG
        lda (IA),y
        tax
        lda game_cost,x
        rts
