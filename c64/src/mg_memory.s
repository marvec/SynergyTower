; Name Badge Memory (src/minigames/memory.js) as a disk-loaded overlay at $4000.
; All badges show for a moment, then turn face down; flip two at a time and match the colleague pairs.
; Score = pairs found / pairs × turn efficiency: past ceil(1.6 × pairs) turns every extra turn costs
; 1 / (2.5 × pairs), down to × 0.3.
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   pairs (grid)   6 (4×3), 8 (4×4), 10 (5×4), 12 (6×4) for round(3d) = 0..3
;   memorise       2.5 - 1.7d s              2.5 s      0.8 s
;   time limit     min(85, pairs × (6 - 1.4d) + 10) s   46 s (6 pairs)   65 s (12 pairs)
; A badge: the role (by department, X at init) in its top edge, hair + face, the name. On the 6-column grid the
; badges are 6 wide, so the 7-letter roles (Courier, Recruit, Payroll) are left out there.

.include "api.inc"

MAX_PAIRS = 12
MAX_CARDS = MAX_PAIRS * 2
CARD_H    = 5
HIDE_T    = 40                  ; 0.8 s before a wrong pair turns back
EFF_MIN   = 77                  ; 0.3 × 255
.if .defined(AUTOPLAY)
BOT_EVERY = 16                  ; the bot flips a badge every 16 frames
.endif

.zeropage
diff:     .res 1
dept:     .res 1
pairs:    .res 1
ncards:   .res 1
cols:     .res 1
cw:       .res 1                ; badge width
layout:   .res 1                ; 0..3
cursor:   .res 1
open_cnt: .res 1
open:     .res 2
turns:    .res 1
found:    .res 1
peek:     .res 1
hide_t:   .res 1
done:     .res 1
cx:       .res 1                ; card position while drawing
cy:       .res 1
ci:       .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
right:    .res 1
bottom:   .res 1
ysave:    .res 1
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; A = difficulty, X = department
init:
        sta diff
        cpx #8
        bcc :+
        ldx #0
:       stx dept
        ; layout = round(3d): 1 from D 43, 2 from 128, 3 from 213
        ldx #0
:       lda diff
        cmp lay_step,x
        bcc :+
        inx
        cpx #3
        bne :-
:       stx layout
        lda lay_pairs,x
        sta pairs
        asl
        sta ncards
        lda lay_cols,x
        sta cols
        lda lay_cw,x
        sta cw
        ; memorise: 125 - 85d frames
        lda diff
        ldy #85
        jsr mulr
        eor #$ff
        sec
        adc #125
        sta peek
        lda #0
        sta cursor
        sta open_cnt
        sta turns
        sta found
        sta hide_t
        sta done
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; badge positions, row by row
        ldy layout
        lda lay_y0,y
        sta cy
        lda lay_x0,y
        sta cx
        lda #0
        sta t0                  ; column
        tax                     ; card
@pos:   lda cx
        sta card_x,x
        lda cy
        sta card_y,x
        inc t0
        lda t0
        cmp cols
        bne @same
        lda #0                  ; next row
        sta t0
        lda lay_x0,y
        sta cx
        lda cy
        clc
        adc lay_py,y
        sta cy
        bne @nx
@same:  lda cx
        clc
        adc lay_px,y
        sta cx
@nx:    inx
        cpx ncards
        bne @pos
        ; pick the pairs' names: partial Fisher-Yates over the 26 names
        ldx #NAMES-1
:       txa
        sta name_pool,x
        dex
        bpl :-
        ldx #0
@pick:  stx t0
        lda #NAMES
        sec
        sbc t0                  ; remaining
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda name_pool,y         ; swap pool[i] and pool[j]
        pha
        lda name_pool,x
        sta name_pool,y
        pla
        sta name_pool,x
        sta person_name,x
        jsr API_RAND
        and #7
        tay
        lda hair_tab,y
        ldx t0
        sta person_hair,x
        inx
        cpx pairs
        bne @pick
        ; deal: two of each, then shuffle
        ldx #0
:       txa
        lsr
        sta cards,x
        lda #0
        sta state,x
        inx
        cpx ncards
        bne :-
        ldx ncards
        dex
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda cards,x
        pha
        lda cards,y
        sta cards,x
        pla
        sta cards,y
        dex
        bne @shuf
        ; screen: the clock is full while you memorise
        text 1, 0, s_name, 7
        jsr draw_counts
        jsr time_limit
        jsr timer_start
        jsr draw_all
        lda #<s_memorize
        ldx #>s_memorize
        jsr footer
        jmp draw_peek

; A/X = frames: min(85 s, pairs × (300 - 70d) + 500)
time_limit:
        lda diff
        ldy #70
        jsr mulr
        eor #$ff
        sec
        adc #<300               ; 300 - 70d (230..300)
        sta t0
        lda #>300
        sbc #0
        sta t1
        lda #<500
        sta t2
        lda #>500
        sta t3
        ldx pairs
:       lda t2
        clc
        adc t0
        sta t2
        lda t3
        adc t1
        sta t3
        dex
        bne :-
        lda t3                  ; (never above 85 s with these curves, but keep the cap)
        cmp #>4250
        bcc @ok
        bne @cap
        lda t2
        cmp #<4250
        bcc @ok
@cap:   lda #<4250
        ldx #>4250
        rts
@ok:    lda t2
        ldx t3
        rts

; A × Y -> A = round(A × Y / 256)
mulr:   jsr mul8
        ldx m_lo
        cpx #$80
        adc #0
        rts

; A × Y -> A = high byte, m_lo = low byte (X = 0)
mul8:   sta m_a
        sty m_b
        lda #0
        ldx #8
@l:     lsr m_a
        bcc :+
        clc
        adc m_b
:       ror
        ror m_lo
        dex
        bne @l
        rts

; "Memorize! N" while the badges show (N = seconds left, rounded up)
draw_peek:
        lda peek
        ldx #'0'
:       inx
        sec
        sbc #50
        beq :+
        bcs :-
:       txa
        ldx #(40 - 11) / 2 + 10
        ldy #24
        jmp API_PUTC

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda peek
        beq @play
        dec peek
        beq :+
        lda #7
        sta COLOR
        jsr draw_peek
        clc
        rts
:       jsr draw_all            ; peek over: everything turns face down
        lda #<s_play
        ldx #>s_play
        jsr footer
        clc
        rts
@play:  jsr timer_tick
        bcc :+
        jmp finish
:       lda hide_t
        beq :+
        dec hide_t
        bne :+
        jsr hide_open
:       ; cursor movement
        lda cursor
        sta t2
.ifdef AUTOPLAY
        jsr bot
        bcc :+
        jmp @moved
:
.endif
        lda JOYP
        and #J_RIGHT
        beq :+
        ldx cursor
        inx
        cpx ncards
        bcc @setc
        ldx #0
        beq @setc
:       lda JOYP
        and #J_LEFT
        beq :+
        ldx cursor
        dex
        bpl @setc
        ldx ncards
        dex
        jmp @setc
:       lda JOYP
        and #J_DOWN
        beq :+
        lda cursor
        clc
        adc cols
        cmp ncards
        bcc @seta
        sbc ncards
        jmp @seta
:       lda JOYP
        and #J_UP
        beq @fire
        lda cursor
        sec
        sbc cols
        bcs @seta
        adc ncards
@seta:  tax
@setc:  stx cursor
@moved:
        lda t2
        jsr draw_card
        lda cursor
        jsr draw_card
@fire:  lda JOYP
        and #J_FIRE
        beq :+
        ldx cursor
        jsr flip
:       lda done
        beq :+
        sec
        rts
:       clc
        rts

.ifdef AUTOPLAY
; Perfect player (test builds): every BOT_EVERY frames point the cursor at the right badge and press fire.
; C=1 when it moved the cursor (JOYP fire is set).
bot:    lda #0
        sta JOYP
        lda hide_t
        bne @no
        inc bot_t
        lda bot_t
        cmp #BOT_EVERY
        bne @no
        lda #0
        sta bot_t
        lda open_cnt
        beq @first
        ldx open                ; find the partner of the open badge
        lda cards,x
        sta t3
        ldy #0
:       cpy open
        beq @skip
        lda cards,y
        cmp t3
        beq @hit
@skip:  iny
        cpy ncards
        bne :-
        beq @no
@first: ldy #0
:       lda state,y
        beq @hit
        iny
        cpy ncards
        bne :-
@no:    clc
        rts
@hit:   lda #J_FIRE
        sta JOYP
        ldx cursor
        stx t2
        sty cursor
        sec
        rts
.endif

; X = card
flip:
        lda state,x
        bne @out
        lda open_cnt
        cmp #2
        bne :+
        stx t3
        jsr hide_open
        ldx t3
:       lda #1
        sta state,x
        ldy open_cnt
        txa
        sta open,y
        inc open_cnt
        jsr draw_card
        lda #SFX_BLIP
        jsr API_SFX
        lda open_cnt
        cmp #2
        bne @out
        inc turns
        ldx open
        ldy open+1
        lda cards,x
        cmp cards,y
        bne @miss
        lda #2
        sta state,x
        sta state,y
        lda #0
        sta open_cnt
        inc found
        txa
        jsr draw_card
        lda open+1
        jsr draw_card
        lda #SFX_GOOD
        jsr API_SFX
        jsr draw_counts
        lda found
        cmp pairs
        bne @out
        jmp finish
@miss:  lda #HIDE_T
        sta hide_t
        lda #SFX_BAD
        jsr API_SFX
        jmp draw_counts
@out:   rts

hide_open:
        lda open_cnt
        beq @done
        ldx open
        lda #0
        sta state,x
        txa
        jsr draw_card
        lda open_cnt
        cmp #2
        bne @done
        ldx open+1
        lda #0
        sta state,x
        txa
        jsr draw_card
@done:  lda #0
        sta open_cnt
        sta hide_t
        rts

; score = found × 255 / pairs × eff, eff = max(77, 255 - extra × 102 / pairs) / 256, extra = turns past
; ceil(1.6 × pairs)
finish:
        ldx layout
        lda turns
        sec
        sbc lay_allow,x
        bcs :+
        lda #0
:       cmp #31                 ; (30 extra turns already floor the efficiency)
        bcc :+
        lda #31
:       ldy #102
        jsr mul8                ; A:m_lo = extra × 102
        jsr div_pairs           ; / pairs
        eor #$ff
        sec
        adc #255
        bcc @floor              ; (more than 255: below zero)
        cmp #EFF_MIN
        bcs :+
@floor: lda #EFF_MIN
:       sta t3
        lda found
        ldy #255
        jsr mul8
        jsr div_pairs           ; base = found × 255 / pairs
        ldy t3
        jsr mulr
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; A:m_lo / pairs -> A (quotient must fit 8 bits; else 255)
div_pairs:
        cmp pairs
        bcc :+
        lda #255
        rts
:       ldx #8
@div:   asl m_lo
        rol
        bcs @sub
        cmp pairs
        bcc :+
@sub:   sbc pairs
        inc m_lo
:       dex
        bne @div
        lda m_lo
        rts

draw_all:
        lda #0
        sta ci
:       lda ci
        jsr draw_card
        inc ci
        lda ci
        cmp ncards
        bne :-
        rts

; A = card index
draw_card:
        sta ci
        tax
        lda card_x,x
        sta cx
        lda card_y,x
        sta cy
        ; frame colour: cursor yellow, matched green, face up white, face down blue; all white while memorising
        lda #7
        ldy peek
        bne :+
        cpx cursor
        beq @col
:       lda state,x
        tay
        lda frame_col,y
        ldy peek
        beq @col
        lda #1
@col:   sta COLOR
        lda cx
        clc
        adc cw
        sta right
        dec right
        lda cy
        clc
        adc #CARD_H-1
        sta bottom
        ldx cx
        ldy cy
        lda #CH_TL
        jsr putc
        ldx right
        lda #CH_TR
        jsr putc
        ldx right
        ldy bottom
        lda #CH_BR
        jsr putc
        ldx cx
        lda #CH_BL
        jsr putc
        ldx cw
        dex
        dex
        stx FILL_W
        lda #1
        sta FILL_H
        ldx cx
        inx
        lda #CH_B
        jsr fill
        ldx cx
        inx
        ldy cy
        lda #CH_T
        jsr fill
        lda #1
        sta FILL_W
        lda #CARD_H-2
        sta FILL_H
        iny
        ldx cx
        lda #CH_L
        jsr fill
        ldx right
        lda #CH_R
        jsr fill
        ; interior
        ldx cw
        dex
        dex
        stx FILL_W
        lda #CARD_H-2
        sta FILL_H
        ldx ci
        lda state,x
        ora peek
        ldx cx
        inx
        ldy cy
        iny
        cmp #0
        bne @face
        lda #6
        sta COLOR
        lda #CH_CHECKER
        jsr fill
        lda #3
        sta COLOR
        lda #<s_id
        sta PTR
        lda #>s_id
        sta PTR+1
        lda cy
        clc
        adc #2
        jmp print_in_card
@face:  lda #0
        sta COLOR
        lda #' '
        jsr fill
        ; person: hair + face in the middle of the badge
        ldx ci
        lda cards,x
        sta t0                  ; person
        tax
        lda person_hair,x
        sta COLOR
        lda cw
        lsr
        clc
        adc cx
        sta t2
        dec t2                  ; cx + cw / 2 - 1
        ldx t2
        ldy cy
        iny
        lda #CH_HAIRL
        jsr putc
        ldx t2
        inx
        lda #CH_HAIRR
        jsr putc
        lda #7
        sta COLOR
        iny
        ldx t2
        inx
        lda #CH_FACER
        jsr putc
        ldx t2
        lda #CH_FACEL
        jsr putc
        ; name (white, green when matched)
        ldx ci
        lda #1
        ldy state,x
        cpy #2
        bne :+
        lda #5
:       sta COLOR
        ldx t0
        lda person_name,x
        asl
        asl
        adc person_name,x       ; × 5
        adc #<names
        sta PTR
        lda #>names
        adc #0
        sta PTR+1
        lda cy
        clc
        adc #3
        jsr print_in_card
        ; role in the top edge: roles[dept][person % 4], if it fits the badge
        lda dept
        asl
        asl
        sta t1
        lda t0
        and #3
        ora t1
        asl
        asl
        asl                     ; × 8
        adc #<roles
        sta PTR
        lda #>roles
        adc #0
        sta PTR+1
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       cpy cw
        beq :+
        bcc :+
        rts
:       lda #3
        sta COLOR
        lda cy
        ; fall through

; A = row: print PTR centred inside the current card.
print_in_card:
        tay
        sty t1
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc cw
        lsr
        clc
        adc cx
        tax
        ldy t1
        jmp API_PRINT

; "Pairs f/p  Turns t" at the right of the title row
draw_counts:
        lda #21
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #19
        ldy #0
        lda #' '
        jsr API_FILL
        lda #1
        sta COLOR
        lda #<s_pairs
        sta PTR
        lda #>s_pairs
        sta PTR+1
        ldx #19
        ldy #0
        jsr API_PRINT
        ldx #25
        ldy #0
        lda found
        jsr API_NUM
        ldx #26
        lda found
        cmp #10
        bcc :+
        inx
:       stx t0
        lda #'/'
        ldy #0
        jsr API_PUTC
        ldx t0
        inx
        ldy #0
        lda pairs
        jsr API_NUM
        lda #<s_turns
        sta PTR
        lda #>s_turns
        sta PTR+1
        ldx #32
        ldy #0
        jsr API_PRINT
        ldx #38
        ldy #0
        lda turns
        cmp #100
        bcc :+
        lda #99
:       jmp API_NUM

; API calls that keep Y.
putc:   sty ysave
        jsr API_PUTC
        ldy ysave
        rts
fill:   sty ysave
        jsr API_FILL
        ldy ysave
        rts

.rodata
s_name:     .byte "Name Badge Memory", 0
s_help:     .byte "Flip two badges at a time. Match pairs!", 0
s_memorize: .byte "Memorize!  ", 0
s_play:     .byte "Joystick + FIRE to flip", 0
s_pairs:    .byte "Pairs", 0
s_turns:    .byte "Turns", 0
s_id:       .byte "ID", 0
frame_col:  .byte 6, 1, 5       ; face down, face up, matched
hair_tab:   .byte 2, 7, 1, 4, 3, 5, 2, 1
; layouts for round(3d) = 0..3
lay_step:   .byte 43, 128, 213
lay_pairs:  .byte 6, 8, 10, 12
lay_allow:  .byte 10, 13, 16, 20 ; ceil(1.6 × pairs)
lay_cols:   .byte 4, 4, 5, 6
lay_cw:     .byte 9, 9, 7, 6    ; badge width
lay_px:     .byte 10, 10, 8, 6  ; column pitch
lay_x0:     .byte 1, 1, 1, 2
lay_py:     .byte 6, 5, 5, 5    ; row pitch (3 rows: rows 4, 10, 16; 4 rows: 3, 8, 13, 18)
lay_y0:     .byte 4, 3, 3, 3

; From src/minigames/memory.js (NAMES, ROLES). 5 bytes per name, 8 per role.
NAMES = 26
names:
        .byte "Ada",0,0,  "Bob",0,0,  "Cleo",0, "Dev",0,0,  "Eve",0,0,  "Finn",0, "Gus",0,0,  "Hana",0
        .byte "Ivo",0,0,  "Jade",0,   "Kai",0,0,  "Lena",0, "Milo",0, "Nia",0,0,  "Otto",0, "Pia",0,0
        .byte "Quin",0,   "Rosa",0,   "Stan",0,   "Tess",0, "Umar",0, "Vera",0,   "Walt",0, "Xena",0
        .byte "Yuri",0,   "Zoe",0,0
.macro role s
        .byte s
        .res 8 - .strlen(s), 0
.endmacro
roles:
        role "Porter"
        role "Courier"
        role "Guest"
        role "Guard"
        role "Agent"
        role "Lead"
        role "Coach"
        role "Caller"
        role "AE"
        role "SDR"
        role "Client"
        role "VP"
        role "Brand"
        role "Copy"
        role "Social"
        role "SEO"
        role "Dev"
        role "Ops"
        role "QA"
        role "SRE"
        role "Audit"
        role "Tax"
        role "AP"
        role "FP&A"
        role "HR"
        role "Legal"
        role "Recruit"
        role "Payroll"
        role "CEO"
        role "CFO"
        role "COO"
        role "Board"

.bss
name_pool:   .res NAMES
person_name: .res MAX_PAIRS
person_hair: .res MAX_PAIRS
cards:       .res MAX_CARDS
state:       .res MAX_CARDS         ; 0 down, 1 up, 2 matched
card_x:      .res MAX_CARDS
card_y:      .res MAX_CARDS
