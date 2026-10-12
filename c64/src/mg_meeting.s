; Meeting Survival (src/minigames/meeting.js) as a disk-loaded overlay at $4000.
; Stay awake through the boss's monologue: sip coffee (FIRE) to keep your eyelids up, but every sip adds
; jitter, and a full jitter bar shakes your hands for a few seconds (no sips, no nods, no "awake" time).
; Nod (N / up) exactly while a buzzword line is said (or just after it, 0.35 s grace); nodding at filler
; ("Can everyone see my screen?") or twice too often costs a wrong nod. Eyelids at 0 = 2 s asleep.
; Score = 0.6 acc + 0.4 awake × (0.5 + 0.5 min(1, 2 acc)) - 0.15 × naps, acc = (right - 0.75 wrong) / buzz
; lines, awake = share of the time with the eyes above 0.3 and no jitters.
; Difficulty d = MG_DIFF / 255 (JS byDiff(d, a, b) = a + (b - a) × d):
;   d = 0: 35 s, eyelids drop 0.055/s, a line stays 1.6 s (+ 0.016 s per char, max + 0.9 s), jitters 3 s
;   d = 1: 45 s, 0.085/s, 1.0 s, jitters 4 s
; Lines: buzz or filler at random (no more than 3 in a row of either), 0.25-0.45 s pauses between them.
; Content (gen/mg_meeting_data.s, tools/mg/meeting.js): every buzz / filler line (common to all
; departments, byte-pair encoded with their own table and expanded into lbuf when said), the department's
; boss and whiteboard, the reaction pools.
; The JS lids (skin from the top and bottom, below 0.5) are red rows that grow over the screen; nothing is
; drawn under them (the clipped putc / hline / print below) and a lid going up redraws the scene.

.include "api.inc"
.include "gen/chars.inc"
.import __BSS_RUN__, __BSS_SIZE__

; fixed point: eyes and jitter are 0..$ffff = 0..1
AWAKE_HI  = 77                  ; eyes > 0.3 count as awake
LID_HI    = 128                 ; lids below 0.5
SLEEPY_HI = 64                  ; "So... sleepy..." below 0.25 (lids half closed)
EYES_0    = 55705               ; 0.85 at the start
EYES_SNORT = 29491              ; 0.45 after a nap
SIP_K     = 69                  ; sip = 0.27 × (1 - 0.8 jitter) = 69 × (256 - 0.8 × 256 jitter)
JIT_SIP   = 15729               ; + 0.24 per sip
JIT_DECAY = 144                 ; - 0.11/s
JIT_AFTER = 36045               ; 0.55 once the jitters are over
JIT_WARN  = 153                 ; > 0.6: "slurp...?", yellow bar
GRACE     = 18                  ; a nod up to 0.35 s after a buzz line still counts
EARLY     = 13                  ; ... if the next line is filler and younger than 0.25 s
NAP_T     = 100                 ; 2 s asleep
NOD_T     = 15                  ; nod animation 0.3 s
SIP_T     = 20                  ; mug lifted 0.4 s
BOSS_T    = 65                  ; the boss's remark stays 1.3 s (2 s when you nap)
FLO_T     = 50                  ; reactions under the bubble: 1 s
NO_LINE_T = 60                  ; no new line in the last 1.2 s
KEY_N     = 39                  ; key matrix code of N
; screen
BUB_Y     = 2                   ; speech bubble rows 2-5 (life strip in its bottom border)
FLO_Y     = 6                   ; reactions (centred on FLO_X), the bubble's tail at TAIL_X
FLO_X     = 24
TAIL_X    = 6
SLEEPY_Y  = 13
METER_X   = 19                  ; meters: 12 cells, half-cell steps
EYE_Y     = 20
JIT_Y     = 22
SHAKY_X   = 25
MUG_X     = 36
TOP_Y     = 2                   ; the lids cover rows 2-23
BOT_Y     = 23
MC_COL    = 8                   ; colour RAM of the solid multicolour cells (MC_A dark grey, MC_B mid grey)
.if .defined(AUTOPLAY)
BOT_NOD   = 20                  ; the bot nods 0.4 s into a buzz line
BOT_EYES  = 140                 ; ... sips below 0.55 eyes
BOT_JIT   = 170                 ; ... if the jitter is under 0.66
.endif

.zeropage
diff:     .res 1
left:     .res 2                ; frames to go
elapsed:  .res 2
awake_t:  .res 2
eyes:     .res 2
jit:      .res 2
shaky:    .res 1                ; frames of jitters left
asleep:   .res 1                ; frames of nap left
sleeps:   .res 1
buzz_n:   .res 1
correct:  .res 1
wrong:    .res 1
line_on:  .res 1
l_buzz:   .res 1
l_age:    .res 1
l_life:   .res 1
l_nod:    .res 1                ; times nodded
last_buzz: .res 1               ; the previous line, for the grace window
last_nod: .res 1
since_end: .res 1               ; frames since it ended (saturating)
gap:      .res 1
boss_t:   .res 1
nod_a:    .res 1
sip_a:    .res 1
anim:     .res 1
flo_t:    .res 1
done:     .res 1
lid:      .res 1                ; rows under each lid, $ff = redraw everything
vtop:     .res 1                ; visible rows vtop .. vbot1 - 1
vbot1:    .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
sp:       .res 2
k_x:      .res 1
k_a:      .res 1
k_y2:     .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- init
; A = difficulty
init:
        sta diff
        ldx #k_y2 - left        ; zero page state and BSS (the overlay stays loaded between plays)
        lda #0
:       sta left,x
        dex
        bpl :-
        ldx #<(__BSS_SIZE__)
:       sta __BSS_RUN__-1,x
        dex
        bne :-
        lda #<EYES_0
        sta eyes
        lda #>EYES_0
        sta eyes+1
        lda #50                 ; the first line after 1 s
        sta gap
        lda #$ff
        sta last_key
        sta since_end
        ; difficulty curve
        lda diff                ; eyelids drop 72 .. 111 / 65536 per frame
        ldy #39
        jsr mulr
        adc #72
        sta drain
        lda diff                ; a line lives 80 .. 50 frames + its length
        ldy #30
        jsr mulr
        eor #$ff
        sec
        adc #80
        sta base_life
        lda diff                ; jitters 150 .. 200 frames
        ldy #50
        jsr mulr
        adc #150
        sta jit_dur
        lda diff                ; 1750 .. 2250 frames
        ldy #251
        jsr mulr
        asl
        sta left
        lda #0
        rol
        sta left+1
        lda left
        clc
        adc #<1750
        sta left
        lda left+1
        adc #>1750
        sta left+1
        ; the decks: shuffled buzz and filler lines
        ldx #B_COUNT-1
:       txa
        sta bdeck,x
        dex
        bpl :-
        ldx #F_COUNT-1
:       txa
        sta fdeck,x
        dex
        bpl :-
        ldx #B_COUNT-1
@sb:    stx t0
        inx
        txa
        jsr API_RMOD
        tay
        ldx t0
        lda bdeck,x
        pha
        lda bdeck,y
        sta bdeck,x
        pla
        sta bdeck,y
        dex
        bne @sb
        ldx #F_COUNT-1
@sf:    stx t0
        inx
        txa
        jsr API_RMOD
        tay
        ldx t0
        lda fdeck,x
        pha
        lda fdeck,y
        sta fdeck,x
        pla
        sta fdeck,y
        dex
        bne @sf
        ; screen
        text 1, 0, s_name, 7
        lda #<s_footer
        ldx #>s_footer
        jsr footer
        lda #$ff
        sta lid
        sta nods_shown
        jsr refresh
        lda left
        ldx left+1
        jmp timer_start

; ---------------------------------------------------------------- maths
; A × Y -> A = round(A × Y / 256), C = 0
mulr:   jsr mul8
        ldx m_lo
        cpx #$80
        adc #0
        clc
        rts

; A × Y -> A = high byte, m_lo = low byte
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

; A:m_lo / t2 -> m_lo (needs A < t2)
div8:   ldx #8
@d:     asl m_lo
        rol
        bcs @s
        cmp t2
        bcc :+
@s:     sbc t2
        inc m_lo
:       dex
        bne @d
        rts

; ---------------------------------------------------------------- frame
frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        lda nod_a
        beq :+
        dec nod_a
:       lda sip_a
        beq :+
        dec sip_a
:       lda boss_t
        beq :+
        dec boss_t
        bne :+
        inc bub_dirty
:       lda flo_t
        beq :+
        dec flo_t
        bne :+
        jsr clear_floater
:       inc elapsed
        bne :+
        inc elapsed+1
:       lda left
        bne :+
        dec left+1
:       dec left
        jsr timer_tick
        bcc :+
        jmp finish
:       inc since_end
        bne :+
        dec since_end
:
        ; ---- the monologue goes on regardless
        lda line_on
        beq @gap
        inc l_age
        lda l_age
        cmp l_life
        bcc @chem
        lda l_buzz              ; the line is over
        sta last_buzz
        lda l_nod
        sta last_nod
        lda #0
        sta since_end
        sta line_on
        inc bub_dirty
        lda #10                 ; 0.25-0.45 s
        jsr API_RMOD
        clc
        adc #13
        sta gap
        bne @chem
@gap:   lda gap
        beq :+
        dec gap
        bne @chem
:       lda left+1
        bne :+
        lda left
        cmp #NO_LINE_T+1
        bcc @chem
:       jsr next_line

        ; ---- body chemistry
@chem:  lda shaky
        beq @decay
        dec shaky
        bne @nap
        lda #<JIT_AFTER
        sta jit
        lda #>JIT_AFTER
        sta jit+1
        bne @nap
@decay: lda jit
        sec
        sbc #JIT_DECAY
        sta jit
        bcs @nap
        lda jit+1
        beq :+
        dec jit+1
        jmp @nap
:       lda #0
        sta jit
        sta jit+1
@nap:   lda asleep
        beq @awake
        dec asleep
        bne :+
        jsr wake_up
        clc
        rts
:       jsr draw_zzz
        clc
        rts
@awake: lda eyes
        sec
        sbc drain
        sta eyes
        bcs :+
        dec eyes+1
        lda eyes+1
        cmp #$ff
        bne :+
        lda #0
        sta eyes
        sta eyes+1
:       lda eyes+1
        cmp #AWAKE_HI
        bcc :+
        lda shaky
        bne :+
        inc awake_t
        bne :+
        inc awake_t+1
:       lda eyes
        ora eyes+1
        bne @input
        jsr fall_asleep
        clc
        rts

        ; ---- input
@input:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda $cb                 ; N, on the press only
        cmp last_key
        sta last_key
        beq :+
        cmp #KEY_N
        beq @nod
:       lda JOYP
        and #J_UP
        beq :+
@nod:   jsr nod
:       lda JOYP
        and #J_FIRE
        beq :+
        jsr sip
:       jsr refresh
        clc
        rts

.if .defined(AUTOPLAY)
; The bot: nods each buzz line once, sips when the eyes sag and the jitter allows it.
bot:    lda line_on
        beq @sip
        lda l_buzz
        beq @sip
        lda l_nod
        bne @sip
        lda l_age
        cmp #BOT_NOD
        bcc @sip
        jmp nod
@sip:   lda shaky
        bne @out
        lda eyes+1
        cmp #BOT_EYES
        bcs @out
        lda jit+1
        cmp #BOT_JIT
        bcs @out
        jmp sip
@out:   rts
.endif

; Start a new line: buzz or filler (at most 3 in a row of either), from the shuffled decks.
next_line:
        jsr API_RAND
        and #1
        ldx run_b
        cpx #3
        bcc :+
        lda #0
:       ldx run_f
        cpx #3
        bcc :+
        lda #1
:       sta l_buzz
        tax
        beq @fill
        inc run_b
        lda #0
        sta run_f
        inc buzz_n
        ldx bi
        lda bdeck,x
        inx
        cpx #B_COUNT
        bcc :+
        ldx #0
:       stx bi
        jmp @got
@fill:  stx run_b
        inc run_f
        ldx fi
        lda fdeck,x
        inx
        cpx #F_COUNT
        bcc :+
        ldx #0
:       stx fi
        clc
        adc #B_COUNT
@got:   tax
        lda line_lo,x
        sta sp
        lda line_hi,x
        sta sp+1
        jsr expand
        lda #<lbuf
        sta sp
        lda #>lbuf
        sta sp+1
        ; life = base + min(45, 0.8 × length)
        ldy #$ff
:       iny
        lda (sp),y
        bne :-
        sty t0                  ; first line
        iny
        sty t1                  ; start of the second
        lda (sp),y
        beq :+
        dec t1                  ; (+ 1 for the space between)
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        sec
        sbc t1                  ; second line's length (+1 if any)
        clc
        adc t0
        ldy #205
        jsr mulr
        cmp #45
        bcc :+
        lda #45
:       clc
        adc base_life
        sta l_life
        lda #0
        sta l_age
        sta l_nod
        lda #1
        sta line_on
        inc bub_dirty
        rts

; Expand the byte-pair encoded line at sp (two 0-terminated halves) into lbuf.
expand: ldy #0
        sty xw
        sty xr
        lda #2
        sta t0
@next:  ldy xr
        inc xr
        lda (sp),y
        pha
        jsr @emit
        pla
        bne @next
        dec t0
        bne @next
        rts
@emit:  bpl @put                ; 128+: a pair (of chars or pairs)
        tax
        lda bpe_b-128,x
        pha
        lda bpe_a-128,x
        jsr @emit
        pla
        jmp @emit
@put:   ldx xw
        sta lbuf,x
        inc xw
        rts

; Nod: right while a buzz line is said (or just after), wrong otherwise.
nod:    lda #NOD_T
        sta nod_a
        lda shaky
        beq :+
        lda #<s_twitchy
        ldx #>s_twitchy
        ldy #7
        jmp click
:       ; target: the line, or the previous one if it was buzz, un-nodded and just over
        lda line_on
        beq @last
        lda l_buzz
        bne @line
        lda l_age
        cmp #EARLY
        bcs @line
@last:  lda last_buzz
        beq @line
        lda last_nod
        bne @line
        lda since_end
        cmp #GRACE
        bcs @line
        inc last_nod
        bne @right              ; (always)
@line:  lda line_on
        beq @wrong
        lda l_buzz
        beq @wrong
        inc bub_dirty
        inc l_nod
        lda l_nod
        cmp #1
        beq @right
        cmp #3                  ; one bonus bob is harmless
        bcc @out
        lda #3
        sta l_nod
        lda #<s_weget
        ldx #>s_weget
        bne @say
@right: inc correct
        lda #SFX_GOOD
        jsr API_SFX
        lda #GOODNOD_N
        jsr API_RMOD
        tax
        lda goodnod_lo,x
        pha
        lda goodnod_hi,x
        tax
        pla
        ldy #5
        jmp floater
@out:   rts
@wrong: lda #BADNOD_N
        jsr API_RMOD
        tay
        lda badnod_lo,y
        ldx badnod_hi,y
@say:   sta boss_ptr
        stx boss_ptr+1
        inc wrong
        lda #SFX_BAD
        jsr API_SFX
        lda #BOSS_T
        sta boss_t
        inc bub_dirty
        lda #<s_minus
        ldx #>s_minus
        ldy #2
        jmp floater

; Sip: eyes up (less with jitter), jitter up; a full jitter bar = the jitters.
sip:    lda #SIP_T
        sta sip_a
        lda shaky
        beq :+
        lda #<s_shaking
        ldx #>s_shaking
        ldy #7
        jmp click
:       lda jit+1               ; gain = 69 × (256 - 0.8 × jitter)
        ldy #205
        jsr mulr
        eor #$ff
        sec
        adc #0                  ; 256 - t (t = 0 -> 0: the full 256 below)
        beq @full
        ldy #SIP_K
        jsr mul8
        sta t1
        lda m_lo
        jmp @add
@full:  lda #SIP_K
        sta t1
        lda #0
@add:   clc
        adc eyes
        sta eyes
        lda t1
        adc eyes+1
        sta eyes+1
        bcc :+
        lda #$ff
        sta eyes
        sta eyes+1
:       lda jit
        clc
        adc #<JIT_SIP
        sta jit
        lda jit+1
        adc #>JIT_SIP
        sta jit+1
        bcc @ok
        lda #$ff                ; the jitters
        sta jit
        sta jit+1
        lda jit_dur
        sta shaky
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_jitters
        ldx #>s_jitters
        ldy #2
        jmp floater
@ok:    lda #SFX_BLIP
        jsr API_SFX
        lda jit+1
        cmp #JIT_WARN+1
        lda #<s_slurp
        ldx #>s_slurp
        ldy #3
        bcc :+
        lda #<s_slurp2
        ldx #>s_slurp2
        ldy #7
:       jmp floater

; A/X = message, Y = colour, with a click (the shaky hands' "no").
click:  jsr floater
        lda #5                  ; rim shot
        jmp API_SFX

fall_asleep:
        lda #NAP_T
        sta asleep
        sta boss_t
        inc sleeps
        lda #SFX_BAD
        jsr API_SFX
        lda #ASLEEP_N
        jsr API_RMOD
        tax
        lda asleep_lo,x
        sta boss_ptr
        lda asleep_hi,x
        sta boss_ptr+1
        lda #0
        sta flo_t
        lda #$ff                ; everything is redrawn on waking up
        sta lid
        lda #TOP_Y              ; the nap screen
        ldx #BOT_Y - TOP_Y + 1
        jsr clear_rows
        center 16, s_asleep, 2
        lda #2                  ; the boss's remark (under the JS lids it is never seen)
        sta COLOR
        lda boss_ptr
        ldx boss_ptr+1
        ldy #18
        jsr API_CENTER
        ; fall through

; The nap: 1-4 Z's.
draw_zzz:
        lda #10
        ldx #1
        jsr clear_rows
        lda anim                ; (JS: 3 a second)
        lsr
        lsr
        lsr
        lsr
        and #3
        tay
        lda #<(s_zzz + 3)
        sty t0
        sec
        sbc t0
        ldx #>(s_zzz + 3)
        bcs :+
        dex
:       ldy #6
        sty COLOR
        ldy #10
        jmp API_CENTER

wake_up:
        lda #<EYES_SNORT
        sta eyes
        lda #>EYES_SNORT
        sta eyes+1
        lda #1                  ; kick
        jsr API_SFX
        jsr refresh             ; the scene back (lid = $ff)
        lda #<s_snort
        ldx #>s_snort
        ldy #7
        jmp floater

; score = 0.6 acc + 0.4 awake × (0.5 + 0.5 min(1, 2 acc)) - 0.15 × naps
finish:
        lda #0
        sta t0                  ; acc
        lda correct             ; (4 right - 3 wrong) / (4 buzz)
        asl
        asl
        sta t1
        lda wrong
        asl
        adc wrong
        sta t2
        lda t1
        sec
        sbc t2
        bcc @acc
        beq @acc
        ldy #255
        jsr mul8
        ldx buzz_n
        beq @acc
        pha
        txa
        asl
        asl
        sta t2
        pla
        jsr div8
        lda m_lo
        sta t0
@acc:   lda elapsed+1           ; awake = awake_t / elapsed (both scaled to 8 bit)
        beq :+
        lsr elapsed+1
        ror elapsed
        lsr awake_t+1
        ror awake_t
        jmp @acc
:       lda elapsed
        sta t2
        lda awake_t
        ldy #255
        jsr mul8
        jsr div8
        lda m_lo
        ldy #102                ; 0.4 awake
        jsr mulr
        sta t1
        lda t0                  ; × (128 + min(127, acc)) / 256
        cmp #127
        bcc :+
        lda #127
:       clc
        adc #128
        ldy t1
        jsr mulr
        sta t1
        lda t0
        ldy #153                ; + 0.6 acc
        jsr mulr
        adc t1
        ldx sleeps              ; - 38 per nap
        beq @set
:       sec
        sbc #38
        bcs :+
        lda #0
        beq @set
:       dex
        bne :--
@set:   sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; ---------------------------------------------------------------- drawing
; Lids, the bubble, the life strip, the counter, then a quarter of the animated bits.
refresh:
        lda eyes+1              ; lid rows = (0.5 - eyes) / 0.5 × 11
        sec
        sbc #LID_HI
        bcs @none
        eor #$ff
        adc #1
        ldy #22
        jsr mulr
        .byte $2c               ; (skip the lda)
@none:  lda #0
        cmp lid
        beq @same
        php
        sta lid
        clc
        adc #TOP_Y
        sta vtop
        lda #BOT_Y + 1
        sec
        sbc lid
        sta vbot1
        plp
        bcs :+
        jsr draw_all            ; a lid went up
        jmp @same
:       jsr draw_lids
@same:  lda bub_dirty
        beq :+
        jsr draw_bubble
:       jsr draw_strip
        lda correct             ; "Nods c/b" (both only go up)
        clc
        adc buzz_n
        cmp nods_shown
        beq :+
        sta nods_shown
        jsr draw_nods
:       lda anim
        and #3
        bne :+
        jmp dyn_boss
:       cmp #2
        bcs :+
        jmp dyn_eyes
:       bne :+
        jmp dyn_jit
:       jmp dyn_hud

; Everything (the visible rows).
draw_all:
        lda vbot1
        sec
        sbc vtop
        bne :+
        jmp draw_lids
:       sta FILL_H
        lda #40
        sta FILL_W
        lda #7
        sta COLOR
        ldx #0
        ldy vtop
        lda #' '
        jsr API_FILL
        ; static runs, cells, texts
        ldx #0
@f:     lda fills,x
        bmi @c0
        sta k_x
        lda fills+1,x
        sta t0
        lda fills+2,x
        sta FILL_W
        lda fills+4,x
        sta COLOR
        lda fills+3,x
        stx t1
        ldx k_x
        ldy t0
        jsr hline
        lda t1
        clc
        adc #5
        tax
        bne @f
@c0:    ldx #0
@c:     lda cells,x
        bmi @t0
        sta k_x
        lda cells+3,x
        sta COLOR
        lda cells+1,x
        tay
        lda cells+2,x
        stx t1
        ldx k_x
        jsr putc
        lda t1
        clc
        adc #4
        tax
        bne @c
@t0:    ldx #0
@t:     lda texts,x
        bmi @box
        sta k_x
        lda texts+2,x
        sta COLOR
        lda texts+3,x
        sta PTR
        lda texts+4,x
        sta PTR+1
        lda texts+1,x
        tay
        stx t1
        ldx k_x
        jsr print
        lda t1
        clc
        adc #5
        tax
        bne @t
@box:   lda #1                  ; the whiteboard
        sta COLOR
        lda #21
        sta FILL_W
        lda #6
        ldx #11
        ldy #7
        jsr box
        ldx #0                  ; the colleagues
:       stx t1
        lda face_x,x
        ldy face_y,x
        sta k_x
        lda face_hair,x
        ldx k_x
        jsr cface
        ldx t1
        inx
        cpx #4
        bne :-
        jsr draw_bubble
        lda flo_t
        beq :+
        jsr draw_floater
:       jsr dyn_boss
        jsr dyn_eyes
        jsr dyn_jit
        jsr dyn_hud
        ; fall through

; The lids over the rows outside vtop .. vbot1 - 1: blocks, the edge row half.
draw_lids:
        lda lid
        beq @out
        lda #2
        sta COLOR
        lda #40
        sta FILL_W
        ldx lid
        dex
        beq :+
        stx FILL_H
        ldx #0
        ldy #TOP_Y
        lda #CH_BLOCK
        jsr API_FILL
        ldx lid
        dex
        stx FILL_H
        ldx #0
        ldy vbot1
        iny
        lda #CH_BLOCK
        jsr API_FILL
:       lda #1
        sta FILL_H
        ldy vtop
        dey
        ldx #0
        lda #$f3                ; top half
        jsr API_FILL
        ldy vbot1
        ldx #0
        lda #$fc                ; bottom half
        jsr API_FILL
@out:   rts

; The speech bubble: the line (white), the boss's remark (red) or "..." (blue) between lines.
draw_bubble:
        lda #0
        sta bub_dirty
        sta strip_shown
        dec strip_shown         ; ($ff: redraw the strip)
        lda #1
        ldx line_on
        bne :+
        lda #6
:       ldx boss_t
        beq :+
        lda #2
:       sta COLOR
        sta bub_col
        lda #40
        sta FILL_W
        lda #4
        ldx #0
        ldy #BUB_Y
        jsr box
        lda #38
        sta FILL_W
        lda #' '
        ldx #1
        ldy #BUB_Y+1
        jsr hline
        ldy #BUB_Y+2
        jsr hline
        lda #' '                ; the tail
        ldx bub_col
        cpx #6
        beq :+
        lda #$f3
:       ldx #TAIL_X
        ldy #FLO_Y
        jsr putc
        lda bub_col
        cmp #6
        beq @idle
        cmp #2
        beq @boss
        lda #<lbuf              ; the line, in two rows
        sta PTR
        sta sp
        lda #>lbuf
        sta PTR+1
        sta sp+1
        ldx #2
        ldy #BUB_Y+1
        jsr print
        ldy #$ff
:       iny
        lda (sp),y
        bne :-
        tya
        sec
        adc sp
        sta PTR
        lda sp+1
        adc #0
        sta PTR+1
        ldx #2
        ldy #BUB_Y+2
        jsr print
        lda l_nod
        beq @out
        lda #<s_nodded
        sta PTR
        lda #>s_nodded
        sta PTR+1
        lda #5
        sta COLOR
        ldx #32
        ldy #BUB_Y
        jmp print
@idle:  lda #<s_dots
        ldx #>s_dots
        bne :+
@boss:  lda boss_ptr
        ldx boss_ptr+1
:       ldy #BUB_Y+1
        jmp cprint
@out:   rts

; The line's remaining life: the bubble's bottom border, white for what is left.
draw_strip:
        lda line_on
        beq @out
        lda boss_t
        bne @out
        lda l_life              ; cells = 38 × (life - age) / life
        sta t2
        sec
        sbc l_age
        ldy #38
        jsr mul8
        jsr div8
        lda m_lo
        cmp strip_shown
        beq @out
        sta strip_shown
        sta FILL_W
        lda #1
        sta COLOR
        lda #CH_B
        ldx #1
        ldy #BUB_Y+3
        ldx FILL_W
        beq :+
        ldx #1
        jsr hline
:       lda #38
        sec
        sbc strip_shown
        beq @out
        sta FILL_W
        lda #6
        sta COLOR
        lda strip_shown
        clc
        adc #1
        tax
        lda #CH_B
        ldy #BUB_Y+3
        jmp hline
@out:   rts

; "Nods c/b" top right.
draw_nods:
        ldy #0
        lda correct
        jsr dec_buf
        lda #'/'
        sta nbuf,y
        iny
        lda buzz_n
        jsr dec_buf
        lda #0
        sta nbuf,y
        lda #5
        sta FILL_W
        lda #1
        sta FILL_H
        sta COLOR
        lda #' '
        ldx #35
        ldy #0
        jsr API_FILL
        text 30, 0, s_nods, 1
        lda #<nbuf
        sta PTR
        lda #>nbuf
        sta PTR+1
        ldx #35
        ldy #0
        jmp API_PRINT

; A (< 100) in decimal at nbuf,y; Y moves on.
dec_buf:
        ldx #'0'
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       cpx #'0'
        beq :+
        pha
        txa
        sta nbuf,y
        iny
        pla
:       ora #'0'
        sta nbuf,y
        iny
        rts

; ---- animated bits, one group a frame
; The boss (hair red while he is annoyed, the pointing arm waves while he talks), the sleeper's z,
; the laptop and the doodle.
dyn_boss:
        lda #1
        ldx boss_t
        beq :+
        lda #2
:       sta COLOR
        ldx #4
        ldy #7
        lda #CH_HAIRL
        jsr putc
        inx
        lda #CH_HAIRR
        jsr putc
        lda #4                  ; clear both arm rows, then the arm in one
        sta FILL_W
        lda #' '
        ldx #7
        ldy #9
        jsr hline
        iny
        jsr hline
        lda line_on
        beq :+
        lda anim                ; (JS: twice a second)
        and #32
        beq :+
        dey
:       lda #MC_COL
        sta COLOR
        lda #2
        sta FILL_W
        lda #MC_A
        jsr hline
        lda #7
        sta COLOR
        ldx #9
        lda #$f5                ; hand: left half
        jsr putc
        lda #1
        sta COLOR
        inx
        lda #'-'                ; the pointer
        jsr putc
        ; the sleeper's z: three places
        lda #0
        sta COLOR
        ldx #2
:       stx t1
        lda zzz_x,x
        ldy zzz_y,x
        tax
        lda #' '
        jsr putc
        ldx t1
        dex
        bpl :-
        lda anim
        lsr
        lsr
        lsr
        lsr
        lsr
        tax
:       cpx #3                  ; (anim / 32) mod 3
        bcc :+
        dex
        dex
        dex
        bcs :-
:       lda #6
        sta COLOR
        lda zzz_ch,x
        pha
        lda zzz_y,x
        tay
        lda zzz_x,x
        tax
        pla
        jsr putc
        ; laptop screen
        ldx #3                  ; (JS: twice a second)
        lda anim
        and #32
        beq :+
        ldx #5
:       stx COLOR
        lda #2
        sta FILL_W
        lda #CH_BLOCK
        ldx #3
        ldy #19
        jsr hline
        ; doodle: the pen moves along the pad
        lda #1
        sta COLOR
        lda #4
        sta FILL_W
        lda #'='
        ldx #34
        jsr hline
        lda anim
        lsr
        lsr
        lsr
        lsr
        and #3
        clc
        adc #34
        tax
        lda #6
        sta COLOR
        lda #'*'
        jmp putc

; EYELIDS label and meter.
dyn_eyes:
        ldy #2                  ; red at 0.3 and below
        lda eyes+1
        cmp #AWAKE_HI
        bcc :+
        ldy #1
:       sty COLOR
        lda #<s_eyelids
        sta PTR
        lda #>s_eyelids
        sta PTR+1
        ldx #11
        ldy #EYE_Y
        jsr print
        ldx #5                  ; green above 0.5, yellow above 0.3, red
        lda eyes+1
        cmp #LID_HI
        bcs :+
        ldx #7
        cmp #AWAKE_HI
        bcs :+
        ldx #2
:       stx COLOR
        ldy #EYE_Y
        jmp meter

; JITTERS label and meter, SHAKY! blinking.
dyn_jit:
        ldy #1
        lda shaky
        beq :+
        ldy #2
:       sty COLOR
        lda #<s_jitlbl
        sta PTR
        lda #>s_jitlbl
        sta PTR+1
        ldx #11
        ldy #JIT_Y
        jsr print
        ldx #2                  ; red while shaking, yellow above 0.6, else cyan
        lda shaky
        bne :+
        ldx #7
        lda jit+1
        cmp #JIT_WARN+1
        bcs :+
        ldx #3
:       stx COLOR
        lda jit+1
        ldy #JIT_Y
        jsr meter
        lda #2
        sta COLOR
        lda #6
        sta FILL_W
        lda #' '
        ldx #SHAKY_X
        ldy #EYE_Y+1
        jsr hline
        lda shaky
        beq @out
        lda anim
        and #8
        beq @out
        lda #<s_shaky
        sta PTR
        lda #>s_shaky
        sta PTR+1
        ldx #SHAKY_X
        ldy #EYE_Y+1
        jmp print
@out:   rts

; A = level (0-255) as 12 cells of half-cell steps at METER_X, row Y, in COLOR; the rest dim.
meter:  sty t0
        ldy #24
        jsr mulr
        sta t1                  ; half cells 0-24
        lsr
        sta t2                  ; full cells
        beq :+
        sta FILL_W
        lda #CH_BLOCK
        ldx #METER_X
        ldy t0
        jsr hline
:       lda #METER_X
        clc
        adc t2
        tax
        lda t1
        lsr
        bcc :+
        lda #CH_HALF
        ldy t0
        jsr putc
        inx
        inc t2
:       lda #12
        sec
        sbc t2
        beq @out
        sta FILL_W
        lda #6
        sta COLOR
        lda #CH_CHECKER
        ldy t0
        jmp hline
@out:   rts

; The NOD button, your hands (bob on a nod), the mug (lifted on a sip, steaming) and the sleepy warning.
dyn_hud:
        lda #5                  ; button: green, yellow while pressed, blue while shaking
        ldx nod_a
        cpx #NOD_T/2 + 1
        bcc :+
        lda #7
:       ldx shaky
        beq :+
        lda #6
:       sta COLOR
        lda #10
        sta FILL_W
        lda #3
        ldx #0
        ldy #EYE_Y
        jsr box
        lda #<s_nod
        sta PTR
        lda #>s_nod
        sta PTR+1
        lda #1
        sta COLOR
        ldx #4
        ldy #EYE_Y+1
        jsr print
        ; hands: up a row for the first half of the nod
        lda #MC_COL
        sta COLOR
        ldy #18
        ldx #16
        lda #MC_B
        jsr putc
        ldx #23
        jsr putc
        iny
        lda #MC_A
        jsr putc
        ldx #16
        jsr putc
        lda #7
        sta COLOR
        lda nod_a
        cmp #NOD_T/2 + 1
        bcc :+
        dey
:       lda #$fc
        jsr putc
        ldx #23
        jsr putc
        ; the mug
        lda #4
        sta FILL_W
        lda #' '
        ldx #MUG_X
        ldy #EYE_Y
        jsr hline
        iny
        jsr hline
        iny
        jsr hline
        lda #1
        sta COLOR
        lda #3
        sta FILL_W
        ldy #EYE_Y+1
        lda sip_a
        beq :+
        dey
:       lda #$fc                ; rim
        jsr hline
        iny
        lda #CH_BLOCK
        jsr hline
        ldx #MUG_X+3
        lda #')'
        jsr putc
        lda sip_a
        bne @sleepy
        lda anim
        lsr
        lsr
        lsr
        sta t2
        ldx #2                  ; steam
:       stx t1
        txa
        clc
        adc t2
        lsr
        lda #'('
        adc #0                  ; ')'
        pha
        txa
        clc
        adc #MUG_X
        tax
        pla
        ldy #EYE_Y
        jsr putc
        ldx t1
        dex
        bpl :-
@sleepy:
        lda #22
        sta FILL_W
        lda #7
        sta COLOR
        lda #' '
        ldx #9
        ldy #SLEEPY_Y
        jsr hline
        lda eyes+1
        cmp #SLEEPY_HI
        bcs @out
        lda #<s_sleepy
        ldx #>s_sleepy
        ldy #SLEEPY_Y
        jmp cprint
@out:   rts

; ---- reactions under the bubble
; A/X = text, Y = colour: shown for a second.
floater:
floater_ay:
        sta flo_ptr
        stx flo_ptr+1
        sty flo_col
        lda #FLO_T
        sta flo_t
        jsr clear_floater
draw_floater:
        lda flo_ptr
        sta PTR
        lda flo_ptr+1
        sta PTR+1
        lda flo_col
        sta COLOR
        ldy #$ff
:       iny
        lda (PTR),y
        bne :-
        tya
        lsr
        eor #$ff
        sec
        adc #FLO_X
        tax
        ldy #FLO_Y
        jmp print
clear_floater:
        lda #31
        sta FILL_W
        lda #' '
        ldx #TAIL_X+3
        ldy #FLO_Y
        jmp hline

; ---- clipped drawing: nothing under the lids
; A = char at X, Y in COLOR. Keeps A, X, Y.
putc:   cpy vtop
        bcc @out
        cpy vbot1
        bcs @out
        stx k_x
        sty k_y2
        sta k_a
        jsr API_PUTC
        ldx k_x
        ldy k_y2
        lda k_a
@out:   rts

; A = char × FILL_W (> 0) at X, Y in COLOR. Keeps A, X, Y.
hline:  cpy vtop
        bcc @out
        cpy vbot1
        bcs @out
        stx k_x
        sty k_y2
        sta k_a
        lda #1
        sta FILL_H
        lda k_a
        jsr API_FILL
        ldx k_x
        ldy k_y2
        lda k_a
@out:   rts

; PTR at X, Y in COLOR.
print:  cpy vtop
        bcc @out
        cpy vbot1
        bcs @out
        jmp API_PRINT
@out:   rts

; A/X = string centred on row Y, in COLOR.
cprint: sta PTR
        stx PTR+1
        sty t0
        ldy #$ff
:       iny
        lda (PTR),y
        bne :-
        tya
        eor #$ff
        sec
        adc #40
        lsr
        tax
        ldy t0
        jmp print

; Frame at X, Y: FILL_W × A cells in COLOR (the inside is left alone). Uses t0, t2.
box:    sta t0
        stx b_x
        sty b_y
        lda FILL_W
        sta b_w
        ldx #CH_T
        lda #CH_TL
        ldy #CH_TR
        jsr @row
@mid:   inc b_y
        dec t0
        lda t0
        cmp #1
        beq @last
        lda #CH_L
        ldy #CH_R
        jsr @ends
        jmp @mid
@last:  ldx #CH_B
        lda #CH_BL
        ldy #CH_BR
@row:   sty t2                  ; A left, X middle, Y right
        pha
        txa
        pha
        lda b_w
        sec
        sbc #2
        sta FILL_W
        pla
        ldx b_x
        inx
        ldy b_y
        jsr hline
        pla
        ldy t2
@ends:  sty t2
        ldx b_x
        ldy b_y
        jsr putc
        lda b_x
        clc
        adc b_w
        tax
        dex
        lda t2
        jmp putc

; Colleague's face at X, Y (2 × 2), A = hair colour.
cface:  sta COLOR
        lda #CH_HAIRL
        jsr putc
        inx
        lda #CH_HAIRR
        jsr putc
        iny
        lda #7
        sta COLOR
        lda #CH_FACER
        jsr putc
        dex
        lda #CH_FACEL
        jmp putc

.rodata
s_name:    .byte "Meeting Survival", 0
s_help:    .byte "Stay awake, nod only at buzzwords.", 0
s_footer:  .byte "N/Up: nod at buzzwords ONLY. FIRE: sip", 0
s_nods:    .byte "Nods", 0
s_nodded:  .byte "nodded", 0
s_dots:    .byte "...", 0
s_nod:     .byte "NOD", 0
s_nupkey:  .byte "N / Up", 0
s_sip:     .byte "SIP", 0
s_fire:    .byte "FIRE", 0
s_eyelids: .byte "EYELIDS", 0
s_jitlbl:  .byte "JITTERS", 0
s_shaky:   .byte "SHAKY!", 0
s_sleepy:  .byte "So... sleepy... (SIP!)", 0
s_asleep:  .byte "You fell asleep. The boss noticed.", 0
s_zzz:     .byte "ZZZZ", 0
s_snort:   .byte "*snort* I was listening!", 0
s_twitchy: .byte "Too twitchy!", 0
s_shaking: .byte "Hands shaking!", 0
s_jitters: .byte "JITTERS!", 0
s_slurp:   .byte "slurp", 0
s_slurp2:  .byte "slurp...?", 0
s_minus:   .byte "-nod", 0
s_weget:   .byte "Okay, we get it.", 0

; static scene: runs (x, y, width, char, colour)
fills:
        .byte 3, 10, 4, MC_A, MC_COL            ; the boss's suit
        .byte 3, 11, 4, MC_A, MC_COL
        .byte 23, 11, 7, CH_B, 6                ; chart base line
        .byte 36, 11, 2, CH_BLOCK, 5            ; plant
        .byte 36, 12, 2, CH_BLOCK, 2            ; pot
        .byte 36, 13, 2, CH_BLOCK, 2
        .byte 11, 17, 18, MC_B, MC_COL          ; the table, its front edge dark
        .byte 10, 18, 20, MC_B, MC_COL
        .byte 9, 19, 22, MC_A, MC_COL
        .byte 2, 18, 4, CH_BLOCK, 5             ; shirts of the colleagues at the ends
        .byte 34, 18, 4, CH_BLOCK, 4
        .byte 18, 19, 4, '=', 1                 ; your notepad
        .byte $ff
; cells (x, y, char, colour); quarter blocks $f0 + 1 top left, 2 top right, 4 bottom left, 8 bottom right
cells:
        .byte 4, 8, CH_FACEL, 7, 5, 8, CH_FACER, 7      ; the boss
        .byte 3, 9, MC_A, MC_COL, 4, 9, $fa, 2, 5, 9, $f5, 2, 6, 9, MC_A, MC_COL  ; red tie
        .byte 2, 9, MC_A, MC_COL, 2, 10, MC_A, MC_COL, 2, 11, $fc, 7     ; the other arm
        .byte 3, 12, $fa, 6, 4, 12, $f5, 6, 5, 12, $fa, 6, 6, 12, $f5, 6 ; legs
        .byte 3, 13, $fa, 6, 4, 13, $f5, 6, 5, 13, $fa, 6, 6, 13, $f5, 6
        .byte 13, 10, CH_BLOCK, 7, 15, 11, CH_BLOCK, 3, 17, 10, CH_BLOCK, 2, 19, 11, CH_BLOCK, 5 ; sticky notes
        .byte 22, 8, CH_L, 6, 22, 9, CH_L, 6, 22, 10, CH_L, 6, 22, 11, CH_BL, 6  ; chart axis
        .byte 23, 10, $fc, 5, 24, 10, $f3, 5, 25, 9, $f4, 5, 25, 10, $f2, 5     ; going up and to the right
        .byte 26, 10, $f1, 5, 26, 9, $f8, 5, 27, 9, $f3, 5, 28, 8, $fc, 5, 29, 8, $f3, 5
        .byte 35, 8, CH_CLOCK, 1
        .byte 36, 10, $f8, 5, 37, 10, $f4, 5            ; plant top
        .byte 15, 17, $f5, 3                            ; a phone
        .byte 2, 19, $fa, 1, 5, 19, $f5, 1              ; laptop sides
        .byte 22, 21, CH_UP, 1                          ; awake mark (0.3) under the eyelid meter
        .byte $ff
; texts (x, y, colour, string)
texts:
        .byte 1, 14, 7, <s_boss, >s_boss
        .byte 13, 8, 3, <s_board1, >s_board1
        .byte 13, 9, 2, <s_board2, >s_board2
        .byte 2, 23, 3, <s_nupkey, >s_nupkey
        .byte 32, 21, 7, <s_sip, >s_sip
        .byte 32, 22, 3, <s_fire, >s_fire
        .byte $ff
face_x:    .byte 13, 25, 3, 35
face_y:    .byte 15, 15, 16, 16
face_hair: .byte 7, 2, 2, 6
zzz_x:     .byte 27, 28, 29
zzz_y:     .byte 15, 14, 14
zzz_ch:    .byte 'z', 'z', 'Z'

.include "gen/mg_meeting_data.s"

.bss
drain:     .res 1
base_life: .res 1
jit_dur:   .res 1
run_b:     .res 1
run_f:     .res 1
bi:        .res 1
fi:        .res 1
xw:        .res 1
xr:        .res 1
lbuf:      .res 76              ; the line being said, expanded: 2 × (36 + 0)
boss_ptr:  .res 2
flo_ptr:   .res 2
flo_col:   .res 1
bub_dirty: .res 1
bub_col:   .res 1
strip_shown: .res 1
nods_shown: .res 1
last_key:  .res 1
b_x:       .res 1
b_y:       .res 1
b_w:       .res 1
nbuf:      .res 8
bdeck:     .res B_COUNT
fdeck:     .res F_COUNT
