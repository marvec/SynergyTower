; ---- the CEO: personnel decisions (src/scenes/overlays.js FateDialog, floorScene.js fire/keep) ------------------
; Once you are on floor 40 (state.js canFire), talking to a colleague on any floor offers Fire / Keep / Later.
; A fired colleague's desk stash (5-60 paperclips) goes to you; they say a parting line, walk to the elevator
; (src/leave.s) and are gone for good (st_fired: a bit per floor and colleague).

; X = actor (a colleague), farbuf = the line they were about to say.
fate_dialog:
        stx FATE_A
        lda #'"'                ; the quote, kept in lbuf1 (farbuf is reused below)
        sta lbuf1
        ldy #0
:       lda farbuf,y
        beq :+
        sta lbuf1+1,y
        iny
        cpy #188
        bne :-
:       lda #'"'
        sta lbuf1+1,y
        lda #0
        sta lbuf1+2,y
        lda #<s_fate
        ldx #>s_fate
        jsr ui_open
        ldx FATE_A
        jsr actor_who           ; PT = "Name\0Role\0years\0note\0"
        lda #7
        sta COLOR
        jsr fate_field          ; name
        lda #1
        sta COLOR
        jsr fate_field          ; role
        lda #15
        sta COLOR
        jsr sb_line             ; "<Dept> department - floor N"
        lda #<(FL_HDR + HDR_DEPT)
        ldx #>(FL_HDR + HDR_DEPT)
        jsr sb_str
        lda #<s_deptfloor
        ldx #>s_deptfloor
        jsr sb_str
        lda st_floor
        jsr sb_num
        jsr sb_end
        jsr ui_line
        jsr sb_line             ; "With the company: N years"
        lda #<s_withco
        ldx #>s_withco
        jsr sb_str
        lda PT
        ldx PT+1
        jsr sb_str
        lda #<s_years           ; (1 year)
        ldx #>s_years
        ldy #0
        lda (PT),y
        cmp #'1'
        bne :+
        iny
        lda (PT),y
        bne :+
        lda #<s_year
        ldx #>s_year
        bne :++
:       lda #<s_years
        ldx #>s_years
:       jsr sb_str
        jsr sb_end
        jsr ui_line
        jsr fate_skip
        ldy #0                  ; the file note: one of f_notes
        lda (PT),y
        sec
        sbc #32
        tax
        lda #<f_notes
        ldy #>f_notes
        jsr para_addr
        jsr far_str             ; -> farbuf
        jsr sb_line             ; "File: <note>"
        lda #<s_file
        ldx #>s_file
        jsr sb_str
        lda #<farbuf
        ldx #>farbuf
        jsr sb_str
        jsr sb_end
        lda #<linebuf
        ldx #>linebuf
        jsr ui_text
        jsr ui_gap
        lda #3
        sta COLOR
        lda #<lbuf1
        ldx #>lbuf1
        jsr ui_text
        lda #<s_firebtn
        ldx #>s_firebtn
        ldy #0
        jsr ui_btn
        lda #<s_keep
        ldx #>s_keep
        ldy #0
        jsr ui_btn
        lda #<s_later
        ldx #>s_later
        ldy #0
        jsr ui_btn
        jsr ui_run
        cmp #0
        beq fire_colleague
        cmp #1
        bne @later
        lda #SFX_GOOD           ; keep: a grateful line
        jsr sfx
        jsr enter_floor
        lda #<f_kept
        ldx #>f_kept
        jsr fate_say
        rts
@later: jmp enter_floor

; PT: print its string (wrapped), then move PT past it.
fate_field:
        lda PT
        ldx PT+1
        jsr ui_text
; PT past its string's 0.
fate_skip:
        ldy #0
:       lda (PT),y
        inc PT
        bne :+
        inc PT+1
:       cmp #0
        bne :--
        rts

fire_colleague:
        lda #56                 ; desk stash: 5-60 paperclips
        jsr rand_mod
        clc
        adc #5
        sta FIRED_STASH
        sta RSP
        lda #0
        sta RSP+1
        jsr add_sp
        ldx FATE_A
        jsr fired_bit           ; gone for good
        ora st_fired,y
        sta st_fired,y
        inc st_nfired
        jsr save_game
        lda #SFX_BAD
        jsr sfx
        jsr enter_floor
        lda FATE_A
        sta FIRED_A
        jsr exit_map            ; their goodbye, then the walk to the elevator (src/leave.s, main.s timed_lines)
        lda #<f_fired
        ldx #>f_fired
; A/X = far text of one-line paragraphs: FATE_A says one of them (at random).
fate_say:
        sta FARP
        stx FARP+1
        lda #FATE_LINES
        jsr rand_mod
        tax
        lda FARP
        ldy FARP+1
        jsr para_addr
        jsr far_str
        lda #175
        ldx FATE_A
        sta apause,x
        jsr actor_who
        lda #<farbuf
        ldx #>farbuf
        jmp say

.segment "BSS"
FATE_A:  .res 1
.segment "CODE3"
