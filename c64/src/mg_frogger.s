; Coffee Crossing (src/minigames/frogger.js) as a disk-loaded overlay at $4000.
; Carry a full cup from the kitchen to your desk across office lanes of speed-walking managers, rolling
; chairs, mail carts, Roombas and people carrying boxes. A collision spills 22% of the cup (stunned 0.6 s,
; then back to the last safe row; an empty cup sends you back to the kitchen). The "Quick question?"
; colleague homes in on your lane and freezes you for 1.5 s. Difficulty 0 (floor 1): 3 lanes, a median,
; 3 lanes; 2 cups in 50 s; your desk is 5 tiles wide; traffic 8% faster after each cup.
; Score = coffee delivered / 2 cups. Content: gen/mg_frogger_data.s (tools/mg/frogger.js).
;
; The field is the browser's 24 × 9 tiles at 3/4 scale: 12 × 16 px tiles on chars 2-37, rows 3-20.
; Traffic is sprites 2-7, two per lane: lanes 1-3 use them first, then a raster poll between the halves
; (line 137) moves them to lanes 5-7. The side walls are black hires blocks in front of the traffic
; (sprite priority), so people walk in and out of the field as in the browser.

.include "api.inc"
.include "gen/chars.inc"

COLS      = 24                  ; tiles across
ROWS      = 9                   ; your desk, 3 lanes, median, 3 lanes, kitchen
MEDIAN    = 4
KITCHEN   = 8
LANES     = 6
REQUIRED  = 2                   ; cups
TOTAL_T   = 50 * 50
SPILL_AMT = 22                  ; % of a cup per collision
SLOT_W    = 5                   ; your desk, in tiles
DECOR_N   = 4                   ; blocked tiles on the median
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
STAT_Y    = 21                  ; status row: coffee, cups
MSG_Y     = 22                  ; floating messages
NOTE_T    = 150                 ; the department note, 3 s
LOOP      = 324                 ; traffic wraps over the field + 18 px on each side (x 0-323)
BASE_SPD  = 100                 ; 26 JS px/s, in 1/256 px per frame at 3/4 scale
ROOMBA_CYC = 242                ; a Roomba crawls at 1/5 speed for 43 of every 242 frames
ROOMBA_SLOW = 43
QQ_SPD    = 77                  ; 20 JS px/s
QQ_LEAVE  = 269                 ; 70 JS px/s
QQ_HOME   = 105                 ; turns towards you within this distance on your lane
QQ_HIT    = 6
QQ_TELE   = 28                  ; the '!' before a lane hop, 0.55 s
QQ_GONE   = 150                 ; 3 s away after a chat
FX        = 2                   ; field: chars 2-37 ...
FY        = 3                   ; ... rows 3-20, two per tile
SPR_X     = 10                  ; sprite x = traffic x + SPR_X (field px + 28)
SPR_Y     = 67                  ; sprite y on tile row 0 (feet 3 px above the row's bottom)
MUX_LINE  = 137                 ; lanes 1-3 sprites end by here, lanes 5-7 start at 147
P_SHIRT   = 14
Q_SHIRT   = 5
PTR_DOWN  = ($e000 - $c000) / 64        ; person frames: down, up, left, right × 3
PTR_BOXES = ($e300 - $c000) / 64        ; ours: boxes, chair, cart right, cart left, Roomba, Roomba + cat
K_MANAGER = 0
K_CHAIR   = 1
K_CART    = 2
K_ROOMBA  = 3
K_BOXES   = 4
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
init:
        ldx #zp_last - zp_first - 1
        lda #0
:       sta zp_first,x
        dex
        bpl :-
        ldx #bss_end - bss_start
:       sta bss_start-1,x
        dex
        bne :-
        lda #$ff
        sta bub_row
        sta mk_col
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
        lda #$ff
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
        ; median decor: DECOR_N distinct tiles
        lda #DECOR_N
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
        lda #LANES
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
        lda #175                ; 3.5 s to the first lane hop
        sta q_shift
        ; you, in the kitchen
        lda #COLS/2
        sta p_col
        lda #KITCHEN
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
        lda #FY
        sta t4
:       ldy t4
        jsr draw_char_row
        inc t4
        lda t4
        cmp #FY + 2 * ROWS
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
        lda #<TOTAL_T
        ldx #>TOTAL_T
        jmp timer_start

; Lane kinds (never twice in a row), alternating directions, speeds and the traffic on them.
make_lanes:
        jsr API_RAND
        and #1
        sta t3                  ; direction of the first lane
        lda #$ff
        sta t2                  ; previous kind
        ldx #0
@ln:    stx t1
        lda #5
        jsr API_RMOD
        cmp t2
        bne :+
        lda #4                  ; one of the other four
        jsr API_RMOD
        cmp t2
        bcc :+
        adc #0                  ; (C = 1: +1)
:       ldx t1
        sta ln_kind,x
        sta t2
        lda t3
        sta ln_dir,x
        eor #1
        sta t3
        ; speed = BASE_SPD × 0.88-1.12 × the kind's factor (both / 128)
        lda #31                 ; × (113..143) / 128
        jsr API_RMOD
        clc
        adc #113
        ldx #BASE_SPD
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
        jsr place_lane
        ldx t1
        inx
        cpx #LANES
        bne @ln
        rts

; Traffic of lane t1: two, evenly spaced with ±12% jitter (a cart lane has one 74% of the time).
place_lane:
        lda t1
        asl
        sta t0                  ; its first obstacle
        tax
        lda #1
        sta o_used,x
        sta o_used+1,x
        ldy t1
        lda ln_kind,y
        cmp #K_CART
        bne @two
        jsr API_RAND
        cmp #67
        bcc @two
        ldx t0
        lda #0
        sta o_used+1,x
        lda #162                ; anywhere on the loop
        jsr API_RMOD
        sta t4
        jsr API_RAND
        and #1
        beq :+
        lda t4
        clc
        adc #162
        sta t4
        lda #0
        rol
:       ldx t0
        sta o_xhi,x
        lda t4
        sta o_xlo,x
        jmp @extra
@two:   lda #162
        jsr API_RMOD
        sta t4                  ; offset
        ldx t0
        jsr @jitter
        lda t4
        clc
        adc #162
        sta t4
        ldx t0
        inx
        lda #0
        rol
        jsr @jitter_hi
@extra: lda t1
        asl
        tax
        jsr @one
        inx
@one:   stx t0
        lda #ROOMBA_CYC
        jsr API_RMOD
        ldx t0
        sta o_ph,x
        jsr API_RAND
        ldx t0
        cmp #77                 ; 30%: the office cat rides along
        lda #0
        rol
        eor #1
        sta o_cat,x
        rts
; x of obstacle X = t4 (+ 256 × A) + jitter -19..19, wrapped into 0..LOOP-1
@jitter:
        lda #0
@jitter_hi:
        stx t0
        sta t5
        lda #39
        jsr API_RMOD
        sec
        sbc #19
        ldx #0
        bcs :+
        dex                     ; negative
:       clc
        adc t4
        tay
        txa
        adc t5
        bpl :+
        tax                     ; below 0: + LOOP
        tya
        clc
        adc #<LOOP
        tay
        txa
        adc #>LOOP
        bne @set
:       cmp #>LOOP              ; LOOP or more: - LOOP
        bcc @set
        cpy #<LOOP
        bcc @set
        tax
        tya
        sbc #<LOOP
        tay
        txa
        sbc #>LOOP
@set:   ldx t0
        sta o_xhi,x
        tya
        sta o_xlo,x
        rts

; New desk position: slot 1-18, and the screen columns whose middle lies in it.
new_slot:
        lda #COLS - SLOT_W - 1
        jsr API_RMOD
        clc
        adc #1
        sta slot
        asl
        asl
        sta t0
        asl
        adc t0                  ; × 12 (at most 216)
        sta t0
        clc
        adc #3
        lsr
        lsr
        lsr
        clc
        adc #FX
        sta sl_c0
        lda t0
        clc
        adc #63
        ror                     ; 9 bits
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
:       jsr show_front          ; you, the colleague, lanes 1-3 (built last frame)
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
        jsr mux_wait
        ldx #6                  ; lanes 5-7
        jsr write_wave
        clc
        rts

; ---- traffic -----------------------------------------------------------------------------------------
traffic:
        ldx #2 * LANES - 1
@o:     lda o_used,x
        bne :+
        jmp @next
:       txa
        lsr
        tay
        lda ln_spd,y
        sta t1
        lda ln_kind,y
        cmp #K_ROOMBA
        bne @move
        inc o_ph,x
        lda o_ph,x
        cmp #ROOMBA_CYC
        bcc :+
        lda #0
        sta o_ph,x
:       cmp #ROOMBA_SLOW
        bcs @move
        lda t1                  ; × 3/16
        lsr
        lsr
        lsr
        sta t2
        lsr
        adc t2
        sta t1
@move:  lda ln_dir,y
        bne @left
        lda o_frac,x
        clc
        adc t1
        sta o_frac,x
        bcc @next
        inc o_xlo,x
        bne :+
        inc o_xhi,x
:       lda o_xhi,x             ; reached LOOP (one px per frame at most): back to 0
        beq @next
        lda o_xlo,x
        cmp #<LOOP
        bcc @next
        lda #0
        sta o_xlo,x
        sta o_xhi,x
        beq @next
@left:  lda o_frac,x
        sec
        sbc t1
        sta o_frac,x
        bcs @next
        lda o_xlo,x
        bne :+
        dec o_xhi,x
:       dec o_xlo,x
        lda o_xhi,x
        bpl @next
        lda o_xlo,x             ; -1: LOOP - 1
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

; ---- the quick-question colleague --------------------------------------------------------------------
update_qq:
        lda q_gone
        beq @here
        dec q_gone
        bne @rts
        lda #LANES              ; back on a random lane, from a random side
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
        lda #71                 ; next try in 2.8-4.2 s
        jsr API_RMOD
        clc
        adc #140
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
        lda #QQ_GONE
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
        adc #FY - 1
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
        cmp #MEDIAN
        beq :+
        cmp #KITCHEN
        bne @rts
:       sta p_last
        rts

; X = column, Y = row (both kept): C=1 if you may stand there.
is_free:
        cpx #COLS
        bcs @no
        cpy #ROWS
        bcs @no
        cpy #0
        bne @med
        cpx slot
        bcc @no
        txa
        sec
        sbc slot
        cmp #SLOT_W
        bcs @no
        bcc @yes
@med:   cpy #MEDIAN
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
        cmp #REQUIRED
        bcc :+
        jmp finish
:       lda #CELEB_T
        sta celeb
        rts

; Refill: traffic 8% faster, a new desk.
next_round:
        ldx #LANES - 1
:       lda ln_spd,x            ; × (1 + 1/16 + 1/64)
        lsr
        lsr
        lsr
        lsr
        sta t1
        lsr
        lsr
        clc
        adc t1
        adc ln_spd,x
        sta ln_spd,x
        dex
        bpl :-
        lda #COLS/2
        sta p_col
        lda #KITCHEN
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
        ldy #FY
        jsr draw_char_row
        ldy #FY + 1
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
        asl
        tax
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
        txa
        lsr
        tay
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
        sbc #SPILL_AMT
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
        lda #KITCHEN            ; empty cup: back to the kitchen for a refill
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
; Registers for you (0), the colleague (1) and traffic entries 0-11 (lanes 1-3: 0-5, lanes 5-7: 6-11; entry
; k is hardware sprite 2 + k mod 6).
build_sprites:
        jsr calc_pl
        lda #0
        sta msb_pq
        sta msb_w
        sta msb_w+1
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
        ldx #2 * LANES - 1
@o:     lda o_used,x
        bne @on
        sta s_x,x               ; parked in the border
        jmp @next
@on:    lda o_xlo,x
        clc
        adc #SPR_X
        sta s_x,x
        lda o_xhi,x
        adc #0
        beq :+
        ldy #0
        cpx #6
        bcc @w1
        iny
@w1:    lda msb_w,y
        ora bit_of,x
        sta msb_w,y
:       txa
        lsr
        tay                     ; lane
        lda lane_row,y
        sty t2
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

kind_jmp: .word k_manager-1, k_chair-1, k_cart-1, k_roomba-1, k_boxes-1

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

; Sprites 0, 1 and traffic entries 0-5, at the start of the frame (above the field).
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
        lda msb_pq              ; (wave 2 keeps these, not the next frame's)
        sta msb_now
        ldx #0
        ; fall through

; X = 0 (entries 0-5) or 6 (entries 6-11) into hardware sprites 2-7.
write_wave:
        stx t0
        ldy #2
:       lda s_ptr,x
        sta SCREEN + $3f8,y
        lda s_col,x
        sta $d027,y
        inx
        iny
        cpy #8
        bne :-
        ldx t0
        ldy #4
:       lda s_x,x
        sta $d000,y
        lda s_y,x
        sta $d001,y
        inx
        iny
        iny
        cpy #16
        bne :-
        ldx #0
        lda t0
        beq :+
        inx
:       lda msb_w,x
        ora msb_now
        sta $d010
        rts

; Wait until the beam is between the halves (lines MUX_LINE-249 of this frame).
mux_wait:
:       lda $d011
        bmi :-
        lda $d012
        cmp #MUX_LINE
        bcc :-
        cmp #250
        bcs :-
        rts

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
        adc #FY - 1
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
        cmp #FY
        bne @rts
        lda sl_c1               ; MY DESK, centred on the desk
        sec
        sbc sl_c0
        sec
        sbc #7
        lsr
        clc
        adc sl_c0
        tax
        lda #<s_mydesk
        sta PTR
        lda #>s_mydesk
        sta PTR+1
        lda #7
        sta COLOR
        ldy #FY
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
        sbc #FY
        lsr
        sta b_row
        lda #0
        rol
        sta b_low               ; 1 = the tile's lower char row
        ldy b_row
        beq @goal
        cpy #KITCHEN
        beq @kitchen
        cpy #MEDIAN
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

; Status row: the coffee in your cup and the cups so far.
draw_status:
        text 1, STAT_Y, s_coffee, 7
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
        lda #0
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
        jsr print_buf
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
        cpx #REQUIRED
        bne @cup
        rts

; buf at column X of row STAT_Y, padded to 4 chars.
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
        ldy #STAT_Y
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
        lda #REQUIRED
        jmp API_NUM

; A/X = message, Y = colour: centred on row MSG_Y for MSG_T frames.
message_ptr:
        lda PTR
        ldx PTR+1
message:
        sty t0
        pha
        txa
        pha
        lda #MSG_Y
        ldx #1
        jsr clear_rows
        lda t0
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
        lda #MSG_Y
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
        ldy #4                  ; target: a desk tile that is free on the median, middle first
:       lda slot
        clc
        adc tgt_off,y
        tax
        lda decor,x
        beq :+
        dey
        bpl :-
:       lda p_row
        cmp #KITCHEN
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
        asl
        tax
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
:
        txa
        lsr
        tay
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
        lda ln_spd,y            ; reach = speed × 16 (or 32) frames
        lsr
        lsr
        lsr
        lsr
        sta b_r
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

; score = (cup 1 + cup 2) × 255 / 200 = sum × 51 / 40
finish:
        lda #0
        sta $d015
        sta $d01b
        sta $d020
        lda cups
        clc
        adc cups+1
        ldx #51
        jsr mul8
        ldx #0
@d:     lda prod
        sec
        sbc #40
        tay
        lda prod+1
        sbc #0
        bcc @q
        sta prod+1
        sty prod
        inx
        bne @d
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
s_cups:     .byte "CUPS", 0
s_pct:      .byte "%", 0
s_now:      .byte "now", 0
s_later:    .byte "...", 0
s_deliv:    .byte "% delivered! ", 0
s_refill:   .byte "Refill! Next cup.", 0
s_empty:    .byte "Cup empty! Back to the kitchen.", 0
lane_row:   .byte 1, 2, 3, 5, 6, 7
row_lane:   .byte $ff, 0, 1, 2, $ff, 3, 4, 5, $ff
row_y:      .repeat ROWS, i
            .byte SPR_Y + 16 * i
            .endrep
kind_spd:   .byte 186, 141, 77, 70, 102 ; speed factor × 128: manager, chair, cart, Roomba, boxes
kind_hit:   .byte 6, 7, 14, 7, 8        ; collision: half width + 4 JS px, × 3/4
dir_dx:     .byte 0, 0, $ff, 1
dir_dy:     .byte $ff, 1, 0, 0
dir_bit:    .byte J_UP, J_DOWN, J_LEFT, J_RIGHT
face_ptr:   .byte PTR_DOWN + 3, PTR_DOWN, PTR_DOWN + 6, PTR_DOWN + 9
side_ptr:   .byte PTR_DOWN + 9, PTR_DOWN + 6       ; walking right, left
hop_dx:     .byte 0, 2, 5, 7, 10, 12    ; px of the hop still to go, by frames left
hop_dy:     .byte 0, 3, 6, 10, 13, 16
hop_arc:    .byte 0, 2, 3, 3, 2, 0
bit_of:     .byte 4, 8, 16, 32, 64, 128, 4, 8, 16, 32, 64, 128
qspd_lo:    .byte QQ_SPD, <QQ_LEAVE
qspd_hi:    .byte 0, >QQ_LEAVE
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
tgt_off:    .byte 4, 0, 3, 1, 2 ; tried from the end: middle, left, right, edges
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
ln_kind:    .res LANES
ln_dir:     .res LANES          ; 0 right, 1 left
ln_spd:     .res LANES          ; 1/256 px per frame
o_used:     .res 2 * LANES
o_xlo:      .res 2 * LANES      ; 0..LOOP-1 (field px + 18)
o_xhi:      .res 2 * LANES
o_frac:     .res 2 * LANES
o_ph:       .res 2 * LANES      ; Roomba pause cycle
o_cat:      .res 2 * LANES
s_x:        .res 2 * LANES      ; sprite registers for the traffic
s_y:        .res 2 * LANES
s_ptr:      .res 2 * LANES
s_col:      .res 2 * LANES
msb_w:      .res 2
msb_pq:     .res 1
msb_now:    .res 1
p_sx:       .res 1
p_sy:       .res 1
p_ptr:      .res 1
p_scol:     .res 1
q_sx:       .res 1
q_sy:       .res 1
q_ptr:      .res 1
cups:       .res REQUIRED       ; % delivered
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
.assert bss_end - bss_start < 256, error, "BSS too big for the clearing loop"
