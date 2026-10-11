; Name Badge Memory (src/minigames/memory.js) as a disk-loaded overlay at $4000.
; 6 pairs on a 4 × 3 grid. Flip two badges at a time; the score is pairs found × turn efficiency.

.include "api.inc"

PAIRS    = 6
CARDS    = PAIRS * 2
COLS     = 4
CARD_W   = 9
CARD_H   = 6
TOTAL    = 46 * 50              ; frames: min(85, pairs * 6 + 10) seconds at difficulty 0
BAR_W    = 38
BAR_STEP = 60                   ; frames per timer-bar cell (TOTAL / BAR_W)
HIDE_T   = 40                   ; 0.8 s before a wrong pair turns back
ALLOWED  = 10                   ; ceil(pairs * 1.6) turns before the score drops

.zeropage
cursor:   .res 1
open_cnt: .res 1
open:     .res 2
turns:    .res 1
found:    .res 1
peek:     .res 1
hide_t:   .res 1
elapsed:  .res 2
bar_len:  .res 1
bar_acc:  .res 1
done:     .res 1
dept:     .res 1
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

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

; A = difficulty, X = department
init:
        stx dept
        lsr                     ; peek: 2.5 s at difficulty 0, ~1.2 s at the top
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
        sta elapsed
        sta elapsed+1
        sta done
        lda #BAR_W
        sta bar_len
        lda #BAR_STEP
        sta bar_acc
        ; pick PAIRS distinct names: partial Fisher-Yates over 0..25
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
        jsr rand_mod
        clc
        adc t0
        tay
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
        cpx #PAIRS
        bne @pick
        ; deal: two of each, then shuffle
        ldx #0
:       txa
        lsr
        sta cards,x
        lda #0
        sta state,x
        inx
        cpx #CARDS
        bne :-
        ldx #CARDS-1
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr rand_mod
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
        ; screen
        lda #7
        sta COLOR
        ldx #1
        ldy #0
        lda #<s_name
        sta PTR
        lda #>s_name
        sta PTR+1
        jsr API_PRINT
        jsr draw_counts
        lda #5
        sta COLOR
        lda #BAR_W
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #1
        ldy #1
        lda #CH_BLOCK
        jsr API_FILL
        jsr draw_all
        lda #<s_memorize
        ldx #>s_memorize
        jmp footer

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda peek
        beq @play
        dec peek
        bne @wait
        jsr draw_all            ; peek over: everything turns face down
        lda #<s_play
        ldx #>s_play
        jsr footer
@wait:  clc
        rts
@play:  inc elapsed
        bne :+
        inc elapsed+1
:       dec bar_acc
        bne :+
        lda #BAR_STEP
        sta bar_acc
        lda bar_len
        beq :+
        dec bar_len
        ldx bar_len
        inx
        ldy #1
        lda #0
        sta COLOR
        lda #' '
        jsr API_PUTC
:       lda elapsed+1
        cmp #>TOTAL
        bcc :+
        lda elapsed
        cmp #<TOTAL
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
        cpx #CARDS
        bcc @setc
        ldx #0
        beq @setc
:       lda JOYP
        and #J_LEFT
        beq :+
        ldx cursor
        dex
        bpl @setc
        ldx #CARDS-1
        bne @setc
:       lda JOYP
        and #J_DOWN
        beq :+
        lda cursor
        clc
        adc #COLS
        cmp #CARDS
        bcc @seta
        sbc #CARDS
        jmp @seta
:       lda JOYP
        and #J_UP
        beq @fire
        lda cursor
        sec
        sbc #COLS
        bcs @seta
        adc #CARDS
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
; Perfect player (test builds): every 12 frames point the cursor at the right badge and press fire.
; C=1 when it moved the cursor (JOYP fire is set).
bot:    lda #0
        sta JOYP
        lda hide_t
        bne @no
        lda elapsed
        and #15
        cmp #8
        bne @no
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
        cpy #CARDS
        bne :-
        beq @no
@first: ldy #0
:       lda state,y
        beq @hit
        iny
        cpy #CARDS
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
        cmp #PAIRS
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

; score = base[found] × max(77, 255 - 17 × max(0, turns - ALLOWED)) / 256
finish:
        lda turns
        sec
        sbc #ALLOWED
        bcs :+
        lda #0
:       cmp #11
        bcc :+
        lda #11
:       sta t0
        asl
        asl
        asl
        asl
        adc t0                  ; × 17
        eor #$ff
        sec
        adc #255                ; 255 - 17 × extra
        cmp #77
        bcs :+
        lda #77
:       sta t0
        ldx found
        lda base_tab,x
        sta t1
        ; t1 × t0 -> high byte in A
        lda #0
        ldx #8
@mul:   lsr t1
        bcc :+
        clc
        adc t0
:       ror
        ror t2
        dex
        bne @mul
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; A = n (1..255) -> A = random 0..n-1
rand_mod:
        sta t1
        jsr API_RAND
:       cmp t1
        bcc :+
        sbc t1
        jmp :-
:       rts

draw_all:
        lda #0
        sta ci
:       lda ci
        jsr draw_card
        inc ci
        lda ci
        cmp #CARDS
        bne :-
        rts

; A = card index
draw_card:
        sta ci
        pha
        and #COLS-1
        tax
        lda col_x,x
        sta cx
        pla
        lsr
        lsr
        tax
        lda row_y,x
        sta cy
        ; frame colour: cursor yellow, matched green, face up white, face down blue
        ldx ci
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
        adc #CARD_W-1
        sta right
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
        ldy bottom
        lda #CH_BR
        jsr putc
        ldx cx
        lda #CH_BL
        jsr putc
        lda #CARD_W-2
        sta FILL_W
        lda #1
        sta FILL_H
        inx
        lda #CH_B
        jsr fill
        ldy cy
        lda #CH_T
        jsr fill
        lda #1
        sta FILL_W
        lda #CARD_H-2
        sta FILL_H
        iny
        dex
        lda #CH_L
        jsr fill
        ldx right
        lda #CH_R
        jsr fill
        ; interior
        lda #CARD_W-2
        sta FILL_W
        lda #CARD_H-2
        sta FILL_H
        ldx cx
        inx
        ldy cy
        iny
        lda ci
        tax
        lda state,x
        ora peek
        ldx cx
        inx
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
        sta t0                  ; person 0..5
        tax
        lda person_hair,x
        sta COLOR
        lda cx
        clc
        adc #3
        tax
        ldy cy
        iny
        lda #CH_HAIRL
        jsr putc
        inx
        lda #CH_HAIRR
        jsr putc
        lda #7
        sta COLOR
        iny
        lda #CH_FACER
        jsr putc
        dex
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
        ; role: roles[dept][person % 4]
        lda #3
        sta COLOR
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
        lda cy
        clc
        adc #4
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
        adc #CARD_W
        lsr
        clc
        adc cx
        tax
        ldy t1
        jmp API_PRINT

draw_counts:
        lda #1
        sta COLOR
        ldx #22
        ldy #0
        lda #<s_pairs
        sta PTR
        lda #>s_pairs
        sta PTR+1
        jsr API_PRINT
        ldx #28
        ldy #0
        lda found
        jsr API_NUM
        ldx #32
        ldy #0
        lda #<s_turns
        sta PTR
        lda #>s_turns
        sta PTR+1
        jsr API_PRINT
        ldx #38
        ldy #0
        lda turns
        jmp API_NUM

; API calls that keep X and Y.
putc:   sty ysave
        jsr API_PUTC
        ldy ysave
        rts
fill:   sty ysave
        jsr API_FILL
        ldy ysave
        rts

; A/X = string: centred on the bottom row.
footer:
        sta PTR
        stx PTR+1
        lda #0
        sta COLOR
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #0
        ldy #24
        lda #' '
        jsr API_FILL
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        eor #$ff
        sec
        adc #40
        lsr
        tax
        lda #7
        sta COLOR
        ldy #24
        jmp API_PRINT

.rodata
s_name:     .byte "Name Badge Memory", 0
s_help:     .byte "Flip two badges at a time. Match pairs!", 0
s_memorize: .byte "Memorize!", 0
s_play:     .byte "Joystick or keys + FIRE to flip", 0
s_pairs:    .byte "Pairs  /6", 0
s_turns:    .byte "Turns   ", 0
s_id:       .byte "ID", 0
col_x:      .byte 1, 11, 21, 31
row_y:      .byte 3, 10, 17
frame_col:  .byte 6, 1, 5       ; face down, face up, matched
hair_tab:   .byte 2, 7, 1, 4, 3, 5, 2, 1
base_tab:   .byte 0, 42, 85, 127, 170, 212, 255

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
person_name: .res PAIRS
person_hair: .res PAIRS
cards:       .res CARDS
state:       .res CARDS             ; 0 down, 1 up, 2 matched
