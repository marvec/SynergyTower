; Calendar Defender (src/minigames/defender.js) as a disk-loaded overlay at $4000.
; Lane tower defence on your Friday afternoon: meeting invites march from the right along 5 lanes toward your
; Focus Time. Spend Excuses (1 back every 1.5 s, at most 12) on defences placed on the 10 × 5 calendar grid:
; Decline (2: shoots a "NO" every second, 4 s of hit points), Out of Office (3: a wall, 14 s, gone after 20 s),
; Double-booked (3: slows invites to 45% over two columns) and Headphones (4: hits everything in the lane).
; Spending with too few excuses (or on a taken slot) resets the excuse regeneration. A trickle of invites
; thickens, ending with the CEO All-Hands (the boss). Leaked invites cost a life (5) and 4% of the score.
; Difficulty 0: a 45-s wave (+22 s to clear), 16 invites, excuses every 1.5 s, speed × 0.9, hit points × 1,
;   All-Hands 26 HP. Difficulty 1: 60 s, 32 invites, every 2.1 s, speed × 1.2, HP × 2.3, All-Hands 70 HP;
;   from d = 0.5 recurring meetings split into two minis when declined.
; Score = stopped weight / total weight - 0.04 × leaks (weights: short, std, recur 1, long 2, mini 0.5, boss 4).
; Positions are browser px (x 0-479 = 40 columns of 12 px); a lane is 3 text rows, redrawn in a buffer and
; copied, one lane a frame (each at 10 Hz). The cursor is two bracket sprites; FIRE below the last lane picks
; a defence on the bar. The schedule is kept in 0.32-s steps. Labels show what fits the invite's 3-6 chars.
; Content: gen/mg_defender_data.s.

.include "api.inc"

LANES     = 5
NCOL      = 10
GX        = 48                  ; first grid column, browser px
CW        = 42                  ; column width
FOCUS_X   = 46                  ; invites reaching this x leak into your focus time
WX        = 480                 ; the field's width (invites enter at WX + 2)
LANE_Y    = 3                   ; screen row of lane 0 (3 rows per lane)
HDR_Y     = 2                   ; time labels
BAR_Y     = 19                  ; excuses and the defences
MARK_Y    = 22                  ; marker under the chosen defence
MSG_Y     = 23                  ; floaters
MAXI      = 24                  ; invites at once
MAXB      = 16                  ; "NO" bullets
MAXS      = 34                  ; scheduled invites (32 + the All-Hands + a spare)
CELLS     = LANES * NCOL
K_SHORT   = 0
K_STD     = 1
K_LONG    = 2
K_RECUR   = 3
K_MINI    = 4
K_BOSS    = 5
T_DECLINE = 1                   ; tower types (0 = empty cell)
T_OOO     = 2
T_DBL     = 3
DEC_HP    = 4 * 50              ; hit points in frames of chewing
OOO_HP    = 14 * 50
OOO_LIFE  = 20 * 50
FIRE_T    = 50                  ; a decline shoots every second ...
FIRST_T   = 15                  ; ... the first time after 0.3 s
BULLET_V  = 3                   ; 150 px/s
HIT_T     = 6                   ; white flash, 0.12 s
WAVE_T    = 30                  ; headphones shockwave, 0.6 s
END_T     = 60                  ; the banner, 1.2 s
MSG_T     = 45
MAX_EXC   = 12
QUARTER   = 240                 ; + pattern: 1 top left, 2 top right, 4 bottom left, 8 bottom right
SPR_PTR   = ($e300 - $c000) / 64        ; cursor brackets: left, right

.zeropage
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
sp:       .res 2
cp:       .res 2
done:     .res 1
time:     .res 2                ; frames since the start
next:     .res 1                ; next scheduled invite
excuse:   .res 1
regen_t:  .res 1
lives:    .res 1
killed:   .res 1                ; stopped weight × 2
leaks:    .res 1
sel:      .res 1                ; chosen defence 0-3
cur_c:    .res 1                ; cursor column, lane (lane 5 = the defences bar)
cur_l:    .res 1
end_t:    .res 1                ; > 0: the banner is up
msg_t:    .res 1
anim:     .res 1
li:       .res 1                ; lane being drawn
rr:       .res 1                ; lane redraw rotation
ii:       .res 1                ; invite index
xc:       .res 1                ; char column being drawn
xw:       .res 1                ; chars wide
bk:       .res 1
m0:       .res 3
lastkey:  .res 1
stat_dirty: .res 1
bar_dirty: .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup -------------------------------------------------------------------------------------------

; A = difficulty 0-255 (d = A / 255)
init:
        sta dif
        ldx #bar_dirty - t0
        lda #0
:       sta t0,x
        dex
        bpl :-
        ldx #0                  ; BSS (< 768 bytes)
:       sta bss_start,x
        sta bss_start+256,x
        sta bss_start+512,x
        inx
        bne :-
        lda #5
        sta excuse
        sta lives
        lda #1
        sta cur_c
        lda #2
        sta cur_l
        lda #64
        sta lastkey
        jsr setup_diff
        ldx #5
:       lda s_hour0,x
        sta s_hour,x
        dex
        bpl :-
        lda #':'
        sta s_key+1
        lda #0
        sta s_key+2
        jsr schedule
        ; cursor sprites: hires brackets "[" and "]" (21 rows: 2 rows of 6 px at each end, 2 px between)
        ldx #20 * 3
        ldy #20
@br:    lda #$c0
        sta t0
        lda #$03
        sta t1
        cpy #2
        bcc :+
        cpy #19
        bcc :++
:       lda #$fc
        sta t0
        lda #$3f
        sta t1
:       lda t0
        sta $e300,x
        lda #0
        sta $e301,x
        sta $e302,x
        sta $e340,x
        sta $e341,x
        lda t1
        sta $e342,x
        dex
        dex
        dex
        dey
        bpl @br
        lda #SPR_PTR
        sta SCREEN + $3f8
        lda #SPR_PTR + 1
        sta SCREEN + $3f9
        lda #0
        sta $d01c
        sta $d017
        sta $d01d
        sta $d01b
        lda #3
        sta $d015
        jsr build_lists         ; (empty lane lists)
        jsr draw_scene
        lda limit
        ldx limit+1
        jmp timer_start

; byDiff settings.
setup_diff:
        lda dif                 ; wave 45 + 15 d s: 2250 + 2.94 A frames
        sta m0
        lda #0
        sta m0+1
        asl m0
        rol m0+1
        lda m0                  ; 2 A + A = 3 A
        clc
        adc dif
        sta m0
        bcc :+
        inc m0+1
:       lda dif                 ; - A / 16
        lsr
        lsr
        lsr
        lsr
        sta t0
        lda m0
        sec
        sbc t0
        sta m0
        bcs :+
        dec m0+1
:       lda m0
        clc
        adc #<2250
        sta wave_d
        lda m0+1
        adc #>2250
        sta wave_d+1
        lda wave_d              ; time limit: + 22 s
        clc
        adc #<1100
        sta limit
        lda wave_d+1
        adc #>1100
        sta limit+1
        lda dif                 ; excuses every 75 + 30 d frames (A / 8 - A / 128)
        lsr
        lsr
        lsr
        sta t0
        lsr
        lsr
        lsr
        lsr
        eor #$ff
        sec
        adc t0
        clc
        adc #75
        sta regen
        lda dif                 ; speed × (0.9 + 0.3 d) × 256 = 230 + 0.3 A
        lsr
        lsr
        sta t0
        lsr
        lsr
        lsr
        sta t1                  ; A / 32
        lsr
        clc
        adc t1
        adc t0
        adc #230
        sta smul                ; (≤ 307: kept as 230 + that - 230 below)
        lda #0
        adc #0
        sta smul+1
        lda dif                 ; hit points × (1 + 1.3 d^0.7), × 64: table by round(A / 16)
        lsr
        lsr
        lsr
        lsr
        adc #0
        tax
        lda hpmul_tab,x
        sta hpm
        ; per kind: hit points (at least 1) and speed per frame (px/s × 5.12 × speed factor)
        ldx #K_BOSS - 1
@k:     stx t3
        lda k_hp,x
        ldx hpm
        jsr mul8x8              ; hp × hpm / 64, rounded
        sta m0
        stx m0+1
        lda m0
        clc
        adc #32
        sta m0
        bcc :+
        inc m0+1
:       lda m0+1
        ldy #6
:       lsr
        ror m0
        dey
        bne :-
        lda m0
        bne :+
        lda #1
:       ldx t3
        sta khp,x
        lda k_spd256,x          ; × smul / 256 (smul may pass 255)
        ldx smul
        jsr mul8x8
        txa
        ldx t3
        ldy smul+1
        beq :+
        clc
        adc k_spd256,x
:       sta kspd,x
        dex
        bpl @k
        lda k_spd256 + K_BOSS
        ldx smul
        jsr mul8x8
        txa
        ldy smul+1
        beq :+
        clc
        adc k_spd256 + K_BOSS
:       sta kspd + K_BOSS
        lda dif                 ; All-Hands: 26 + 44 d HP (A / 8 + A / 32 + A / 64)
        lsr
        lsr
        lsr
        sta t0
        lsr
        lsr
        sta t1
        lsr
        clc
        adc t1
        adc t0
        adc #26
        sta khp + K_BOSS
        lda hpm                 ; headphones: 8 × hpMul
        clc
        adc #4
        lsr
        lsr
        lsr
        sta phones_dmg
        lda dif                 ; recurring meetings split from d = 0.5
        cmp #128
        lda #0
        rol
        sta splits
        rts

; The wave schedule: count = 16 + 16 d invites at 3 + f^0.85 × (wave - 8) s (± 0.6 s), then the All-Hands at
; wave - 4 s; sorted by time. Also the total weight.
schedule:
        lda dif                 ; 16 + round(A / 16)
        lsr
        lsr
        lsr
        lsr
        adc #16
        sta count
        lda wave_d              ; span = wave - 400 frames
        sec
        sbc #<400
        sta span
        lda wave_d+1
        sbc #>400
        sta span+1
        lda #$ff
        sta t3                  ; last lane
        lda #0
        sta total
        sta ns
@k:     ldx ns
        cpx count
        bne :+
        jmp @boss
:       txa                     ; f = k / count, × 256
        sta m0+1
        lda #0
        sta m0
        lda count
        jsr div16x8
        lda m0
        lsr
        lsr
        lsr
        tax
        lda pow85_tab,x         ; f^0.85 × span / 256
        sta t0
        lda span
        sta m0
        lda span+1
        sta m0+1
        lda t0
        jsr mul16x8
        lda m0+1                ; + 150 + random -30..30
        clc
        adc #150
        sta t0
        lda m0+2
        adc #0
        sta t1
        lda #61
        jsr API_RMOD
        clc
        adc t0
        sta t0
        bcc :+
        inc t1
:       lda t0
        sec
        sbc #30
        sta t0
        lda t1
        sbc #0
        jsr q16
        ldx ns
        sta s_t,x
        ; lane: random, not the same twice in a row
        lda #LANES
        jsr API_RMOD
        cmp t3
        bne :+
        sta t0
        lda #LANES - 1
        jsr API_RMOD
        clc
        adc #1
        adc t0
        cmp #LANES
        bcc :+
        sbc #LANES
:       sta t3
        ldx ns
        sta s_lk,x
        ; kind by the part of the wave (f) and a roll r
        jsr API_RAND
        sta t1                  ; r × 256
        lda ns                  ; (f from k: k × 4 < count is f < 0.25, k × 5 > count × 2 is f > 0.4)
        asl
        asl
        cmp count
        bcs @later
        lda #K_SHORT            ; f < 0.25: 60% short, else std
        ldy t1
        cpy #154
        bcc @kind
        lda #K_STD
        bne @kind
@later: lda #K_SHORT
        ldy t1
        cpy #64                 ; r < 0.25
        bcc @kind
        lda dif                 ; r < 0.5 + 0.1 d: std (A / 16 + A / 32)
        lsr
        lsr
        lsr
        lsr
        sta t2
        lsr
        clc
        adc t2
        adc #128
        sta t2
        lda #K_STD
        cpy t2
        bcc @kind
        lda splits              ; splits and r < 0.75: recurring
        beq @lng
        lda #K_RECUR
        cpy #192
        bcc @kind
@lng:   lda ns                  ; f > 0.4: long, else std
        asl
        asl
        adc ns                  ; 5 k
        sta t2
        lda count
        asl                     ; 2 count
        cmp t2
        lda #K_STD
        bcs @kind
        lda #K_LONG
@kind:  ldx ns
        pha
        asl
        asl
        asl
        ora s_lk,x
        sta s_lk,x
        pla
        jsr add_weight
        inc ns
        jmp @k
@boss:  lda wave_d              ; the All-Hands at wave - 4 s, lanes 1-3
        sec
        sbc #200
        sta t0
        lda wave_d+1
        sbc #0
        jsr q16
        ldx ns
        sta s_t,x
        lda #3
        jsr API_RMOD
        clc
        adc #1 + K_BOSS * 8
        ldx ns
        sta s_lk,x
        lda #K_BOSS
        jsr add_weight
        inc ns
        ; insertion sort by time
        ldx #1
@i:     cpx ns
        bcs @sorted
        stx t2
        stx t3
@j:     ldx t3
        beq @nx
        lda s_t,x               ; [x] < [x-1]: swap
        cmp s_t-1,x
        bcs @nx
        ldy #1
:       lda s_t,x
        pha
        lda s_t-1,x
        sta s_t,x
        pla
        sta s_t-1,x
        txa                     ; next array (they are MAXS apart)
        clc
        adc #MAXS
        tax
        dey
        bpl :-
        dec t3
        jmp @j
@nx:    ldx t2
        inx
        jmp @i
@sorted:
        rts

; A/t0 = 16-bit frames -> A = in 16ths (16 frames = 0.32 s: the schedule's resolution).
q16:    ldx #4
:       lsr
        ror t0
        dex
        bne :-
        lda t0
        rts

; A = kind: its weight (× 2) into the total, + 2 minis' for a recurring one that splits.
add_weight:
        tax
        lda k_wt,x
        clc
        adc total
        sta total
        cpx #K_RECUR
        bne :+
        lda splits
        beq :+
        lda total
        clc
        adc #2
        sta total
:       rts

; ---- scenery -----------------------------------------------------------------------------------------

draw_scene:
        text 1, 0, s_name, 7
        lda #1
        sta stat_dirty
        sta bar_dirty
        ; time labels: FOCUS, then 13:00 .. 17:00 over every other column
        text 0, HDR_Y, s_focus, 5
        ldx #NCOL - 2
@t:     stx t3
        lda #6
        sta COLOR
        lda t3
        lsr
        clc
        adc #'3'                ; 13:00 .. 17:00
        sta s_hour+1
        lda #<s_hour
        sta PTR
        lda #>s_hour
        sta PTR+1
        lda col_char,x
        tax
        inx
        inx
        ldy #HDR_Y
        jsr API_PRINT
        ldx t3
        dex
        dex
        bpl @t
        jsr draw_bar
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        jsr draw_focus
        ldx #LANES - 1
:       stx li
        jsr draw_lane
        ldx li
        dex
        bpl :-
        rts

; Header: "Lives 5  Stopped 37%" right-aligned.
draw_stats:
        lda #0
        sta stat_dirty
        ldy #0
        lda #<s_lives
        ldx #>s_lives
        jsr bstr
        lda lives
        jsr bnum
        lda #<s_stopped
        ldx #>s_stopped
        jsr bstr
        jsr calc_score          ; round(score × 100)
        ldx #100
        jsr mul8x8
        cmp #128
        txa
        adc #0
        jsr bnum
        lda #'%'
        jsr bput
        lda #0
        sta buf,y
        tya
        eor #$ff
        sec
        adc #40
        tax
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        lda #1
        sta COLOR
        ldy #0
        jsr API_PRINT
        ldx #18                 ; (a space before it, for a shorter line)
        ldy #0
        lda #' '
        jmp API_PUTC

; score = clamp(killed / total - 0.04 × leaks, 0, 1) × 255 -> A
calc_score:
        lda killed              ; killed × 255 / total
        sta m0+1
        lda #0
        sta m0
        lda m0
        sec
        sbc killed
        sta m0
        lda m0+1
        sbc #0
        sta m0+1
        lda total
        jsr div16x8
        lda m0+1
        beq :+
        lda #255
        sta m0
:       lda leaks               ; - 10.2 per leak
        ldx #10
        jsr mul8x8
        sta t0
        lda m0
        sec
        sbc t0
        bcs :+
        lda #0
:       rts

; The bar: excuses (count + regeneration) and the four defences, the chosen one marked.
draw_bar:
        lda #0
        sta bar_dirty
        text 0, BAR_Y, s_exc, 6
        lda #2                  ; count: two columns
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #0
        ldy #BAR_Y + 1
        lda #' '
        jsr API_FILL
        lda #7
        sta COLOR
        ldx #0
        lda excuse
        cmp #10
        bcs :+
        inx
:       ldy #BAR_Y + 1
        jsr API_NUM
        jsr draw_regen
        ; the defences
        ldx #3
@o:     stx t3
        lda #1                  ; name: yellow when chosen
        cpx sel
        bne :+
        lda #7
:       sta COLOR
        lda name1_lo,x
        sta PTR
        lda name1_hi,x
        sta PTR+1
        lda opt_x,x
        tax
        ldy #BAR_Y
        jsr API_PRINT
        ldx t3
        lda name2_lo,x
        sta PTR
        lda name2_hi,x
        sta PTR+1
        lda opt_x,x
        tax
        ldy #BAR_Y + 1
        jsr API_PRINT
        ldx t3                  ; cost: gold, red when unaffordable
        lda #7
        ldy cost,x
        cpy excuse
        beq :+
        bcc :+
        lda #2
:       sta COLOR
        lda #<s_cost
        sta PTR
        lda #>s_cost
        sta PTR+1
        lda opt_x,x
        clc
        adc #5
        tax
        ldy #BAR_Y + 2
        jsr API_PRINT
        ldx t3                  ; the key: "1:"
        lda #1
        sta COLOR
        txa
        clc
        adc #'1'
        sta s_key
        lda #<s_key
        sta PTR
        lda #>s_key
        sta PTR+1
        lda opt_x,x
        tax
        ldy #BAR_Y + 2
        jsr API_PRINT
        ldx t3
        lda #7
        ldy cost,x
        cpy excuse
        beq :+
        bcc :+
        lda #2
:       sta COLOR
        ldx t3
        lda opt_x,x
        clc
        adc #3
        tax
        ldy t3
        lda cost,y
        ldy #BAR_Y + 2
        jsr API_NUM
        lda #7                  ; marker row
        sta COLOR
        lda #9
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t3
        lda #' '
        cpx sel
        bne :+
        lda #CH_UP
:       pha
        lda opt_x,x
        tax
        pla
        ldy #MARK_Y
        jsr API_FILL
        ldx t3
        dex
        bmi :+
        jmp @o
:       rts

; Regeneration under the count: 4 chars of 2 halves = regen_t × 8 / regen (full at 12).
draw_regen:
        lda #8
        ldx excuse
        cpx #MAX_EXC
        bcs :+
        lda regen_t
        ldx #8
        jsr mul8x8
        sta m0
        stx m0+1
        lda regen
        jsr div16x8
        lda m0
:       sta t2
        ldx #0
@rb:    stx t3
        lda t2
        sec
        sbc #2
        bcs @full
        lda t2                  ; 1: left half, 0: empty
        beq @emp
        lda #0
        sta t2
        lda #QUARTER + 5
        bne @put
@emp:   lda #'.'
        bne @put
@full:  sta t2
        lda #QUARTER + 15
@put:   pha
        lda #7
        sta COLOR
        pla
        ldy #BAR_Y + 2
        jsr API_PUTC
        ldx t3
        inx
        cpx #4
        bne @rb
        rts

; ---- lanes -------------------------------------------------------------------------------------------

; The focus zone (columns 0-3), straight onto the screen: per lane a colleague at a desk, dim (zz) once that
; life is gone, and the green line. Drawn at the start and when a life is lost.
draw_focus:
        lda #0
        sta focus_dirty
        ldx #LANES - 1
@l:     stx li
        lda lane_row_y,x
        sta t3                  ; screen row of the lane's top
        lda hair_tab,x
        cpx lives
        bcc :+
        lda #6
:       sta COLOR
        lda #CH_HAIRL
        ldx #1
        ldy t3
        jsr API_PUTC
        lda #CH_HAIRR
        ldx #2
        ldy t3
        jsr API_PUTC
        jsr @dim
        sta COLOR
        cmp #6
        beq :+
        lda #7                  ; (face: skin)
        sta COLOR
:       ldy t3
        iny
        lda #CH_FACEL
        ldx #1
        jsr API_PUTC
        ldy t3
        iny
        lda #CH_FACER
        ldx #2
        jsr API_PUTC
        jsr @dim                ; desk: green, dim
        sta COLOR
        lda #3
        sta FILL_W
        lda #1
        sta FILL_H
        ldy t3
        iny
        iny
        ldx #0
        lda #QUARTER + 12
        jsr API_FILL
        lda #2                  ; zz
        sta COLOR
        lda #' '
        ldx li
        cpx lives
        bcc :+
        lda #'z'
:       ldx #0
        ldy t3
        jsr API_PUTC
        lda #5                  ; the line
        sta COLOR
        lda #1
        sta FILL_W
        lda #3
        sta FILL_H
        ldx #3
        ldy t3
        lda #'|'
        jsr API_FILL
        ldx li
        dex
        bmi :+
        jmp @l
:       rts
@dim:   lda #5                  ; A = 5, or 6 (dim) if lane li's life is gone
        ldx li
        cpx lives
        bcc :+
        lda #6
:       rts

; Lane li into the buffer (3 rows × 40; columns 4-39 are used), then onto the screen.
draw_lane:
        lda #' '
        ldx #35
:       sta lb_ch+4,x
        sta lb_ch+44,x
        sta lb_ch+84,x
        dex
        bpl :-
        ldx #NCOL - 1           ; grid: a dot at each column's start, middle row
:       ldy col_char,x
        lda #'.'
        sta lb_ch+40,y
        lda #6
        sta lb_col+40,y
        dex
        bpl :-
        jsr lane_dbl
        jsr lane_towers
        jsr lane_invites
        jsr lane_bullets
        jsr lane_wave
        ; copy columns 4-39 of the 3 rows (the stores' addresses patched in)
        ldx li
        lda lane_scr_lo,x
        sta @s0+1
        sta @c0+1
        clc
        adc #40
        sta @s1+1
        sta @c1+1
        lda lane_scr_hi,x
        sta @s0+2
        adc #0
        sta @s1+2
        lda @s1+1
        clc
        adc #40
        sta @s2+1
        sta @c2+1
        lda @s1+2
        adc #0
        sta @s2+2
        lda @s0+2
        clc
        adc #>(COLRAM - SCREEN)
        sta @c0+2
        lda @s1+2
        adc #>(COLRAM - SCREEN)
        sta @c1+2
        lda @s2+2
        adc #>(COLRAM - SCREEN)
        sta @c2+2
        ldy #39
@cp:    lda lb_ch,y
@s0:    sta $ffff,y
        lda lb_col,y
@c0:    sta $ffff,y
        lda lb_ch+40,y
@s1:    sta $ffff,y
        lda lb_col+40,y
@c1:    sta $ffff,y
        lda lb_ch+80,y
@s2:    sta $ffff,y
        lda lb_col+80,y
@c2:    sta $ffff,y
        dey
        cpy #4
        bcs @cp
        rts

; Double-booked slow zones: checker chars on the bottom row of their two columns.
lane_dbl:
        ldy li
        lda lane10,y
        sta cb
        ldx #NCOL - 1
@c:     txa
        clc
        adc cb
        tay
        lda t_type,y
        cmp #T_DBL
        bne @n
        stx xc
        lda #7                  ; 7 chars (two columns), 4 at the last one
        cpx #NCOL - 1
        bne :+
        lda #4
:       sta t2
        lda col_char,x
        tay
@d:     lda #CH_CHECKER
        sta lb_ch+80,y
        lda #4
        sta lb_col+80,y
        iny
        dec t2
        bne @d
        ldx xc
@n:     dex
        bpl @c
        rts

; Defences on lane li (3 chars at their column's first char).
lane_towers:
        ldy li
        lda lane10,y
        sta cb
        ldx #NCOL - 1
@c:     stx xc
        txa
        clc
        adc cb
        tay
        sty t3                  ; cell
        lda t_type,y
        bne :+
        jmp @n
:       lda #1                  ; flash colour while chewed
        sta t1
        lda t_hit,y
        beq :+
        lda anim
        and #2
        beq :+
        lda #0                  ; (white this frame)
        sta t1
:       lda t_type,y
        ldy col_char,x
        cmp #T_DECLINE
        bne @ooo
        ; decline: a face at the left, the NO sign on its post at the right
        txa
        asl
        adc li
        and #7
        tax
        lda hair_tab2,x
        sta lb_col+40,y
        sta lb_col+41,y
        lda #CH_HAIRL
        sta lb_ch+40,y
        lda #CH_HAIRR
        sta lb_ch+41,y
        lda #CH_FACEL
        sta lb_ch+80,y
        lda #CH_FACER
        sta lb_ch+81,y
        lda #7
        sta lb_col+80,y
        sta lb_col+81,y
        sta lb_col+42,y
        lda #'|'
        sta lb_ch+42,y
        lda #'N'
        sta lb_ch+1,y
        lda #'O'
        sta lb_ch+2,y
        lda #2                  ; red, white while hit
        ldx t1
        bne :+
        lda #1
:       sta lb_col+1,y
        sta lb_col+2,y
        jmp @n
@ooo:   cmp #T_OOO
        bne @dbl
        lda #'O'                ; OOO, its life as a bar below
        sta lb_ch,y
        sta lb_ch+1,y
        sta lb_ch+2,y
        lda #7
        ldx t1
        bne :+
        lda #1
:       sta lb_col,y
        sta lb_col+1,y
        sta lb_col+2,y
        sta lb_col+40,y
        sta lb_col+41,y
        sta lb_col+42,y
        sty t2
        ldy t3                  ; halves = life × 6 / 1024
        lda t_life_hi,y
        ldx #6
        jsr mul8x8
        stx t1
        lsr t1
        ror
        lsr t1
        ror
        tax
        ldy t2
        lda #3
        sta t1
:       jsr half_char
        sta lb_ch+40,y
        iny
        dec t1
        bne :-
        jmp @n
@dbl:   lda #CH_BLOCK           ; two overlapping meetings, x2
        sta lb_ch,y
        sta lb_ch+1,y
        lda #4
        sta lb_col,y
        sta lb_col+40,y
        sta lb_col+41,y
        lda #2
        sta lb_col+1,y
        lda #'x'
        sta lb_ch+40,y
        lda #'2'
        sta lb_ch+41,y
@n:     ldx xc
        dex
        bmi :+
        jmp @c
:       rts

; X = halves left -> A = a full block (X -= 2), a left half (X = 0) or a space. Keeps Y.
half_char:
        cpx #2
        bcc :+
        dex
        dex
        lda #QUARTER + 15
        rts
:       cpx #1
        bne :+
        dex
        lda #QUARTER + 5
        rts
:       lda #' '
        rts

; Invites on lane li: a bar in the kind's colour (a crown on the All-Hands, a clock on recurring ones), the
; label clipped to the width, the hit points left once hurt.
lane_invites:
        ldy li
        ldx lane_head,y
@i:     bpl :+
        rts
:       stx ii
        lda i_used,x
        bne :+
        jmp @n
:       jsr inv_chars           ; xc = first char, xw = chars wide (clipped to column 39)
        lda xc
        cmp #40
        bcc :+
        jmp @n
:       eor #$ff
        sec
        adc #40
        cmp xw
        bcs :+
        sta xw
:       ldx ii
        ldy i_kind,x
        lda k_col,y
        ldy i_hit,x
        beq :+
        lda #1
:       sta t3                  ; colour
        ldy xc                  ; row 0: blocks
        ldx xw
:       lda #CH_BLOCK
        sta lb_ch,y
        lda t3
        sta lb_col,y
        iny
        dex
        bne :-
        ldx ii
        lda i_kind,x
        cmp #K_BOSS
        bne :+
        ldy xc                  ; a crown on the All-Hands
        lda #'W'
        sta lb_ch+2,y
        lda #7
        sta lb_col+2,y
        bne @label
:       cmp #K_RECUR
        beq :+
        cmp #K_MINI
        bne @label
:       ldx ii                  ; recurring: a clock at the right end (if not clipped)
        ldy i_kind,x
        lda k_wch,y
        cmp xw
        bne @label
        clc
        adc xc
        tay
        lda #CH_CLOCK
        sta lb_ch-1,y
        lda #1
        sta lb_col-1,y
@label: ldx ii                  ; row 1: the label, clipped (sp = text - first index, so (sp),y = char)
        ldy i_label,x
        lda xc
        clc
        adc #40
        sta t2
        lda str_lo,y
        sec
        sbc t2
        sta sp
        lda str_hi,y
        sbc #0
        sta sp+1
        ldy t2
        ldx xw
:       lda (sp),y
        beq @hp
        sta lb_ch,y
        lda t3
        sta lb_col,y
        iny
        dex
        bne :-
@hp:    ldx ii                  ; row 2: hit points left (green halves), once hurt
        ldy i_kind,x            ; (full: the kind's)
        lda i_hp,x
        cmp khp,y
        bcs @n
        ldy i_kind,x            ; halves = hp × 2 × width / max
        lda k_wch,y
        asl
        tax
        ldy ii
        lda i_hp,y
        jsr mul8x8
        sta m0
        stx m0+1
        ldx ii
        ldy i_kind,x
        lda khp,y
        jsr div16x8
        ldx m0
        bne :+
        inx
:       lda xc
        clc
        adc #80
        tay
        lda xw
        sta t2
:       jsr half_char
        sta lb_ch,y
        lda #5
        sta lb_col,y
        iny
        dec t2
        bne :-
@n:     ldx ii
        lda i_next,x
        tax
        jmp @i

; Invite ii: xc = its first char (x / 12), xw = chars it covers.
inv_chars:
        ldx ii
        lda i_xlo,x
        ldy i_xhi,x
        jsr x12
        sta xc
        ldx ii
        ldy i_kind,x
        lda k_wch,y
        sta xw
        rts

; A/Y = x (0-511) -> A = x / 12 (the char column).
x12:    sta t0
        tya
        lsr
        ror t0
        lsr t0                  ; x / 4 (< 128), / 3 = × 171 / 512
        lda t0
        ldx #171
        jsr mul8x8
        txa
        lsr
        rts

; "NO" bullets on lane li.
lane_bullets:
        ldx #MAXB - 1
@b:     lda b_used,x
        beq @n
        lda b_lane,x
        cmp li
        bne @n
        stx ii
        lda b_xlo,x
        ldy b_xhi,x
        jsr x12
        ldx ii
        cmp #39
        bcs @n
        tay
        lda #'N'
        sta lb_ch+40,y
        lda #'O'
        sta lb_ch+41,y
        lda #2
        sta lb_col+40,y
        sta lb_col+41,y
@n:     dex
        bpl @b
        rts

; Headphones: "SHHHHH!" sweeping across the lane for 0.6 s.
lane_wave:
        ldx li
        lda w_t,x
        beq @rts
        eor #$ff                ; column 4 + (30 - t)
        sec
        adc #WAVE_T + 4
        tay
        ldx #0
@c:     lda s_shh,x
        beq @rts
        cpy #40
        bcs @rts
        sta lb_ch+40,y
        lda #3
        sta lb_col+40,y
        iny
        inx
        bne @c
@rts:   rts

; ---- one frame ---------------------------------------------------------------------------------------

frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        jsr msg_tick
        ldx #LANES - 1          ; shockwaves fade
:       lda w_t,x
        beq :+
        dec w_t,x
:       dex
        bpl :--
        lda end_t
        beq @play
        dec end_t
        beq :+
        jmp @out
:
        jmp finish
@play:  jsr timer_tick
        bcc :+
        lda #<s_home            ; 17:30
        ldx #>s_home
        ldy #5
        jmp the_end
:       inc time
        bne :+
        inc time+1
:       jsr regen_tick
        jsr spawning
        jsr build_lists
        jsr towers_tick
        jsr bullets_tick
        jsr invites_tick
        lda lives
        bne :+
        lda #<s_ruined
        ldx #>s_ruined
        ldy #2
        jmp the_end
:       lda next                ; all scheduled ones out and gone?
        cmp ns
        bcc @input
        ldx #MAXI - 1
:       lda i_used,x
        bne @input
        dex
        bpl :-
        lda #<s_clear
        ldx #>s_clear
        ldy leaks
        beq :+
        lda #<s_saved
        ldx #>s_saved
:       ldy #5
        jmp the_end
@input: jsr steer
        ; redraw: a lane a frame, the regeneration every 8, the header and bar when they change
        lda anim
        and #7
        bne :+
        jsr draw_regen          ; (regeneration progress)
:       ldx rr              ; one lane a frame
        stx li
        inx
        cpx #LANES
        bcc :+
        ldx #0
:       stx rr
        jsr draw_lane
        lda focus_dirty
        beq :+
        jsr draw_focus
:       lda stat_dirty
        beq :+
        jsr draw_stats
:       lda bar_dirty
        beq :+
        jsr draw_bar
:       jsr place_cursor
@out:   clc
        rts

; A/X = banner, Y = colour: the round is over; the banner stays up 1.2 s.
the_end:
        sta kx2
        stx kx2+1
        sta PTR
        stx PTR+1
        sty t3
        lda #END_T
        sta end_t
        lda #0
        sta $d015
        ldy #0                  ; box around it, centred on rows 9-11
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #4
        sta FILL_W
        lda #40
        sec
        sbc FILL_W
        lsr
        sta t2
        lda #3
        sta FILL_H
        lda t3
        sta COLOR
        ldx t2
        ldy #9
        jsr API_BOX
        lda FILL_W
        sec
        sbc #2
        sta FILL_W
        lda #1
        sta FILL_H
        ldx t2
        inx
        ldy #10
        lda #' '
        jsr API_FILL
        lda #1
        sta COLOR
        lda kx2
        ldx kx2+1
        ldy #10
        jsr API_CENTER
        jsr draw_stats
        clc
        rts

; Excuses come back one every `regen` frames (not while at 12).
regen_tick:
        lda excuse
        cmp #MAX_EXC
        bcc :+
        lda #0
        sta regen_t
        rts
:       inc regen_t
        lda regen_t
        cmp regen
        bcc :+
        lda #0
        sta regen_t
        inc excuse
        inc bar_dirty
:       rts

; Scheduled invites whose time has come walk in at x = 482.
spawning:
        ldx next
        cpx ns
        bcs @rts
        lda time                ; due: t <= time / 16
        sta t0
        lda time+1
        jsr q16
        ldx next
        cmp s_t,x
        bcc @rts
        inc next
        lda #<(WX + 2)
        sta sx
        lda #>(WX + 2)
        sta sx+1
        lda s_lk,x
        and #7
        tay
        lda s_lk,x
        lsr
        lsr
        lsr
        pha
        jsr spawn
        pla
        cmp #K_BOSS
        bne spawning
        lda #1                  ; (kick drum)
        jsr API_SFX
        lda #<s_ceo
        ldx #>s_ceo
        ldy #2
        jsr floater
        jmp spawning
@rts:   rts

; A = kind, Y = lane, sx = x: a new invite (if there is a free slot). Hit points by kind, speed by kind
; × 0.92-1.08, a label from the kind's pool.
spawn:
        sta sp_k
        sty sp_l
        ldx #MAXI - 1
:       lda i_used,x
        beq :+
        dex
        bpl :-
        rts
:       stx sp_i
        lda #1
        sta i_used,x
        lda sp_k
        sta i_kind,x
        lda sp_l
        sta i_lane,x
        lda sx
        sta i_xlo,x
        lda sx+1
        sta i_xhi,x
        lda #0
        sta i_frac,x
        sta i_hit,x
        ldy sp_k
        lda khp,y
        sta i_hp,x
        lda #41                 ; speed - speed × 20 / 256 + speed × (0..40) / 256
        jsr API_RMOD
        ldy sp_k
        ldx kspd,y
        jsr mul8x8
        stx sp_v
        ldy sp_k
        lda kspd,y
        ldx #20
        jsr mul8x8
        stx sp_w
        ldy sp_k
        lda kspd,y
        sec
        sbc sp_w
        clc
        adc sp_v
        ldx sp_i
        sta i_spd,x
        ldy sp_k
        lda pool_n,y
        jsr API_RMOD
        ldy sp_k
        clc
        adc pool_first,y
        ldx sp_i
        sta i_label,x
        rts

; Each defence: a decline shoots when an invite is on its right; an out-of-office sign runs out.
towers_tick:
        lda #0
        sta li
        sta tcell
@l:     lda #0
        sta xc
@c:     ldy tcell
        lda t_hit,y
        beq :+
        sec
        sbc #1
        sta t_hit,y
:       lda t_type,y
        cmp #T_DECLINE
        bne @ooo
        lda t_cool,y
        beq :+
        sec
        sbc #1
        sta t_cool,y
        bne @n
:       sty t3                  ; anything alive on the lane right of x0 = column x + 21?
        ldx xc
        lda colx_lo,x
        clc
        adc #21
        sta t0
        lda colx_hi,x
        adc #0
        sta t1
        jsr lane_target
        bcc @n
        ldy t3
        lda #FIRE_T
        sta t_cool,y
        ldx #MAXB - 1           ; a bullet at x0 + 6
:       lda b_used,x
        beq :+
        dex
        bpl :-
        bmi @n
:       lda #1
        sta b_used,x
        lda li
        sta b_lane,x
        lda t0
        clc
        adc #6
        sta b_xlo,x
        lda t1
        adc #0
        sta b_xhi,x
        lda #3                  ; (hi-hat)
        jsr API_SFX
        jmp @n
@ooo:   cmp #T_OOO
        bne @n
        lda t_cool,y            ; (its life, low byte)
        bne :+
        lda t_life_hi,y
        beq @n
        sec
        sbc #1
        sta t_life_hi,y
:       lda t_cool,y
        sec
        sbc #1
        sta t_cool,y
        ora t_life_hi,y
        bne @n
        lda #0                  ; back from holiday
        sta t_hp_lo,y
        sta t_hp_hi,y
@n:     inc tcell
        inc xc
        lda xc
        cmp #NCOL
        bcs :+
        jmp @c
:       inc li
        lda li
        cmp #LANES
        bcs :+
        jmp @l
:       jmp remove_towers

; Per lane: a list of its invites (lane_head, i_next; $ff ends it) and the right end of the furthest one that
; is on the field (max x + w over x < 474: a decline at x0 fires if it is > x0).
build_lists:
        ldx #LANES - 1
        lda #$ff
:       sta lane_head,x
        lda #0
        sta maxr_lo,x
        sta maxr_hi,x
        lda #$ff
        dex
        bpl :-
        ldx #MAXI - 1
@i:     lda i_used,x
        beq @n
        ldy i_lane,x
        lda lane_head,y
        sta i_next,x
        txa
        sta lane_head,y
        lda i_xhi,x             ; x < 474
        cmp #>474
        bcc :+
        bne @n
        lda i_xlo,x
        cmp #<474
        bcs @n
:       sty t3
        ldy i_kind,x
        lda i_xlo,x
        clc
        adc k_w,y
        sta t0
        lda i_xhi,x
        adc #0
        ldy t3
        cmp maxr_hi,y
        bcc @n
        bne :+
        lda t0
        cmp maxr_lo,y
        bcc @n
        lda maxr_hi,y
:       sta maxr_hi,y
        lda t0
        sta maxr_lo,y
@n:     dex
        bpl @i
        rts

; li = lane, t0/t1 = x0: C=1 if an invite there has x + w > x0 and x < 474.
lane_target:
        ldx li
        lda t0
        cmp maxr_lo,x
        lda t1
        sbc maxr_hi,x
        bcs :+
        sec                     ; x0 < max: yes
        rts
:       clc
        rts

; Defences out of hit points go.
remove_towers:
        ldy #CELLS - 1
@c:     lda t_type,y
        beq @n
        cmp #T_DBL
        beq @n
        lda t_hp_lo,y
        ora t_hp_hi,y
        bne @n
        lda t_type,y
        pha
        lda #0
        sta t_type,y
        sty t3
        pla
        cmp #T_OOO
        bne :+
        lda #<s_holiday
        ldx #>s_holiday
        bne :++
:       lda #<s_caved
        ldx #>s_caved
:       ldy #7
        jsr floater
        ldy t3
@n:     dey
        bpl @c
        rts

; Bullets fly right at 150 px/s and hit the first invite they touch.
bullets_tick:
        ldx #MAXB - 1
@b:     lda b_used,x
        beq @n
        lda b_xlo,x
        clc
        adc #BULLET_V
        sta b_xlo,x
        bcc :+
        inc b_xhi,x
:       stx bk
        jsr bullet_hit
        ldx bk
        bcs @gone
        lda b_xhi,x             ; off the field
        cmp #>WX
        bcc @n
        bne @gone
        lda b_xlo,x
        cmp #<WX
        bcc @n
        beq @n
@gone:  lda #0
        sta b_used,x
@n:     dex
        bpl @b
        rts

; Bullet bk: C=1 if it hit an invite (b.x + 6 >= v.x and b.x <= v.x + w), which takes 1 damage.
bullet_hit:
        ldx bk
        lda b_xlo,x
        clc
        adc #6
        sta t0
        lda b_xhi,x
        adc #0
        sta t1
        lda b_xlo,x
        sta t2
        lda b_xhi,x
        sta t3
        ldy b_lane,x
        ldx lane_head,y
@i:     bmi @no
        lda i_used,x
        beq @n
        lda t0                  ; b.x + 6 >= v.x
        cmp i_xlo,x
        lda t1
        sbc i_xhi,x
        bcc @n
        ldy i_kind,x            ; v.x + w >= b.x
        lda i_xlo,x
        clc
        adc k_w,y
        sta sx
        lda i_xhi,x
        adc #0
        sta sx+1
        lda sx
        cmp t2
        lda sx+1
        sbc t3
        bcc @n
        lda #1
        jsr damage
        sec
        rts
@n:     lda i_next,x
        tax
        jmp @i
@no:    clc
        rts

; Invite X takes A damage (kept: X).
damage:
        sta t2
        lda i_hp,x
        cmp t2
        beq :+
        bcs @hurt
:       jmp kill
@hurt:  sec
        sbc t2
        sta i_hp,x
        lda #HIT_T
        sta i_hit,x
        rts

; Invite X is stopped: weight to the score; a recurring one splits into two minis (d >= 0.5). Keeps X.
kill:
        lda #0
        sta i_used,x
        stx kx
        ldy i_kind,x
        lda k_wt,y
        clc
        adc killed
        sta killed
        inc stat_dirty
        cpy #K_BOSS
        bne :+
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_cancel
        ldx #>s_cancel
        ldy #7
        jsr floater
        ldx kx
        rts
:       lda #SFX_BLIP
        jsr API_SFX
        lda #KILL_N
        jsr API_RMOD
        clc
        adc #KILL_0
        tax
        lda str_lo,x
        pha
        lda str_hi,x
        tax
        pla
        ldy #5
        jsr floater
        ldx kx
        lda i_kind,x
        cmp #K_RECUR
        bne @rts
        lda splits
        beq @rts
        lda i_xlo,x             ; minis at x and x + 30
        sta sx
        sta kx2
        lda i_xhi,x
        sta sx+1
        sta kx2+1
        lda i_lane,x
        sta kl
        tay
        lda #K_MINI
        jsr spawn
        lda kx2
        clc
        adc #30
        sta sx
        lda kx2+1
        adc #0
        sta sx+1
        ldy kl
        lda #K_MINI
        jsr spawn
        lda #<s_recurs
        ldx #>s_recurs
        ldy #4
        jsr floater
        ldx kx
@rts:   rts

; Invites walk left, stopped by a decline / out-of-office sign in their way (chewing through it), slowed
; to 45% over a double-booking; at x <= 46 they leak into your focus time.
invites_tick:
        ldx #MAXI - 1
@i:     stx ii
        lda i_used,x
        bne :+
        jmp @n
:       lda i_hit,x
        beq :+
        dec i_hit,x
:       lda i_lane,x
        sta li
        lda #0
        sta bk                  ; slowed
        ldy li                  ; the lane's cells, right to left (Y = cell)
        lda lane10,y
        sta cb
        clc
        adc #NCOL - 1
        tay
@scan:  lda t_type,y
        bne @have
@next:  dey
        bmi @wk
        cpy cb
        bcs @scan
@wk:    jmp @walk
@have:  sty t3
        tya
        sec
        sbc cb
        sta xc                  ; its column
        lda t_type,y
        cmp #T_DBL
        beq @dbl
        lda t_hp_lo,y           ; (alive)
        ora t_hp_hi,y
        bne :+
        jmp @cn
:       ldx ii                  ; v.x <= col + 34 and v.x >= col - 4
        sty t3
        ldy xc
        lda colx_lo,y
        clc
        adc #CW - 8
        sta t0
        lda colx_hi,y
        adc #0
        sta t1
        lda t0
        cmp i_xlo,x
        lda t1
        sbc i_xhi,x
        bcs :+
        jmp @cn2
:
        lda colx_lo,y
        sec
        sbc #4
        sta t0
        lda colx_hi,y
        sbc #0
        sta t1
        lda i_xlo,x
        cmp t0
        lda i_xhi,x
        sbc t1
        bcc @cn2
        lda #1                  ; blocked: chew (3 a frame for the All-Hands)
        ldy i_kind,x
        cpy #K_BOSS
        bne :+
        lda #3
:       sta t0
        ldy t3
        lda #5
        sta t_hit,y
        lda t_hp_lo,y
        sec
        sbc t0
        sta t_hp_lo,y
        lda t_hp_hi,y
        sbc #0
        sta t_hp_hi,y
        bcs :+
        lda #0                  ; (no lower than 0)
        sta t_hp_lo,y
        sta t_hp_hi,y
:       jmp @n
@dbl:   ldx ii                  ; v.x < col + 84 and v.x + w > col
        sty t3
        ldy xc
        lda colx_lo,y
        clc
        adc #2 * CW
        sta t0
        lda colx_hi,y
        adc #0
        sta t1
        lda i_xlo,x
        cmp t0
        lda i_xhi,x
        sbc t1
        bcs @cn2
        stx t2
        ldy i_kind,x
        lda i_xlo,x
        clc
        adc k_w,y
        sta t0
        lda i_xhi,x
        adc #0
        sta t1
        ldy xc
        lda colx_lo,y
        cmp t0
        lda colx_hi,y
        sbc t1
        bcs @cn2
        lda #1
        sta bk
@cn2:
@cn:    ldy t3
        jmp @next
@walk:  ldx ii                  ; walk
        lda i_spd,x
        ldy bk
        beq :+
        ldy #115                ; × 0.45
        sty t0
        ldx t0
        jsr mul8x8
        txa
        ldx ii
:       sta t0
        lda i_frac,x
        sec
        sbc t0
        sta i_frac,x
        bcs :+
        lda i_xlo,x
        bne @dl
        dec i_xhi,x
@dl:    dec i_xlo,x
:       lda i_xhi,x             ; x <= 46: leaked
        bne @n
        lda i_xlo,x
        cmp #FOCUS_X + 1
        bcs @n
        lda #0
        sta i_used,x
        inc leaks
        dec lives
        inc stat_dirty
        inc focus_dirty
        lda #LEAK_N
        jsr API_RMOD
        clc
        adc #LEAK_0
        tax
        lda str_lo,x
        pha
        lda str_hi,x
        tax
        pla
        ldy #2
        jsr floater
        lda #SFX_BAD
        jsr API_SFX
@n:     ldx ii
        dex
        bmi :+
        jmp @i
:       rts

; ---- you ---------------------------------------------------------------------------------------------

; Keys 1-4 pick a defence; the joystick moves the cursor over the calendar (down past the last lane: onto
; the defences bar, where FIRE picks one); FIRE places.
steer:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda $cb
        cmp lastkey
        beq @joy
        sta lastkey
        jsr number_key
        bmi @joy
        jsr choose
@joy:   lda JOYP
        lsr
        bcc @dn                 ; up
        lda cur_l
        beq @dn
        cmp #LANES
        bne :+
        lda cur_gc              ; back from the bar
        sta cur_c
:       dec cur_l
@dn:    lda JOYP
        and #J_DOWN
        beq @lt
        lda cur_l
        cmp #LANES - 1
        bcc :+
        bne @lt
        lda cur_c               ; onto the bar, at the chosen defence
        sta cur_gc
        lda sel
        sta cur_c
:       inc cur_l
@lt:    lda JOYP
        and #J_LEFT
        beq @rt
        lda cur_c
        beq @rt
        dec cur_c
@rt:    lda JOYP
        and #J_RIGHT
        beq @fire
        ldx #NCOL - 1
        lda cur_l
        cmp #LANES
        bcc :+
        ldx #3
:       cpx cur_c
        beq @fire
        bcc @fire
        inc cur_c
@fire:  lda JOYP
        and #J_FIRE
        beq @rts
        lda cur_l
        cmp #LANES
        bcc place
        lda cur_c               ; on the bar: pick it, back to the calendar
        jsr choose
        lda cur_gc
        sta cur_c
        dec cur_l
@rts:   rts

; A = defence 0-3.
choose:
        sta sel
        inc bar_dirty
        lda #5                  ; (rim click)
        jmp API_SFX

; Place the chosen defence at the cursor.
place:
        ldx sel
        lda excuse
        cmp cost,x
        bcs :+
        lda #<s_noexc
        ldx #>s_noexc
        jmp reject
:       cpx #3
        bne @tower
        sbc #4                  ; headphones: everything on the lane takes 8 × hpMul
        sta excuse
        inc bar_dirty
        lda #SFX_BLIP
        jsr API_SFX
        ldx cur_l
        lda #WAVE_T
        sta w_t,x
        lda #<s_phones
        ldx #>s_phones
        ldy #3
        jsr floater
        ldx #MAXI - 1
@p:     lda i_used,x
        beq @pn
        lda i_lane,x
        cmp cur_l
        bne @pn
        lda i_xhi,x             ; (x < 476: on the field)
        cmp #>476
        bcc :+
        bne @pn
        lda i_xlo,x
        cmp #<476
        bcs @pn
:       lda phones_dmg
        jsr damage
@pn:    dex
        bpl @p
        rts
@tower: lda cur_l
        sta li
        ldx cur_c
        jsr cell_of
        lda t_type,y
        beq :+
        lda #<s_taken
        ldx #>s_taken
        jmp reject
:       ldx sel
        lda excuse
        sec
        sbc cost,x
        sta excuse
        inc bar_dirty
        inx
        txa
        sta t_type,y
        lda #FIRST_T
        sta t_cool,y
        lda #0
        sta t_hit,y
        lda hp0_lo-1,x
        sta t_hp_lo,y
        lda hp0_hi-1,x
        sta t_hp_hi,y
        cpx #T_OOO              ; (an out-of-office sign's life: t_cool + t_life_hi)
        bne :+
        lda #<OOO_LIFE
        sta t_cool,y
:       lda #>OOO_LIFE
        sta t_life_hi,y
        lda #SFX_BLIP
        jmp API_SFX

; A/X = message: spending without the excuses (or on a taken slot) resets the regeneration.
reject:
        ldy #0
        sty regen_t
        ldy #2
        jsr floater
        lda #SFX_BAD
        jmp API_SFX

; The cursor brackets around the cell (gold if the defence fits there, else red), or the chosen bar entry.
place_cursor:
        lda end_t
        bne @rts
        lda #3
        sta $d015
        lda cur_l
        cmp #LANES
        bcc @grid
        ldx cur_c
        lda opt_x,x             ; x = 24 + col × 8 - 2
        asl
        asl
        asl
        clc
        adc #22
        sta t0
        lda #0
        adc #0
        sta t1
        lda #203
        sta t2
        lda #53
        sta t3                  ; right bracket offset
        lda #1
        bne @set
@grid:  ldx cur_c               ; x = 55 + 28 c, y = 75 + 24 l
        lda curx_lo,x
        sta t0
        lda curx_hi,x
        sta t1
        ldx cur_l
        lda cury,x
        sta t2
        lda #7
        sta t3
        jsr can_place           ; colour
@set:   sta $d027
        sta $d028
        lda t0
        sta $d000
        lda t2
        sta $d001
        sta $d003
        lda t0
        clc
        adc t3
        sta $d002
        lda t1
        adc #0
        asl
        ora t1
        sta $d010
@rts:   rts

; A = 7 (gold) if the chosen defence can go at the cursor, else 2 (red).
can_place:
        ldx sel
        lda excuse
        cmp cost,x
        bcc @no
        cpx #3
        beq @yes
        lda cur_l
        sta li
        ldx cur_c
        jsr cell_of
        lda t_type,y
        bne @no
@yes:   lda #7
        rts
@no:    lda #2
        rts

; A/X = text, Y = colour: centred on the message row for 0.9 s.
floater:
        sty fl_c
        pha
        txa
        pha
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        lda fl_c
        sta COLOR
        pla
        tax
        pla
        ldy #MSG_Y
        jsr API_CENTER
        lda #MSG_T
        sta msg_t
        rts

msg_tick:
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jmp clear_rows
:       rts

.if .defined(AUTOPLAY)
; ---- test builds: a planner --------------------------------------------------------------------------
; Every 4 frames: headphones on a lane whose front invite is close (or on the All-Hands' lane); declines at
; the back of every lane (columns 0, then 1); an out-of-office wall at column 3 when something tough comes;
; with the excuses full, headphones on the busiest lane.
bot:    lda anim
        and #3
        beq :+
        jmp @rts
:
        lda end_t
        beq :+
        jmp @rts
:
        jsr lane_stats          ; front x and hit points per lane
        ldx #LANES - 1          ; 1. front invite within 130 px: headphones
:       lda fr_hi,x
        bne :+
        lda fr_lo,x
        cmp #130
        bcs :+
        lda #3
        jsr bot_try
        bcc :+
        jmp @rts
:       dex
        bpl :--
        ldx boss_l              ; 2. the All-Hands on the field
        bmi :+
        lda #3
        jsr bot_try
        bcc :+
        jmp @rts
:       jsr busiest             ; 3. excuses full, or a pile-up (40 HP): headphones on the busiest lane
        lda hp_l,x
        beq :++
        cmp #40
        bcs :+
        lda excuse
        cmp #MAX_EXC
        bcc :++
:       lda #3
        jmp bot_try
:       ldx #LANES - 1          ; keep 4 for headphones while something is within 250 px
        lda #0
        sta bres
:       lda fr_hi,x
        bne :+
        lda fr_lo,x
        cmp #250
        bcs :+
        lda #4
        sta bres
:       dex
        bpl :--
        lda excuse
        sec
        sbc bres
        bcs :+
@rr:    rts
:       cmp #2
        bcc @rr
        sta bres                ; (what may be spent)
        lda #0                  ; 4. every lane gets a decline at column 0 first
        sta sel
        sta cur_c
        ldx #LANES - 1
:       stx cur_l
        jsr can_place
        cmp #7
        bne :+
        jmp place
:       ldx cur_l
        dex
        bpl :--
        lda bres                ; 5. something within 400 px and no wall in columns 3-5: a wall at 4 (5, 3)
        cmp #3
        bcc @dec
        ldx #LANES - 1
@wl:    lda fr_hi,x             ; front < 400
        beq :+
        cmp #1
        bne @wn
        lda fr_lo,x
        cmp #<400
        bcs @wn
:       stx cur_l
        stx li
        ldx #3                  ; a wall there already?
:       jsr cell_of
        lda t_type,y
        cmp #T_OOO
        beq @wn2
        inx
        cpx #6
        bcc :-
        lda #1
        sta sel
        ldx #2
:       lda wall_col,x
        sta cur_c
        jsr can_place
        cmp #7
        bne :+
        jmp place
:       dex
        bpl :--
@wn2:   ldx cur_l
@wn:    dex
        bpl @wl
@dec:
        jsr busiest             ; 6. a decline on the busiest lane (none busy: round robin), leftmost of 0-3
        lda hp_l,x
        bne :+
        ldx brr
        inx
        cpx #LANES
        bcc :+
        ldx #0
:       stx brr
        stx cur_l
        lda #0
        sta sel
        sta cur_c
@col:   jsr can_place
        cmp #7
        bne :+
        jmp place
:       inc cur_c
        lda cur_c
        cmp #6
        bcc @col
@rts:   rts

; X = the lane with the most hit points on it.
busiest:
        ldx #0
        ldy #LANES - 1
:       lda hp_l,y
        cmp hp_l,x
        bcc :+
        tya
        tax
:       dey
        bpl :--
        rts

; X = lane, A = defence: place it there (cursor on column 0 of that lane) if affordable. C=1 if done. Keeps X.
bot_try:
        sta sel
        stx cur_l
        lda #0
        sta cur_c
        jsr can_place
        cmp #7
        bne :+
        jsr place
        ldx cur_l
        sec
        rts
:       ldx cur_l
        clc
        rts

; Per lane: fr = the front invite's x (or $ffff), hp_l = total hit points (at most 255); boss_l = the
; All-Hands' lane once on the field, else $ff.
lane_stats:
        ldx #LANES - 1
        lda #$ff
:       sta fr_lo,x
        sta fr_hi,x
        lda #0
        sta hp_l,x
        lda #$ff
        dex
        bpl :-
        sta boss_l
        ldx #MAXI - 1
@i:     lda i_used,x
        beq @n
        ldy i_lane,x
        lda i_kind,x
        cmp #K_BOSS
        bne :+
        lda i_xhi,x
        cmp #>440
        bcc @bl
        bne :+
        lda i_xlo,x
        cmp #<440
        bcs :+
@bl:    tya
        sta boss_l
:       lda i_hp,x
        clc
        adc hp_l,y
        bcc :+
        lda #255
:       sta hp_l,y
        lda i_xlo,x
        cmp fr_lo,y
        lda i_xhi,x
        sbc fr_hi,y
        bcs @n
        lda i_xlo,x
        sta fr_lo,y
        lda i_xhi,x
        sta fr_hi,y
@n:     dex
        bpl @i
        rts
.endif

finish:
        lda #0
        sta $d015
        jsr calc_score
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; X = column, li = lane -> Y = cell index. Keeps X.
cell_of:
        stx cell_x
        ldy li
        lda lane10,y
        clc
        adc cell_x
        tay
        rts

; ---- helpers -----------------------------------------------------------------------------------------

; A × X -> A = low byte, X = high byte.
mul8x8:
        sta mu_b
        stx mu_a
        lda #0
        ldx #8
        lsr mu_b
@l:     bcc :+
        clc
        adc mu_a
:       ror
        ror mu_b
        dex
        bne @l
        tax
        lda mu_b
        rts

; m0..m0+1 × A -> m0..m0+2.
mul16x8:
        sta mu_a
        lda #0
        ldx #16
        lsr m0+1
        ror m0
@l:     bcc :+
        clc
        adc mu_a
:       ror
        ror m0+1
        ror m0
        dex
        bne @l
        sta m0+2
        rts

; m0..m0+1 / A -> m0..m0+1 (remainder in A). Keeps Y.
div16x8:
        sta mu_a
        lda #0
        ldx #16
@l:     asl m0
        rol m0+1
        rol
        bcs :+
        cmp mu_a
        bcc @n
:       sbc mu_a
        inc m0
@n:     dex
        bne @l
        rts

; buf: Y = index.
bput:   sta buf,y
        iny
        rts
bstr:   sta sp
        stx sp+1
        sty mu_a
        ldy #0
:       lda (sp),y
        beq :+
        sty mu_b
        ldy mu_a
        sta buf,y
        inc mu_a
        ldy mu_b
        iny
        bne :-
:       ldy mu_a
        rts
; A = 0..255 in decimal, no leading zeros.
bnum:   ldx #0
        stx bn_f
:       cmp #100
        bcc :+
        sbc #100
        inx
        bne :-
:       jsr @dig
        ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       jsr @dig
        ora #'0'
        sta buf,y
        iny
        rts
@dig:   pha
        txa
        bne :+
        lda bn_f
        beq @skip
        txa
:       ora #'0'
        sta buf,y
        iny
        inc bn_f
@skip:  pla
        rts

.rodata
s_name:     .byte "Calendar Defender", 0
s_help:     .byte "Defend your Focus Time from meeting invites!", 0
s_keys:     .byte "Joystick + FIRE place, keys 1-4 pick", 0
s_focus:    .byte "FOCUS", 0
s_hour0:    .byte "13:00", 0          ; (copied to s_hour, whose second digit changes)
s_exc:      .byte "Exc", 0
s_cost:     .byte "exc", 0
s_lives:    .byte "Lives ", 0
s_stopped:  .byte "  Stopped ", 0
s_noexc:    .byte "Not enough excuses!", 0
s_taken:    .byte "Slot taken!", 0
s_phones:   .byte "Headphones on!", 0
s_recurs:   .byte "It recurs!", 0
s_cancel:   .byte "All-Hands cancelled!", 0
s_ceo:      .byte "CEO ALL-HANDS INCOMING", 0
s_holiday:  .byte "Back from holiday", 0
s_caved:    .byte "Caved in", 0
s_ruined:   .byte "FRIDAY RUINED", 0
s_saved:    .byte "Weekend saved!", 0
s_clear:    .byte "Calendar clear!", 0
s_home:     .byte "It's 17:30. Go home.", 0
s_shh:      .byte "SHHHHH!", 0
s_d1:       .byte "Decline", 0
s_d2:       .byte "Out of", 0
s_d3:       .byte "Double-", 0
s_d4:       .byte "Head-", 0
s_e1:       .byte 0
s_e2:       .byte "Office", 0
s_e3:       .byte "booked", 0
s_e4:       .byte "phones", 0
name1_lo:   .byte <s_d1, <s_d2, <s_d3, <s_d4
name1_hi:   .byte >s_d1, >s_d2, >s_d3, >s_d4
name2_lo:   .byte <s_e1, <s_e2, <s_e3, <s_e4
name2_hi:   .byte >s_e1, >s_e2, >s_e3, >s_e4
opt_x:      .byte 4, 13, 22, 31
cost:       .byte 2, 3, 3, 4
wall_col:   .byte 3, 5, 4       ; (tried from the end)
hp0_lo:     .byte <DEC_HP, <OOO_HP, 0   ; by tower type 1-3
hp0_hi:     .byte >DEC_HP, >OOO_HP, 0
;                 short std long recur mini boss
k_hp:       .byte 3,    6,  11,  6,    2,   30
k_spd256:   .byte 102,  82, 61,  77,   113, 51  ; px/s × 5.12 (20, 16, 12, 15, 22, 10)
k_w:        .byte 44,   58, 70,  58,   34,  76  ; px
k_wch:      .byte 4,    5,  6,   5,    3,   6   ; chars drawn
k_col:      .byte 3,    6,  7,   4,    4,   2
k_wt:       .byte 2,    2,  4,   2,    1,   8   ; weight × 2
col_char:   .byte 4, 8, 11, 15, 18, 22, 25, 29, 32, 36      ; first char of each column (x / 12, rounded up)
colx_lo:    .repeat NCOL, i
            .byte <(GX + CW * i)
            .endrep
colx_hi:    .repeat NCOL, i
            .byte >(GX + CW * i)
            .endrep
curx_lo:    .repeat NCOL, i
            .byte <(55 + 28 * i)
            .endrep
curx_hi:    .repeat NCOL, i
            .byte >(55 + 28 * i)
            .endrep
cury:       .repeat LANES, i
            .byte 75 + 24 * i
            .endrep
lane10:     .byte 0, 10, 20, 30, 40
lane_row_y: .repeat LANES, i
            .byte LANE_Y + 3 * i
            .endrep
lane_scr_lo: .repeat LANES, i
            .byte <(SCREEN + 40 * (LANE_Y + 3 * i))
            .endrep
lane_scr_hi: .repeat LANES, i
            .byte >(SCREEN + 40 * (LANE_Y + 3 * i))
            .endrep
hair_tab:   .byte 7, 2, 0, 4, 3         ; your colleagues in the focus zone
hair_tab2:  .byte 0, 2, 7, 4, 3, 6, 1, 5
.include "gen/mg_defender_data.s"

.bss
bss_start:
i_used:     .res MAXI
i_kind:     .res MAXI
i_lane:     .res MAXI
i_xlo:      .res MAXI           ; browser px
i_xhi:      .res MAXI
i_frac:     .res MAXI
i_spd:      .res MAXI           ; 1/256 px per frame
i_hp:       .res MAXI
i_hit:      .res MAXI
i_label:    .res MAXI
t_type:     .res CELLS          ; defences by cell (lane × 10 + column)
t_hp_lo:    .res CELLS          ; frames of chewing left
t_hp_hi:    .res CELLS
t_cool:     .res CELLS
t_life_hi:  .res CELLS
t_hit:      .res CELLS
b_used:     .res MAXB
b_lane:     .res MAXB
b_xlo:      .res MAXB
b_xhi:      .res MAXB
w_t:        .res LANES          ; headphones shockwave frames per lane
i_next:     .res MAXI           ; lane lists (build_lists)
lane_head:  .res LANES
maxr_lo:    .res LANES
maxr_hi:    .res LANES
bss_end:
.assert bss_end - bss_start <= 768, error, "BSS too big for the clearing loop"
s_t:        .res MAXS           ; the schedule: time in units of 16 frames ...
s_lk:       .res MAXS           ; ... lane + kind × 8 (MAXS apart, for the sort)
lb_ch:      .res 120            ; lane buffer
lb_col:     .res 120
buf:        .res 24
dif:        .res 1
wave_d:     .res 2              ; frames of the wave
limit:      .res 2
regen:      .res 1              ; frames per excuse
smul:       .res 2              ; speed factor × 256
hpm:        .res 1              ; hit point factor × 64
khp:        .res 6              ; per kind
kspd:       .res 6
phones_dmg: .res 1
splits:     .res 1
count:      .res 1
span:       .res 2
ns:         .res 1              ; scheduled
total:      .res 1              ; total weight × 2
cur_gc:     .res 1
sx:         .res 2
kx:         .res 1
kx2:        .res 2
kl:         .res 1
lp_c:       .res 1
lp_x:       .res 1
lp_y:       .res 1
cell_x:     .res 1
cb:         .res 1
tcell:      .res 1
focus_dirty: .res 1
fl_c:       .res 1
s_hour:     .res 6
s_key:      .res 3
mu_a:       .res 1
mu_b:       .res 1
bn_f:       .res 1
sp_k:       .res 1              ; spawn
sp_l:       .res 1
sp_i:       .res 1
sp_v:       .res 1
sp_w:       .res 1
.if .defined(AUTOPLAY)
fr_lo:      .res LANES
fr_hi:      .res LANES
hp_l:       .res LANES
boss_l:     .res 1
bres:       .res 1
brr:        .res 1
.endif
