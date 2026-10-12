; Elevator Pitch (src/minigames/pitch.js) as a disk-loaded overlay at $4000.
; Alone in the elevator with the CEO: stop four slot-machine reels ([Opener] [Buzz verb] [Thing] [Audience]) on
; the words the CEO will love. The rumour gives the CEO's mood of the moment; words of that category get +5
; appeal. Difficulty 0 (floors 1-2): 3 pitches, ~2 words a second, a reel stops by itself after 5.5 s ("Uhh...",
; the word counts half), FIRE in the first 0.3 s of a reel is "too eager" (also half), and a press up to 0.3
; words after a word left the payline still takes it. Pitch = ((got - worst) / (best - worst)) ^ 1.3, the score
; is the average of the three. Content, score curve and sprites: src/data/mg-pitch.js (gen/mg_pitch_data.s).

.include "api.inc"
.include "gen/chars.inc"

PITCHES   = 3
REELS     = 4
PER_REEL  = 8                   ; words on a reel; pos is 16 bits = 8 words of 8192
EAGER_T   = 15                  ; 0.3 s
INTRO_T   = 110                 ; 2.2 s before the first pitch, 1.4 s before the others
INTRO2_T  = 70
REPLY_T   = 160                 ; 3.2 s, FIRE after 0.7 s
REPLY_SKIP = 36
ARRIVE_T  = 130                 ; 2.6 s, FIRE after 0.9 s
ARRIVE_SKIP = 46
REACT_T   = 55                  ; 1.1 s
VERDICT_T = 175                 ; 3.5 s
FLOAT_T   = 50
FLOOR_STEP = 6                  ; frames per floor on the indicator

PH_INTRO  = 0
PH_SPIN   = 1
PH_REPLY  = 2
PH_ARRIVE = 3

FL_AUTO   = 1                   ; reel flags: stopped by itself / pressed too early
FL_EAGER  = 2

EX_NEUTRAL = 0                  ; CEO faces = sprite frames 141-144
EX_DELIGHT = 1
EX_BORED  = 2
EX_ANNOYED = 3

SPR_PTR   = ($e300 - $c000) / 64
SPR_Y     = 50 + 11 * 8 - 42    ; feet on the elevator floor (row 11), Y-expanded
YOU_X     = 24 + 17 * 8
CEO_X     = 24 + 20 * 8

PLAQUE_X  = 0                   ; impression plaque: cols 0-15, rows 5-9
BUBBLE_X  = 24                  ; speech bubble: cols 24-39, rows 5-10 (inside 25-38 × 6-9)
IND_X     = 17                  ; floor indicator above the door, row 4
LINE_Y    = 22                  ; the pitch so far, rows 22-23

.zeropage
zp_start:
phase:    .res 1
phase_t:  .res 1                ; frames in this phase (stops at 255)
p:        .res 1                ; pitch 0-2
cur:      .res 1                ; reel being stopped
rt:       .res 1                ; frames since this reel started (stops at 255)
anim:     .res 1
mood:     .res 1                ; category 0-5
rum_idx:  .res 1
rum_flash: .res 1
expr:     .res 1
react_t:  .res 1
float_t:  .res 1
border_t: .res 1
imp:      .res 1                ; CEO impression shown, eases to imp_tgt
imp_tgt:  .res 1
imp_shown: .res 1
fl_val:   .res 1                ; floor on the indicator
fl_t:     .res 1
z_shown:  .res 1
nres:     .res 1
done:     .res 1
zp_end:
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
sp:       .res 2
d_num:    .res 2
d_den:    .res 1
m_b:      .res 1
say:      .res 2                ; bubble text (0 = empty)
say_col:  .res 1
rum_col:  .res 1
bx:       .res 1
auto_t:   .res 2                ; frames before a reel stops by itself
grace:    .res 2                ; reaction grace in pos units
spd:      .res 2                ; base reel speed in pos units per frame
bored_t:  .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- setup

init:
        ldx #zp_end - zp_start - 1
        lda #0
:       sta zp_start,x
        dex
        bpl :-
        sta say+1
        ; timings from the difficulty (byDiff at d = MG_DIFF / 255)
        lda MG_DIFF
        lsr
        sta t1
        lda #<275               ; auto stop: 5.5 s - 2.3 s × d
        sec
        sbc t1
        sta auto_t
        lda #>275
        sbc #0
        sta auto_t+1
        lsr t1
        lda #165                ; the CEO gets bored after 60 % of it
        sec
        sbc t1
        sta bored_t
        lda MG_DIFF             ; grace: 0.3 - 0.05 d words (1.5 × d of 8192 per word ~ 0.047 d)
        lsr
        clc
        adc MG_DIFF
        sta t1
        lda #0
        rol
        sta t2
        lda #<2458
        sec
        sbc t1
        sta grace
        lda #>2458
        sbc t2
        sta grace+1
        lda MG_DIFF             ; speed: 2.0 + 1.6 d words a second (328 + 262 d per frame) × 0.9-1.12
        clc
        adc #<295
        sta spd
        lda #>295
        adc #0
        sta spd+1
        lda #128
        sta imp
        sta imp_tgt
        lda #$ff
        sta imp_shown
        ; sprites to $e300: you, the CEO's four faces, his hair and collar
        ldx #0
:       lda sprite_data,x
        sta $e300,x
        lda sprite_data+128,x
        sta $e380,x
        lda sprite_data+256,x
        sta $e400,x
        inx
        bpl :-
        ; the CEO's three moods: 3 of the 6 categories
        ldx #5
:       txa
        sta moods,x
        dex
        bpl :-
        lda #0
        sta t0
@mood:  lda #6
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda moods,y
        pha
        lda moods,x
        sta moods,y
        pla
        sta moods,x
        inc t0
        lda t0
        cmp #PITCHES
        bne @mood
        ; floors: three climbs of 10-12 that end at 40
        lda #2
        sta t0
:       lda #3
        jsr API_RMOD
        clc
        adc #10
        ldx t0
        sta climbs,x
        dec t0
        bpl :-
        lda #40
        sec
        sbc climbs
        sbc climbs+1
        sbc climbs+2
        sta floors
        ldx #0
:       lda floors,x
        clc
        adc climbs,x
        sta floors+1,x
        inx
        cpx #PITCHES
        bne :-
        lda floors
        sta fl_val
        lda #$ff
        sta z_shown
        jsr draw_scene
        jsr draw_indicator
        jsr sprites_on
        lda #<intro
        sta say
        lda #>intro
        sta say+1
        lda #1
        sta say_col
        jsr draw_bubble
        jmp start_pitch

sprites_on:
        lda #%111               ; 0 = the CEO's hair/collar (on top), 1 = the CEO, 2 = you; all multicolour
        sta $d015               ; as the host keeps them ($d01c = $ff)
        sta $d017               ; Y-expanded
        lda #0
        sta $d01d
        sta $d01b
        sta $d010
        sta $d025               ; outline black
        lda #10
        sta $d026               ; skin
        lda #15
        sta $d027               ; light grey hair, white collar
        lda #2
        sta $d028               ; the CEO's red tie (his suit is the outline colour)
        lda #14
        sta $d029               ; your blue shirt
        lda #CEO_X
        sta $d000
        sta $d002
        lda #YOU_X
        sta $d004
        lda #SPR_Y
        sta $d001
        sta $d003
        sta $d005
        lda #SPR_PTR + 5
        sta SCREEN + $3f8
        lda #SPR_PTR
        sta SCREEN + $3fa
        ; fall through
set_face:
        lda expr
        clc
        adc #SPR_PTR + 1
        sta SCREEN + $3f9
        rts

; New pitch p: mood, rumour, reels.
start_pitch:
        ldx p
        lda moods,x
        sta mood
        asl
        adc mood                ; × R_PER rumours
        sta t0
        lda #R_PER
        jsr API_RMOD
        clc
        adc t0
        sta rum_idx
        lda #40                 ; the sticky note flashes for 0.8 s
        sta rum_flash
        lda #7
        sta rum_col
        jsr draw_rumour
        lda #REELS-1
        sta br_reel
:       jsr build_reel
        dec br_reel
        bpl :-
        lda #0
        sta cur
        sta phase_t
        lda #PH_INTRO
        sta phase
        jsr draw_reels
        jsr draw_counters
        jsr draw_line
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda auto_t              ; full bar until the first reel runs
        ldx auto_t+1
        jmp timer_start

; Reel br_reel: 1 mood word, 2 buzz, 1 boring (none when boring is the mood), the rest other categories; shuffled.
build_reel:
        lda br_reel
        asl
        asl
        asl
        sta br_dst
        sta br_n
        lda #0
        sta br_cls
@class: ldy br_reel             ; candidates: the slot's words of this class
        lda slot_first+1,y
        sta t1
        ldx slot_first,y
        ldy #0
@scan:  cpx t1
        beq @got
        jsr classify
        cmp br_cls
        bne :+
        txa
        sta cand,y
        iny
:       inx
        bne @scan
@got:   sty br_m
        ldx br_cls
        lda class_need,x
        cpx #3
        bcc :+
        lda br_dst              ; others fill the reel up
        clc
        adc #PER_REEL
        sec
        sbc br_n
:       cmp br_m
        bcc :+
        lda br_m
:       sta br_need
        lda #0                  ; partial Fisher-Yates: br_need of br_m
        sta br_j
@pick:  lda br_j
        cmp br_need
        bcs @next
        lda br_m
        sec
        sbc br_j
        jsr API_RMOD
        clc
        adc br_j
        tay
        ldx br_j
        lda cand,y
        pha
        lda cand,x
        sta cand,y
        pla
        sta cand,x
        ldy br_n
        sta r_word,y
        inc br_n
        inc br_j
        bne @pick
@next:  inc br_cls
        lda br_cls
        cmp #4
        beq :+
        jmp @class
:
        lda #PER_REEL-1         ; shuffle the reel
        sta br_j
@shuf:  lda br_j
        clc
        adc #1
        jsr API_RMOD
        clc
        adc br_dst
        tay
        lda br_j
        clc
        adc br_dst
        tax
        lda r_word,x
        pha
        lda r_word,y
        sta r_word,x
        pla
        sta r_word,y
        dec br_j
        bne @shuf
        ldx br_reel             ; appeal: base, +MOOD_BONUS for the mood's words; min and max
        lda #0
        sta r_max,x
        lda #$ff
        sta r_min,x
        lda #PER_REEL-1
        sta br_j
@val:   lda br_j
        clc
        adc br_dst
        tay
        ldx r_word,y
        lda w_cat,x
        cmp mood
        php
        lda w_base,x
        plp
        bne :+
        clc
        adc #MOOD_BONUS
:       sta r_val,y
        ldx br_reel
        cmp r_min,x
        bcs :+
        sta r_min,x
:       cmp r_max,x
        bcc :+
        sta r_max,x
:       dec br_j
        bpl @val
        jsr API_RAND            ; random start, speed × 0.9-1.12
        ldx br_reel
        sta r_plo,x
        jsr API_RAND
        ldx br_reel
        sta r_phi,x
        lda #73
        jsr API_RMOD
        ldx br_reel
        clc
        adc spd
        sta r_slo,x
        lda spd+1
        adc #0
        sta r_shi,x
        lda #$ff
        sta r_pick,x
        sta r_shown,x
        lda #0
        sta r_flag,x
        rts

; X = word: A = 0 mood, 1 buzz, 2 boring, 3 other (keeps X and Y).
classify:
        lda w_cat,x
        cmp mood
        beq @c0
        cmp #CAT_BUZZ
        beq @c1
        cmp #CAT_BORING
        beq @c2
        lda #3
        rts
@c0:    lda #0
        rts
@c1:    lda #1
        rts
@c2:    lda #2
        rts

; ---------------------------------------------------------------- drawing

draw_scene:
        text 1, 0, s_name, 7
        lda #8                  ; elevator wall (mid grey), floor (dark grey)
        sta COLOR
        lda #40
        sta FILL_W
        lda #6
        sta FILL_H
        ldx #0
        ldy #5
        lda #MC_B
        jsr API_FILL
        lda #1
        sta FILL_H
        ldx #0
        ldy #11
        lda #MC_A
        jsr API_FILL
        lda #8                  ; door: dark frame, light panels
        sta FILL_W
        lda #6
        sta FILL_H
        ldx #16
        ldy #5
        lda #MC_A
        jsr API_FILL
        lda #1 | 8
        sta COLOR
        lda #6
        sta FILL_W
        lda #5
        sta FILL_H
        ldx #17
        ldy #6
        lda #MC_C
        jsr API_FILL
        lda #16                 ; impression plaque
        sta FILL_W
        lda #5
        sta FILL_H
        ldx #PLAQUE_X
        ldy #5
        jsr panel
        text PLAQUE_X + 1, 7, s_impress, 3
        lda #16                 ; speech bubble with its tail towards the CEO
        sta FILL_W
        lda #6
        sta FILL_H
        ldx #BUBBLE_X
        ldy #5
        jsr panel
        lda #'<'
        ldx #BUBBLE_X
        ldy #8
        jmp API_PUTC

; X, Y, FILL_W × FILL_H: black inside, white frame.
panel:
        stx t0
        sty t1
        lda #7
        sta COLOR
        lda #' '
        jsr API_FILL
        lda #1
        sta COLOR
        ldx t0
        ldy t1
        jmp API_BOX

; "Pitch n/3" in the header, "PITCH n OF 3" on the plaque.
draw_counters:
        text 31, 0, s_pitch, 1
        ldx p
        inx
        txa
        ldx #37
        ldy #0
        jsr API_NUM
        text PLAQUE_X + 2, 6, s_pitchof, 7
        ldx p
        inx
        txa
        ldx #PLAQUE_X + 8
        ldy #6
        jmp API_NUM

; Rows 2-3: icon, the rumour in rum_col, "CEO likes" + icon.
draw_rumour:
        lda #2
        ldx #2
        jsr clear_rows
        ldx mood
        lda cat_col,x
        sta COLOR
        lda cat_char,x
        ldx #1
        ldy #2
        jsr API_PUTC
        ldx mood
        lda cat_char,x
        ldx #38
        ldy #3
        jsr API_PUTC
        text 28, 3, s_likes, 1
        ldx rum_idx
        lda rum_lo,x
        sta sp
        sta PTR
        lda rum_hi,x
        sta sp+1
        sta PTR+1
        lda rum_col
        sta COLOR
        ldx #3
        ldy #2
        jsr API_PRINT
        jsr sp_skip
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        ldx #3
        ldy #3
        jmp API_PRINT

; The CEO's line `say` (line count, then the lines), centred in the bubble in say_col. say = 0: empty.
draw_bubble:
        lda #14
        sta FILL_W
        lda #4
        sta FILL_H
        lda #7
        sta COLOR
        ldx #BUBBLE_X + 1
        ldy #6
        lda #' '
        jsr API_FILL
        lda say+1
        beq @done
        sta sp+1
        lda say
        sta sp
        ldy #0
        lda (sp),y
        sta t2                  ; lines
        lda #4
        sec
        sbc t2
        lsr
        clc
        adc #6
        sta t3                  ; first row
        inc sp
        bne @line
        inc sp+1
@line:  jsr strlen
        tya
        eor #$ff
        sec
        adc #14
        lsr
        clc
        adc #BUBBLE_X + 1
        tax
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda say_col
        sta COLOR
        ldy t3
        jsr API_PRINT
        jsr sp_skip
        inc t3
        dec t2
        bne @line
@done:  rts

; A/X = text, Y = colour: floating line on row 4 above the plaque for a second.
show_float:
        sta sp
        stx sp+1
        sty t3
        jsr clear_float
        jsr strlen
        tya
        eor #$ff
        sec
        adc #16
        lsr
        tax
        lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        lda t3
        sta COLOR
        ldy #4
        jsr API_PRINT
        lda #FLOAT_T
        sta float_t
        rts

clear_float:
        lda #16
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        ldx #0
        ldy #4
        lda #' '
        jmp API_FILL

; Impression bar on the plaque (row 8, 14 cells in half steps), redrawn when it changes.
draw_bar:
        lda imp
        ldx #7
        jsr mul8                ; halves = imp × 28 / 256
        lda d_num+1
        asl d_num
        rol
        asl d_num
        rol
        cmp imp_shown
        beq @done
        sta imp_shown
        sta t1
        ldx #2                  ; red under 35 %, yellow, green from 85 %
        lda imp
        cmp #89
        bcc :+
        ldx #7
        cmp #217
        bcc :+
        ldx #5
:       stx COLOR
        lda #PLAQUE_X + 1
        sta t0
@c:     lda #' '
        ldx t1
        beq @put
        lda #CH_HALF
        dex
        beq @put1
        dex
        lda #CH_BLOCK
@put1:  stx t1
@put:   ldx t0
        ldy #8
        jsr API_PUTC
        inc t0
        lda t0
        cmp #PLAQUE_X + 15
        bne @c
@done:  rts

; The floor indicator above the door: "^ 07", "PH 40" blinking once arrived.
draw_indicator:
        lda #6
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        ldx #IND_X
        ldy #4
        lda #' '
        jsr API_FILL
        lda phase
        cmp #PH_ARRIVE
        bne @floor
        ldx #7
        lda anim
        and #16
        beq :+
        ldx #2
:       stx COLOR
        lda #<s_ph40
        sta PTR
        lda #>s_ph40
        sta PTR+1
        ldx #IND_X + 1
        ldy #4
        jmp API_PRINT
@floor: lda #'^'
        ldx #IND_X + 1
        ldy #4
        jsr API_PUTC
        lda fl_val
        ldx #'0' - 1
:       inx
        sec
        sbc #10
        bcs :-
        adc #'0' + 10
        sta t0
        txa
        ldx #IND_X + 3
        ldy #4
        jsr API_PUTC
        lda t0
        ldx #IND_X + 4
        ldy #4
        jmp API_PUTC

; All four reels: frames and words.
draw_reels:
        lda #REELS-1
        sta dl_i
:       ldx dl_i
        jsr draw_frame
        ldx dl_i
        jsr draw_reel
        dec dl_i
        bpl :-
        rts

; X = reel: A = frame colour (yellow running, green stopped, blue waiting).
reel_col:
        lda phase
        cmp #PH_SPIN
        bne :+
        cpx cur
        bne :+
        lda #7
        rts
:       lda r_pick,x
        bmi :+
        lda #5
        rts
:       lda #6
        rts

; X = reel: box, label, uhh/eager mark, payline arrows.
draw_frame:
        stx dr_i
        jsr reel_col
        sta COLOR
        sta dr_col
        lda #20
        sta FILL_W
        lda #5
        sta FILL_H
        ldy dr_i
        ldx reel_x,y
        lda reel_y,y
        tay
        jsr API_BOX
        ldy dr_i
        lda slot_lo,y
        sta PTR
        lda slot_hi,y
        sta PTR+1
        lda reel_x,y
        clc
        adc #2
        tax
        lda reel_y,y
        tay
        jsr API_PRINT
        lda #2
        sta COLOR
        ldy dr_i
        lda r_flag,y
        beq @arrows
        lda r_flag,y
        and #FL_AUTO
        beq :+
        lda #<s_uhh
        sta PTR
        lda #>s_uhh
        sta PTR+1
        lda #14
        bne @mark
:       lda #<s_eager
        sta PTR
        lda #>s_eager
        sta PTR+1
        lda #12
@mark:  clc
        adc reel_x,y
        tax
        lda reel_y,y
        tay
        jsr API_PRINT
@arrows:
        lda #6
        ldy dr_i
        ldx dr_col
        cpx #7
        bne :+
        lda #2
:       sta COLOR
        lda reel_y,y
        clc
        adc #2
        sta t1
        lda reel_x,y
        sta t0
        tax
        inx
        ldy t1
        lda #CH_ARROW
        jsr API_PUTC
        lda t0
        clc
        adc #18
        tax
        ldy t1
        lda #'<'
        jmp API_PUTC

; X = reel: the payline word (the stopped one, or the one the reel shows now) with its neighbours.
draw_reel:
        stx dr_i
        lda r_pick,x
        bpl :+
        lda r_phi,x
        lsr
        lsr
        lsr
        lsr
        lsr
:       sta dr_k
        sta r_shown,x
        lda reel_y,x
        sta dw_row
        inc dw_row
        lda #6
        sta dw_col
        lda dr_k                ; above: the next word down
        clc
        adc #1
        jsr draw_word
        inc dw_row
        ldx dr_i
        lda #1
        ldy r_pick,x
        bmi :+
        lda #5
:       sta dw_col
        lda dr_k
        jsr draw_word
        inc dw_row
        lda #6
        sta dw_col
        lda dr_k
        sec
        sbc #1
        ; fall through

; A = word slot (mod 8) of reel dr_i on row dw_row in dw_col: icon + word.
draw_word:
        and #PER_REEL-1
        sta t0
        lda dr_i
        asl
        asl
        asl
        ora t0
        tay
        lda r_word,y
        sta dw_w
        ldy dr_i
        lda reel_x,y
        clc
        adc #2
        sta dw_x
        lda #16
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        ldx dw_x
        ldy dw_row
        lda #' '
        jsr API_FILL
        ldx dw_w
        lda w_cat,x
        tax
        lda cat_col,x
        sta COLOR
        lda cat_char,x
        ldx dw_x
        ldy dw_row
        jsr API_PUTC
        ldx dw_w
        lda w_lo,x
        sta PTR
        lda w_hi,x
        sta PTR+1
        lda dw_col
        sta COLOR
        ldx dw_x
        inx
        inx
        ldy dw_row
        jmp API_PRINT

; Rows 22-23: You: "Opener verb ... ___" (wrapped at a space).
draw_line:
        lda #0
        sta bx
        lda #<s_you
        ldx #>s_you
        jsr append
        lda #0
        sta dl_i
@w:     ldx dl_i
        lda r_pick,x
        bmi @none
        sta t0
        txa
        asl
        asl
        asl
        ora t0
        tay
        ldx r_word,y
        lda w_lo,x
        pha
        lda w_hi,x
        tax
        pla
        jmp @app
@none:  lda phase
        cmp #PH_SPIN
        bne @blank
        cpx cur
        bne @blank
        lda #<s_dots
        ldx #>s_dots
        bne @app
@blank: lda #<s_blank
        ldx #>s_blank
@app:   jsr append
        lda dl_i
        cmp #REELS-1
        beq :+
        lda #' '
        jsr append_c
:       inc dl_i
        lda dl_i
        cmp #REELS
        bne @w
        lda #'"'
        jsr append_c
        lda #0
        ldy bx
        sta linebuf,y
        lda #LINE_Y
        ldx #2
        jsr clear_rows
        lda #1
        sta COLOR
        lda #<linebuf
        sta PTR
        lda #>linebuf
        sta PTR+1
        ldy bx
        cpy #39
        bcc @one
        ldy #38                 ; break at the last space that fits
:       lda linebuf,y
        cmp #' '
        beq :+
        dey
        bne :-
:       lda #0
        sta linebuf,y
        sty t0
        ldx #1
        ldy #LINE_Y
        jsr API_PRINT
        lda t0
        sec                     ; + 1: past the space
        adc #<linebuf
        sta PTR
        lda #>linebuf
        adc #0
        sta PTR+1
        ldx #1
        ldy #LINE_Y + 1
        jmp API_PRINT
@one:   ldx #1
        ldy #LINE_Y
        jmp API_PRINT

; A/X = string appended to linebuf at bx.
append: sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        beq :+
        jsr append_c
        iny
        bne :-
:       rts

; A appended to linebuf (keeps Y).
append_c:
        sty t3
        ldy bx
        sta linebuf,y
        inc bx
        ldy t3
        rts

; ---------------------------------------------------------------- helpers

; Y = length of the string at sp.
strlen: ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       rts

; sp = past the 0 of the string at sp.
sp_skip:
        jsr strlen
        iny
        tya
        clc
        adc sp
        sta sp
        bcc :+
        inc sp+1
:       rts

; d_num = d_num / A (A = remainder).
div16:  sta d_den
        lda #0
        ldx #16
@l:     asl d_num
        rol d_num+1
        rol
        bcs @sub
        cmp d_den
        bcc @n
@sub:   sbc d_den
        inc d_num
@n:     dex
        bne @l
        rts

; d_num = A × X.
mul8:   sta t3
        stx m_b
        lda #0
        ldx #8
        lsr m_b
@l:     bcc :+
        clc
        adc t3
:       ror
        ror m_b
        dex
        bne @l
        sta d_num+1
        lda m_b
        sta d_num
        rts

; A = t0 × 255 / A (t0 <= A).
scale255:
        pha
        lda t0
        sta d_num+1
        lda #0
        sec
        sbc t0
        sta d_num
        bcs :+
        dec d_num+1
:       pla
        jsr div16
        lda d_num
        rts

; X = reel: A = the word a press would take now (a word that left the payline < grace ago still counts).
pick_index:
        lda r_plo,x
        sec
        sbc grace
        lda r_phi,x
        sbc grace+1
        lsr
        lsr
        lsr
        lsr
        lsr
        rts

; A = reaction band (0 high, 1 mid, 2 low, 3 stall): sp = a random line of it.
rand_react:
        tax
        lda react_first,x
        sta t0
        lda react_count,x
        jsr API_RMOD
        clc
        adc t0
        tax
        lda rea_lo,x
        sta sp
        lda rea_hi,x
        sta sp+1
        rts

; ---------------------------------------------------------------- frame

frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        lda phase_t
        cmp #255
        beq :+
        inc phase_t
:       jsr spin_reels
        jsr ease_imp
        jsr ease_floor
        jsr tick_timers
        jsr boredom
        jsr set_face
        lda phase
        asl
        tax
        lda ph_tab+1,x
        pha
        lda ph_tab,x
        pha
        rts

ph_tab: .word ph_intro-1, ph_spin-1, ph_reply-1, ph_arrive-1

ph_intro:
        ldx #INTRO_T
        lda p
        beq :+
        ldx #INTRO2_T
:       cpx phase_t
        beq :+
        bcs @wait
:       lda #PH_SPIN            ; the first reel runs
        sta phase
        lda #0
        sta phase_t
        sta cur
        sta say+1
        jsr draw_bubble
        jsr start_reel
        jsr draw_line
@wait:  clc
        rts

ph_spin:
        lda rt
        cmp #255
        beq :+
        inc rt
:       jsr timer_tick
        bcc :+
        lda #1                  ; too slow: the reel stops by itself
        jmp stop_reel
:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda JOYP
        and #J_FIRE
        beq @out
        lda rt
        cmp #EAGER_T
        bcs @stop
        ldx cur                 ; mashing: the CEO notices the fidgeting
        lda r_flag,x
        and #FL_EAGER
        bne @out
        lda r_flag,x
        ora #FL_EAGER
        sta r_flag,x
        jsr draw_frame
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_tooeager
        ldx #>s_tooeager
        ldy #7
        jsr show_float
@out:   clc
        rts
@stop:  lda #0
        jmp stop_reel

ph_reply:
        lda phase_t
        cmp #REPLY_T
        bcs @next
        cmp #REPLY_SKIP
        bcc @out
        lda JOYP
        and #J_FIRE
        beq @out
@next:  inc p
        lda p
        cmp #PITCHES
        bcs @arrive
        jsr start_pitch
        lda #NEXT_COUNT
        jsr API_RMOD
        tax
        lda nxt_lo,x
        sta say
        lda nxt_hi,x
        sta say+1
        lda #1
        sta say_col
        jsr draw_bubble
@out:   clc
        rts
@arrive:
        lda #PH_ARRIVE          ; ding: the penthouse
        sta phase
        lda #0
        sta phase_t
        lda #ARRIVE_COUNT
        jsr API_RMOD
        tax
        lda arr_lo,x
        sta say
        lda arr_hi,x
        sta say+1
        lda #1
        sta say_col
        jsr draw_bubble
        lda #EX_NEUTRAL
        sta expr
        lda #255
        sta react_t
        lda #SFX_GOOD
        jsr API_SFX
        jsr draw_indicator
        clc
        rts

ph_arrive:
        lda phase_t
        cmp #ARRIVE_T
        bcs @end
        cmp #ARRIVE_SKIP
        bcc @out
        lda JOYP
        and #J_FIRE
        beq @out
@end:   jmp finish
@out:   clc
        rts

; Running reels move on; redraw the ones whose payline word changed.
spin_reels:
        ldx #REELS-1
@r:     lda r_pick,x
        bpl @next
        lda r_plo,x
        clc
        adc r_slo,x
        sta r_plo,x
        lda r_phi,x
        adc r_shi,x
        sta r_phi,x
        lsr
        lsr
        lsr
        lsr
        lsr
        cmp r_shown,x
        beq @next
        stx sr_i
        jsr draw_reel
        ldx sr_i
@next:  dex
        bpl @r
        rts

; The impression bar eases towards the average of the pitches so far.
ease_imp:
        lda imp_tgt
        sec
        sbc imp
        beq @draw
        bcc @down
        lsr
        lsr
        lsr
        bne :+
        lda #1
:       clc
        adc imp
        sta imp
        jmp draw_bar
@down:  lda imp
        sec
        sbc imp_tgt
        lsr
        lsr
        lsr
        bne :+
        lda #1
:       sta t0
        lda imp
        sec
        sbc t0
        sta imp
@draw:  jmp draw_bar

; The indicator climbs a floor every FLOOR_STEP frames towards the target of the phase.
ease_floor:
        jsr floor_target
        cmp fl_val
        beq @blink
        inc fl_t
        ldx fl_t
        cpx #FLOOR_STEP
        bcc @out
        ldx #0
        stx fl_t
        cmp fl_val
        bcc :+
        inc fl_val
        jmp draw_indicator
:       dec fl_val
        jmp draw_indicator
@blink: lda phase
        cmp #PH_ARRIVE
        bne @out
        lda anim
        and #15
        bne @out
        jmp draw_indicator
@out:   rts

; A = the floor the elevator heads for: the pitch's start, + a quarter of the climb per stopped reel, its end.
floor_target:
        ldx p
        lda phase
        cmp #PH_ARRIVE
        bne :+
        lda #40
        rts
:       cmp #PH_REPLY
        bne :+
        lda floors+1,x
        rts
:       cmp #PH_SPIN
        beq :+
        lda floors,x
        rts
:       lda #0
        ldy cur
        beq @add
:       clc
        adc climbs,x
        dey
        bne :-
        lsr
        lsr
@add:   clc
        adc floors,x
        rts

tick_timers:
        lda float_t
        beq :+
        dec float_t
        bne :+
        jsr clear_float
:       lda react_t
        beq :+
        dec react_t
        bne :+
        lda #EX_NEUTRAL
        sta expr
:       lda border_t
        beq :+
        dec border_t
        bne :+
        lda #0
        sta $d020
:       lda rum_flash
        beq @out
        dec rum_flash
        lda rum_flash
        and #3
        bne @out
        ldx #7
        lda rum_flash
        and #4
        beq :+
        ldx #1
:       stx rum_col
        jmp draw_rumour
@out:   rts

; Late in a reel the CEO gets bored: his face, and a "z" over his head while the reel runs.
boredom:
        lda phase
        cmp #PH_SPIN
        bne @noz
        lda react_t
        bne :+
        lda bored_t
        cmp rt
        bcs :+
        lda #EX_BORED
        sta expr
:       lda expr
        cmp #EX_BORED
        bne @noz
        lda anim
        lsr
        lsr
        lsr
        lsr
        and #1
        cmp z_shown
        beq @out
        sta z_shown
        jsr clear_z
        lda #3
        sta COLOR
        lda z_shown
        clc
        adc #23
        tax
        ldy #4
        lda #'z'
        jmp API_PUTC
@noz:   lda z_shown
        bmi @out
        lda #$ff
        sta z_shown
        jmp clear_z
@out:   rts

clear_z:
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #7
        sta COLOR
        ldx #23
        ldy #4
        lda #' '
        jmp API_FILL

; Reel cur starts: timer bar, frame.
start_reel:
        lda #0
        sta rt
        lda auto_t
        ldx auto_t+1
        jsr timer_start
        ldx cur
        jmp draw_frame

; A = 1: the reel stopped by itself, 0: FIRE. The CEO reacts; then the next reel, or the verdict.
stop_reel:
        sta sr_auto
        ldx cur
        lda sr_auto
        beq @man
        lda r_phi,x
        lsr
        lsr
        lsr
        lsr
        lsr
        jmp @k
@man:   jsr pick_index
@k:     sta r_pick,x
        asl                     ; the reel snaps to the word
        asl
        asl
        asl
        asl
        sta r_phi,x
        lda #0
        sta r_plo,x
        lda sr_auto
        beq :+
        lda r_flag,x
        ora #FL_AUTO
        sta r_flag,x
:       txa                     ; v = (a - min) × 255 / (max - min)
        asl
        asl
        asl
        ora r_pick,x
        tay
        lda r_val,y
        sec
        sbc r_min,x
        sta t0
        lda r_max,x
        sec
        sbc r_min,x
        jsr scale255
        sta sr_v
        lda sr_auto
        beq @hand
        lda #SFX_BAD            ; "Uhh..."
        jsr API_SFX
        jsr flash
        lda #3
        jsr rand_react
        inc sp                  ; (skip the line count)
        bne :+
        inc sp+1
:       lda sp
        ldx sp+1
        ldy #7
        jsr show_float
        lda #EX_ANNOYED
        jmp @react
@hand:  ldx #SFX_BLIP
        lda sr_v
        cmp #191                ; 0.75
        bcc :+
        ldx #SFX_GOOD
:       txa
        jsr API_SFX
        ldx #0                  ; reaction: high from 0.75, mid from 0.35, low
        ldy #5
        lda sr_v
        cmp #191
        bcs :+
        inx
        ldy #1
        cmp #89
        bcs :+
        inx
        ldy #4
:       sty say_col
        txa
        jsr rand_react
        lda sp
        sta say
        lda sp+1
        sta say+1
        jsr draw_bubble
        lda #EX_DELIGHT         ; face: delighted from 0.8, neutral from 0.2, bored
        ldx sr_v
        cpx #204
        bcs @react
        lda #EX_NEUTRAL
        cpx #51
        bcs @react
        lda #EX_BORED
@react: sta expr
        lda #REACT_T
        sta react_t
        ldx cur                 ; (cur moves on first, so the stopped reel's frame turns green)
        inc cur
        stx sr_i
        jsr draw_frame
        ldx sr_i
        jsr draw_reel
        lda cur
        cmp #REELS
        bcs end_pitch
        jsr start_reel
        jsr draw_line
        clc
        rts

; Score the pitch: half value for a reel that stalled or was rushed.
end_pitch:
        lda #0
        sta ep_best
        sta ep_worst
        sta ep_got
        ldx #REELS-1
@r:     txa
        asl
        asl
        asl
        ora r_pick,x
        tay
        lda r_val,y
        sta t0
        lda r_max,x             ; doubled units, so the halves stay whole
        asl
        clc
        adc ep_best
        sta ep_best
        lda r_min,x
        asl
        clc
        adc ep_worst
        sta ep_worst
        lda r_flag,x
        beq @full
        lda r_min,x             ; 2 × (min + (a - min) / 2)
        clc
        adc t0
        jmp @add
@full:  lda t0
        asl
@add:   clc
        adc ep_got
        sta ep_got
        dex
        bpl @r
        lda ep_got
        sec
        sbc ep_worst
        sta t0
        lda ep_best
        sec
        sbc ep_worst
        jsr scale255
        lsr
        lsr
        tax
        lda curve,x             ; ^ 1.3
        sta ep_sc
        ldx p
        sta results,x
        inc nres
        jsr average
        sta imp_tgt
        ldx #0                  ; verdict: great from 0.8, good from 0.55, meh from 0.3, bad
        lda ep_sc
        cmp #204
        bcs :+
        inx
        cmp #141
        bcs :+
        inx
        cmp #77
        bcs :+
        inx
:       stx t1
        txa
        asl
        asl                     ; × REPLY_PER
        sta t0
        lda #REPLY_PER
        jsr API_RMOD
        clc
        adc t0
        tax
        lda rep_lo,x
        sta say
        lda rep_hi,x
        sta say+1
        lda #1
        sta say_col
        jsr draw_bubble
        ldx t1
        lda verdict_expr,x
        sta expr
        lda #VERDICT_T
        sta react_t
        lda verdict_sfx,x
        jsr API_SFX
        ldx t1
        cpx #3
        bne :+
        jsr flash
:       jsr show_impression
        lda #PH_REPLY
        sta phase
        lda #0
        sta phase_t
        jsr API_BAR
        jsr draw_reels
        jsr draw_line
        lda #<s_next
        ldx #>s_next
        jsr footer
        clc
        rts

; "Impression NN%" over the plaque in the verdict's colour (t1 = band).
show_impression:
        lda ep_sc               ; round(sc × 100 / 255)
        ldx #100
        jsr mul8
        lda d_num
        clc
        adc #127
        sta d_num
        bcc :+
        inc d_num+1
:       lda #255
        jsr div16
        ldx t1
        ldy verdict_col,x
        lda #<s_impression
        ldx #>s_impression
        jsr show_float          ; "Impression" centred as if it had "NN%" after it
        ldx #12
        lda d_num
        cmp #10
        bcc :+
        inx
        cmp #100
        bcc :+
        inx
:       stx t0
        ldx #12
        ldy #4
        jsr API_NUM
        ldx t0
        inx
        ldy #4
        lda #'%'
        jmp API_PUTC

; Red border for a moment (the browser version shakes the screen).
flash:  lda #2
        sta $d020
        lda #10
        sta border_t
        rts

; A = average of the nres pitch scores.
average:
        lda #0
        sta d_num
        sta d_num+1
        ldx nres
        dex
:       lda results,x
        clc
        adc d_num
        sta d_num
        bcc :+
        inc d_num+1
:       dex
        bpl :--
        lda nres
        jsr div16
        lda d_num
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): FIRE once a press would take the reel's best word (the mood word), not eagerly.
bot:    lda rt
        cmp #EAGER_T
        bcc @no
        ldx cur
        jsr pick_index
        sta t0
        txa
        asl
        asl
        asl
        ora t0
        tay
        lda r_val,y
        cmp r_max,x
        bne @no
        lda #J_FIRE
        sta JOYP
@no:    rts
.endif

; score = average of the three pitches
finish:
        jsr average
        sta MG_SCORE
        lda #0
        sta $d015
        sta $d017
        sta $d020
        lda #1
        sta done
        sec
        rts

.rodata
s_name:      .byte "Elevator Pitch", 0
s_help:      .byte "Stop each reel on the word the CEO loves.", 0
s_keys:      .byte "FIRE: stop the reel on the rumour icon", 0
s_next:      .byte "FIRE: next", 0
s_pitch:     .byte "Pitch  /3", 0
s_pitchof:   .byte "PITCH   OF 3", 0
s_impress:   .byte "CEO IMPRESSION", 0
s_likes:     .byte "CEO likes", 0
s_ph40:      .byte "PH 40", 0
s_you:       .byte "You: ", 34, 0
s_dots:      .byte "...", 0
s_blank:     .byte "___", 0
s_uhh:       .byte "uhh", 0
s_eager:     .byte "eager", 0
s_tooeager:  .byte "Too eager!", 0
s_impression: .byte "Impression    ", 0
; categories: animals, ai, space, green, money, boring, buzz
cat_char:    .byte CH_PIP, CH_SO, CH_UP, CH_CHECK, '$', CH_HR, '*'
cat_col:     .byte 2, 3, 1, 5, 7, 6, 4
reel_x:      .byte 0, 20, 0, 20
reel_y:      .byte 12, 12, 17, 17
class_need:  .byte 1, 2, 1, 0
verdict_expr: .byte EX_DELIGHT, EX_NEUTRAL, EX_BORED, EX_ANNOYED
verdict_sfx: .byte SFX_GOOD, SFX_GOOD, SFX_BLIP, SFX_BAD
verdict_col: .byte 5, 7, 7, 2

.include "gen/mg_pitch_data.s"

.bss
moods:       .res 6
climbs:      .res PITCHES
floors:      .res PITCHES + 1
results:     .res PITCHES
r_word:      .res REELS * PER_REEL
r_val:       .res REELS * PER_REEL
r_min:       .res REELS
r_max:       .res REELS
r_plo:       .res REELS         ; position: high 3 bits = word on the payline
r_phi:       .res REELS
r_slo:       .res REELS
r_shi:       .res REELS
r_pick:      .res REELS         ; $ff = spinning
r_flag:      .res REELS
r_shown:     .res REELS
cand:        .res 32
linebuf:     .res 72
br_reel:     .res 1
br_dst:      .res 1
br_n:        .res 1
br_cls:      .res 1
br_m:        .res 1
br_need:     .res 1
br_j:        .res 1
dr_i:        .res 1
dr_k:        .res 1
dr_col:      .res 1
dw_w:        .res 1
dw_x:        .res 1
dw_row:      .res 1
dw_col:      .res 1
dl_i:        .res 1
sr_i:        .res 1
sr_auto:     .res 1
sr_v:        .res 1
ep_best:     .res 1
ep_worst:    .res 1
ep_got:      .res 1
ep_sc:       .res 1
