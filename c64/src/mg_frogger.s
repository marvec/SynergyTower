; Coffee Crossing (src/minigames/frogger.js) as a disk-loaded overlay at $4000.
; Carry a full cup from the kitchen to your desk across office lanes of speed-walking managers, rolling
; chairs, mail carts, Roombas, people carrying boxes and (d >= 0.4) dogs. A collision spills part of the cup
; (stunned 0.6 s, then back to the last safe row; an empty cup sends you back to the kitchen). The "Quick
; question?" colleague homes in on your lane and freezes you for 1.5 s. Traffic is 8% faster after each cup.
; Difficulty 0: 3 lanes, a median, 3 lanes; 2 cups in 50 s; 22% spilled; desk 5 tiles wide; 4 median decor;
;   traffic 26 px/s × kind, ~2 per lane; the colleague walks 20 px/s and tries a lane hop every ~3.5 s.
; Difficulty 1: 4 + 4 lanes (from d = 0.5, with 3 cups); 45 s; 30% spilled; desk 3 tiles; 6 decor; traffic
;   50 px/s, ~3.4 per lane (at most 3 here: two sprite sets of 3); the colleague 32 px/s, a hop every ~2 s.
; Score = coffee delivered / cups required. Content: gen/mg_frogger_data.s (tools/mg/frogger.js).
;
; The field is the browser's 24 × 9 (11) tiles at 3/4 scale: 12 × 16 px tiles on chars 2-37, rows 3-20
; (rows 2-23 with 11 rows; the status then moves to the header and the messages to the footer row).
; You are sprite 0, the colleague sprite 1. Traffic: sprites 2-4 on the even lanes, 5-7 on the odd ones;
; after the frame's logic, raster polls re-use each set two lanes further down once the lane above it has
; been drawn. The side walls are black hires blocks in front of the traffic (sprite priority), so people
; walk in and out of the field as in the browser.

.include "api.inc"
.include "gen/chars.inc"

COLS      = 24                  ; tiles across
MAXL      = 8                   ; lanes: 3 + 3, or 4 + 4 from d = 0.5
PER       = 3                   ; traffic per lane, at most (one sprite set)
MAXO      = MAXL * PER
MAXR      = 11                  ; rows: your desk, lanes, median, lanes, kitchen
BIG_FROM  = 128                 ; d >= 0.5: 4 + 4 lanes, 3 cups
DOG_FROM  = 102                 ; d >= 0.4: dogs (and a second manager) join the lane pool
HOP_T     = 5                   ; 0.1 s per hop
STUN_T    = 30
FREEZE_T  = 75
CELEB_T   = 45
INV_START = 30                  ; blinking, can't be hit
INV_ROUND = 40
INV_STUN  = 60
INV_CHAT  = 25
REP_FIRST = 11                  ; a held direction hops again after 0.22 s, then every 0.14 s
REP_NEXT  = 7
MSG_T     = 60
STAT_Y    = 21                  ; 9 rows: status row (coffee, cups) ...
MSG_Y     = 22                  ; ... and floating messages; 11 rows: header and footer row instead
NOTE_T    = 150                 ; the department note, 3 s
LOOP      = 324                 ; traffic wraps over the field + 18 px on each side (x 0-323)
FIELD_R   = 18 + 288            ; traffic x of the field's right edge
BASE_SPD  = 100                 ; 26 JS px/s, in 1/256 px per frame at 3/4 scale (+ 92 at d = 1)
ROOMBA_CYC = 242                ; a Roomba crawls at 1/5 speed for 43 of every 242 frames
ROOMBA_SLOW = 43
QQ_SPD    = 77                  ; 20 JS px/s (+ 46 at d = 1)
QQ_LEAVE  = 269                 ; 70 JS px/s
QQ_HOME   = 105                 ; turns towards you within this distance on your lane
QQ_HIT    = 6
QQ_TELE   = 28                  ; the '!' before a lane hop, 0.55 s
QQ_GONE   = 150                 ; 3 s away after a chat (- 60 at d = 1)
QQ_SHIFT  = 175                 ; 3.5 s between lane hop tries (- 75 at d = 1), × 0.8-1.2
FX        = 2                   ; field: chars 2-37 ...
SPR_X     = 10                  ; sprite x = traffic x + SPR_X (field px + 28)
P_SHIRT   = 14
Q_SHIRT   = 5
DOG_COL   = 8
PTR_DOWN  = ($e000 - $c000) / 64        ; person frames: down, up, left, right × 3
PTR_BOXES = ($e300 - $c000) / 64        ; ours: boxes, chair, cart right, cart left, Roomba, Roomba + cat
PTR_DOG   = PTR_BOXES + 5               ; (the dog takes the cat's frame when dogs are about)
K_MANAGER = 0
K_CHAIR   = 1
K_CART    = 2
K_ROOMBA  = 3
K_BOXES   = 4
K_DOG     = 5
B_MARGIN  = 4                   ; bot: extra px of room it wants
.zeropage
zp_first:
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
t4:       .res 1
t5:       .res 1
anim:     .res 1
done:     .res 1
p_col:    .res 1
p_row:    .res 1
p_face:   .res 1                ; 0 up, 1 down, 2 left, 3 right (also the hop direction)
p_last:   .res 1                ; last safe row (median or kitchen)
hop_t:    .res 1
buffer:   .res 1                ; direction + 1 pressed during a hop
stun:     .res 1
freeze:   .res 1
inv:      .res 1
celeb:    .res 1
coffee:   .res 1                ; % in the cup
ndel:     .res 1                ; cups delivered
slot:     .res 1                ; first tile of your desk
sl_c0:    .res 1                ; its screen columns
sl_c1:    .res 1
held:     .res 1                ; joystick bit held since its press
rep:      .res 1
msg_t:    .res 1
flash_t:  .res 1
q_lx:     .res 2                ; quick-question colleague: x like the traffic's (signed)
q_frac:   .res 1
q_row:    .res 1
q_dir:    .res 1                ; 0 right, 1 left
q_tele:   .res 1
q_target: .res 1
q_shift:  .res 1
q_gone:   .res 1
q_leave:  .res 1
bub_row:  .res 1                ; speech bubble's screen row, $ff = none
mk_col:   .res 1                ; the '?' over the colleague, $ff = none
mk_row:   .res 1
mk_ch:    .res 1
pl:       .res 2                ; your x like the traffic's: 12 col + 24
prod:     .res 2
m1:       .res 1
rp:       .res 2
cp:       .res 2
zp_last:
sp:       .res 2

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup -------------------------------------------------------------------------------------------
; A = difficulty 0-255 (d = A / 255)
init:
        tay
        ldx #zp_last - zp_first - 1
        lda #0
:       sta zp_first,x
        dex
        bpl :-
        tax                     ; (BSS: up to 512 bytes)
:       sta bss_start,x
        sta bss_start+256,x
        inx
        bne :-
        sty dif
        lda #$ff
        sta bub_row
        sta mk_col
        jsr setup_diff
        ; our sprite frames under the KERNAL
        ldx #0
:       lda frog_frames,x
        sta $e300,x
        lda frog_frames+128,x
        sta $e380,x
        lda frog_frames+256,x
        sta $e400,x
        inx
        bpl :-
        lda dog_on              ; dogs about: the dog replaces the Roomba's cat
        beq :++
        ldx #63
:       lda dog_frame,x
        sta $c000 + 64 * PTR_DOG,x
        dex
        bpl :-
:       lda #$ff
        sta $d01c               ; all multicolour
        lda #0                  ; (on with the first frame's positions)
        sta $d015
        lda #%11111110          ; traffic and the colleague behind the side walls, you in front
        sta $d01b
        lda #0
        sta $d017
        sta $d01d
        sta $d025
        lda #10
        sta $d026
        ; median decor: decor_n distinct tiles
        lda decor_n
        sta t1
:       lda #COLS
        jsr API_RMOD
        tax
        lda decor,x
        bne :-
        stx t0
        lda #5
        jsr API_RMOD
        tax
        lda decor_pick,x
        ldx t0
        sta decor,x
        dec t1
        bne :-
        jsr make_lanes
        ; the colleague comes in from one side
        lda nlanes
        jsr API_RMOD
        tax
        lda lane_row,x
        sta q_row
        jsr API_RAND
        and #1
        sta q_dir
        tax
        lda q_start_lo,x
        sta q_lx
        lda q_start_hi,x
        sta q_lx+1
        lda q_base              ; the first lane hop try
        sta q_shift
        ; you, in the kitchen
        lda #COLS/2
        sta p_col
        lda kitchen
        sta p_row
        sta p_last
        lda #100
        sta coffee
        lda #INV_START
        sta inv
        jsr new_slot
        ; screen
        text 1, 0, s_name, 7
        jsr draw_cups_header
        lda fy
        sta t4
        lda rows
        asl
        adc fy
        sta t5                  ; past the field's last char row
:       ldy t4
        jsr draw_char_row
        inc t4
        lda t4
        cmp t5
        bne :-
        jsr draw_status
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<s_note
        ldx #>s_note
        ldy #7
        jsr message
        lda #NOTE_T
        sta msg_t
        jsr build_sprites
        lda #<2500              ; 50 s, 45 s at d = 1
        sec
        sbc dif
        pha
        lda #>2500
        sbc #0
        tax
        pla
        jmp timer_start

; The difficulty's settings (byDiff over d = dif / 255) and the layout that goes with them.
setup_diff:
        ldx #0                  ; 3 + 3 lanes, 2 cups, rows 3-20 ...
        lda dif
        cmp #BIG_FROM
        bcc :+
        inx                     ; ... or 4 + 4 lanes, 3 cups, rows 2-23
:       stx big
        lda half_tab,x          ; lanes per side
        sta median
        inc median              ; (the median's row: half + 1)
        asl
        sta nlanes
        adc #3
        sta rows
        sta kitchen
        dec kitchen
        lda req_tab,x
        sta required
        lda fy_tab,x
        sta fy
        lda msg_tab,x
        sta msg_row
        lda stat_tab,x
        sta stat_row
        lda fy                  ; sprite y on row 0: feet 3 px above the row's bottom
        asl
        asl
        asl
        adc #43
        ldx #0
:       sta row_y,x
        clc
        adc #16
        inx
        cpx #MAXR
        bne :-
        ldx #MAXR - 1           ; lane numbers: rows 1 .. kitchen - 1 except the median
        lda #$ff
:       sta row_lane,x
        dex
        bpl :-
        ldx #0
        ldy #1
:       cpy median
        beq :+
        tya
        sta lane_row,x
        txa
        sta row_lane,y
        inx
:       iny
        cpy kitchen
        bcc :--
        ; desk 5 / 4 / 3 tiles and 4 / 5 / 6 median decor (round(5 - 2 d), round(4 + 2 d))
        ldx #5
        lda dif
        cmp #64
        bcc :+
        dex
        cmp #192
        bcc :+
        dex
:       stx slot_w
        txa
        eor #$ff
        sec
        adc #9
        sta decor_n
        lda dif                 ; spilled per collision: 22 + 8 d %
        lsr
        lsr
        lsr
        lsr
        lsr
        clc
        adc #22
        sta spill_amt
        lda dif                 ; dogs from d = 0.4
        cmp #DOG_FROM
        lda #0
        rol
        sta dog_on
        lda dif                 ; traffic: 100 + 0.36 A (26 -> 50 JS px/s)
        lsr
        lsr
        sta t0                  ; A / 4
        lsr
        sta t1                  ; A / 8
        lsr
        lsr
        lsr                     ; A / 64
        eor #$ff
        sec
        adc t0
        clc
        adc t1
        adc #BASE_SPD
        sta base_spd
        lda t1                  ; the colleague: 77 + 0.19 A (20 -> 32 JS px/s)
        lsr
        clc
        adc t1
        adc #QQ_SPD
        sta qspd_lo
        lda #0
        sta qspd_hi
        lda #<QQ_LEAVE
        sta qspd_lo+1
        lda #>QQ_LEAVE
        sta qspd_hi+1
        lda t1                  ; lane hop tries: 175 - 0.29 A frames (3.5 -> 2 s)
        lsr
        lsr
        sta t2                  ; A / 32
        lsr
        lsr
        clc
        adc t2
        adc t0
        eor #$ff
        sec
        adc #QQ_SHIFT
        sta q_base
        lda t1                  ; away after a chat: 150 - 0.23 A frames (3 -> 1.8 s)
        lsr
        lsr
        lsr
        eor #$ff
        sec
        adc t0
        eor #$ff
        sec
        adc #QQ_GONE
        sta q_gone_t
        rts

; Lane kinds (never twice in a row), alternating directions, speeds and the traffic on them.
make_lanes:
        jsr API_RAND
        and #1
        sta t3                  ; direction of the first lane
        lda #$ff
        sta t2                  ; previous kind
        ldx #0
@ln:    stx t1
:       lda #5                  ; from the pool (+ dog, manager at d >= 0.4), not the previous kind
        clc
        adc dog_on
        adc dog_on
        jsr API_RMOD
        tax
        lda kind_pool,x
        cmp t2
        beq :-
        ldx t1
        sta ln_kind,x
        sta t2
        lda t3
        sta ln_dir,x
        eor #1
        sta t3
        ; speed = base × 0.88-1.12 × the kind's factor (both / 128), 16 bit
        lda #31                 ; × (113..143) / 128
        jsr API_RMOD
        clc
        adc #113
        ldx base_spd
        jsr mul8
        lda prod
        asl
        lda prod+1
        rol
        pha
        ldx t1
        ldy ln_kind,x
        ldx kind_spd,y
        pla
        jsr mul8
        lda prod
        asl
        lda prod+1
        rol
        ldx t1
        sta ln_spd,x
        lda #0
        rol
        sta ln_spdh,x
        jsr place_lane
        ldx t1
        inx
        cpx nlanes
        bne @ln
        rts

; Traffic of lane t1: n = round((2 + 1.4 d) × the kind's density × 0.85-1.15), 1-3 (the browser allows 4),
; evenly spaced around the loop with ±12% jitter.
place_lane:
        lda dif                 ; (2 + 1.4 d) × 16 = 32 + 0.086 A
        lsr
        lsr
        lsr
        lsr
        sta t0
        lsr
        clc
        adc t0
        sta t0
        lda dif
        lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        eor #$ff
        sec
        adc t0
        clc
        adc #32
        ldy t1
        ldx ln_kind,y
        ldy kind_dens,x
        tax
        tya
        jsr mul8                ; × density / 128
        lda prod
        asl
        lda prod+1
        rol
        sta t4
        lda #39                 ; × (109..147) / 128
        jsr API_RMOD
        clc
        adc #109
        ldx t4
        jsr mul8
        lda prod
        asl
        lda prod+1
        rol
        clc
        adc #8                  ; round (sixteenths)
        lsr
        lsr
        lsr
        lsr
        bne :+
        lda #1
:       cmp #PER + 1
        bcc :+
        lda #PER
:       ldx t1
        sta ln_n,x
        tay
        lda spacing_lo-1,y
        sta sp
        lda spacing_hi-1,y
        sta sp+1
        lda jitter_w-1,y
        sta t5
        ; offset: random 0 .. spacing - 1 (16 bit: two bytes, the high one only when spacing > 255)
        lda sp+1
        beq :+
        lda #2                  ; 0-323: 0-161 + 0/162
        jsr API_RMOD
        tax
        lda #162
        jsr API_RMOD
        clc
        adc off_hi_tab,x
        sta t4
        lda #0
        adc #0
        sta t3
        jmp @have
:       lda sp
        jsr API_RMOD
        sta t4
        lda #0
        sta t3
@have:  ldx t1                  ; entries lane × 3 ..
        lda lane3,x
        sta t0
        lda #0
        sta t2                  ; obstacle number
@ob:    ldx t0
        lda #1
        sta o_used,x
        lda t1
        sta o_lane,x
        and #1                  ; its hardware sprite's bit: 2 + k (even lanes), 5 + k (odd lanes)
        tay
        lda hw_first,y
        clc
        adc t2
        tay
        lda bit_tab,y
        sta o_bit,x
        ; x = offset + k × spacing + jitter (-w..w), wrapped into 0..LOOP-1
        lda t5
        asl
        clc
        adc #1
        jsr API_RMOD
        ldx t0
        sec
        sbc t5
        ldy #0
        bcs :+
        dey                     ; negative
:       clc
        adc t4
        sta o_xlo,x
        tya
        adc t3
        sta o_xhi,x
        bpl :+
        lda o_xlo,x             ; below 0: + LOOP
        clc
        adc #<LOOP
        sta o_xlo,x
        lda o_xhi,x
        adc #>LOOP
        sta o_xhi,x
        jmp @wrapped
:       cmp #>LOOP              ; LOOP or more: - LOOP
        bcc @wrapped
        bne :+
        lda o_xlo,x
        cmp #<LOOP
        bcc @wrapped
:       lda o_xlo,x
        sec
        sbc #<LOOP
        sta o_xlo,x
        lda o_xhi,x
        sbc #>LOOP
        sta o_xhi,x
@wrapped:
        lda #ROOMBA_CYC         ; Roomba pause cycle / dog stride phase
        jsr API_RMOD
        ldx t0
        sta o_ph,x
        lda #60                 ; the dog's first yap in 1.2-2.4 s
        jsr API_RMOD
        clc
        adc #60
        ldx t0
        sta o_yap,x
        lda #0                  ; 30%: the office cat rides along (no cat while dogs are about)
        ldx dog_on
        bne :+
        jsr API_RAND
        cmp #77
        lda #0
        rol
        eor #1
:       ldx t0
        sta o_cat,x
        inc t0
        lda t4                  ; next: + spacing
        clc
        adc sp
        sta t4
        lda t3
        adc sp+1
        sta t3
        inc t2
        lda t2
        ldx t1
        cmp ln_n,x
        bcs :+
        jmp @ob
:       rts

; New desk position: slot 1 .. 23 - width, and the screen columns whose middle lies in it.
new_slot:
        lda #COLS - 1
        sec
        sbc slot_w
        jsr API_RMOD
        clc
        adc #1
        sta slot
.if .defined(AUTOPLAY)
        ; (test builds: again if every tile of the desk has decor in front of it, which the bot can't do)
        tax
        ldy slot_w
:       lda decor,x
        beq :+
        inx
        dey
        bne :-
        beq new_slot
:       lda slot
.endif
        asl
        asl
        sta t0
        asl
        adc t0                  ; × 12 (at most 240)
        sta t0
        clc
        adc #3
        lsr
        lsr
        lsr
        clc
        adc #FX
        sta sl_c0
        ldx slot_w
        lda w12_tab-3,x         ; + width × 12 + 3, 9 bits
        clc
        adc t0
        ror
        lsr
        lsr
        clc
        adc #FX
        sta sl_c1
        rts

; ---- frame -------------------------------------------------------------------------------------------
frame:
        lda done
        beq :+
        sec
        rts
:       jsr show_front          ; you, the colleague, lanes 0-1 (built last frame)
        inc anim
        jsr msg_tick
        jsr timer_tick
        bcc :+
        jmp finish
:       jsr traffic
        jsr update_qq
        lda celeb
        beq @play
        dec celeb
        bne @draw
        jsr next_round
        jmp @draw
@play:  lda inv
        beq :+
        dec inv
:       lda hop_t
        beq @hopped
        dec hop_t
        bne @hopped
        lda buffer              ; pressed during the hop
        beq @hopped
        ldx #0
        stx buffer
        sec
        sbc #1
        jsr hop
@hopped:
        lda stun
        beq :+
        dec stun
        bne :+
        jsr after_stun
:       lda freeze
        beq :+
        dec freeze
        bne :+
        jsr chat_over
:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        jsr steer
        jsr collide
        lda done
        beq @draw
        sec
        rts
@draw:  jsr draw_marker
        jsr build_sprites
        jsr mux_lanes           ; lanes 2.. as the beam passes the lanes above
        clc
        rts

; ---- traffic -----------------------------------------------------------------------------------------
traffic:
        ldx #MAXO - 1
@o:     lda o_used,x
        bne :+
        jmp @next
:       ldy o_lane,x
        lda ln_spd,y
        sta t1
        lda ln_spdh,y
        sta t2
        lda ln_kind,y
        cmp #K_ROOMBA
        bne @dog
        inc o_ph,x
        lda o_ph,x
        cmp #ROOMBA_CYC
        bcc :+
        lda #0
        sta o_ph,x
:       cmp #ROOMBA_SLOW
        bcs @move
        lsr t2                  ; × 3/16
        ror t1
        lsr t2
        ror t1
        lsr t2
        ror t1
        lda t1
        lsr
        adc t1
        sta t1
        lda #0
        sta t2
        beq @move
@dog:   cmp #K_DOG
        bne @move
        jsr dog_step
@move:  lda ln_dir,y
        bne @left
        lda o_frac,x
        clc
        adc t1
        sta o_frac,x
        lda o_xlo,x
        adc t2
        sta o_xlo,x
        bcc :+
        inc o_xhi,x
:       lda o_xhi,x             ; reached LOOP: - LOOP
        beq @next
        lda o_xlo,x
        cmp #<LOOP
        bcc @next
        sbc #<LOOP
        sta o_xlo,x
        lda #0
        sta o_xhi,x
        beq @next
@left:  lda o_frac,x
        sec
        sbc t1
        sta o_frac,x
        lda o_xlo,x
        sbc t2
        sta o_xlo,x
        bcs @next
        dec o_xhi,x
        bpl @next
        lda o_xlo,x             ; below 0: + LOOP
        clc
        adc #<LOOP
        sta o_xlo,x
        lda o_xhi,x
        adc #>LOOP
        sta o_xhi,x
@next:  dex
        bmi :+
        jmp @o
:       rts

; Dog X (lane Y, both kept): speed t1/t2 × (1 + 0.55 sin(3 t + phase)); now and then a yap near you.
dog_step:
        stx t3
        sty t4
        dec o_yap,x
        bne @speed
        lda #61                 ; next yap in 1.2-2.4 s
        jsr API_RMOD
        clc
        adc #60
        ldx t3
        sta o_yap,x
        lda msg_t               ; (only when no other message is up)
        bne @speed
        ldy t4
        lda lane_row,y          ; within 2 rows of you
        sec
        sbc p_row
        bcs :+
        eor #$ff
        adc #1
:       cmp #3
        bcs @speed
        lda o_xhi,x             ; and on the field
        bne :+
        lda o_xlo,x
        cmp #18
        bcc @speed
        bcs @yap
:       lda o_xlo,x
        cmp #<FIELD_R
        bcs @speed
@yap:   lda #3
        jsr API_RMOD
        tax
        lda yap_lo,x
        pha
        lda yap_hi,x
        tax
        pla
        ldy #15
        jsr message
@speed: ldx t3
        lda anim                ; phase: 2.5 steps (of 256) per frame
        and #1
        clc
        adc #2
        adc o_ph,x
        sta o_ph,x
        lsr
        lsr
        tay
        lda dog_sin,y           ; f = 128 + 70 sin
        sta t5
        tax
        lda t1
        jsr mul8                ; lo × f
        lda #0
        sta t1
        lda t2
        beq :+
        lda prod+1              ; + hi × f × 256 (hi is 0 or 1)
        clc
        adc t5
        sta prod+1
        rol t1
:       asl prod                ; / 128
        rol prod+1
        rol t1
        lda t1
        sta t2
        lda prod+1
        sta t1
        ldx t3
        ldy t4
        rts

; ---- the quick-question colleague --------------------------------------------------------------------
update_qq:
        lda q_gone
        beq @here
        dec q_gone
        bne @rts
        lda nlanes              ; back on a random lane, from a random side
        jsr API_RMOD
        tax
        lda lane_row,x
        sta q_row
        jsr API_RAND
        and #1
        sta q_dir
        tax
        lda q_back_lo,x
        sta q_lx
        lda q_back_hi,x
        sta q_lx+1
        lda #0
        sta q_leave
        sta q_frac
@rts:   rts
@here:  lda freeze              ; chatting
        bne @rts
        lda q_leave
        bne @move
        lda q_row               ; on your lane: walk towards you
        cmp p_row
        bne @hops
        jsr calc_pl
        jsr q_dist
        lda t1
        cmp #QQ_HOME
        bcs @hops
        lda t2
        sta q_dir
@hops:  lda q_tele
        beq @count
        dec q_tele
        bne @move
        lda q_target
        sta q_row
        jmp @move
@count: dec q_shift
        bne @move
        lda q_base              ; next try in base × 0.8-1.2: base × 0.8 + rand(base × 0.4)
        ldx #102
        jsr mul8
        ldx prod+1
        inx
        txa
        jsr API_RMOD
        sta t3
        lda q_base
        ldx #205
        jsr mul8
        lda prod+1
        clc
        adc t3
        sta q_shift
        lda p_row               ; one lane towards you, if you are 3 rows away or less
        sec
        sbc q_row
        beq @move
        ldx #1
        bcs :+
        ldx #$ff
        eor #$ff
        adc #1
:       cmp #4
        bcs @move
        txa
        clc
        adc q_row
        tay
        lda row_lane,y
        bmi @move
        sty q_target
        lda #QQ_TELE
        sta q_tele
@move:  ldx q_leave
        lda q_dir
        bne @ml
        lda q_frac
        clc
        adc qspd_lo,x
        sta q_frac
        lda q_lx
        adc qspd_hi,x
        sta q_lx
        bcc @bounds
        inc q_lx+1
        jmp @bounds
@ml:    lda q_frac
        sec
        sbc qspd_lo,x
        sta q_frac
        lda q_lx
        sbc qspd_hi,x
        sta q_lx
        bcs @bounds
        dec q_lx+1
@bounds:                        ; out past either edge (x < 0 or > LOOP): turn back, or gone after a chat
        lda q_lx+1
        bmi @out
        beq @in
        lda q_lx
        cmp #<(LOOP + 1)
        bcc @in
@out:   lda q_leave
        beq @turn
        lda q_gone_t
        sta q_gone
        rts
@turn:  lda q_dir
        eor #1
        sta q_dir
@in:    rts

; t1 = |your x - the colleague's x| (255 = far), t2 = direction from the colleague to you (0 right, 1 left).
q_dist:
        lda pl
        sec
        sbc q_lx
        sta t1
        lda pl+1
        sbc q_lx+1
        ldx #0
        tay
        bpl @pos
        lda t1
        eor #$ff
        clc
        adc #1
        sta t1
        tya
        eor #$ff
        adc #0
        ldx #1
@pos:   stx t2
        cmp #0
        beq :+
        lda #255
        sta t1
:       rts

hit_qq:
        lda #FREEZE_T
        sta freeze
        lda #0
        sta hop_t
        sta buffer
        lda q_dir               ; the colleague stops right beside you
        tax
        lda pl
        clc
        adc qq_side,x
        sta q_lx
        lda pl+1
        adc qq_side_hi,x
        sta q_lx+1
        lda #SFX_BLIP
        jsr API_SFX
        jsr remove_marker
        lda #QQ_N
        ldx #QQ_0
        jsr pick_str
        ; speech bubble on the row above you, centred on you and kept inside the field
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       sty t1
        lda pl
        sec
        sbc #2
        sta t2
        lda pl+1
        sbc #0
        lsr
        lda t2
        ror
        lsr
        lsr                     ; your column
        sta t2
        lda t1
        lsr
        sta t3
        lda t2
        sec
        sbc t3
        bcc @lo
        cmp #FX
        bcs :+
@lo:    lda #FX
:       sta t2
        lda #FX + 36
        sec
        sbc t1
        cmp t2
        bcs :+
        sta t2
:       lda p_row
        asl
        adc fy
        sbc #0                  ; (C = 0: - 1)
        sta bub_row
        tay
        ldx t2
        lda #1
        sta COLOR
        jmp API_PRINT

chat_over:
        lda #BYE_N
        ldx #BYE_0
        jsr pick_str
        ldy #6
        jsr message_ptr
        jsr clear_bubble
        lda #1
        sta q_leave
        jsr calc_pl
        jsr q_dist              ; walk away from you
        lda t2
        eor #1
        sta q_dir
        lda inv
        cmp #INV_CHAT
        bcs :+
        lda #INV_CHAT
        sta inv
:       rts

clear_bubble:
        ldy bub_row
        bmi :+
        jsr draw_char_row
        lda #$ff
        sta bub_row
:       rts

; ---- you ---------------------------------------------------------------------------------------------
; Joystick: a press hops, holding it keeps hopping (Up, Down, Left, Right take turns in that order).
steer:
        lda JOYP
        and #J_UP | J_DOWN | J_LEFT | J_RIGHT
        beq @held
        ldy #0
:       lsr
        bcs :+
        iny
        bne :-
:       lda dir_bit,y
        sta held
        lda #REP_FIRST
        sta rep
        tya
        jmp hop
@held:  lda held
        beq @rts
        and JOY
        bne :+
        sta held
        rts
:       dec rep
        bne @rts
        lda #REP_NEXT
        sta rep
        ldy #0
        lda held
:       lsr
        bcs :+
        iny
        bne :-
:       tya
        jmp hop
@rts:   rts

; A = direction (0 up, 1 down, 2 left, 3 right).
hop:
        tay
        lda stun
        ora freeze
        ora celeb
        ora done
        bne @rts
        lda hop_t
        beq :+
        iny                     ; mid-hop: remember it for the end of the hop
        sty buffer
@rts:   rts
:       sty p_face
        lda p_col
        clc
        adc dir_dx,y
        tax
        lda p_row
        clc
        adc dir_dy,y
        tay
        jsr is_free
        bcs @go
        cpy #0
        bne @rts
        cpx #COLS
        bcs @rts
        lda #5                  ; somebody else's desk: rim click
        jsr API_SFX
        lda #BUMP_N
        ldx #BUMP_0
        jsr pick_str
        ldy #7
        jmp message_ptr
@go:    stx p_col
        sty p_row
        lda #HOP_T
        sta hop_t
        lda #3                  ; step: hi-hat
        jsr API_SFX
        lda p_row
        beq deliver
        cmp median
        beq :+
        cmp kitchen
        bne @rts
:       sta p_last
        rts

; X = column, Y = row (both kept): C=1 if you may stand there.
is_free:
        cpx #COLS
        bcs @no
        cpy rows
        bcs @no
        cpy #0
        bne @med
        cpx slot
        bcc @no
        txa
        sec
        sbc slot
        cmp slot_w
        bcs @no
        bcc @yes
@med:   cpy median
        bne @yes
        lda decor,x
        bne @no
@yes:   sec
        rts
@no:    clc
        rts

deliver:
        lda #0
        sta hop_t
        ldx ndel
        lda coffee
        sta cups,x
        inc ndel
        lda #SFX_GOOD
        jsr API_SFX
        lda #0                  ; "57% delivered! Fuel acquired."
        sta buf_i
        lda coffee
        jsr buf_num
        lda #<s_deliv
        ldx #>s_deliv
        jsr buf_str
        lda #DELIV_N
        ldx #DELIV_0
        jsr pick_str
        lda PTR
        ldx PTR+1
        jsr buf_str
        lda #<buf
        ldx #>buf
        ldy #5
        jsr message
        jsr draw_status
        jsr draw_cups_header
        lda ndel
        cmp required
        bcc :+
        jmp finish
:       lda #CELEB_T
        sta celeb
        rts

; Refill: traffic 8% faster, a new desk.
next_round:
        ldx nlanes
        dex
:       lda ln_spdh,x           ; × (1 + 1/16 + 1/64), 16 bit
        sta t2
        lda ln_spd,x
        ldy #4
@sh:    lsr t2
        ror
        dey
        bne @sh
        sta t1                  ; / 16 (fits a byte)
        lsr
        lsr
        clc
        adc t1
        adc ln_spd,x
        sta ln_spd,x
        bcc :+
        inc ln_spdh,x
:       dex
        bpl :--
        lda #COLS/2
        sta p_col
        lda kitchen
        sta p_row
        sta p_last
        lda #100
        sta coffee
        lda #INV_ROUND
        sta inv
        lda #0
        sta hop_t
        sta p_face
        jsr new_slot
        ldy fy
        jsr draw_char_row
        ldy fy
        iny
        jsr draw_char_row
        lda #SFX_BLIP
        jsr API_SFX
        lda #<s_refill
        ldx #>s_refill
        ldy #7
        jsr message
        jmp draw_status

collide:
        lda stun
        ora inv
        ora celeb
        ora done
        bne @rts
        jsr calc_pl
        ldx p_row
        lda row_lane,x
        bmi @rts                ; not a lane
        tax
        lda lane3,x
        tax
        jsr hit_test
        bcs spill
        inx
        jsr hit_test
        bcs spill
        inx
        jsr hit_test
        bcs spill
        lda freeze
        ora q_gone
        ora q_leave
        bne @rts
        lda q_row
        cmp p_row
        bne @rts
        jsr q_dist
        lda t1
        cmp #QQ_HIT
        bcs @rts
        jmp hit_qq
@rts:   rts

; X = obstacle (kept): C=1 if it is in use and touches you.
hit_test:
        lda o_used,x
        beq @no
        lda pl
        sec
        sbc o_xlo,x
        sta t1
        lda pl+1
        sbc o_xhi,x
        bcs :+
        sta t2                  ; negative: |d|
        lda t1
        eor #$ff
        clc
        adc #1
        sta t1
        lda t2
        eor #$ff
        adc #0
:       bne @no
        ldy o_lane,x
        lda ln_kind,y
        tay
        lda kind_hit,y
        clc
        sbc t1                  ; C=1 if t1 < half width
        rts
@no:    clc
        rts

spill:
        lda coffee
        sec
        sbc spill_amt
        bcs :+
        lda #0
:       sta coffee
        lda #STUN_T
        sta stun
        lda #0
        sta hop_t
        sta buffer
        lda #SFX_BAD
        jsr API_SFX
        lda #2                  ; (the browser shakes the screen)
        sta $d020
        lda #15
        sta flash_t
        lda #SPILL_N
        ldx #SPILL_0
        jsr pick_str
        ldy #2
        jsr message_ptr
        jmp draw_status

after_stun:
        lda coffee
        bne @back
        lda kitchen             ; empty cup: back to the kitchen for a refill
        sta p_row
        sta p_last
        lda #100
        sta coffee
        lda #<s_empty
        ldx #>s_empty
        ldy #7
        jsr message
        jsr draw_status
        jmp @place
@back:  lda p_last
        sta p_row
@place: lda #0                  ; nearest free column
        sta t3
@k:     lda p_col
        clc
        adc t3
        tax
        ldy p_row
        jsr is_free
        bcs @got
        lda p_col
        sec
        sbc t3
        tax
        jsr is_free
        bcs @got
        inc t3
        lda t3
        cmp #COLS
        bne @k
        beq :+
@got:   stx p_col
:       lda #INV_STUN
        sta inv
        rts

; pl = your x in traffic coordinates: 12 col + 24.
calc_pl:
        lda p_col
        asl
        asl
        sta pl
        asl
        clc
        adc pl
        sta pl
        lda #0
        adc #0
        sta pl+1
        lda pl
        clc
        adc #24
        sta pl
        bcc :+
        inc pl+1
:       rts

; ---- sprites -----------------------------------------------------------------------------------------
; Registers for you (0), the colleague (1) and the traffic entries (lane × 3 + k: sprite set 2-4 or 5-7).
build_sprites:
        jsr calc_pl
        lda #0
        sta msb_pq
        ; you: x = pl + SPR_X, minus the rest of the hop
        lda pl
        clc
        adc #SPR_X
        sta p_sx
        lda pl+1
        adc #0
        sta t1
        ldx p_row
        lda row_y,x
        sta p_sy
        ldy hop_t
        beq @still
        lda p_face
        cmp #2
        bcc @vert
        bne @right
        lda p_sx                ; hopped left: was further right
        clc
        adc hop_dx,y
        sta p_sx
        bcc @arc
        inc t1
        bcs @arc
@right: lda p_sx
        sec
        sbc hop_dx,y
        sta p_sx
        bcs @arc
        dec t1
        bcc @arc
@vert:  lda p_face
        bne @down
        lda p_sy                ; hopped up: was lower
        clc
        adc hop_dy,y
        sta p_sy
        jmp @arc
@down:  lda p_sy
        sec
        sbc hop_dy,y
        sta p_sy
@arc:   lda p_sy
        sec
        sbc hop_arc,y
        sta p_sy
@still: lda t1
        sta msb_pq
        ldx p_face
        lda face_ptr,x
        ldy hop_t
        beq :+
        clc
        adc #1                  ; mid-step
:       ldx #P_SHIRT
        ldy stun
        beq :+
        lda #PTR_DOWN           ; splat: (the browser lays you down) red, facing the screen
        ldx #2
:       sta p_ptr
        stx p_scol
        lda inv                 ; blinking while you can't be hit
        beq :+
        lda anim
        and #4
        beq :+
        lda #0
        sta p_sx
        sta msb_pq
:
        ; the colleague
        lda q_gone
        beq :+
        lda #0
        sta q_sx
        beq @traffic
:       lda q_lx
        clc
        adc #SPR_X
        sta q_sx
        lda q_lx+1
        adc #0
        bmi @qoff
        beq :+
        lda #2
        ora msb_pq
        sta msb_pq
        bne :+
@qoff:  lda #0
        sta q_sx
:       ldx q_row
        lda row_y,x
        sta q_sy
        lda freeze
        beq @walk
        jsr q_dist              ; chatting: stands facing you
        ldx t2
        lda side_ptr,x
        bne @qptr
@walk:  ldx q_dir
        lda anim
        lsr
        lsr
        lsr
        and #1
        sec                     ; walking frames 1-2
        adc side_ptr,x
@qptr:  sta q_ptr
@traffic:
        ldx nlanes              ; per-lane MSB bits, filled below
        lda #0
:       sta ln_msb-1,x
        dex
        bne :-
        ldx #MAXO - 1
@o:     lda o_used,x
        bne @on
        sta s_x,x               ; parked in the border
        jmp @next
@on:    ldy o_lane,x
        sty t2
        lda o_xlo,x
        clc
        adc #SPR_X
        sta s_x,x
        lda o_xhi,x
        adc #0
        beq :+
        lda ln_msb,y
        ora o_bit,x
        sta ln_msb,y
:       lda lane_row,y
        tay
        lda row_y,y
        sta s_y,x
        jsr @kind
@next:  dex
        bpl @o
        rts
@kind:  ldy t2                  ; the kind's routine: X = entry, Y = lane
        lda ln_kind,y
        asl
        tay
        lda kind_jmp+1,y
        pha
        lda kind_jmp,y
        pha
        ldy t2
        rts

kind_jmp: .word k_manager-1, k_chair-1, k_cart-1, k_roomba-1, k_boxes-1, k_dog-1

k_manager:                      ; dark suit, walking fast
        lda ln_dir,y
        tay
        lda anim
        lsr
        lsr
        and #1
        sec
        adc side_ptr,y
        ldy #0
        beq k_set
k_chair:
        lda #PTR_BOXES + 1
        ldy #15
        bne k_set
k_cart:
        lda ln_dir,y
        clc
        adc #PTR_BOXES + 2
        ldy #15
        bne k_set
k_roomba:
        lda o_cat,x
        beq :+
        lda #PTR_BOXES + 5
        ldy #8
        bne k_set
:       lda #PTR_BOXES + 4
        ldy #5
        bne k_set
k_dog:                          ; trots: bobs a pixel with its stride
        lda o_ph,x
        and #$20
        beq :+
        dec s_y,x
:       lda #PTR_DOG
        ldy #DOG_COL
        bne k_set
k_boxes:                        ; one frame, bobbing as it walks
        lda anim
        lsr
        lsr
        lsr
        and #1
        eor #$ff
        sec
        adc s_y,x
        sta s_y,x
        lda #PTR_BOXES
        ldy #8
k_set:  sta s_ptr,x
        tya
        sta s_col,x
        rts

; Sprites 0, 1 and lanes 0-1 at the start of the frame (above the field).
show_front:
        lda #$ff
        sta $d015
        lda p_sx
        sta $d000
        lda p_sy
        sta $d001
        lda p_ptr
        sta SCREEN + $3f8
        lda p_scol
        sta $d027
        lda q_sx
        sta $d002
        lda q_sy
        sta $d003
        lda q_ptr
        sta SCREEN + $3f9
        lda #Q_SHIRT
        sta $d028
        lda msb_pq              ; (the lanes add theirs)
        sta msb_now
        ldx #0
        jsr write_lane
        ldx #1
        ; fall through

; X = lane: its 3 entries into its sprite set (2-4 for even lanes, 5-7 for odd ones), and its MSB bits.
write_lane:
        stx wl_l
        lda lane3,x
        tax                     ; first entry
        lda wl_l
        and #1
        tay
        lda hw_first,y
        tay                     ; first sprite
        lda #PER
        sta wl_n
@s:     lda s_ptr,x
        sta SCREEN + $3f8,y
        lda s_col,x
        sta $d027,y
        sty wl_y
        tya
        asl
        tay
        lda s_x,x
        sta $d000,y
        lda s_y,x
        sta $d001,y
        ldy wl_y
        inx
        iny
        dec wl_n
        bne @s
        lda wl_l
        and #1
        tay
        lda msb_now
        and msb_keep,y          ; this set's bits from this lane
        ldx wl_l
        ora ln_msb,x
        sta msb_now
        sta $d010
        rts

; Lanes 2 .. nlanes-1: each one's sprite set is re-used once the beam is past the lane two rows up
; (its sprites end 21 lines below their top), before this lane's sprites start.
mux_lanes:
        ldx #2
@l:     cpx nlanes
        bcs @rts
        stx wl_i
        lda lane_row-2,x
        tay
        lda row_y,y
        clc
        adc #21
        sta wl_line
:       lda $d011               ; wait for lines wl_line-249 of this frame
        bmi :-
        lda $d012
        cmp wl_line
        bcc :-
        cmp #250
        bcs :-
        ldx wl_i
        jsr write_lane
        ldx wl_i
        inx
        bne @l
@rts:   rts

; ---- screen ------------------------------------------------------------------------------------------
; The '?' over the colleague ('!' before a lane hop), unless chatting or leaving.
draw_marker:
        lda q_gone
        ora q_leave
        ora freeze
        bne remove_marker
        lda q_lx                ; column = (x - 2) / 8
        sec
        sbc #2
        sta t1
        lda q_lx+1
        sbc #0
        bmi remove_marker
        lsr
        lda t1
        ror
        lsr
        lsr
        cmp #FX
        bcc remove_marker
        cmp #FX + 36
        bcs remove_marker
        sta t1
        lda q_row
        asl
        adc fy
        sbc #0                  ; (C = 0: - 1)
        sta t2
        ldx #'?'
        lda q_tele
        beq :+
        ldx #'!'
:       stx t3
        lda t1
        cmp mk_col
        bne @move
        lda t2
        cmp mk_row
        bne @move
        cpx mk_ch
        beq @rts
@move:  jsr remove_marker
        lda t1
        sta mk_col
        lda t2
        sta mk_row
        lda t3
        sta mk_ch
        ldx #7
        cmp #'?'
        beq :+
        ldx #2
:       stx COLOR
        ldx mk_col
        ldy mk_row
        jsr API_PUTC
@rts:   rts

remove_marker:
        ldx mk_col
        bmi :+
        ldy mk_row
        jsr bg_cell
        ldx mk_col
        ldy mk_row
        jsr API_PUTC
        lda #$ff
        sta mk_col
:       rts

; Y = screen row: redrawn from the field's layout (plus MY DESK on the desk row).
draw_char_row:
        sty dr_row
        lda row_lo,y
        sta rp
        sta cp
        lda row_hi,y
        sta rp+1
        clc
        adc #>(COLRAM - SCREEN)
        sta cp+1
        lda #39
        sta dr_x
@x:     ldx dr_x
        ldy dr_row
        jsr bg_cell
        ldy dr_x
        sta (rp),y
        lda COLOR
        sta (cp),y
        dec dr_x
        bpl @x
        lda dr_row
        cmp mk_row              ; the '?' was on it: draw it again
        bne :+
        lda #$ff
        sta mk_col
        lda dr_row
:
        cmp fy
        bne @rts
        lda sl_c1               ; MY DESK, centred on the desk, kept on the field
        clc
        adc sl_c0
        sec
        sbc #7
        lsr
        cmp #FX
        bcs :+
        lda #FX
:       cmp #FX + 36 - 7
        bcc :+
        lda #FX + 36 - 7
:       tax
        lda #<s_mydesk
        sta PTR
        lda #>s_mydesk
        sta PTR+1
        lda #7
        sta COLOR
        ldy fy
        jmp API_PRINT
@rts:   rts

; X = column, Y = screen row (3-20) -> A = char, COLOR.
bg_cell:
        cpx #FX
        bcc @wall
        cpx #FX + 36
        bcs @wall
        tya
        sec
        sbc fy
        lsr
        sta b_row
        lda #0
        rol
        sta b_low               ; 1 = the tile's lower char row
        ldy b_row
        beq @goal
        cpy kitchen
        beq @kitchen
        cpy median
        beq @median
        lda #8
        sta COLOR
        lda #MC_A               ; carpet
        rts
@wall:  lda #0
        sta COLOR
        lda #CH_BLOCK
        rts
@kitchen:                       ; checkered tiles
        txa
        eor b_low
        and #1
        tay
        lda kit_col,y
        sta COLOR
        lda kit_ch,y
        rts
@median:
        lda char_tile - FX,x
        tay
        lda decor,y
        beq :+
        asl
        ora b_low
        tay
        lda decor_col - 2,y
        sta COLOR
        lda decor_ch - 2,y
        rts
:       lda #8
        sta COLOR
        lda #MC_HALL
        rts
@goal:  cpx sl_c0
        bcc @desk
        cpx sl_c1
        bcs @desk
        lda b_low               ; your desk: MY DESK over a blue spot
        bne :+
        lda #7
        sta COLOR
        lda #' '
        rts
:       lda #6 | 8
        sta COLOR
        lda #MC_C
        rts
@desk:  lda b_low               ; the others': monitors on the desk, drawers below
        beq :+
        lda #2 | 8
        sta COLOR
        lda #MC_KNOB
        rts
:       lda mod3 - FX,x
        tay
        lda desk_col,y
        sta COLOR
        lda desk_ch,y
        rts

; Status row: the coffee in your cup and the cups so far (11 rows: just the coffee, in the header).
draw_status:
        lda big
        beq :+
        text 18, 0, s_cup, 7
        jmp @pct
:       text 1, STAT_Y, s_coffee, 7
        lda coffee              ; bar of 10 cells: full, half, empty
        sta t1
        ldx #0
@cell:  stx t2
        lda t1
        cmp #10
        bcc :+
        sbc #10
        sta t1
        lda #CH_BLOCK
        bne @put
:       ldy #0
        sty t1
        cmp #5
        lda #CH_HALF
        bcs @put
        lda #MC_A               ; empty: dark grey
@put:   ldy #2
        cmp #MC_A
        bne :+
        ldy #8
:       sty COLOR
        pha
        txa
        clc
        adc #8
        tax
        pla
        ldy #STAT_Y
        jsr API_PUTC
        ldx t2
        inx
        cpx #10
        bne @cell
@pct:   lda #0
        sta buf_i
        lda coffee
        jsr buf_num
        lda #<s_pct
        ldx #>s_pct
        jsr buf_str
        ldx #1                  ; colour: white, yellow under 60%, red under 30%
        lda coffee
        cmp #61
        bcs :+
        ldx #7
        cmp #31
        bcs :+
        ldx #2
:       stx COLOR
        ldx #19
        lda big
        beq :+
        ldx #22
        jmp print_buf
:       jsr print_buf
        text 26, STAT_Y, s_cups, 7
        ldx #0
@cup:   stx t2
        ldy #6                  ; to come: blue
        cpx ndel
        bcc @had
        bne :+
        ldy #7                  ; this one: yellow
:       sty COLOR
        lda cup_col,x
        tax
        lda #CH_COFFEE
        ldy #STAT_Y
        jsr API_PUTC
        ldx t2
        lda #<s_now
        ldy #>s_now
        cpx ndel
        beq :+
        lda #<s_later
        ldy #>s_later
:       sta PTR
        sty PTR+1
        lda cup_col,x
        tax
        inx
        ldy #STAT_Y
        jsr API_PRINT
        jmp @ncup
@had:   lda #1
        sta COLOR
        lda cup_col,x
        tax
        lda #CH_COFFEE
        ldy #STAT_Y
        jsr API_PUTC
        lda #0
        sta buf_i
        ldx t2
        lda cups,x
        jsr buf_num
        lda #<s_pct
        ldx #>s_pct
        jsr buf_str
        ldx t2
        lda cup_col,x
        tax
        inx
        jsr print_buf
@ncup:  ldx t2
        inx
        cpx required
        bne @cup
        rts

; buf at column X of the status row, padded to 4 chars.
print_buf:
        stx t3
:       ldy buf_i
        cpy #4
        bcs :+
        lda #' '
        sta buf,y
        iny
        lda #0
        sta buf,y
        sty buf_i
        bne :-
:       lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        ldx t3
        ldy stat_row
        jmp API_PRINT

; "Cups 1/2" top right.
draw_cups_header:
        text 32, 0, s_cupsof, 7
        ldx #37
        ldy #0
        lda ndel
        jsr API_NUM
        lda #'/'
        ldx #38
        ldy #0
        jsr API_PUTC
        ldx #39
        ldy #0
        lda required
        jmp API_NUM

; A/X = message, Y = colour: centred on the message row for MSG_T frames.
message_ptr:
        lda PTR
        ldx PTR+1
message:
        sty t0
        pha
        txa
        pha
        lda msg_row
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy msg_row
        jsr API_CENTER
        lda #MSG_T
        sta msg_t
        rts

msg_tick:
        lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda big                 ; (11 rows: the footer comes back)
        beq @clr
        lda #<s_keys
        ldx #>s_keys
        jmp footer
@clr:   lda #MSG_Y
        ldx #1
        jmp clear_rows
:       rts

; A = count, X = first: PTR = a random string of that pool.
pick_str:
        stx t0
        jsr API_RMOD
        clc
        adc t0
        tax
        lda str_lo,x
        sta PTR
        lda str_hi,x
        sta PTR+1
        rts

; A/X = string appended to buf.
buf_str:
        sta sp
        stx sp+1
        ldx buf_i
        ldy #0
:       lda (sp),y
        sta buf,x
        beq :+
        inx
        iny
        bne :-
:       stx buf_i
        rts

; A = 0-255 appended to buf in decimal.
buf_num:
        sta bn
        ldy #0                  ; digits so far
        lda #100
        jsr @digit
        lda #10
        jsr @digit
        lda bn
        ora #'0'
        ldx buf_i
        sta buf,x
        inx
        lda #0
        sta buf,x
        stx buf_i
        rts
@digit: sta bd
        ldx #'0'
        lda bn
:       cmp bd
        bcc :+
        sbc bd
        inx
        bne :-
:       sta bn
        cpx #'0'
        bne :+
        cpy #0
        beq @skip
:       txa
        ldx buf_i
        sta buf,x
        inc buf_i
        iny
@skip:  rts

; prod = A × X.
mul8:
        sta m1
        stx t0
        lda #0
        ldx #8
        lsr m1
:       bcc :+
        clc
        adc t0
:       ror
        ror m1
        dex
        bne :--
        sta prod+1
        lda m1
        sta prod
        rts

.if .defined(AUTOPLAY)
; ---- test builds: a careful player -------------------------------------------------------------------
; Lines up below a free tile of the desk in the kitchen, then goes straight up whenever the next row stays
; clear for 32 frames; on a lane it steps back down if trouble arrives within 16 frames.
bot:
        lda stun
        ora freeze
        ora celeb
        ora hop_t
        ora done
        bne @rts
        jsr calc_pl
        lda slot_w              ; target: a desk tile that is free on the median, middle first
        lsr
        clc
        adc slot
        tax
        lda decor,x
        beq @tgt
        ldx slot
:       lda decor,x
        beq @tgt
        inx
        bne :-
@tgt:   lda p_row
        cmp kitchen
        bne @up
        cpx p_col
        beq @up
        lda #3                  ; right
        bcs :+
        lda #2                  ; left
:       jmp hop
@up:    lda #1
        sta b_long
        ldy p_row
        dey
        jsr lane_safe
        bcc @stay
        lda #0
        jmp hop
@stay:  lda #0
        sta b_long
        ldy p_row
        jsr lane_safe
        bcs @rts
        ldy p_row
        iny
        jsr lane_safe
        bcc @rts
        lda #1
        jmp hop
@rts:   rts

; Y = row: C=1 if it stays clear at your column (b_long: for 32 frames, else 16).
lane_safe:
        lda row_lane,y
        bmi @safe
        sty b_row
        tax
        lda lane3,x
        tax
        jsr ob_safe
        bcc @rts
        inx
        jsr ob_safe
        bcc @rts
        inx
        jsr ob_safe
        bcc @rts
        lda q_gone
        ora q_leave
        bne @safe
        lda q_row
        cmp b_row
        beq @q
        lda q_tele
        beq @safe
        lda q_target
        cmp b_row
        bne @safe
@q:     jsr q_dist
        lda t1
        cmp #QQ_HIT + 16
        rts
@safe:  sec
@rts:   rts

; X = obstacle (kept): C=1 if it won't reach you in time and has passed far enough.
ob_safe:
        lda o_used,x
        bne :+
        sec
        rts
:       ldy o_lane,x
        lda ln_dir,y            ; d = how far you are ahead of it, around the loop
        bne @l
        lda pl
        sec
        sbc o_xlo,x
        sta b_d
        lda pl+1
        sbc o_xhi,x
        jmp @m
@l:     lda o_xlo,x
        sec
        sbc pl
        sta b_d
        lda o_xhi,x
        sbc pl+1
@m:     bpl :+
        sta b_d+1
        lda b_d
        clc
        adc #<LOOP
        sta b_d
        lda b_d+1
        adc #>LOOP
:       sta b_d+1
        lda ln_spdh,y           ; reach = speed × 16 (or 32) frames (16 bit / 16)
        sta b_r
        lda ln_spd,y
        lsr b_r
        ror
        lsr b_r
        ror
        lsr b_r
        ror
        lsr b_r
        ror
        sta b_r
        lda ln_kind,y           ; a dog may trot 1.55 × as fast: × 1.625
        cmp #K_DOG
        bne :+
        lda b_r
        lsr
        sta b_t
        lsr
        lsr
        adc b_t
        adc b_r
        sta b_r
:
        lda b_long
        beq :+
        asl b_r
:       lda ln_kind,y
        tay
        lda kind_hit,y
        clc
        adc #B_MARGIN
        sta b_t
        adc b_r
        sta b_r
        lda b_d+1               ; coming: d < reach
        bne :+
        lda b_d
        cmp b_r
        bcc @no
:       lda #<LOOP              ; just passed: LOOP - d < margin
        sec
        sbc b_d
        sta b_d
        lda #>LOOP
        sbc b_d+1
        bne @safe
        lda b_d
        cmp b_t
        bcc @no
@safe:  sec
        rts
@no:    clc
        rts
.endif

; score = sum of the cups' % × 255 / (100 × required) = sum × 51 / (20 × required)
finish:
        lda #0
        sta $d015
        sta $d01b
        sta $d020
        sta t2                  ; sum, 16 bit
        sta t3
        ldx required
:       lda cups-1,x
        clc
        adc t2
        sta t2
        bcc :+
        inc t3
:       dex
        bne :--
        lda t2                  ; × 51: lo × 51 + hi × 51 × 256
        ldx #51
        jsr mul8
        lda t3
        beq :+
        lda prod+1
        clc
        adc #51
        sta prod+1
:       ldx required            ; ÷ (20 × required)
        lda div_tab-2,x
        sta t1
        ldx #0
@d:     lda prod
        sec
        sbc t1
        tay
        lda prod+1
        sbc #0
        bcc @q
        sta prod+1
        sty prod
        inx
        bne @d
        dex                     ; (255 at most)
@q:     stx MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:     .byte "Coffee Crossing", 0
s_help:     .byte "Carry your coffee to your desk. Dodge traffic!", 0
s_keys:     .byte "Joystick hops (hold = keep going)", 0
s_cupsof:   .byte "Cups", 0
s_mydesk:   .byte "MY DESK", 0
s_coffee:   .byte "COFFEE", 0
s_cup:      .byte "Cup", 0
s_cups:     .byte "CUPS", 0
s_pct:      .byte "%", 0
s_now:      .byte "now", 0
s_later:    .byte "...", 0
s_deliv:    .byte "% delivered! ", 0
s_refill:   .byte "Refill! Next cup.", 0
s_empty:    .byte "Cup empty! Back to the kitchen.", 0
s_yap1:     .byte "Yap!", 0
s_yap2:     .byte "Woof!", 0
s_yap3:     .byte "Yip!", 0
yap_lo:     .byte <s_yap1, <s_yap2, <s_yap3
yap_hi:     .byte >s_yap1, >s_yap2, >s_yap3
half_tab:   .byte 3, 4          ; lanes per side: d < 0.5, d >= 0.5
req_tab:    .byte 2, 3          ; cups
fy_tab:     .byte 3, 2          ; the field's first screen row
msg_tab:    .byte MSG_Y, 24
stat_tab:   .byte STAT_Y, 0
div_tab:    .byte 40, 60        ; 20 × cups
w12_tab:    .byte 3 * 12 + 3, 4 * 12 + 3, 5 * 12 + 3        ; desk widths × 12 + 3
kind_pool:  .byte K_MANAGER, K_CHAIR, K_CART, K_ROOMBA, K_BOXES, K_DOG, K_MANAGER
kind_spd:   .byte 186, 141, 77, 70, 102, 205    ; speed factor × 128: manager, chair, cart, Roomba, boxes, dog
kind_dens:  .byte 128, 128, 90, 141, 128, 102   ; density × 128
kind_hit:   .byte 6, 7, 14, 7, 8, 7             ; collision: half width + 4 JS px, × 3/4
spacing_lo: .byte <LOOP, <(LOOP / 2), <(LOOP / 3)     ; by traffic count 1-3
spacing_hi: .byte >LOOP, >(LOOP / 2), >(LOOP / 3)
jitter_w:   .byte LOOP * 12 / 100, LOOP * 6 / 100, LOOP * 4 / 100  ; ±12% of the spacing
off_hi_tab: .byte 0, 162
lane3:      .repeat MAXL, i     ; first entry of each lane
            .byte PER * i
            .endrep
hw_first:   .byte 2, 5          ; first hardware sprite of the even / odd lanes' set
msb_keep:   .byte %11100011, %00011111
bit_tab:    .byte 1, 2, 4, 8, 16, 32, 64, 128
dir_dx:     .byte 0, 0, $ff, 1
dir_dy:     .byte $ff, 1, 0, 0
dir_bit:    .byte J_UP, J_DOWN, J_LEFT, J_RIGHT
face_ptr:   .byte PTR_DOWN + 3, PTR_DOWN, PTR_DOWN + 6, PTR_DOWN + 9
side_ptr:   .byte PTR_DOWN + 9, PTR_DOWN + 6       ; walking right, left
hop_dx:     .byte 0, 2, 5, 7, 10, 12    ; px of the hop still to go, by frames left
hop_dy:     .byte 0, 3, 6, 10, 13, 16
hop_arc:    .byte 0, 2, 3, 3, 2, 0
q_start_lo: .byte <10, <313     ; 10 JS px outside the field: walking right / left
q_start_hi: .byte >10, >313
q_back_lo:  .byte <9, <315      ; 12 JS px outside
q_back_hi:  .byte >9, >315
qq_side:    .byte <-8, <8       ; where the colleague stops: behind you as it walked
qq_side_hi: .byte >-8, >8
decor_pick: .byte 1, 2, 3, 4, 1 ; plant, cabinet, cooler, printer, plant
decor_ch:   .byte MC_C, MC_C, MC_KNOB, MC_KNOB, MC_C, MC_C, MC_CARDS, MC_GRID
decor_col:  .byte 5|8, 2|8, 1|8, 1|8, 3|8, 1|8, 1|8, 1|8
kit_ch:     .byte MC_B, MC_C
kit_col:    .byte 8, 1|8
desk_ch:    .byte MC_C, MC_GRID, MC_C
desk_col:   .byte 2|8, 3|8, 2|8
cup_col:    .byte 31, 36
char_tile:  .repeat 36, i       ; the tile under the middle of each field column
            .byte (8 * i + 4) / 12
            .endrep
mod3:       .repeat 36, i
            .byte i .mod 3
            .endrep
row_lo:     .repeat 25, i
            .byte <(SCREEN + 40 * i)
            .endrep
row_hi:     .repeat 25, i
            .byte >(SCREEN + 40 * i)
            .endrep

.include "gen/mg_frogger_data.s"

.bss
bss_start:
decor:      .res COLS           ; median: 0 free, else 1 plant, 2 cabinet, 3 cooler, 4 printer
ln_kind:    .res MAXL
ln_dir:     .res MAXL           ; 0 right, 1 left
ln_spd:     .res MAXL           ; 1/256 px per frame ...
ln_spdh:    .res MAXL           ; ... + px
ln_n:       .res MAXL           ; traffic on it, 1-3
ln_msb:     .res MAXL           ; its sprites' x MSB bits this frame
o_used:     .res MAXO           ; traffic entries: lane × 3 + k
o_lane:     .res MAXO
o_bit:      .res MAXO           ; its hardware sprite's bit
o_xlo:      .res MAXO           ; 0..LOOP-1 (field px + 18)
o_xhi:      .res MAXO
o_frac:     .res MAXO
o_ph:       .res MAXO           ; Roomba pause cycle, dog stride phase
o_cat:      .res MAXO
o_yap:      .res MAXO           ; frames to the dog's next yap
s_x:        .res MAXO           ; sprite registers for the traffic
s_y:        .res MAXO
s_ptr:      .res MAXO
s_col:      .res MAXO
row_y:      .res MAXR           ; sprite y on each row
row_lane:   .res MAXR           ; lane number of each row, $ff = not a lane
lane_row:   .res MAXL
qspd_lo:    .res 2              ; the colleague's speed: walking, leaving
qspd_hi:    .res 2
msb_pq:     .res 1
msb_now:    .res 1
p_sx:       .res 1
p_sy:       .res 1
p_ptr:      .res 1
p_scol:     .res 1
q_sx:       .res 1
q_sy:       .res 1
q_ptr:      .res 1
cups:       .res 3              ; % delivered
dif:        .res 1              ; difficulty 0-255
big:        .res 1              ; 1: 4 + 4 lanes, 11 rows (d >= 0.5)
rows:       .res 1
median:     .res 1
kitchen:    .res 1
nlanes:     .res 1
fy:         .res 1              ; the field's first screen row
msg_row:    .res 1
stat_row:   .res 1
required:   .res 1              ; cups
slot_w:     .res 1              ; your desk's width
decor_n:    .res 1
spill_amt:  .res 1              ; % per collision
dog_on:     .res 1
base_spd:   .res 1              ; traffic speed before the kind's factor
q_base:     .res 1              ; frames between the colleague's lane hop tries
q_gone_t:   .res 1              ; frames away after a chat
wl_l:       .res 1              ; write_lane / mux_lanes
wl_n:       .res 1
wl_y:       .res 1
wl_i:       .res 1
wl_line:    .res 1
buf:        .res 41
buf_i:      .res 1
bn:         .res 1
bd:         .res 1
dr_row:     .res 1
dr_x:       .res 1
b_row:      .res 1
b_low:      .res 1
b_long:     .res 1
b_d:        .res 2
b_r:        .res 1
b_t:        .res 1
bss_end:
.assert bss_end - bss_start <= 512, error, "BSS too big for the clearing loop"
