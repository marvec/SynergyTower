; The CEO ending (src/scenes/ending.js) as a system overlay at $4000, on the exec disk side: fireworks over the
; lit-up tower at night, the career in numbers, the fanfare; FIRE ("Keep running the company") returns to free play.
; Called with jsr OVERLAY once the floor-40 KPI quota is reached (host.s).
; C64 differences: the tower doesn't pan up (it stands at the right edge), the fireworks are character bursts.

.include "api.inc"
.include "state.inc"
.include "gen/chars.inc"

TOWER_X  = 31                   ; the tower: columns 31-38, rows 3-24
TOWER_W  = 8
BURSTS   = 3                    ; at the same time
PANEL_Y  = 8                    ; the panel: rows 8-23, the fireworks above it
SONG_FANFARE = 3

e_pt     = $40                  ; 2: a string
e_n      = $42                  ; 2: a 16-bit number
e_t      = $44                  ; 2: frames so far
e_ret    = $46                  ; 2: stat's return address

.segment "CODE"
        jmp ending
.include "mgkit.s"              ; (after the entry point at $4000)

ending:
        lda #0
        sta COLOR
        jsr API_CLS
        lda #0                  ; (API calls change A)
        sta $d015
        sta e_t
        sta e_t+1
        ldx #BURSTS - 1
        lda #0
:       sta b_age,x
        dex
        bpl :-
        ldx #SONG_FANFARE
        jsr API_SONG
        jsr sky
        jsr tower
        jsr panel
@frame: jsr API_WAIT
        jsr API_INPUT
        inc e_t
        bne :+
        inc e_t+1
:       jsr fireworks
        lda e_t+1               ; the button after 1 s
        bne :+
        lda e_t
        cmp #50
        bcc @frame
:       lda JOYP
        and #J_FIRE
        beq @frame
        lda #SFX_GOOD
        jsr API_SFX
        rts

; ---- the night: a few stars (white and blue dots)
sky:
        lda #40
        sta e_n
@star:  lda #29
        jsr API_RMOD
        clc
        adc #1
        sta e_n+1
        jsr API_RAND
        and #1
        beq :+
        lda #1
        .byte $2c
:       lda #6
        sta COLOR
        lda #PANEL_Y - 1
        jsr API_RMOD
        tay
        iny
        lda #'.'
        ldx e_n+1
        jsr API_PUTC
        dec e_n
        bne @star
        rts

; ---- the tower: a dark grey block with lit windows, your floor (the top) in the corp colour
tower:
        lda #8                  ; multicolour cells: MC_A is all dark grey
        sta COLOR
        lda #TOWER_W
        sta FILL_W
        lda #22
        sta FILL_H
        lda #MC_A
        ldx #TOWER_X
        ldy #3
        jsr API_FILL
        ldy #4                  ; windows: lit, every other column and row
@row:   sty e_n
        ldx #TOWER_X + 1
@col:   stx e_n+1
        jsr API_RAND
        and #3
        beq :+                  ; (a quarter dark)
        lda #7
        sta COLOR
        lda #CH_HALF
        ldx e_n+1
        ldy e_n
        jsr API_PUTC
:       ldx e_n+1
        inx
        inx
        cpx #TOWER_X + TOWER_W - 1
        bcc @col
        ldy e_n
        iny
        iny
        cpy #24
        bcc @row
        lda st_color            ; the top floor: yours
        tax
        lda corp_hires,x
        sta COLOR
        lda #TOWER_W - 2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #CH_BLOCK
        ldx #TOWER_X + 1
        ldy #3
        jsr API_FILL
        lda #7                  ; "40" on the antenna
        sta COLOR
        lda #<s_forty
        sta PTR
        lda #>s_forty
        sta PTR+1
        ldx #TOWER_X + 3
        ldy #2
        jmp API_PRINT

; ---- the panel: the career in numbers
panel:
        lda #3
        sta COLOR
        lda #30
        sta FILL_W
        lda #16
        sta FILL_H
        lda #' '
        ldx #0
        ldy #PANEL_Y
        jsr API_FILL
        lda #14
        sta COLOR
        ldx #0
        ldy #PANEL_Y
        jsr API_BOX
        text 3, PANEL_Y + 1, s_title, 7
        lda #7                  ; "Congratulations, <name>!"
        sta COLOR
        lda #<s_congrats
        ldx #>s_congrats
        ldy #PANEL_Y + 2
        jsr line_start
        lda #<st_name
        ldx #>st_name
        jsr line_add
        lda #'!'
        jsr line_char
        jsr line_end
        lda #1                  ; "From unpaid intern to CEO of" / "<corp>."
        sta COLOR
        lda #<s_from
        ldx #>s_from
        ldy #PANEL_Y + 3
        jsr line_start
        jsr line_end
        lda #<s_of
        ldx #>s_of
        ldy #PANEL_Y + 4
        jsr line_start
        lda #<st_corp
        ldx #>st_corp
        jsr line_add
        lda #'.'
        jsr line_char
        jsr line_end
        lda #1
        sta COLOR
        lda st_tasks
        ldx st_tasks+1
        ldy #PANEL_Y + 5
        jsr stat
        .word s_tasks
        lda st_perfect
        ldx st_perfect+1
        ldy #PANEL_Y + 6
        jsr stat
        .word s_perfect
        lda st_promos
        ldx #0
        ldy #PANEL_Y + 7
        jsr stat
        .word s_promos
        lda st_level
        ldx #0
        ldy #PANEL_Y + 8
        jsr stat
        .word s_level
        lda st_nfired
        ldx #0
        ldy #PANEL_Y + 9
        jsr stat
        .word s_fired
        lda st_sobought
        ldx st_sobought+1
        ldy #PANEL_Y + 10
        jsr stat
        .word s_sobought
        text 2, PANEL_Y + 11, s_thanks1, 3
        text 2, PANEL_Y + 12, s_thanks2, 3
        text 2, PANEL_Y + 13, s_free1, 6
        text 2, PANEL_Y + 14, s_free2, 6
        center 24, s_keep, 7
        rts

; A/X = number, Y = row, and the label's address in the word after the jsr: "<label><number>" on row Y.
stat:
        sta e_n
        stx e_n+1
        sty l_row
        pla                     ; the return address points at the word's first byte - 1
        sta e_ret
        pla
        sta e_ret+1
        ldy #1
        lda (e_ret),y
        sta e_lbl
        iny
        lda (e_ret),y
        sta e_lbl+1
        lda e_ret               ; return past the word
        clc
        adc #2
        tay
        lda e_ret+1
        adc #0
        pha
        tya
        pha
        lda e_lbl
        ldx e_lbl+1
        ldy l_row
        jsr line_start
        jsr line_u16
        jmp line_end

; ---- a line of text built at column 2 of row Y (lbuf)
line_start:
        sty l_row
        ldy #0
        sty l_len
line_add:
        sta e_pt
        stx e_pt+1
        ldy #0
:       lda (e_pt),y
        beq :+
        jsr line_char
        iny
        bne :-
:       rts
line_char:
        sty l_y
        ldy l_len
        cpy #27
        bcs :+
        sta lbuf,y
        inc l_len
:       ldy l_y
        rts
line_end:
        ldy l_len
        lda #0
        sta lbuf,y
        lda #<lbuf
        sta PTR
        lda #>lbuf
        sta PTR+1
        ldx #2
        ldy l_row
        jmp API_PRINT

; e_n (16 bit) in decimal.
line_u16:
        ldx #0
        stx l_z
@pow:   ldy #'0'
@sub:   lda e_n
        sec
        sbc p10_lo,x
        sta l_y
        lda e_n+1
        sbc p10_hi,x
        bcc @out
        sta e_n+1
        lda l_y
        sta e_n
        iny
        bne @sub
@out:   tya
        cpx #4
        beq :+
        cmp #'0'
        bne :+
        ldy l_z
        beq @next
:       jsr line_char
        inc l_z
@next:  inx
        cpx #5
        bne @pow
        rts

; ---- fireworks: up to BURSTS rings of sparks growing from a random point in the sky, then fading
fireworks:
        ldx #BURSTS - 1
@b:     stx b_i
        lda b_age,x
        bne @grow
        jsr API_RAND            ; a new one now and then (~2.5 a second for all)
        cmp #18
        bcs @next
        ldx b_i
        lda #26
        jsr API_RMOD
        clc
        adc #2
        ldx b_i
        sta b_x,x
        lda #4
        jsr API_RMOD
        clc
        adc #2
        ldx b_i
        sta b_y,x
        lda #5
        jsr API_RMOD
        tay
        lda spark_col,y
        ldx b_i
        sta b_col,x
        lda #1
        sta b_age,x
        lda #SFX_BLIP
        jsr API_SFX
        jmp @next
@grow:  inc b_age,x
        lda b_age,x
        and #3                  ; a step every 4 frames
        bne @next
        lda b_age,x
        lsr
        lsr
        sta b_r                 ; radius 1..
        cmp #6
        bcc :+
        lda #0                  ; done
        sta b_age,x
        lda #' '                ; erase the last ring
        ldy #5
        jsr ring
        jmp @next
:       cmp #1
        beq :+
        lda #' '                ; the previous ring goes
        ldy b_r
        dey
        jsr ring
:       lda #'*'
        ldy b_r
        jsr ring
@next:  ldx b_i
        dex
        bmi :+
        jmp @b
:       rts

; A = char, Y = radius: 8 points round burst b_i, clipped to the sky (above the panel, left of the tower).
ring:
        sta r_ch
        sty b_rr
        ldy #7
@p:     sty r_k
        ldx b_i
        lda ring_dx,y
        jsr times_r
        clc
        adc b_x,x
        sta r_x
        lda ring_dy,y
        jsr times_r
        clc
        adc b_y,x
        sta r_y
        lda r_x                 ; clip: the sky above the panel, left of the tower
        cmp #TOWER_X
        bcs @skip
        lda r_y
        cmp #1
        bcc @skip
        cmp #PANEL_Y
        bcs @skip
        lda r_ch
        cmp #' '
        beq :+
        lda b_col,x
        .byte $2c
:       lda #0
        sta COLOR
        lda r_ch
        ldx r_x
        ldy r_y
        jsr API_PUTC
@skip:  ldy r_k
        dey
        bpl @p
        rts

; A = -1/0/1 -> A × b_rr (as a signed byte)
times_r:
        cmp #0
        beq @z
        bmi :+
        lda b_rr
        rts
:       lda #0
        sec
        sbc b_rr
@z:     rts

ring_dx:   .byte 0, 1, 1, 1, 0, $ff, $ff, $ff
ring_dy:   .byte $ff, $ff, 0, 1, 1, 1, 0, $ff
spark_col: .byte 7, 2, 3, 6, 5
corp_hires: .byte 6, 3, 1, 4, 2, 5, 7, 2, 4, 1, 5, 6 ; corp colours on the hires palette (src/main.s corp_c64)
p10_lo:    .byte <10000, <1000, <100, <10, <1
p10_hi:    .byte >10000, >1000, >100, >10, >1

s_forty:   .byte "40", 0
s_title:   .byte "CHIEF EXECUTIVE OFFICER", 0
s_congrats: .byte "Congratulations, ", 0
s_from:    .byte "From unpaid intern to CEO", 0
s_of:      .byte "of ", 0
s_tasks:   .byte "Tasks completed: ", 0
s_perfect: .byte "Perfect (3-star) tasks: ", 0
s_promos:  .byte "Promotions: ", 0
s_level:   .byte "Seniority level: ", 0
s_fired:   .byte "Colleagues let go: ", 0
s_sobought: .byte "Stock Options bought: ", 0
s_thanks1: .byte "The board thanks you.", 0
s_thanks2: .byte "Shareholders weep with joy.", 0
s_free1:   .byte "Free play continues -", 0
s_free2:   .byte "beat your best scores!", 0
s_keep:    .byte "FIRE: Keep running the company", 0

.segment "BSS"
b_age:  .res BURSTS
b_x:    .res BURSTS
b_y:    .res BURSTS
b_col:  .res BURSTS
b_i:    .res 1
b_r:    .res 1
b_rr:   .res 1
r_ch:   .res 1
r_k:    .res 1
r_x:    .res 1
r_y:    .res 1
l_row:  .res 1
l_len:  .res 1
l_y:    .res 1
l_z:    .res 1
e_lbl:  .res 2
lbuf:   .res 28
