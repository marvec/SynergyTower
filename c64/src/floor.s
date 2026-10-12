; ---- the floor: loading, markers, interaction --------------------------------------------------------------

; Load floor st_floor (floorNN file) to $8000 and apply the saved state: turnstile gate, task markers.
load_floor:
        jsr set_loadbuf
        ldx st_floor
        lda floor_t-1,x
        pha
        lda floor_s-1,x
        tax
        pla
        jsr fl_load
        bcc :+
        jmp disk_error
:       lda #<LOADBUF
        sta SRC
        lda #>LOADBUF
        sta SRC+1
        lda #<FL_MAP
        sta DST
        lda #>FL_MAP
        sta DST+1
        jsr lz_unpack
        lda st_lobby
        cmp #LOBBY_DONE
        bne :+
        jsr open_gate
:       jsr update_markers
        rts

; Where the player starts: by the front door while the lobby check-in isn't done, else at the elevator.
place_player:
        ldy #HDR_SPAWN
        lda FL_HDR + HDR_FLOORNO
        cmp #1
        bne :+
        lda st_lobby
        cmp #LOBBY_DONE
        beq :+
        ldy #HDR_ENTRY
:       lda FL_HDR,y
        sta ax_lo
        lda FL_HDR+1,y
        sta ax_hi
        lda FL_HDR+2,y
        sta ay
        lda #0                  ; facing down at the elevator, up at the door
        cpy #HDR_ENTRY
        bne :+
        lda #1
:       sta adir
        rts

; ---- interactables -------------------------------------------------------------------------------------
; Point IA at interactable A.
ia_ptr:
        sta T0
        asl
        adc T0                  ; × 3
        asl
        asl                     ; × 12
        clc
        adc #<(FL_HDR + HDR_IA)
        sta IA
        lda #>(FL_HDR + HDR_IA)
        adc #0
        sta IA+1
        rts

; The turnstile's open gate: its cells become walkable and show the open art (after the check-in is paid).
open_gate:
        ldx #0
@find:  cpx FL_HDR + HDR_IACTS
        bcs @done
        txa
        pha
        jsr ia_ptr
        pla
        tax
        ldy #IA_KIND
        lda (IA),y
        cmp #KIND_TURNSTILE
        beq @gate
        inx
        bne @find
@done:  rts
@gate:  ldy #IA_STR             ; open chars: the row above (top), then the gate row
        lda (IA),y
        sta SRC
        iny
        lda (IA),y
        sta SRC+1
        ldy #IA_Y
        lda (IA),y
        sta T3                  ; gate row
        tax
        dex
        stx T2                  ; row above
        ldy #IA_W
        lda (IA),y
        and #$7f
        sta T1
        lda #0
        sta T0                  ; index into the open chars
        lda T2
        jsr @row
        lda T3
        jsr @row
        ; the gate row is walkable now
        ldy T3
        lda irow_lo,y
        sta PT
        lda irow_hi,y
        sta PT+1
        ldy #IA_ARG2            ; walkable lanes (bit k = cell k); the posts between them stay solid
        lda (IA),y
        sta T2
        ldy #IA_X
        lda (IA),y
        tay
        ldx T1
:       lda #0
        lsr T2
        bcc :+
        lda #1
:       sta (PT),y
        iny
        dex
        bne :--
        lda #1
        sta REDRAW
        rts
@row:   tay                     ; A = map row: copy T1 chars from SRC+T0 to the map at IA_X
        lda mrow_lo,y
        sta PT
        lda mrow_hi,y
        sta PT+1
        ldy #IA_X
        lda (IA),y
        clc
        adc PT
        sta PT
        bcc :+
        inc PT+1
:       ldx #0
:       stx TMP
        ldy T0
        lda (SRC),y
        ldy TMP
        sta (PT),y
        inc T0
        ldx TMP
        inx
        cpx T1
        bne :-
        rts

; Markers above interactables, from the state: "!" ready task, clock busy task, HR badge / clock / check,
; elevator arrow when promotion is possible, coffee cup when the machine is ready, ">" at the workstation.
update_markers:
        ldx #0
@ia:    cpx FL_HDR + HDR_IACTS
        bcc :+
        rts
:       stx MK_I
        txa
        jsr ia_ptr
        ldy #IA_MARK+1
        lda (IA),y
        cmp #$ff
        bne :+
        jmp @next               ; no marker cell
:       ldy #IA_UC              ; default: what's under the marker
        lda (IA),y
        sta MK_C
        iny
        lda (IA),y
        sta MK_COL
        ldy #IA_KIND
        lda (IA),y
        bne @notask
        ldx MK_I                ; station: busy or ready
        jsr station_cd_ptr
        jsr time_left
        beq :+
        lda #CH_CLOCK
        ldx #3
        bne @set
:       lda #CH_MARKER
        ldx #7
        bne @set
@notask:
        cmp #KIND_ELEVATOR
        bne @nolift
        jsr promo_status
        lda PROMO
        cmp #PROMO_STARS | PROMO_LEVEL | PROMO_SP | PROMO_REVIEW
        bne @put
        lda st_floor
        cmp st_max
        bne @put
        cmp #FLOORS_DISK
        bcs @put                ; no floor above on this disk
        lda #CH_UP
        ldx #5
        bne @set
@nolift:
        cmp #KIND_HR
        bne @nohr
        jsr review_state
        cmp #RS_PASSED
        bne :+
        lda #CH_CHECK
        ldx #5
        bne @set
:       cmp #RS_COOLDOWN
        bne :+
        lda #CH_CLOCK
        ldx #3
        bne @set
:       cmp #RS_AVAILABLE
        beq :+
        cmp #RS_COFFEE
        bne @put
:       lda #CH_HR
        ldx #4
        bne @set
@nohr:  cmp #KIND_COFFEE
        bne @nocof
        lda #<st_machcd
        ldx #>st_machcd
        jsr floor_dl_ptr
        jsr time_left
        bne @put
        lda #CH_COFFEE
        ldx #1
        bne @set
@nocof: cmp #KIND_TERMINAL
        bne @put
        lda #'>'
        ldx #5
@set:   sta MK_C
        stx MK_COL
@put:   ldy #IA_MARK            ; write it to the map if it changed
        lda (IA),y
        clc
        adc #<FL_MAP
        sta PT
        iny
        lda (IA),y
        adc #>FL_MAP
        sta PT+1
        ldy #0
        lda (PT),y
        cmp MK_C
        beq :+
        lda MK_C
        sta (PT),y
        lda #1
        sta REDRAW
:       lda PT
        clc
        adc #<(FL_COL - FL_MAP)
        sta PT
        lda PT+1
        adc #>(FL_COL - FL_MAP)
        sta PT+1
        lda (PT),y
        cmp MK_COL
        beq @next
        lda MK_COL
        sta (PT),y
        lda #1
        sta REDRAW
@next:  ldx MK_I
        inx
        jmp @ia

; Look around the player's feet (facing direction first) for an interactable tile, then for a colleague.
; NEAR = interactable, $80 + actor for a colleague, $ff = nothing.
check_near:
        lda #0
        sta T2
@try:   lda adir
        clc
        adc T2
        and #3
        tax
        lda look_dx,x
        clc
        adc ax_lo
        sta T0
        lda look_dx,x
        bpl @pos
        lda #$ff
        .byte $2c
@pos:   lda #0
        adc ax_hi
        sta T1
        lda ay
        clc
        adc look_dy,x
        jsr info_at
        cmp #2
        bcs @found
        inc T2
        lda T2
        cmp #4
        bne @try
        jsr near_actor
        jmp @set
@found: sbc #2
@set:   cmp NEAR
        beq :+
        sta NEAR
        lda PANEL_T
        bne :+
        jsr draw_status
:       rts

; A = $80 + the nearest colleague within reach (by box distance), $ff = none.
near_actor:
        ldx #1
@a:     cpx nact
        bcs @none
        lda ay,x
        sec
        sbc ay
        bcs :+
        eor #$ff
        adc #1
:       cmp #12
        bcs @next
        lda ax_lo,x
        sec
        sbc ax_lo
        sta T0
        lda ax_hi,x
        sbc ax_hi
        bpl :+
        lda T0                  ; negative: |dx|
        eor #$ff
        clc
        adc #1
        sta T0
        lda #0
:       bne @next
        lda T0
        cmp #12
        bcs @next
        lda akind,x
        cmp #ACTOR_COLLEAGUE
        beq :+
        cmp #ACTOR_BOARD
        bne @next               ; receptionist and HR rep: through their desks
:
        txa
        ora #$80
        rts
@next:  inx
        bne @a
@none:  lda #$ff
        rts

interact:
        lda NEAR
        cmp #$ff
        bne :+
        rts
:       bpl :+
        and #$7f                ; an actor: a whiteboard (quest) or a colleague
        tax
        lda akind,x
        cmp #ACTOR_BOARD
        bne @talk
        jmp quest_board
@talk:  lda NEAR
        jmp talk
:       ldx QACT                ; a quest: its station leads to the desk part, the rest waits
        beq :+
        cmp QSTATION
        bne @busy
        jmp quest_desk
:       jsr ia_ptr
        ldy #IA_KIND
        lda (IA),y
        asl
        tax
        lda ia_jump+1,x
        pha
        lda ia_jump,x
        pha
        rts
@busy:  jsr ia_ptr              ; (posters and the coffee machine still work)
        ldy #IA_KIND
        lda (IA),y
        cmp #KIND_COFFEE
        beq @ok
        cmp #KIND_POSTER
        beq @ok
        jsr sb_line             ; 'Busy with "<title>". Finish it or give up (G).'
        lda #<s_qbusy
        ldx #>s_qbusy
        jsr sb_str
        lda QSTATION
        jsr ia_ptr
        ldy #IA_STR
        lda (IA),y
        pha
        iny
        lda (IA),y
        tax
        pla
        jsr sb_str
        lda #<s_qbusy2
        ldx #>s_qbusy2
        jsr sb_str
        jsr sb_end
        jmp toast_line
@ok:    lda NEAR
        jsr ia_ptr
        ldy #IA_KIND
        lda (IA),y
        asl
        tax
        lda ia_jump+1,x
        pha
        lda ia_jump,x
        pha
        rts
ia_jump:
        .word task_card - 1, elevator_panel - 1, hr_desk - 1, open_terminal - 1
        .word coffee_machine - 1, turnstile - 1, poster - 1

; ---- coffee machine, turnstile -----------------------------------------------------------------------------
coffee_machine:
        lda #<st_machcd
        ldx #>st_machcd
        jsr floor_dl_ptr
        jsr time_left
        beq @brew
        jsr sb_line             ; "The machine is brewing... ready in m:ss"
        lda #<s_brewing
        ldx #>s_brewing
        jsr sb_str
        jsr sb_mmss
        jsr sb_end
        jmp toast_line
@brew:  lda #<st_machcd
        ldx #>st_machcd
        jsr floor_dl_ptr
        lda #<COFFEE_MACHINE_S
        sta T0
        lda #>COFFEE_MACHINE_S
        sta T1
        jsr set_deadline
        lda st_coffee
        clc
        adc #3
        sta st_coffee
        lda #SFX_GOOD
        jsr sfx
        jsr hud_values
        jsr update_markers
        lda #<s_freshbrew
        ldx #>s_freshbrew
        jmp toast

turnstile:
        lda st_lobby
        bne :+
        jsr gate_nag
        lda #<s_nobadge
        ldx #>s_nobadge
        jmp toast
:       cmp #LOBBY_GATE
        beq :+
        rts
:       lda st_coffee
        bne @pay
        jsr sb_line             ; "The turnstile wants 1 coffee. Next cup in m:ss."
        lda #<s_gatecoffee
        ldx #>s_gatecoffee
        jsr sb_str
        jsr cup_left
        jsr sb_mmss
        lda #'.'
        jsr sb_char
        jsr sb_end
        jmp toast_line
@pay:   lda #1
        jsr spend_coffee
        lda #LOBBY_DONE
        sta st_lobby
        jsr open_gate
        lda #SFX_GOOD
        jsr sfx
        jsr hud_values
        lda #<s_havegreat
        ldx #>s_havegreat
        jsr recep_say
        jsr sb_line             ; "Beep! -1 coffee. Welcome to <corp>!"
        lda #<s_beep
        ldx #>s_beep
        jsr sb_str
        lda #<st_corp
        ldx #>st_corp
        jsr sb_str
        lda #'!'
        jsr sb_char
        jsr sb_end
        jsr toast_line
        jmp save_game

; Before check-in the receptionist stops you (not more often than every 3 s).
gate_nag:
        lda FRAME
        sec
        sbc NAG_T
        cmp #150
        bcc :+
        lda FRAME
        sta NAG_T
        lda #<s_notsofast
        ldx #>s_notsofast
        jmp recep_say
:       rts

; T0/T1 = seconds to the next cup.
cup_left:
        lda #<st_cupdl
        sta PT
        lda #>st_cupdl
        sta PT+1
        jmp time_left

; Walking up into the closed turnstiles tries them, like a badge tap.
bump_gate:
        lda st_lobby
        cmp #LOBBY_DONE
        beq @no
        lda NEAR
        bmi @no
        jsr ia_ptr
        ldy #IA_KIND
        lda (IA),y
        cmp #KIND_TURNSTILE
        bne @no
        lda JOY
        and #J_UP
        beq @no
        lda FRAME
        sec
        sbc BUMP_T
        cmp #100
        bcc @no
        lda FRAME
        sta BUMP_T
        jmp turnstile
@no:    rts

; ---- posters ------------------------------------------------------------------------------------------------
poster:
        ldy #IA_ARG
        lda (IA),y
        bne @ad
        lda #<s_adhere
        ldx #>s_adhere
        jsr ui_open
        lda #<f_sponsor
        ldx #>f_sponsor
        jsr far_text
        jmp @tail
@ad:    ldy #IA_STR             ; brand, then tagline
        lda (IA),y
        sta PT
        iny
        lda (IA),y
        sta PT+1
        lda PT
        ldx PT+1
        jsr ui_open
        ldy #0
:       lda (PT),y
        beq :+
        iny
        bne :-
:       iny                     ; the tagline, in quotes
        tya
        clc
        adc PT
        sta PT
        bcc :+
        inc PT+1
:       jsr sb_line
        lda #'"'
        jsr sb_char
        lda PT
        ldx PT+1
        jsr sb_str
        lda #'"'
        jsr sb_char
        jsr sb_end
        lda #7
        sta COLOR
        lda #<linebuf
        ldx #>linebuf
        jsr ui_text
        jsr ui_gap
        lda #1
        sta COLOR
        lda #<s_madeup
        ldx #>s_madeup
        jsr ui_text
@tail:  jsr ui_gap
        lda #<s_advertise
        ldx #>s_advertise
        jsr ui_text
        lda #3
        sta COLOR
        lda #<s_url_feedback
        ldx #>s_url_feedback
        jsr ui_text
        lda #<s_ok
        ldx #>s_ok
        ldy #0
        jsr ui_btn
        jsr ui_run
        jmp enter_floor

; ---- colleagues ----------------------------------------------------------------------------------------------
; Talk: the colleague turns to you and stops for 3.5 s; their name, role and a line show in the HUD panel.
talk:
        and #$7f
        tax
        stx TALK_A
        lda adir                ; face the player: opposite of the player's facing
        eor #1
        sta adir,x
        lda #0
        sta aanim,x
        lda #175
        sta apause,x
        lda amode,x
        ; a line: 40% the department's, 60% the common ones; not one of the last few said
        ldy #8
@pick:  dey
        beq @take
        jsr rand
        cmp #102                ; 40%
        bcs @common
        lda #LINES_DEPT
        jsr rand_mod
        clc
        adc #LINES_COMMON
        bne @check
@common:
        lda #LINES_COMMON
        jsr rand_mod
@check: ldx #RECENT - 1
:       cmp recent,x
        beq @pick
        dex
        bpl :-
@take:  sta TMP                 ; remember it
        ldx #RECENT - 1
:       lda recent-1,x
        sta recent,x
        dex
        bne :-
        lda TMP
        sta recent
        tax
        lda lines_lo,x
        sta T0
        lda lines_hi,x
        tax
        lda T0
        jsr far_str             ; -> farbuf
        ldx TALK_A
        jsr actor_who
        lda #<farbuf
        ldx #>farbuf
        jmp say

; X = actor -> PT = "Name\0Role\0" from the floor header.
actor_who:
        txa
        asl
        asl
        asl                     ; × 8
        tay
        dey                     ; (actor 0 is the player: entry X-1)
        dey
        dey
        dey
        dey
        dey
        dey
        dey
        lda FL_HDR + HDR_NPC + 6,y
        sta PT
        lda FL_HDR + HDR_NPC + 7,y
        sta PT+1
        rts

; A/X = what the receptionist says (floor 1).
recep_say:
        sta TMPW
        stx TMPW+1
        ldx #1
:       cpx nact
        bcs @none
        lda akind,x
        cmp #ACTOR_RECEPTION
        beq :+
        inx
        bne :-
:       jsr actor_who
        lda TMPW
        ldx TMPW+1
        jmp say
@none:  rts

; A/X = what the HR rep says.
hr_say:
        sta TMPW
        stx TMPW+1
        ldx #1
:       cpx nact
        bcs @none
        lda akind,x
        cmp #ACTOR_HR
        beq :+
        inx
        bne :-
:       jsr actor_who
        lda TMPW
        ldx TMPW+1
        jmp say
@none:  rts

; ---- HUD panel: speech and toasts --------------------------------------------------------------------------
; The three HUD rows double as a panel: a speaker (name + role) and two lines of text for 3.5 s.
; PT = "Name\0Role\0" (or 0 for a toast without a speaker), A/X = text.
say:
        sta TMPW
        stx TMPW+1
        lda #0
        sta COLOR
        jsr hud_clear
        lda PT+1
        beq @text
        lda #7                  ; name
        sta COLOR
        lda PT
        sta PTR
        lda PT+1
        sta PTR+1
        ldx #1
        ldy #0
        jsr print
        ldy #0                  ; role after it, in grey
:       lda (PT),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc PT
        sta PTR
        lda PT+1
        adc #0
        sta PTR+1
        lda #15
        sta COLOR
        lda #','
        jsr putc_next
        lda #' '
        jsr putc_next
        jsr print_next
@text:  lda TMPW
        sta PTR
        lda TMPW+1
        sta PTR+1
        lda #1
        sta COLOR
        ldy #1
        lda PT+1
        bne :+
        ldy #0                  ; a toast: from the top row
:       jsr hud_wrap
        lda #175
        sta PANEL_T
        rts

; Toast: A/X = text in the HUD panel (no speaker).
toast:
        ldy #0
        sty PT+1
        jsr say
        lda #SFX_BLIP
        jmp sfx

toast_line:
        lda #<linebuf
        ldx #>linebuf
        jmp toast

; PTR = text, wrapped into the HUD rows from row Y (columns 1-38).
hud_wrap:
        sty HW_ROW
        lda #1
        sta HW_COL
        ldy #0
@word:  sty HW_WS
        ldx #0
@m:     lda (PTR),y
        beq @me
        cmp #' '
        beq @me
        inx
        iny
        bne @m
@me:    txa
        clc
        adc HW_COL
        cmp #40
        bcc :+
        lda #1
        sta HW_COL
        inc HW_ROW
        lda HW_ROW
        cmp #HUD_ROWS
        bcs @end
:       ldy HW_WS
@p:     cpx #0
        beq @sep
        lda (PTR),y
        stx HW_X
        sty HW_Y
        ldx HW_COL
        ldy HW_ROW
        jsr putc
        inc HW_COL
        ldx HW_X
        ldy HW_Y
        iny
        dex
        jmp @p
@sep:   lda (PTR),y
        beq @end
        iny
        inc HW_COL
        jmp @word
@end:   rts

; Count the panel down; back to the HUD when it runs out.
panel_tick:
        lda PANEL_T
        beq @done
        dec PANEL_T
        bne @done
        jsr draw_hud
@done:  rts

; ---- the receptionist's nudges (lobby check-in) ---------------------------------------------------------
recep_tick:
        lda st_lobby
        bne @done
        lda FL_HDR + HDR_FLOORNO
        cmp #1
        bne @done
        dec NUDGE_T
        bne @done
        lda #12 * 50 / 4        ; every 12 s (the counter runs every 4th frame)
        sta NUDGE_T
        lda PANEL_T
        bne @done
        ldx NUDGE_I
        inx
        cpx #4
        bcc :+
        ldx #0
:       stx NUDGE_I
        lda nudge_lo,x
        pha
        lda nudge_hi,x
        tax
        pla
        jmp recep_say
@done:  rts
