; ---- floor quest: Lost Password's search (src/scenes/floorQuest.js) ---------------------------------------------
; Starting the task rolls whiteboards onto the floor (actors with the overlay's board sprite). Find the one with
; your pet's photo before the time runs out (HUD row 1), then log in at the desk (the overlay's mini-game). G gives
; up. Meanwhile the other tasks, the elevator, HR and the terminal wait. The overlay (mg.lostpw) stays loaded for the
; whole quest: it picks the boards' places and contents and draws their close-ups.
ACTOR_BOARD = 3

; NEAR = station (IA set): start the quest. Coffee: already taken by the caller.
quest_start:
        lda NEAR
        sta QSTATION
        jsr ia_ptr
        ldy #IA_ARG2
        lda (IA),y
        sta MG_DIFF
        ldy #IA_X               ; places to avoid: the player, the station
        lda (IA),y
        sta Q_SX
        iny
        lda (IA),y
        sta Q_SY
        lda ax_hi
        lsr
        lda ax_lo
        ror
        lsr
        lsr
        sta Q_PX
        lda ay
        lsr
        lsr
        lsr
        sta Q_PY
        ldx #G_LOSTPW
        jsr game_overlay
        jsr QUEST_SETUP
        lda nact                ; the boards join the actors
        sta QFIRST
        ldx #0
@b:     cpx QB_N
        bcs @placed
        stx T2
        ldy nact
        lda QB_X,x
        asl
        asl
        asl
        php
        ora #4
        sta ax_lo,y
        lda #0
        plp
        rol
        sta ax_hi,y
        lda QB_Y,x
        asl
        asl
        asl
        ora #7
        sta ay,y
        lda #7
        sta acol,y
        lda #QB_SPRITE
        sta abase,y
        lda #0
        sta adir,y
        sta aanim,y
        sta apause,y
        lda #1
        sta astill,y
        lda #ACTOR_BOARD
        sta akind,y
        txa
        sta amode,y             ; (which board)
        inc nact
        ldx T2
        inx
        bne @b
@placed:
        lda #0
        sta QKIND
; Both quests: on, the clock running.
quest_go:
        lda #1
        sta QACT
        lda #0
        sta QPHASE
        sta QCHECKED
        sta Q_SEEN
        lda #<QDL
        sta PT
        lda #>QDL
        sta PT+1
        lda Q_LIMIT
        sta T0
        lda #0
        sta T1
        jsr set_deadline
        lda #SFX_GOOD
        jsr sfx
        jsr enter_floor
        jmp quest_hud

; Once a second: the time limit, and HUD row 1.
quest_tick:
        lda QACT
        beq @done
        jsr quest_left
        bne quest_hud
        lda QKIND
        beq :+
        jsr fb_wenthome         ; "<name> went home for the day. Review deadline missed."
        lda #<lbuf1
        ldx #>lbuf1
        bne :++
:       lda #<s_qtimeup         ; time's up
        ldx #>s_qtimeup
:
        ldy #<s_qtimeup_t
        sty QFAIL_T
        ldy #>s_qtimeup_t
        sty QFAIL_T+1
        jmp quest_fail
@done:  rts

; T0/T1 = seconds left, Z=1 when up.
quest_left:
        lda #<QDL
        sta PT
        lda #>QDL
        sta PT+1
        jmp time_left

; HUD row 1: the objective, the time left, boards checked.
quest_hud:
        lda PANEL_T
        beq :+
        rts
:       jsr sb_line
        lda QKIND
        beq @pw
        lda QPHASE              ; feedback: "Find <name> and have a chat" / back to the desk
        bne @fbback
        lda #<s_qfind
        ldx #>s_qfind
        jsr sb_str
        lda FB_WHO
        ldx FB_WHO+1
        jsr sb_str
        lda #<s_fbchat
        ldx #>s_fbchat
        jsr sb_str
        jmp @obj
@fbback:
        lda #<s_fbback
        ldx #>s_fbback
        jsr sb_str
        jmp @obj
@pw:    lda QPHASE
        bne @back
        lda #<s_qfind           ; "Find <first name>'s <species>!"
        ldx #>s_qfind
        jsr sb_str
        ldx #0
:       lda st_name,x
        beq :+
        cmp #' '
        beq :+
        jsr sb_char
        inx
        cpx #10
        bne :-
:       lda #$27
        jsr sb_char
        lda #'s'
        jsr sb_char
        lda #' '
        jsr sb_char
        lda Q_SPEC
        ldx Q_SPEC+1
        jsr sb_str
        lda #<s_qyours
        ldx #>s_qyours
        jsr sb_str
        jmp :+
@back:  lda #<s_qback
        ldx #>s_qback
        jsr sb_str
@obj:
:       jsr sb_end
        lda #7
        sta COLOR
        lda #31
        ldx #0
        ldy #1
        jsr print_field
        jsr sb_line             ; "m:ss n/3"
        jsr quest_left
        jsr sb_mmss
        lda QKIND               ; (boards: Lost Password only)
        bne :+
        lda #' '
        jsr sb_char
        lda QCHECKED
        jsr sb_num
        lda #'/'
        jsr sb_char
        lda QB_N
        jsr sb_num
:       jsr sb_end
        lda #1
        sta COLOR
        lda #9
        ldx #31
        ldy #1
        jmp print_field

; FIRE at a board (X = actor): its close-up; your pet's photo moves you on to the desk.
quest_board:
        lda amode,x
        sta T3
        lda abase,x             ; first look: checked
        cmp #QB_SPRITE
        bne :+
        lda #QB_SPRITE + 1
        sta abase,x
        lda #11
        sta acol,x
        inc QCHECKED
:       lda T3
        cmp QB_MINE
        bne :+
        lda QPHASE
        bne :+
        inc QPHASE
        lda #1
        sta Q_SEEN
        lda #SFX_GOOD
        jsr sfx
:       jsr plain_screen
        lda #0
        sta $d015
        lda T3
        jsr QUEST_VIEW          ; (it may turn the background white)
        lda #0
        sta $c6
:       jsr wait_frame          ; FIRE / RETURN closes it
        jsr read_input
        jsr getkey
        cmp #3
        beq :+
        lda JOYP
        and #J_FIRE
        beq :-
:       lda #0
        sta $d021
        sta $d020
        lda #SFX_BLIP
        jsr sfx
        jsr enter_floor
        jmp quest_hud

; FIRE at the quest's station: the desk part (speed bonus from the time left), then the usual pay-out.
quest_desk:
        lda QKIND               ; feedback: not before the chat
        beq :+
        lda QPHASE
        bne :+
        jsr sb_line             ; "Talk to <name> first. Hallway chats from before don't count."
        lda #<s_fbfirst
        ldx #>s_fbfirst
        jsr sb_str
        lda FB_WHO
        ldx FB_WHO+1
        jsr sb_str
        lda #<s_fbfirst2
        ldx #>s_fbfirst2
        jsr sb_str
        jsr sb_end
        lda #SFX_BAD
        jsr sfx
        jmp toast_line
:
        jsr quest_left          ; speed = min(1, left / (limit × 0.45)) × 255
        lda Q_LIMIT             ; limit × 0.45 ≈ limit × 115 / 256
        sta NUM
        lda #0
        sta NUM+1
        ldx #115
        lda #0
        sta T2
        sta T3
:       lda T2                  ; T2/T3 = limit × 115
        clc
        adc NUM
        sta T2
        lda T3
        adc #0
        sta T3
        dex
        bne :-
        lda T3                  ; /256 -> A = limit × 0.45 (at least 1)
        bne :+
        lda #1
:       sta T2
        lda T1
        bne @full
        lda T0
        cmp T2
        bcs @full
        ldx #0                  ; left × 255 / need: repeated subtraction of need from left × 255
        stx NUM
        stx NUM+1
        ldy #0
:       cpy T0                  ; NUM = left × 255
        beq :+
        lda NUM
        clc
        adc #255
        sta NUM
        bcc @ny
        inc NUM+1
@ny:    iny
        bne :-
:       ldx #0
:       lda NUM
        sec
        sbc T2
        tay
        lda NUM+1
        sbc #0
        bcc :+
        sta NUM+1
        sty NUM
        inx
        bne :-
:       txa
        .byte $2c
@full:  lda #255
        sta Q_SPEED
        jsr quest_end
        lda #1                  ; (coffee was taken when the quest began)
        sta QDESK
        lda QSTATION
        jmp play_station

; RUN... G: give up.
quest_giveup:
        lda #<s_qgaveup
        ldx #>s_qgaveup
        ldy #<s_qgaveup_t
        sty QFAIL_T
        ldy #>s_qgaveup_t
        sty QFAIL_T+1
; A/X = text, QFAIL_T = title: the task counts as played with 0 stars.
quest_fail:
        sta TMPW
        stx TMPW+1
        jsr quest_end
        lda QSTATION
        jsr ia_ptr
        lda QSTATION
        sta HOST_I
        ldy #IA_ARG
        lda (IA),y
        sta HOST_G
        lda #0
        sta MG_SCORE
        sta HOST_CHECKIN
        jsr pay_out
        lda #SFX_BAD
        jsr sfx
        lda QFAIL_T
        ldx QFAIL_T+1
        jsr ui_open
        lda TMPW
        ldx TMPW+1
        jsr ui_text
        jsr ui_gap
        lda #<s_nokpi
        ldx #>s_nokpi
        jsr ui_text
        lda #<s_ok
        ldx #>s_ok
        ldy #0
        jsr ui_btn
        jsr ui_run
        jmp enter_floor

; The boards go, the quest is over.
quest_end:
        lda #0
        sta QACT
        lda QFIRST
        sta nact
        rts

; ---- floor quest: 360 Feedback's search (floorQuest.js kind 'feedback') -----------------------------------------
; Find the named colleague on this floor and chat with them (earlier chats don't count), then write their review at
; the desk (the overlay's mini-game). Other colleagues sometimes say where they saw them. The overlay (mg.feedback)
; stays loaded: it picks the facts (QUEST_SETUP) and draws the chat (QUEST_VIEW).
QK_FEEDBACK = 1

; NEAR = station (IA set): start the quest. Coffee: already taken by the caller.
fb_start:
        lda NEAR
        sta QSTATION
        jsr ia_ptr
        ldy #IA_ARG2
        lda (IA),y
        sta MG_DIFF
        ldx #1                  ; the colleagues still here
        ldy #0
@count: cpx nact
        bcs @pick
        lda akind,x
        cmp #ACTOR_COLLEAGUE
        bne :+
        lda ay,x
        beq :+
        iny
:       inx
        bne @count
@pick:  tya
        bne :+
        jmp play_quest_station  ; (nobody on the floor: just the desk part)
:       jsr rand_mod
        sta T3
        ldx #0
@find:  inx
        lda akind,x
        cmp #ACTOR_COLLEAGUE
        bne @find
        lda ay,x
        beq @find
        dec T3
        bpl @find
        stx QTARGET
        jsr actor_who           ; FB_WHO = their record, FB_YEARS from it
        lda PT
        sta FB_WHO
        lda PT+1
        sta FB_WHO+1
        jsr fb_years
        sta FB_YEARS
        ldx #G_FEEDBACK
        jsr game_overlay
        jsr QUEST_SETUP         ; facts and Q_LIMIT
        lda #QK_FEEDBACK
        sta QKIND
        lda nact
        sta QFIRST
        jmp quest_go

; The desk part straight away (no colleague to find).
play_quest_station:
        lda QSTATION
        jmp play_station

; FB_WHO -> A = the years in its third string.
fb_years:
        ldy #0
        ldx #2                  ; past name and role
:       lda (PT),y
        iny
        cmp #0
        bne :-
        dex
        bne :-
        lda #0
        sta T2
:       lda (PT),y
        beq :+
        and #$0f
        sta T3
        lda T2                  ; × 10 + digit
        asl
        asl
        adc T2
        asl
        adc T3
        sta T2
        iny
        bne :-
:       lda T2
        rts

; X = actor talked to during the feedback search. C=1 when handled here.
fb_talk:
        cpx QTARGET
        bne :+
        jmp @target
:       jsr rand                ; someone else: 60% point you the right way
        cmp #154
        bcc :+
        clc                     ; (not this time: their usual line)
        rts
:       stx T3
        jsr sb_line             ; "<First>? Saw them <where>."
        lda FB_WHO
        sta PT
        lda FB_WHO+1
        sta PT+1
        ldy #0
:       lda (PT),y
        beq :+
        cmp #' '
        beq :+
        jsr sb_char
        iny
        bne :-
:       lda #<s_fbsaw
        ldx #>s_fbsaw
        jsr sb_str
        ldx T3                  ; where: the bigger of |dx| (pixels) and |dy|
        ldy QTARGET
        lda ax_lo,y
        sec
        sbc ax_lo,x
        sta T0
        lda ax_hi,y
        sbc ax_hi,x
        sta T1                  ; dx (signed 16)
        lda ay,y
        sec
        sbc ay,x
        sta T2                  ; dy (signed 8: rows 0-223)
        ror                     ; (C from the subtraction: borrow -> negative)
        eor #$80
        sta TMPW                ; bit 7: dy < 0
        lda T1
        bpl :+
        lda #0                  ; |dx|
        sec
        sbc T0
        sta T0
        lda #0
        sbc T1
:       sta TMPW+1              ; (|dx| high byte)
        lda T2
        bit TMPW
        bpl :+
        eor #$ff
        clc
        adc #1
:       sta T2                  ; |dy|
        lda TMPW+1
        bne @horiz
        lda T0
        cmp T2
        bcc @vert
@horiz: lda T1
        bmi :+
        lda #<s_fbright
        ldx #>s_fbright
        bne @say
:       lda #<s_fbleft
        ldx #>s_fbleft
        bne @say
@vert:  bit TMPW
        bpl :+
        lda #<s_fbup
        ldx #>s_fbup
        bne @say
:       lda #<s_fbdown
        ldx #>s_fbdown
@say:   jsr sb_str
        jsr sb_end
        ldx T3
        lda #175
        sta apause,x
        jsr actor_who
        lda #<linebuf
        ldx #>linebuf
        jsr say
        sec
        rts
@target:
        lda #175
        sta apause,x
        jsr plain_screen
        lda #0
        sta $d015
        sta COLOR
        jsr cls
        lda QPHASE
        jsr QUEST_VIEW
        lda #0
        sta $c6
:       jsr wait_frame          ; FIRE / RETURN closes it
        jsr read_input
        jsr getkey
        cmp #3
        beq :+
        lda JOYP
        and #J_FIRE
        beq :-
:       lda QPHASE
        bne :+
        inc QPHASE              ; on to the desk
        lda #SFX_GOOD
        jsr sfx
:       jsr enter_floor
        jsr quest_hud
        sec
        rts

; lbuf1 = "<name> went home for the day. Review deadline missed."
fb_wenthome:
        lda #<lbuf1
        ldx #>lbuf1
        jsr sb_start
        lda FB_WHO
        ldx FB_WHO+1
        jsr sb_str
        lda #<s_fbhome
        ldx #>s_fbhome
        jsr sb_str
        jmp sb_end
