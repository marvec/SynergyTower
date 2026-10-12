; PowerPoint Karaoke (src/minigames/karaoke.js) as a disk-loaded overlay at $4000.
; Present slides you have never seen: each slide shows a randomly generated chart (bar, line, pie, 2x2 matrix,
; funnel, Venn); pick the one narration that matches it. The right narration is derived from the generated
; data (the trend's shape and its peak or dip, the biggest slice, our quadrant, the biggest drop, the overlap);
; the others describe another shape / slice / quadrant / stage, one is the wrong kind of chart (50 %) or
; confident nonsense. Slide types: shuffled rounds of the six. Score = (right - 0.25 × wrong picks) / slides
; (letting the time run out costs nothing extra).
;   d = 0: 6 slides, 10 s each, 3 narrations, pies of 3 slices
;   d = 1: 9 slides, 6 s each, 4 narrations from d = 0.3, pies of 4 slices from d = 0.5
; Content (department metrics and titles + the common pools), chart geometry, sprites: src/data/mg-karaoke.js
; (gen/mg_karaoke_data.s); the texts are byte-pair encoded, placeholders are bytes 1-13.

.include "api.inc"
.include "gen/chars.inc"

MAX_SLIDES = 9
NEXT_T    = 20                  ; 0.4 s for a new slide to come up
REVEAL_T  = 70                  ; 1.4 s, FIRE moves on after 0.45 s
REVEAL_SKIP = 23
CROWD_T   = 80                  ; 1.6 s of applause or crickets
PER_T     = 500                 ; 10 s a slide, minus 4 s × d
NOPT4_DIFF = 77                 ; 4 narrations from d = 0.3
PIE4_DIFF = 128                 ; 4 slices from d = 0.5

PH_NEXT   = 0
PH_SHOW   = 1
PH_REVEAL = 2

T_BAR     = 0                   ; slide types (the order of K.WRONG_TYPE in the data)
T_LINE    = 1
T_PIE     = 2
T_MATRIX  = 3
T_FUNNEL  = 4
T_VENN    = 5

SH_RISE   = 0                   ; trend shapes
SH_FALL   = 1
SH_PEAK   = 2
SH_DIP    = 3
SH_FLAT   = 4

; placeholder slots (template bytes 1-13; 1 = slot 2 with a capital letter)
P_Y       = 2
P_UNIT    = 3
P_PREP    = 4
P_X       = 5
P_L       = 6
P_LA      = 7                   ; {a} high / low
P_LB      = 8
P_A       = 9
P_B       = 10
P_S1      = 11
P_S2      = 12
P_C       = 13

; decks: content is dealt from per-game shuffled decks, so slides never repeat until a deck runs out
D_MET     = 0
D_DMET    = 1
D_TDEPT   = 2
D_TGEN    = 3
D_PIES    = 4
D_MATS    = 5
D_FUNS    = 6
D_VENNS   = 7
D_NONS    = 8
DECKS     = 9

; screen: the projector (frame cols 6-39, rows 2-13), the narrations (rows 15-22), the audience (row 23)
SCR_X     = 6
SCR_Y     = 2
TITLE_X   = 8
TITLE_Y   = 3
STAT_Y    = 14                  ; streak, verdict, nailed
OPT_Y     = 15
OPT_X     = 3                   ; 2 lines of 37
OPT_W     = 37
CROWD_Y   = 23
; bar / line chart: axis label on row 4, plot cols 11-38 × rows 5-11, x labels on row 12
PLOT_X    = 11
PLOT_ROW  = 5
BASE_PY   = 24                  ; quarter-pixel row under the plot
PIE_X     = 9                   ; pie: 8 × 8 cells, legend from col 19
PIE_Y     = 4
MAT_X     = 19                  ; matrix: box cols 19-38 × rows 4-11, divider col 29 / row 7
MAT_Y     = 4
FUN_MID   = 53                  ; funnel: centre in half-cells (col 26 | 27)
VENN_X    = 18                  ; Venn: 11 × 7 cells
VENN_Y    = 5
QB        = 240                 ; quarter blocks: QB + 1 top left, 2 top right, 4 bottom left, 8 bottom right

; sprites: 0 presenter (multicolour, Y-expanded, behind the lectern), 1 laser pointer
SPR_PTR   = ($e300 - $c000) / 64
F_IDLE    = 0
F_TALK    = 1
F_HAPPY   = 2
F_SWEAT   = 3
F_LASER   = 4
PRES_X    = 24 + 8
PRES_Y    = 50 + 7 * 8
LASER_X0  = 100                 ; laser_x is from here (the sprite's x goes past 255)

.zeropage
zp_start:
phase:    .res 1
phase_t:  .res 1
si:       .res 1                ; slide
correct:  .res 1
wrongs:   .res 1                ; wrong picks (not timeouts)
streak:   .res 1
focus:    .res 1
chosen:   .res 1
crowd:    .res 1                ; 0 idle, 1 clapping, 2 crickets
crowd_t:  .res 1
mood:     .res 1                ; presenter frame outside the talking
anim:     .res 1
done:     .res 1
bot_t:    .res 1
zp_end:
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
sp:       .res 2                ; string walking
op:       .res 2                ; output while expanding
olen:     .res 1
capnext:  .res 1
d_num:    .res 2                ; division: d_num / d_den -> A, remainder in d_num
d_den:    .res 2
m_lo:     .res 1                ; mul8 result
m_hi:     .res 1
m_a:      .res 1
sbase:    .res 1                ; shuffle6: first index (back to 0 after each call)
x0:       .res 1                ; line / plot (quarter pixels)
y0:       .res 1
x1:       .res 1
y1:       .res 1
ldx_:     .res 1
ldy_:     .res 1
lsx:      .res 1
lsy:      .res 1
lerr:     .res 1
pcol:     .res 1
scr:      .res 2
ccl:      .res 2
k:        .res 1
nspec:    .res 1
count:    .res 1                ; slides
nopt:     .res 1                ; narrations (3-4)
pie_n:    .res 1                ; pie slices (3-4)
right:    .res 1                ; the right narration's place
stype:    .res 1                ; slide type
tshape:   .res 1                ; trend shape
npts:     .res 1                ; trend points
hi:       .res 1                ; highest point / big slice / our quadrant / big drop
lo:       .res 1                ; lowest point
slotw:    .res 1

.rodata
.include "gen/mg_karaoke_data.s"   ; (first: the code needs its constants)

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
        sta sbase
        ldx #DECKS - 1          ; every deck empty: shuffled on its first deal
:       sta deck_pos,x
        dex
        bpl :-
        ; slides: round(6 + 3 d) = 6 + (3 × MG_DIFF + 128) / 256; narrations; slices
        lda MG_DIFF
        asl
        sta t0
        lda #0
        rol
        sta t1
        lda t0
        clc
        adc MG_DIFF
        bcc :+
        inc t1
:       clc
        adc #128
        lda t1
        adc #6
        sta count
        ldx #3
        lda MG_DIFF
        cmp #NOPT4_DIFF
        bcc :+
        inx
:       stx nopt
        ldx #3
        cmp #PIE4_DIFF
        bcc :+
        inx
:       stx pie_n
        ; time a slide: 500 - 200 × d frames = 500 - MG_DIFF × (1 - 1/4 + 1/32)
        lsr
        lsr
        sta t0                  ; d / 4
        lsr
        lsr
        lsr
        sec
        sbc t0                  ; d / 32 - d / 4 (negative)
        clc
        adc MG_DIFF
        sta t0
        lda #<PER_T
        sec
        sbc t0
        sta per_t
        lda #>PER_T
        sbc #0
        sta per_t+1
        ; slide types: shuffled rounds of the six
        lda #0
        sta k
@round: ldx #5
        jsr ident6
        ldx #0
:       ldy k
        cpy count
        beq @types
        lda tmp6,x
        sta types,y
        inc k
        inx
        cpx #6
        bne :-
        beq @round
@types: jsr API_RAND             ; the audience's hair colours: from this seed
        sta hseed
        jsr make_sprites
        ; screen
        text 1, 0, s_name, 7
        text 30, 0, s_slide, 1
        ldx #38
        ldy #0
        lda count
        jsr API_NUM
        lda #1
        sta COLOR
        lda #34
        sta FILL_W
        lda #12
        sta FILL_H
        ldx #SCR_X
        ldy #SCR_Y
        jsr API_BOX
        lda #2                  ; the lectern (hides the presenter's legs) and a laptop on it
        sta COLOR
        lda #5
        sta FILL_W
        lda #3
        sta FILL_H
        lda #CH_BLOCK
        ldx #0
        ldy #11
        jsr API_FILL
        lda #3
        sta COLOR
        lda #3
        sta FILL_W
        lda #1
        sta FILL_H
        lda #QB + 12
        ldx #1
        ldy #10
        jsr API_FILL
        jsr draw_heads
        lda #<s_keys3
        ldx #>s_keys3
        ldy nopt
        cpy #4
        bne :+
        lda #<s_keys4
        ldx #>s_keys4
:       jsr footer
        jmp new_slide

; The presenter's frames (head + face + body rows) and the laser to $e300, the sprite registers.
make_sprites:
        ldx #0                  ; clear 6 frames
        txa
:       sta $e300,x
        sta $e300 + 128,x
        sta $e300 + 256,x
        inx
        bpl :-
        lda #3
        sta t0                  ; face
@face:  lda t0                  ; frame start
        lsr
        ror
        ror
        sta op                  ; t0 × 64
        lda #>$e300
        adc #0
        sta op+1
        ldy #0
:       lda spr_head,y          ; head rows 0-2
        sta (op),y
        iny
        cpy #9
        bne :-
        lda t0                  ; face rows 3-6
        asl
        asl
        sta t1
        asl
        adc t1                  ; × 12
        tax
:       lda spr_faces,x
        sta (op),y
        inx
        iny
        cpy #21
        bne :-
        ldx #0
:       lda spr_body,x          ; body rows 7-20
        sta (op),y
        inx
        iny
        cpy #63
        bne :-
        dec t0
        bpl @face
        ldx #11                 ; the laser: its top rows
:       lda spr_laser,x
        sta $e300 + F_LASER * 64,x
        dex
        bpl :-
        lda #%001               ; presenter: multicolour, Y-expanded, behind the lectern
        sta $d01c
        sta $d017
        sta $d01b
        sta $d015
        lda #0
        sta $d01d
        sta $d010
        lda #2                  ; hair (and eyes): brown or dark grey; skin: light red or orange
        jsr API_RMOD
        tax
        lda hair_spr,x
        sta $d025
        lda #14
        sta $d027               ; light blue top
        lda #2
        sta $d028               ; red laser
        lda #3
        jsr API_RMOD
        tax
        lda skin_tab,x
        sta $d026
        lda #PRES_X
        sta $d000
        lda #PRES_Y
        sta $d001
        lda #SPR_PTR + F_LASER
        sta SCREEN + $3f9
        rts

; tmp6[0..X] = 0..X, shuffled.
ident6: stx t2
:       txa
        sta tmp6,x
        dex
        bpl :-
        ldx t2
        ; fall through
; Fisher-Yates over tmp6[sbase .. X] (sbase is 0 again afterwards).
shuffle6:
@s:     cpx sbase
        beq @out
        bcc @out
        stx t2
        txa
        sec
        sbc sbase
        clc
        adc #1
        jsr API_RMOD
        clc
        adc sbase
        tay
        ldx t2
        lda tmp6,x
        pha
        lda tmp6,y
        sta tmp6,x
        pla
        sta tmp6,y
        dex
        jmp @s
@out:   lda #0
        sta sbase
        rts

; ---------------------------------------------------------------- frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr sprites
        lda crowd_t
        beq :+
        dec crowd_t
        bne :+
        lda #0
        sta crowd
        jsr draw_heads
:       inc phase_t
        lda phase
        cmp #PH_SHOW
        beq show
        bcs reveal
        ; next: the slide comes up
        lda phase_t
        cmp #NEXT_T
        bcc @out
        lda #PH_SHOW
        sta phase
        lda #0
        sta focus
        sta bot_t
        jsr draw_marks
        lda per_t
        ldx per_t+1
        jsr timer_start
@out:   clc
        rts

reveal:
        lda phase_t
        cmp #REVEAL_T
        bcs @next
        cmp #REVEAL_SKIP
        bcc @out
        lda JOYP
        and #J_FIRE
        beq @out
@next:  inc si
        lda si
        cmp count
        bne :+
        jmp finish
:       jsr new_slide
@out:   clc
        rts

show:
        jsr timer_tick
        bcc :+
        lda #$ff                ; awkward silence
        jmp answer
:
.if .defined(AUTOPLAY)
        inc bot_t               ; a perfect presenter who reads for 0.5 s
        lda bot_t
        cmp #25
        bne :+
        lda right
        jmp answer
:
.endif
        jsr number_key
        cmp nopt
        bcs :+
        jmp answer
:       ldx focus
        lda JOYP
        and #J_DOWN | J_RIGHT
        beq :+
        inx
        cpx nopt
        bcc @moved
        ldx #0
        beq @moved
:       lda JOYP
        and #J_UP | J_LEFT
        beq :+
        dex
        bpl @moved
        ldx nopt
        dex
        bpl @moved
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp answer
@moved: stx focus
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_marks
@out:   clc
        rts

; A = picked narration, $ff = time ran out.
answer:
        sta chosen
        cmp right
        bne @wrong
        inc correct
        inc streak
        lda #SFX_GOOD
        jsr API_SFX
        lda #1
        sta crowd
        lda #F_HAPPY
        sta mood
        lda #<s_nailed
        ldx #>s_nailed
        ldy #5
        jmp @stamp
@wrong: lda chosen
        bmi :+
        inc wrongs
:       lda #0
        sta streak
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta crowd
        lda #F_SWEAT
        sta mood
        lda #<s_awkward
        ldx #>s_awkward
        ldy chosen
        bpl :+
        lda #<s_silence
        ldx #>s_silence
:       ldy #2
@stamp: sta p1                  ; (free until the next slide)
        stx p1+1
        sty p2
        jsr draw_stats
        lda p2
        sta COLOR
        lda p1
        ldx p1+1
        ldy #STAT_Y
        jsr API_CENTER
        lda #CROWD_T
        sta crowd_t
        jsr draw_crowd
        lda #PH_REVEAL
        sta phase
        lda #0
        sta phase_t
        jsr API_BAR             ; (bar cleared)
        jsr draw_marks
        clc
        rts

; score = (4 × right - wrong picks) × 255 / (4 × slides), at least 0
finish:
        lda correct
        asl
        asl
        sec
        sbc wrongs
        bcs :+
        lda #0
:       tax
        jsr mul255
        lda count
        asl
        asl
        sta d_den
        lda #0
        sta d_den+1
        jsr div16
        sta MG_SCORE
        lda #0
        sta $d015
        sta $d01b
        sta $d017
        sta $d01d
        lda #1
        sta done
        sec
        rts

; d_num = X × 255
mul255:
        stx d_num+1
        lda #0
        sta d_num
        txa
        eor #$ff
        sec
        adc d_num               ; X × 256 - X
        sta d_num
        lda d_num+1
        sbc #0
        sta d_num+1
        rts

; ---------------------------------------------------------------- sprites

; Presenter's face, the laser wobbling over the slide while you present.
sprites:
        lda mood                ; talking a third of the time while presenting
        ldx phase
        cpx #PH_SHOW
        bne :+
        lda anim
        and #31
        cmp #11
        lda #F_IDLE
        bcs :+
        lda #F_TALK
:       clc
        adc #SPR_PTR
        sta SCREEN + $3f8
        lda #%001
        ldx phase
        cpx #PH_SHOW
        bne :+
        ora #%010
:       sta $d015
        ; laser: along a wobbly figure-eight (32 points, 4 frames each; x from LASER_X0)
        lda anim
        lsr
        lsr
        and #31
        tax
        lda laser_y,x
        sta $d003
        lda laser_x,x
        clc
        adc #<LASER_X0
        sta $d002
        lda #0
        rol
        asl
        sta t1
        lda $d010
        and #%11111101
        ora t1
        sta $d010
        rts

; ---------------------------------------------------------------- slides

; Build slide si and draw it; its narrations come up dim.
new_slide:
        lda #PH_NEXT
        sta phase
        lda #0
        sta phase_t
        sta nspec
        lda #F_IDLE
        sta mood
        lda #SFX_BLIP
        jsr API_SFX
        lda #5                  ; full bar until the slide is up
        sta COLOR
        lda #38
        jsr API_BAR
        lda #32                 ; clear the slide, the stats, the narrations
        sta FILL_W
        lda #10
        sta FILL_H
        lda #' '
        ldx #SCR_X + 1
        ldy #SCR_Y + 1
        jsr API_FILL
        lda #STAT_Y
        ldx #9
        jsr clear_rows
        jsr draw_stats
        lda #1                  ; slide number: top right, in the frame's corner
        sta COLOR
        lda si
        clc
        adc #'1'
        pha
        ldx #36
        ldy #0
        jsr API_PUTC
        pla
        ldx #37
        ldy #SCR_Y + 11
        jsr API_PUTC
        ; the slide's own content
        ldx si
        lda types,x
        sta stype
        asl
        tax
        lda gen_tab+1,x
        pha
        lda gen_tab,x
        pha
        rts                     ; -> gen_trend / gen_pie / ..., which end in jmp options

gen_tab:   .word gen_trend - 1, gen_trend - 1, gen_pie - 1, gen_matrix - 1, gen_funnel - 1, gen_venn - 1

; A spec from a random one of the first A templates in list X.
say:    stx t2
        jsr API_RMOD
        tay
        ldx t2
        ; fall through
; A spec from template Y of list X.
say_y:  jsr nth
        lda sp
        ldx sp+1
        ; fall through
; A spec (a narration before it is written out): template A/X, its two variable slots s_p1 / s_p2.
add_spec:
        ldy nspec
        cpy #4                  ; (only the first nopt - 1 + the filler are kept)
        bcs @out
        sta spec_tl,y
        txa
        sta spec_th,y
        lda p1
        sta spec_1l,y
        lda p1+1
        sta spec_1h,y
        lda p2
        sta spec_2l,y
        lda p2+1
        sta spec_2h,y
        inc nspec
@out:   rts

; The narrations: the right one (spec 0), nopt - 2 wrong ones (specs 1..), then the wrong kind of chart
; (50 %) or nonsense; shuffled, written out on rows 15-22.
options:
        lda nopt
        sec
        sbc #1
        sta nspec               ; keep spec 0 + nopt - 2 wrong ones
        jsr API_RAND
        bmi @nons
@wt:    lda #6                  ; a type that is not this one (nor bar / line for a trend)
        jsr API_RMOD
        cmp stype
        beq @wt
        ldx stype
        cpx #T_PIE
        bcs :+
        cmp #T_PIE
        bcc @wt
:
.if WT_PER = 2
        asl
        sta t0
        lda #2
        jsr API_RMOD
        ora t0
.endif
        tay
        ldx #L_WT
        jsr nth
        jmp @add
@nons:  ldx #D_NONS
        jsr deal
        tay
        ldx #L_NS
        jsr nth
@add:   lda sp
        ldx sp+1
        jsr add_spec
        ; shuffle: order[] = 0..nopt-1, the right one is where 0 lands
        ldx nopt
        dex
        jsr ident6
        ldx nopt
        dex
:       lda tmp6,x
        beq :+
        dex
        bpl :-
:       stx right
        ; write them out
        lda #0
        sta k
@o:     ldx k
        ldy tmp6,x
        lda spec_1l,y           ; the variable slots for this slide type
        sta t0
        lda spec_1h,y
        sta t1
        ldx stype
        lda slot1_tab,x
        tax
        lda t0
        sta slot_lo,x
        lda t1
        sta slot_hi,x
        lda spec_2l,y
        sta t0
        lda spec_2h,y
        sta t1
        ldx stype
        lda slot2_tab,x
        tax
        lda t0
        sta slot_lo,x
        lda t1
        sta slot_hi,x
        lda spec_tl,y
        ldx spec_th,y
        jsr expand
        jsr put_option
        inc k
        lda k
        cmp nopt
        bne @o
        jmp draw_marks

; slot codes that a spec's p1 / p2 fill, per slide type (0 = unused: slot 0 is never read)
slot1_tab: .byte P_X, P_X, P_L, P_LA, P_S1, P_C
slot2_tab: .byte 0, 0, 0, P_LB, P_S2, 0

; Narration k (obuf) wrapped on rows 15 + 2k and 16 + 2k: break at the last space before column 37.
put_option:
        lda k
        asl
        adc #OPT_Y
        sta t3                  ; row
        lda olen
        cmp #OPT_W + 1
        bcc @one
        ldy #OPT_W
:       lda obuf,y
        cmp #' '
        beq :+
        dey
        bne :-
:       lda #0
        sta obuf,y
        iny
        sty t2                  ; second line starts here
        jsr @line1
        lda t2
        clc
        adc #<obuf
        sta PTR
        lda #>obuf
        adc #0
        sta PTR+1
        ldx #OPT_X
        ldy t3
        iny
        jmp API_PRINT
@one:
@line1: lda #<obuf
        sta PTR
        lda #>obuf
        sta PTR+1
        lda #6
        sta COLOR
        ldx #OPT_X
        ldy t3
        jmp API_PRINT

; Colours of the narrations: number + arrow at the focus while presenting; dim while the slide comes up;
; right green / wrong pick red after the answer.
draw_marks:
        lda #0
        sta k
@m:     lda k
        asl
        adc #OPT_Y
        tay
        ldx k
        lda #6                  ; coming up: dim
        sta t0
        lda phase
        beq @col
        cmp #PH_REVEAL
        beq @rev
        lda #1
        sta t0
        cpx focus
        bne @col
        lda #7
        sta t0
        bne @col
@rev:   lda #6
        sta t0
        cpx right
        bne :+
        lda #5
        sta t0
:       cpx chosen
        bne @col
        cpx right
        beq @col
        lda #2
        sta t0
@col:   sty t3                  ; row: two lines of colour
        ldx t3
        jsr color_row
        ldx t3
        inx
        jsr color_row
        lda #' '                ; arrow at the focus (while presenting)
        ldx k
        cpx focus
        bne :+
        ldx phase
        cpx #PH_SHOW
        bne :+
        lda #CH_ARROW
:       ldx t0
        stx COLOR
        ldx #0
        ldy t3
        jsr API_PUTC
        lda #3
        sta COLOR
        lda k
        clc
        adc #'1'
        ldx #1
        ldy t3
        jsr API_PUTC
        inc k
        lda k
        cmp nopt
        bne @m
        rts

; Colour RAM of row X, cols 3-39 = t0.
color_row:
        lda row_lo,x
        clc
        adc #OPT_X
        sta ccl
        lda row_hi,x
        adc #>(COLRAM - SCREEN)
        sta ccl+1
        lda t0
        ldy #OPT_W - 1
:       sta (ccl),y
        dey
        bpl :-
        rts

; ---------------------------------------------------------------- trend slides (bar, line)

gen_trend:
        ; title: the department's 65 % of the time
        ldx #D_TGEN
        lda #T_DEPT
        beq :+
        jsr API_RAND
        cmp #166
        bcs :+
        ldx #D_TDEPT
:       jsr deal
        cpx #D_TDEPT
        beq :+
        clc
        adc #T_DEPT
:       tay
        ldx #L_TI
        jsr nth
        jsr print_title
        ; metric: the department's half of the time
        ldx #D_MET
        lda #M_DEPT
        beq :+
        jsr API_RAND
        bpl :+
        ldx #D_DMET
:       jsr deal
        cpx #D_DMET
        bne :+
        clc
        adc #M_GEN
:       tay
        ldx #L_MET
        jsr nth
        lda sp
        sta slot_lo + P_Y
        lda sp+1
        sta slot_hi + P_Y
        ; x axis: points, unit, preposition, the labels
        lda #XS_COUNT
        jsr API_RMOD
        tax
        lda xs_n,x
        sta npts
        ldy xs_skip,x
        ldx #L_XS
        jsr nth
        ldx #P_UNIT
        jsr @slot
        ldx #P_PREP
        jsr @slot
        lda #0
        sta k
:       ldx k
        jsr @lab
        sta lab_lo,x
        tya
        sta lab_hi,x
        inc k
        lda k
        cmp npts
        bne :-
        jmp shape
@slot:  jsr @lab
        sta slot_lo,x
        tya
        sta slot_hi,x
        rts
; A/Y = sp, then sp moves to the next string (keeps X)
@lab:   lda sp+1
        pha
        lda sp
        pha
        stx t0
        jsr skip_1
        ldx t0
        pla
        tay                     ; (lo)
        pla
        sty t1
        tay                     ; hi in Y
        lda t1
        rts

; The trend: a shape, its values (0-250 = 0-10), the narrations.
shape:
        lda #5
        jsr API_RMOD
        sta tshape
        cmp #SH_FLAT
        bne @curve
        lda #51                 ; flat: all the same, 4.5-6.5
        jsr API_RMOD
        clc
        adc #112
        ldx npts
        dex
:       sta vals,x
        dex
        bpl :-
        jmp @done
@curve: ; every other shape: base + or - distance from a key point × step × (0.9-1, 1 at the key)
        ;   rising: key = first point, base 1-2.5, up to 8.5-10 at the far end; falling: key = last point
        ;   peak: a random inner key, base 8.5-10, down to 1.5;  dip: inner key, base 1-2, up to 8-10
        tax
        lda base_n,x
        jsr API_RMOD
        clc
        adc base_0,x
        sta t2                  ; base
        lda far_n,x
        jsr API_RMOD
        clc
        adc far_0,x
        sec
        sbc t2
        bcs :+
        eor #$ff                ; (peak: base - far)
        adc #1
:       sta d_num
        lda #0
        cpx #SH_FALL
        bcc @k                  ; rising: key 0
        lda npts
        sbc #1                  ; (C=1)
        cpx #SH_FALL
        beq @k
        lda npts
        sec
        sbc #2
        jsr API_RMOD
        clc
        adc #1
@k:     sta k
        lda npts                ; step = range / the largest distance to an end
        sec
        sbc #1
        sec
        sbc k
        cmp k
        bcs :+
        lda k
:       sta d_den
        lda #0
        sta d_den+1
        sta d_num+1
        jsr div16
        sta t3
        ldx npts
        dex
@pk:    stx t1
        txa
        sec
        sbc k
        bcs :+
        eor #$ff
        adc #1
:       tax
        lda #0
:       dex
        bmi :+
        clc
        adc t3
        bne :-
:       sta t0
        ldx t1
        cpx k
        beq :+
        lda #26
        jsr API_RMOD
        clc
        adc #230
        ldx t0
        jsr mul8
        lda m_hi
        sta t0
:       ldx t1
        lda t2
        ldy tshape
        cpy #SH_PEAK
        bne :+
        sec
        sbc t0
        bcs @set                ; (always)
:       clc
        adc t0
@set:   sta vals,x
        dex
        bpl @pk
@done:  ; highest and lowest point
        ldx npts
        dex
        stx hi
        stx lo
:       lda vals,x              ; (scanning down, >= / <=: the first such point wins, as indexOf)
        ldy hi
        cmp vals,y
        bcc :+
        stx hi
:       ldy lo
        cmp vals,y
        beq :+
        bcs :++
:       stx lo
:       dex
        bpl :----
        jsr draw_trend
        ; the right narration: the shape (+ the peak / dip point)
        lda tshape
        jsr say_trend
        ; wrong: a wrong point for a peak / dip, then the other shapes (shuffled) with points that are clearly
        ; off; half the time the whole list is shuffled. tmp6 = shapes, $80 = same shape, wrong point.
        ldx #0
        lda tshape
        cmp #SH_PEAK
        bcc @others
        cmp #SH_FLAT
        beq @others
        jsr key_of
        sta t0
:       lda npts
        jsr API_RMOD
        cmp t0
        beq :-
        sta wpt
        lda #$80
        sta tmp6
        ldx #1
@others:
        stx t3                  ; where the other shapes start
        lda #0
        sta k
:       lda k
        cmp tshape
        beq :+
        sta tmp6,x
        inx
:       inc k
        lda k
        cmp #5
        bne :--
        stx nlist               ; list length
        lda t3                  ; shuffle the other shapes, or half the time the whole list
        sta sbase
        jsr API_RAND
        bpl :+
        lda #0
        sta sbase
:       ldx nlist
        dex
        jsr shuffle6
@take:  lda #0                  ; (options keeps the first nopt - 2)
        sta k
@w:     ldx k
        lda tmp6,x
        bpl :+
        lda tshape
        ldx wpt
        jsr say_trend_x
        jmp @wn
:       pha
        jsr false_x
        tax
        pla
        jsr say_trend_x
@wn:    inc k
        lda k
        cmp nlist
        bne @w
        jmp options

; A = shape: A = its point (peak: highest, dip: lowest, others: 0).
key_of:
        cmp #SH_PEAK
        bne :+
        lda hi
        rts
:       cmp #SH_DIP
        bne :+
        lda lo
        rts
:       lda #0
        rts

; A = claimed shape: a point for its claim that is clearly false (neither extreme; any point on a flat slide,
; or when the claim prints no point).
false_x:
        ldx tshape
        cpx #SH_FLAT
        beq @any
        cmp #SH_PEAK
        bcc @any
        cmp #SH_FLAT
        bne @off
@any:   lda npts
        jmp API_RMOD
@off:   lda npts
        jsr API_RMOD
        cmp hi
        beq @off
        cmp lo
        beq @off
        rts

; A = shape, its point from key_of: a spec with a random template of that shape.
say_trend:
        pha
        jsr key_of
        tax
        pla
        ; fall through
; A = shape, X = point.
say_trend_x:
        sta t0
        lda lab_lo,x
        sta p1
        lda lab_hi,x
        sta p1+1
        ldx t0
        lda tr_count,x
        jsr API_RMOD
        ldx t0
        clc
        adc tr_first,x
        tay
        ldx #L_TR
        jmp say_y

; Bars or a line on the plot, the axis label, the x labels.
draw_trend:
        lda #1                  ; "^ Metric"
        sta COLOR
        lda #CH_UP
        ldx #TITLE_X
        ldy #TITLE_Y + 1
        jsr API_PUTC
        lda #1
        sta capnext
        lda slot_lo + P_Y
        ldx slot_hi + P_Y
        jsr expand_str
        ldx #TITLE_X + 2
        ldy #TITLE_Y + 1
        lda #1
        jsr print_obuf
        lda #6                  ; y axis
        sta COLOR
        lda #1
        sta FILL_W
        lda #7
        sta FILL_H
        lda #CH_L
        ldx #PLOT_X - 1
        ldy #PLOT_ROW
        jsr API_FILL
        ; slots: width 7 / 5 / 4 for 4 / 5 / 6 points, centred in the 28 columns
        ldx npts
        lda slot_w-4,x
        sta slotw
        lda bar_w-4,x
        sta barw
        lda bar_off-4,x
        sta baroff
        lda slot_x0-4,x
        sta t2                  ; slot column
        lda #0
        sta k
@pt:    ldx k                   ; height in half-rows: v × 14 / 250 ~ (v + 9) / 18
        lda vals,x
        clc
        adc #9
        bcc :+
        lda #255                ; (values up to 250)
:       ldx #0
:       cmp #18
        bcc :+
        sbc #18
        inx
        bne :-
:       txa
        bne :+
        lda #1
:       sta t3
        ldx k
        lda #BASE_PY
        sec
        sbc t3
        sta pty,x               ; top pixel
        lda t2                  ; centre pixel column
        asl
        clc
        adc slotw
        sta ptx,x
        lda stype
        bne @lbl
        ; a bar: barw columns of full blocks, a half block on top when the height is odd
        lda #3
        sta COLOR
        lda t2
        clc
        adc baroff
        sta t0
        lda barw
        sta FILL_W
        lda t3
        lsr
        sta FILL_H
        beq @half
        lda #PLOT_ROW + 7
        sec
        sbc FILL_H
        tay
        ldx t0
        lda #CH_BLOCK
        jsr API_FILL
@half:  lda t3
        lsr
        bcc @lbl
        eor #$ff                ; row PLOT_ROW + 6 - height / 2
        sec
        adc #PLOT_ROW + 6
        tay
        lda barw
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t0
        lda #QB + 12
        jsr API_FILL
@lbl:   ; x label, shortened (spaces out, then cut to slot - 1 keeping a last digit), centred in its slot
        ldx k
        lda lab_lo,x
        pha
        lda lab_hi,x
        tax
        pla
        jsr expand_str
        ldx #0
        ldy #0
:       lda obuf,x
        inx
        cmp #' '
        beq :-
        sta obuf,y
        iny
        cmp #0
        bne :-
        dey
        sty olen
        ldx slotw
        dex
        cpx olen
        bcs @fit
        lda obuf-1,y            ; the last character
        stx olen
        cmp #'9' + 1
        bcs @cut
        cmp #'0'
        bcc @cut
        sta obuf-1,x
@cut:   lda #0
        sta obuf,x
@fit:
        lda slotw
        sec
        sbc olen
        lsr
        clc
        adc t2
        tax
        ldy #PLOT_ROW + 7
        lda #1
        jsr print_obuf
        lda t2
        clc
        adc slotw
        sta t2
        inc k
        lda k
        cmp npts
        beq :+
        jmp @pt
:       lda stype
        beq @out
        ; a line: red segments between the points, the points white
        lda #2
        sta pcol
        lda #0
        sta k
:       ldx k
        lda ptx,x
        sta x0
        lda pty,x
        sta y0
        lda ptx+1,x
        sta x1
        lda pty+1,x
        sta y1
        jsr line
        inc k
        ldx k
        inx
        cpx npts
        bne :-
        lda #1
        sta pcol
        ldx npts
        dex
:       stx k
        lda ptx,x
        sta x0
        lda pty,x
        sta y0
        jsr plot
        ldx k
        dex
        bpl :-
@out:   rts

; ---------------------------------------------------------------- pie

gen_pie:
        ldx #D_PIES
        jsr deal
        tax
        lda pi_nlab,x
        sta t3                  ; labels in the set
        ldy pi_skip,x
        ldx #L_PI
        jsr nth
        jsr print_title
        jsr skip_1
        ldx #0                  ; their pointers
:       lda sp
        sta lab_lo,x
        lda sp+1
        sta lab_hi,x
        stx t2
        jsr skip_1
        ldx t2
        inx
        cpx t3
        bne :-
        ; pie_n of them, in random order (partial Fisher-Yates over the pointers)
        ldx #0
@pk:    stx t2
        lda t3
        sec
        sbc t2
        jsr API_RMOD
        clc
        adc t2
        tay
        ldx t2
        lda lab_lo,x
        pha
        lda lab_lo,y
        sta lab_lo,x
        pla
        sta lab_lo,y
        lda lab_hi,x
        pha
        lda lab_hi,y
        sta lab_hi,x
        pla
        sta lab_hi,y
        inx
        cpx pie_n
        bne @pk
        lda pie_n
        jsr API_RMOD
        sta hi                  ; the big slice
        ; slices: the big one 44-58 %, then each other one a random share of the rest that leaves the ones
        ; after it 6 % or more each and at most 12 below the big one
        lda #15
        jsr API_RMOD
        clc
        adc #44
        ldx hi
        sta vals,x
        sec
        sbc #12
        sta t1                  ; ceiling
        lda #100
        sec
        sbc vals,x
        sta t0                  ; rest
        lda pie_n
        sec
        sbc #2
        sta t3                  ; others still to come after this one
        ldx #0
@sl:    cpx hi
        beq @sn
        stx t2
        lda t3                  ; this one's range: max(6, rest - ceiling × after) .. min(ceiling, rest - 6 × after)
        ldx t1
        jsr mul8
        lda t0
        sec
        sbc m_lo
        bcc :+
        cmp #6
        bcs :++
:       lda #6
:       sta k                   ; low end
        lda t3
        asl
        adc t3
        asl                     ; 6 × after
        eor #$ff
        sec
        adc t0
        cmp t1
        bcc :+
        lda t1
:       sec
        sbc k
        adc #0                  ; (C=1: + 1) range size
        jsr API_RMOD
        clc
        adc k
        ldx t2
        sta vals,x
        lda t0
        sec
        sbc vals,x
        sta t0
        dec t3
@sn:    inx
        cpx pie_n
        bne @sl
@ok:    jsr draw_pie
        ; narrations: the big slice; the others (in random order)
        ldx hi
        jsr say_pie
        ldx pie_n
        dex
        jsr ident6
        lda #0
        sta k
:       ldx k
        lda tmp6,x
        cmp hi
        beq :+
        tax
        jsr say_pie
:       inc k
        lda k
        cmp pie_n
        bne :--
        jmp options

; X = slice: a spec "{L} is the biggest slice".
say_pie:
        lda lab_lo,x
        sta p1
        lda lab_hi,x
        sta p1+1
        lda #PIE_T_N
        ldx #L_PT
        jmp say

; The pie from its cells (angle -> slice colour) and the legend.
draw_pie:
        lda #0                  ; slice boundaries as angles: cumulative % × 2.56
        sta t0
        ldx #0
:       lda vals,x
        clc
        adc t0
        sta t0
        asl
        sta t1
        lda t0
        lsr
        sta t2
        lsr
        lsr
        lsr
        clc
        adc t2
        bcs @full
        adc t1
        bcc :+
@full:  lda #255
:       sta wts,x               ; (reused: boundary of slice x)
        inx
        cpx pie_n
        bne :--
        ldx #63
@c:     lda pie_cell,x          ; angle / 16 in the high nibble: compare its middle with the boundaries
        beq @n
        ora #$0f
        sec
        sbc #7                  ; -> angle × 16 + 8
        ldy #0
:       cmp wts,y
        bcc :+
        iny
        cpy pie_n
        bne :-
        dey
:       lda pie_cols,y
        sta COLOR
        lda pie_cell,x
        and #$0f
        ora #QB
        pha
        txa
        and #7
        clc
        adc #PIE_X
        sta t0
        txa
        lsr
        lsr
        lsr
        clc
        adc #PIE_Y
        tay
        stx t2
        pla
        ldx t0
        jsr API_PUTC
        ldx t2
@n:     dex
        bpl @c
        ; legend: colour block, label, percentage
        lda #0
        sta k
@l:     lda k
        asl
        adc #PIE_Y + 1
        sta t3
        ldx k
        lda pie_cols,x
        sta COLOR
        lda #QB + 15
        ldx #19
        ldy t3
        jsr API_PUTC
        ldx k
        lda lab_lo,x
        pha
        lda lab_hi,x
        tax
        pla
        jsr expand_str
        ldx #21
        ldy t3
        lda #1
        jsr print_obuf
        lda #3
        sta COLOR
        ldx k
        lda vals,x
        ldx #36
        ldy t3
        jsr API_NUM
        lda #'%'
        ldx #38
        ldy t3
        jsr API_PUTC
        inc k
        lda k
        cmp pie_n
        bne @l
        rts

; ---------------------------------------------------------------- matrix

gen_matrix:
        lda #MTIT_N
        jsr API_RMOD
        tay
        ldx #L_MX
        jsr nth
        jsr print_title
        ldx #D_MATS
        jsr deal
        tay
        ldx #L_MA
        jsr nth_rec2
        lda sp
        sta slot_lo + P_A
        lda sp+1
        sta slot_hi + P_A
        jsr skip_1
        lda sp
        sta slot_lo + P_B
        lda sp+1
        sta slot_hi + P_B
        ; our quadrant (bit 0: high on A, bit 1: high on B); the other three shuffled, "them" in the first
        jsr API_RAND
        and #3
        sta hi
        ldx #2
        jsr ident6
        ldx #2
:       lda tmp6,x              ; 0, 1, 2 -> flip A, flip B, flip both
        clc
        adc #1
        eor hi
        sta tmp6,x
        dex
        bpl :-
        jsr draw_matrix
        lda hi
        jsr say_matrix
        lda #0
        sta k
:       ldx k
        lda tmp6,x
        jsr say_matrix
        inc k
        lda k
        cmp #3
        bne :-
        jmp options

; A = quadrant: a spec "We are {a} {A}, {b} {B}".
say_matrix:
        tax
        and #1
        tay
        lda hl_lo,y
        sta p1
        lda hl_hi,y
        sta p1+1
        txa
        lsr
        tay
        lda hl_lo,y
        sta p2
        lda hl_hi,y
        sta p2+1
        lda #MATRIX_T_N
        ldx #L_MT
        jmp say

draw_matrix:
        lda #1
        sta COLOR
        lda #20
        sta FILL_W
        lda #8
        sta FILL_H
        ldx #MAT_X
        ldy #MAT_Y
        jsr API_BOX
        lda #6                  ; the cross
        sta COLOR
        lda #18
        sta FILL_W
        lda #1
        sta FILL_H
        lda #CH_B
        ldx #MAT_X + 1
        ldy #MAT_Y + 3
        jsr API_FILL
        lda #1
        sta FILL_W
        lda #6
        sta FILL_H
        lda #CH_L
        ldx #MAT_X + 10
        ldy #MAT_Y + 1
        jsr API_FILL
        ; axes: high / low, "^ B" on the left, low / high in the bottom border, "A ->" under it
        text MAT_X - 4, MAT_Y + 1, s_high, 3
        text MAT_X - 3, MAT_Y + 6, s_low, 3
        text MAT_X + 1, MAT_Y + 7, s_lowhigh, 1
        lda #1
        sta capnext
        lda slot_lo + P_B
        ldx slot_hi + P_B
        jsr expand_str
        lda #MAT_X - 1
        sec
        sbc olen
        tax
        ldy #MAT_Y + 3
        lda #1
        jsr print_obuf
        lda #MAT_X - 2          ; (just left of the word)
        sec
        sbc olen
        tax
        lda #CH_UP
        ldy #MAT_Y + 3
        jsr API_PUTC
        lda #1
        sta capnext
        lda slot_lo + P_A
        ldx slot_hi + P_A
        jsr expand_str
        ldx olen                ; + " ->"
        ldy #0
:       lda s_arrow,y
        sta obuf,x
        inx
        iny
        cpy #4
        bne :-
        dex
        stx olen
        lda olen
        lsr
        eor #$ff
        sec
        adc #MAT_X + 10
        tax
        ldy #MAT_Y + 8
        lda #1
        jsr print_obuf
        ; the dots: them (white), us (red)
        lda tmp6
        ldx #1
        jsr dot
        lda hi
        ldx #2
        ; fall through

; A = quadrant, X = colour: a dot at a random spot in it, labelled US / THEM.
dot:    stx pcol
        sta t2
        lda #3
        jsr API_RMOD
        sta t0
        lda t2
        and #1                  ; high on A: right half
        tax
        lda t0
        clc
        adc quad_x,x
        sta t0
        lda #2
        jsr API_RMOD
        sta t1
        lda t2
        lsr                     ; high on B: top half
        eor #1
        tax
        lda t1
        clc
        adc quad_y,x
        sta t1
        lda pcol
        sta COLOR
        lda #QB + 15
        ldx t0
        ldy t1
        jsr API_PUTC
        lda #<s_them
        ldx #>s_them
        ldy pcol
        cpy #1
        beq :+
        lda #<s_us
        ldx #>s_us
:       sta PTR
        stx PTR+1
        lda #7
        sta COLOR
        ldx t0
        inx
        ldy t1
        jmp API_PRINT

; ---------------------------------------------------------------- funnel

gen_funnel:
        ldx #D_FUNS
        jsr deal
        tay
        ldx #L_FU
        jsr nth_rec5
        jsr print_title
        ldx #0                  ; the four stages
:       stx t2
        jsr skip_1
        ldx t2
        lda sp
        sta lab_lo,x
        lda sp+1
        sta lab_hi,x
        inx
        cpx #4
        bne :-
        lda #3
        jsr API_RMOD
        sta hi                  ; the big drop: after stage hi
        lda #5
        jsr API_RMOD
        tax
        lda fun_start,x
        sta fv
        ldx #0
@v:     stx t2                  ; next = this × 0.2-0.35 (the drop) or × 0.8-0.9
        lda #39
        jsr API_RMOD
        clc
        adc #51
        ldx t2
        cpx hi
        beq :+
        lda #26
        jsr API_RMOD
        clc
        adc #205
:       sta t3
        ldx t2
        lda fv,x                ; v × t3 / 256 (rounded)
        ldx t3
        jsr mul8
        asl m_lo
        lda m_hi
        adc #0
        ldx t2
        sta fv+1,x
        inx
        cpx #3
        bne @v
        jsr draw_funnel
        ldx hi                  ; narrations: the big drop, then the other two stages
        jsr say_funnel
        ldx #2
        jsr ident6
        lda #0
        sta k
:       ldx k
        lda tmp6,x
        cmp hi
        beq :+
        tax
        jsr say_funnel
:       inc k
        lda k
        cmp #3
        bne :--
        jmp options

; X = stage: a spec "The big drop is from {S1} to {S2}".
say_funnel:
        lda lab_lo,x
        sta p1
        lda lab_hi,x
        sta p1+1
        lda lab_lo+1,x
        sta p2
        lda lab_hi+1,x
        sta p2+1
        lda #FUNNEL_T_N
        ldx #L_FT
        jmp say

; Stages as bars of 6 + 24 × v / v0 half-cells (each over two rows, narrowing to the next), label, value.
draw_funnel:
        ldx #0
@w:     stx t2
        lda fv,x                ; width = 6 + v × 24 / v0 (half-cells)
        ldx #24
        jsr mul8
        lda m_lo
        sta d_num
        lda m_hi
        sta d_num+1
        lda fv
        sta d_den
        lda #0
        sta d_den+1
        jsr div16
        ldx t2
        clc
        adc #6
        sta wts,x
        inx
        cpx #4
        bne @w
        lda wts+3               ; past the last stage: three quarters of it
        lsr
        sta t0
        lsr
        clc
        adc t0
        sta wts+4
        lda #0
        sta k
@st:    ldx k
        lda fun_cols,x
        sta pcol
        lda wts,x
        sta t3
        txa
        asl
        adc #PLOT_ROW
        sta t1                  ; row
        jsr fun_row
        ldx k
        lda wts,x
        clc
        adc wts+1,x
        lsr
        sta t3
        inc t1
        jsr fun_row
        ldx k                   ; label (right-aligned to col 17) and value
        lda lab_lo,x
        pha
        lda lab_hi,x
        tax
        pla
        jsr expand_str
        lda #18
        sec
        sbc olen
        tax
        ldy t1
        dey
        lda #1
        jsr print_obuf
        lda #3                  ; value (in tens)
        sta COLOR
        ldx k
        lda fv,x
        ldx #35
        ldy t1
        dey
        jsr API_NUM
        lda #'0'
        ldx #36                 ; after the digits: 2 or 3 of them
        ldy k
        lda fv,y
        cmp #10
        bcc :+
        inx
        cmp #100
        bcc :+
        inx
:       lda #'0'
        ldy t1
        dey
        jsr API_PUTC
        inc k
        lda k
        cmp #4
        bne @st
        rts

; One funnel row t1: t3 half-cells centred on FUN_MID, colour pcol.
fun_row:
        lda t3
        lsr
        eor #$ff
        sec
        adc #FUN_MID
        sta x0                  ; first half-cell
        clc
        adc t3
        sta x1                  ; past the last
        lda t1
        asl
        sta y0
@h:     jsr plot                ; both quarter pixels of the half-cell
        inc y0
        jsr plot
        dec y0
        inc x0
        lda x0
        cmp x1
        bne @h
        rts

; ---------------------------------------------------------------- Venn

gen_venn:
        lda #VTIT_N
        jsr API_RMOD
        tay
        ldx #L_VX
        jsr nth
        jsr print_title
        ldx #D_VENNS
        jsr deal
        sta t3
        tay
        ldx #L_VE
        jsr nth_rec3
        lda sp
        sta slot_lo + P_A
        sta lab_lo
        lda sp+1
        sta slot_hi + P_A
        sta lab_hi
        jsr skip_1
        lda sp
        sta slot_lo + P_B
        sta lab_lo+1
        lda sp+1
        sta slot_hi + P_B
        sta lab_hi+1
        jsr skip_1
        lda sp
        sta lab_lo+2
        lda sp+1
        sta lab_hi+2
:       lda #VENNS_N            ; another set's overlap
        jsr API_RMOD
        cmp t3
        beq :-
        tay
        ldx #L_VE
        jsr nth_rec3
        jsr skip_1
        jsr skip_1
        lda sp
        sta lab_lo+3
        lda sp+1
        sta lab_hi+3
        jsr draw_venn
        ldx #2                  ; right: the overlap; wrong: A, B, the other overlap (shuffled)
        jsr say_venn
        ldx #2
        jsr ident6
        lda #0
        sta k
:       ldx k
        lda tmp6,x              ; 0 A, 1 B, 2 -> 3 the other overlap
        cmp #2
        bne :+
        lda #3
:       tax
        jsr say_venn
        inc k
        lda k
        cmp #3
        bne :--
        jmp options

; X = which (lab_*): a spec "The overlap is {C}".
say_venn:
        lda lab_lo,x
        sta p1
        lda lab_hi,x
        sta p1+1
        lda #VENN_T_N
        ldx #L_VT
        jmp say

draw_venn:
        ldx #7 * 11 - 1
@c:     lda venn_cell,x         ; region in bits 4-5, quarter-block bits below
        beq @n
        pha
        lsr
        lsr
        lsr
        lsr
        tay
        lda venn_cols-1,y
        sta COLOR
        txa                     ; column / row of cell x (11 a row)
        ldy #VENN_Y
:       cmp #11
        bcc :+
        sbc #11
        iny
        bne :-
:       adc #VENN_X
        stx t2
        tax
        pla
        and #$0f
        ora #QB
        jsr API_PUTC
        ldx t2
@n:     dex
        bpl @c
        lda lab_lo              ; A right-aligned to col 21, B from col 25, the overlap centred under them
        ldx lab_hi
        jsr expand_str
        lda #VENN_X + 4
        sec
        sbc olen
        tax
        ldy #VENN_Y - 1
        lda #1
        jsr print_obuf
        lda lab_lo+1
        ldx lab_hi+1
        jsr expand_str
        ldx #VENN_X + 7
        ldy #VENN_Y - 1
        lda #1
        jsr print_obuf
        lda lab_lo+2
        ldx lab_hi+2
        jsr expand_str
        lda olen
        clc
        adc #1
        lsr
        eor #$ff
        sec
        adc #VENN_X + 6
        tax
        ldy #VENN_Y + 7
        lda #7
        jmp print_obuf

; ---------------------------------------------------------------- drawing helpers

; Quarter pixel x0, y0 (2 per cell) on, the cell in colour pcol.
plot:   lda y0
        lsr
        tax
        lda x0
        lsr
        clc
        adc row_lo,x
        sta scr
        sta ccl
        lda row_hi,x
        adc #0
        sta scr+1
        adc #>(COLRAM - SCREEN)
        sta ccl+1
        lda y0
        and #1
        asl
        sta t0
        lda x0
        and #1
        ora t0
        tax
        ldy #0
        lda (scr),y
        cmp #QB
        bcs :+
        lda #QB
:       ora qbit,x
        sta (scr),y
        lda pcol
        sta (ccl),y
        rts

; Line x0, y0 -> x1, y1 (Bresenham; small distances, 8-bit error).
line:   lda x1
        sec
        sbc x0
        ldx #1
        bcs :+
        eor #$ff
        adc #1
        ldx #$ff
:       sta ldx_
        stx lsx
        lda y1
        sec
        sbc y0
        ldx #1
        bcs :+
        eor #$ff
        adc #1
        ldx #$ff
:       eor #$ff                ; dy = -|y1 - y0|
        clc
        adc #1
        sta ldy_
        stx lsy
        clc
        adc ldx_
        sta lerr
@l:     jsr plot
        lda x0
        cmp x1
        bne :+
        lda y0
        cmp y1
        beq @out
:       lda lerr
        asl
        sta t1                  ; e2
        sec                     ; e2 >= dy: step x
        sbc ldy_
        bvc :+
        eor #$80
:       bmi :+
        lda lerr
        clc
        adc ldy_
        sta lerr
        lda x0
        clc
        adc lsx
        sta x0
:       lda ldx_                ; e2 <= dx: step y
        sec
        sbc t1
        bvc :+
        eor #$80
:       bmi @l
        lda lerr
        clc
        adc ldx_
        sta lerr
        lda y0
        clc
        adc lsy
        sta y0
        jmp @l
@out:   rts

; Slide title (string sp) on row 3.
print_title:
        lda sp
        ldx sp+1
        jsr expand_str
        ldx #TITLE_X
        ldy #TITLE_Y
        lda #7
        ; fall through
; obuf at X, Y in colour A.
print_obuf:
        sta COLOR
        lda #<obuf
        sta PTR
        lda #>obuf
        sta PTR+1
        jmp API_PRINT

; Row 14: streak (left), nailed (right).
draw_stats:
        lda #STAT_Y
        ldx #1
        jsr clear_rows
        ldx #1
        lda streak
        cmp #2
        bcc :+
        ldx #7
:       stx COLOR
        lda #<s_streak
        sta PTR
        lda #>s_streak
        sta PTR+1
        ldx #0
        ldy #STAT_Y
        jsr API_PRINT
        ldx #8
        ldy #STAT_Y
        lda streak
        jsr API_NUM
        text 31, STAT_Y, s_nailedn, 5
        ldx #38
        ldy #STAT_Y
        lda correct
        jmp API_NUM

; Row 23: the audience's heads (from behind).
draw_heads:
        ldx #19
:       stx t3
        txa                     ; hair colour: hair_tab[(x × 5 + seed) / 2 & 7]
        asl
        asl
        adc t3
        adc hseed
        lsr
        and #7
        tay
        lda hair_tab,y
        sta COLOR
        txa
        asl
        tax
        lda #CH_HAIRL
        ldy #CROWD_Y
        jsr API_PUTC
        lda t3
        asl
        tax
        inx
        lda #CH_HAIRR
        ldy #CROWD_Y
        jsr API_PUTC
        ldx t3
        dex
        bpl :-
        rts

; Row 23: three cheers (yellow) or two crickets (cyan) in 13-column slots.
draw_crowd:
        lda #CROWD_Y
        ldx #1
        jsr clear_rows
        lda #2
        sta k
@r:     lda crowd
        cmp #1
        bne @cri
        lda #CHEERS_N
        jsr API_RMOD
        ldx #7
        bne @say
@cri:   lda k
        beq @out
        lda #CRICKETS_N
        jsr API_RMOD
        clc
        adc #CHEERS_N
        ldx #3
@say:   stx COLOR
        tay
        ldx #L_CH
        jsr nth
        lda sp
        ldx sp+1
        jsr expand_str
        lda k
        ldx crowd
        cpx #1
        beq :+
        clc
        adc #3
:       tax
        lda crowd_x,x
        tax
        ldy #CROWD_Y
        lda COLOR
        jsr print_obuf
        dec k
        bpl @r
@out:   rts

; ---------------------------------------------------------------- strings

; sp = string Y of list X (strings one after the other).
nth:    jsr list_sp
        tya
        tax
        ; fall through
; skip X strings at sp
skip_x: dex
        bmi @out
        jsr skip_1
        jmp skip_x
@out:   rts

; sp past the string at sp.
skip_1: ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc sp
        sta sp
        bcc :+
        inc sp+1
:       rts

inc_sp: inc sp
        bne :+
        inc sp+1
:       rts

; sp = list X
list_sp:
        lda list_lo,x
        sta sp
        lda list_hi,x
        sta sp+1
        rts

; Record Y of 2 / 3 / 5 strings in list X.
nth_rec2:
        jsr list_sp
        tya
        asl
        tax
        bpl skip_x
nth_rec3:
        jsr list_sp
        sty t0
        tya
        asl
        adc t0
        tax
        bpl skip_x
nth_rec5:
        jsr list_sp
        sty t0
        tya
        asl
        asl
        adc t0
        tax
        bpl skip_x

; A/X = template / string: expanded into obuf (pairs, placeholders), olen = length.
expand:
        sta sp
        stx sp+1
        lda #0
        sta olen
        sta capnext
        beq ex_walk
; A/X = plain or encoded string (no placeholders), capnext as set.
expand_str:
        sta sp
        stx sp+1
        lda #0
        sta olen
ex_walk:
        ldy #0
        lda (sp),y
        beq @end
        jsr ex_sym
        jsr inc_sp
        jmp ex_walk
@end:   ldx olen
        sta obuf,x
        rts

; One symbol A: a pair expands (recursively), a placeholder writes its slot, a character is stored.
ex_sym: cmp #128
        bcc @plain
        tax
        lda bpe_b - 128,x
        pha
        lda bpe_a - 128,x
        jsr ex_sym
        pla
        jmp ex_sym
@plain: cmp #P_C + 1
        bcs @char
        tax
        cpx #1
        bne :+
        inx                     ; {Y}: slot 2 with a capital letter
        stx capnext
:       lda sp                  ; walk the slot string with the same routine
        pha
        lda sp+1
        pha
        lda slot_lo,x
        sta sp
        lda slot_hi,x
        sta sp+1
@s:     ldy #0
        lda (sp),y
        beq :+
        jsr ex_sym
        jsr inc_sp
        jmp @s
:       pla
        sta sp+1
        pla
        sta sp
        rts
@char:  ldx capnext
        beq :+
        ldx #0
        stx capnext
        cmp #'a'
        bcc :+
        cmp #'z' + 1
        bcs :+
        and #$df
:       ldx olen
        sta obuf,x
        inc olen
        rts

; ---------------------------------------------------------------- arithmetic, decks

; A = d_num / d_den (repeated subtraction: small quotients), remainder in d_num.
div16:  ldx #0
:       lda d_num
        sec
        sbc d_den
        tay
        lda d_num+1
        sbc d_den+1
        bcc :+
        sta d_num+1
        sty d_num
        inx
        bne :-
:       txa
        rts

; m_hi/m_lo = A × X
mul8:   sta m_a
        stx m_lo
        lda #0
        ldx #8
        lsr m_lo
:       bcc :+
        clc
        adc m_a
:       ror
        ror m_lo
        dex
        bne :--
        sta m_hi
        rts

; X = deck: A = the next card (index into its list). A deck is walked from a random start with a random step
; of 1, 3, 5 or 7 that does not divide its size, so every card comes once before the walk starts again.
deal:   stx t3
        lda deck_pos,x
        bne @next
        lda deck_size,x
        sta deck_pos,x
        jsr API_RMOD
        ldx t3
        sta deck_cur,x
@st:    lda #4
        jsr API_RMOD
        asl
        ora #1
        ldx t3
        sta deck_step,x
        cmp #1
        beq @next
        sta t2                  ; size mod step = 0: try another step
        lda deck_size,x
:       sec
        sbc t2
        beq @st
        bcs :-
@next:  ldx t3
        dec deck_pos,x
        lda deck_cur,x
        pha
        clc                     ; cur = (cur + step) mod size
        adc deck_step,x
:       cmp deck_size,x
        bcc :+
        sbc deck_size,x
        bcs :-
:       sta deck_cur,x
        pla
        rts

.rodata
s_name:    .byte "PowerPoint Karaoke", 0
s_help:    .byte "Pick the narration that matches the chart.", 0
s_keys3:   .byte "Keys 1-3, or up/down + FIRE", 0
s_keys4:   .byte "Keys 1-4, or up/down + FIRE", 0
s_slide:   .byte "Slide  /", 0
s_streak:  .byte "Streak x", 0
s_nailedn: .byte "Nailed", 0
s_nailed:  .byte "NAILED IT!", 0
s_awkward: .byte "AWKWARD...", 0
s_silence: .byte "AWKWARD SILENCE", 0
s_high:    .byte "high", 0
s_low:     .byte "low", 0
s_us:      .byte "US", 0
s_them:    .byte "THEM", 0
s_arrow:   .byte " ->", 0
s_lowhigh: .byte "low", CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, CH_B, "high", 0 ; (in the bottom border)
hl_lo:     .byte <s_low, <s_high
hl_hi:     .byte >s_low, >s_high
hair_tab:  .byte 2, 7, 1, 4, 2, 7, 6, 3
skin_tab:  .byte 10, 8, 10
hair_spr:  .byte 9, 11
crowd_x:   .byte 0, 13, 26, 0, 6, 22 ; cheer slots, cricket slots (k = 2, 1)
qbit:      .byte 1, 2, 4, 8
pie_cols:  .byte 2, 7, 5, 6, 4
fun_cols:  .byte 6, 5, 7, 2
venn_cols: .byte 3, 2, 4        ; left, right, both
quad_x:    .byte MAT_X + 2, MAT_X + 11 ; dot columns: low / high on A (+ 0-2)
quad_y:    .byte MAT_Y + 1, MAT_Y + 5  ; dot rows: high / low on B (+ 0-1)
fun_start: .byte 50, 80, 100, 120, 200 ; first stage (in tens)
base_0:    .byte 25, 25, 212, 25 ; series base (values × 25: 0-10 = 0-250) per shape, + rnd(base_n)
base_n:    .byte 38, 38, 39, 26
far_0:     .byte 212, 212, 37, 200 ; the far end
far_n:     .byte 39, 39, 1, 51
slot_w:    .byte 7, 5, 4        ; bar / line slots for 4, 5, 6 points
bar_w:     .byte 3, 3, 2
bar_off:   .byte 2, 1, 1
slot_x0:   .byte PLOT_X, PLOT_X + 1, PLOT_X + 2
row_lo:    .repeat 25, I
           .byte <(SCREEN + I * 40)
           .endrepeat
row_hi:    .repeat 25, I
           .byte >(SCREEN + I * 40)
           .endrepeat

deck_size: .byte M_GEN, M_DEPT, T_DEPT, T_GEN, PIES_N, MATS_N, FUNS_N, VENNS_N, NONS_N

.bss
per_t:     .res 2
half:      .res 2
wpt:       .res 1
nlist:     .res 1
barw:      .res 1
baroff:    .res 1
p1:        .res 2
p2:        .res 2
types:     .res MAX_SLIDES
hseed:     .res 1
tmp6:      .res 6
vals:      .res 6
wts:       .res 6
ptx:       .res 6
pty:       .res 6
fv:        .res 4               ; stage values in tens
lab_lo:    .res 6
lab_hi:    .res 6
slot_lo:   .res P_C + 1
slot_hi:   .res P_C + 1
spec_tl:   .res 4
spec_th:   .res 4
spec_1l:   .res 4
spec_1h:   .res 4
spec_2l:   .res 4
spec_2h:   .res 4
deck_pos:  .res DECKS          ; cards left in the walk
deck_cur:  .res DECKS
deck_step: .res DECKS
obuf:      .res 76              ; a narration: at most 2 × 37 + 0
