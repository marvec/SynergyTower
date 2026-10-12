; ---- career state + economy ---------------------------------------------------------------------------
; The save game is one disk block: the state block (src/state.inc, at $9400, at most 254 bytes), written to the
; "save" file the build reserves (src/drive.s write command). Numbers follow src/core/economy.js and
; src/core/state.js; the per-floor tables come from the same functions (gen/econ.s).
;
; Time: CLOCK counts seconds (24 bit) in the music IRQ, also during loads and mini-games, and is saved with the
; game. Cooldowns and the next cup of coffee are deadlines on that clock (3 bytes each).

PERK_MUG      = 0
PERK_ESPRESSO = 1
PERK_CHAIR    = 2
PERK_MONITOR  = 3
PERK_STAPLER  = 4
PERK_PLANT    = 5

.segment "BSS"
CLOCK:     .res 3               ; seconds, low byte first
TICK50:    .res 1               ; frames of the current second
; results of the economy routines
RSP:       .res 2
RXP:       .res 3
TXP:       .res 3               ; training: XP of the option (menus.s)
LEVELUPS:  .res 1
PROMO:     .res 1               ; promo_status flags
PROMO_STARS = 1
PROMO_LEVEL = 2
PROMO_SP    = 4
PROMO_REVIEW = 8
CKEY:      .res 1               ; cd_lookup
CI:        .res 1
CO:        .res 1
CB:        .res 3
CSAVE:     .res 1
ST_VER     = 3                  ; save format (1: one block, floors 1-2; 2: four floor slots)

.segment "CODE"

; New career: names and looks already in st_corp/st_name/st_color/st_skin/st_hair/st_hstyle.
st_new:
        ldx #ST_END - st_floor  ; everything after the names and looks, and page 2
        lda #0
:       sta st_floor-1,x
        dex
        bne :-
        ldx #.sizeof(ST2)
:       sta ST2_BASE-1,x
        dex
        bne :-
        ldx #254                ; page 3: nothing attempted
        lda #$ff
:       sta ST3_BASE-1,x
        dex
        bne :-
        lda #'S'
        sta st_magic
        lda #'T'
        sta st_magic+1
        jsr rand                ; a new career id
        sta st_career
        jsr rand
        sta st_career+1
        lda #ST_VER
        sta st_ver
        lda #1
        sta st_floor
        sta st_max
        sta st_level
        sta st_music
        sta st_sfx
        lda #<START_SP
        sta st_sp
        lda #>START_SP
        sta st_sp+1
        lda #START_SO           ; no coffee until the lobby check-in (st_coffee = 0, st_lobby = LOBBY_CHECKIN)
        sta st_so
        lda #0
        sta CLOCK
        sta CLOCK+1
        sta CLOCK+2
        rts

; ---- clock ---------------------------------------------------------------------------------------------
; IRQ: one more frame.
clock_tick:
        inc TICK50
        lda TICK50
        cmp #50
        bcc @done
        lda #0
        sta TICK50
        inc CLOCK
        bne @done
        inc CLOCK+1
        bne @done
        inc CLOCK+2
@done:  rts

; PT -> deadline: T0/T1 = seconds left (0 when passed; 65535 at most). Z=1 when passed.
time_left:
        sei
        ldy #0
        lda (PT),y
        sec
        sbc CLOCK
        sta T0
        iny
        lda (PT),y
        sbc CLOCK+1
        sta T1
        iny
        lda (PT),y
        sbc CLOCK+2
        cli
        bcc @zero               ; deadline passed
        beq :+
        lda #$ff                ; more than 65535 s
        sta T0
        sta T1
:       lda T0
        ora T1
        rts
@zero:  lda #0
        sta T0
        sta T1
        rts

; PT -> deadline := CLOCK + T0/T1 seconds.
set_deadline:
        sei
        ldy #0
        lda CLOCK
        clc
        adc T0
        sta (PT),y
        iny
        lda CLOCK+1
        adc T1
        sta (PT),y
        iny
        lda CLOCK+2
        adc #0
        sta (PT),y
        cli
        rts

; ---- economy --------------------------------------------------------------------------------------------
; A = 6 + maxFloor / 5 + 2 × Bigger Mug
coffee_max:
        lda st_max
        ldx #0
:       cmp #5
        bcc :+
        sbc #5
        inx
        bne :-
:       txa
        clc
        adc #6
        adc st_perks + PERK_MUG
        adc st_perks + PERK_MUG
        rts

; T0/T1 = seconds per cup (Espresso Machine level).
regen_secs:
        ldx st_perks + PERK_ESPRESSO
        lda regen_lo,x
        sta T0
        lda regen_hi,x
        sta T1
        rts

; Coffee refills by itself once checked in: a cup every regen_secs while below the max.
coffee_tick:
        lda st_lobby
        beq @restart            ; the check-in hasn't loaded the coffee card yet
        jsr coffee_max
        sta T2
@cup:   lda st_coffee
        cmp T2
        bcs @restart            ; full: the clock starts again when a cup is taken
        lda #<st_cupdl
        sta PT
        lda #>st_cupdl
        sta PT+1
        jsr time_left
        bne @done
        inc st_coffee           ; a cup is due: and the next one counts from its deadline
        jsr regen_secs
        ldy #0
        clc
        lda st_cupdl
        adc T0
        sta st_cupdl
        lda st_cupdl+1
        adc T1
        sta st_cupdl+1
        bcc @cup
        inc st_cupdl+2
        bne @cup
@restart:
        lda #<st_cupdl
        sta PT
        lda #>st_cupdl
        sta PT+1
        jsr regen_secs
        jmp set_deadline
@done:  rts

; A = cups: take them. (A full pot's refill clock starts now: coffee_tick keeps it restarting while full.)
spend_coffee:
        sta T3
        lda st_coffee
        sec
        sbc T3
        bcs :+
        lda #0
:       sta st_coffee
        rts

; A = stars: RSP / RXP = economy.taskReward(this floor, stars, perks), from the floor header (HDR_SP / HDR_XP).
reward_calc:
        sta T3
        lda st_perks + PERK_MONITOR ; sp word: (monitor × 2 + stapler) × 4 + stars
        asl
        adc st_perks + PERK_STAPLER
        asl
        asl
        adc T3
        asl
        tax
        lda FL_HDR + HDR_SP,x
        sta RSP
        lda FL_HDR + HDR_SP + 1,x
        sta RSP+1
        lda st_perks + PERK_CHAIR   ; xp word: chair × 4 + stars
        asl
        asl
        adc T3
        asl
        tax
        lda FL_HDR + HDR_XP,x
        sta RXP
        lda FL_HDR + HDR_XP + 1,x
        sta RXP+1
        lda #0
        sta RXP+2
        rts

; st_sp += RSP (saturating at 2^24 - 1).
add_sp:
        lda st_sp
        clc
        adc RSP
        sta st_sp
        lda st_sp+1
        adc RSP+1
        sta st_sp+1
        bcc :+
        inc st_sp+2
        bne :+
        lda #$ff
        sta st_sp
        sta st_sp+1
        sta st_sp+2
:       rts

; A = Stock Options to add.
add_so:
        clc
        adc st_so
        sta st_so
        bcc :+
        inc st_so+1
:       rts

; st_xp += RXP (24 bit) with level-ups (+1 Stock Option each). LEVELUPS = levels gained.
add_xp:
        lda #0
        sta LEVELUPS
        lda st_xp
        clc
        adc RXP
        sta st_xp
        lda st_xp+1
        adc RXP+1
        sta st_xp+1
        lda st_xp+2
        adc RXP+2
        sta st_xp+2
@lv:    ldx st_level
        cpx #99
        bcs @done
        lda st_xp               ; xp >= xpToNext(level)?
        sec
        sbc xpn_lo,x
        sta T0
        lda st_xp+1
        sbc xpn_md,x
        sta T1
        lda st_xp+2
        sbc xpn_hi,x
        bcc @done
        sta st_xp+2
        lda T1
        sta st_xp+1
        lda T0
        sta st_xp
        inc st_level
        inc LEVELUPS
        lda #1
        jsr add_so
        jmp @lv
@done:  rts

; NUM = XP still needed for the next level (24 bit).
xp_needed:
        ldx st_level
        lda xpn_lo,x
        sec
        sbc st_xp
        sta NUM
        lda xpn_md,x
        sbc st_xp+1
        sta NUM+1
        lda xpn_hi,x
        sbc st_xp+2
        sta NUM+2
        rts

; ---- 24-bit paperclips: NUM is the operand ------------------------------------------------------------------
; C=1 if st_sp >= NUM.
sp_ge:
        lda st_sp
        cmp NUM
        lda st_sp+1
        sbc NUM+1
        lda st_sp+2
        sbc NUM+2
        rts

; st_sp -= NUM.
sp_sub:
        lda st_sp
        sec
        sbc NUM
        sta st_sp
        lda st_sp+1
        sbc NUM+1
        sta st_sp+1
        lda st_sp+2
        sbc NUM+2
        sta st_sp+2
        rts

; NUM = st_xp.
xp_num:
        lda st_xp
        sta NUM
        lda st_xp+1
        sta NUM+1
        lda st_xp+2
        sta NUM+2
        rts

; NUM = xpToNext(st_level).
xpn_num:
        ldx st_level
        lda xpn_lo,x
        sta NUM
        lda xpn_md,x
        sta NUM+1
        lda xpn_hi,x
        sta NUM+2
        rts

; NUM = st_sp.
sp_num:
        lda st_sp
        sta NUM
        lda st_sp+1
        sta NUM+1
        lda st_sp+2
        sta NUM+2
        rts

; X = floor: NUM = the keycard fee for promotion from it.
fee_num:
        lda fee_lo,x
        sta NUM
        lda fee_md,x
        sta NUM+1
        lda fee_hi,x
        sta NUM+2
        rts

; A = game tier (1-3, 0 = HR review): T0/T1 = this floor's cooldown in seconds (floor header HDR_CD).
cooldown_secs:
        sta T2
        lda st_perks + PERK_PLANT
        asl
        asl
        adc T2
        asl
        tax
        lda FL_HDR + HDR_CD,x
        sta T0
        lda FL_HDR + HDR_CD + 1,x
        sta T1
        rts

; A = floor -> A = KPI star quota (8 + 2 × (floor - 1)).
quota:
        asl
        clc
        adc #6
        rts

; X = floor (1-2) -> A = stars earned there.
stars_on:
        lda st_stars-1,x
        rts

; PROMO = what promotion from st_max still needs (economy.promotionStatus): stars, level, keycard fee, review.
promo_status:
        lda #0
        sta PROMO
        ldx st_max
        lda st_max
        jsr quota
        sta T2
        lda st_stars-1,x
        cmp T2
        bcc :+
        lda #PROMO_STARS
        ora PROMO
        sta PROMO
:       ldx st_max
        inx
        cpx st_level
        beq :+
        bcs :++
:       lda #PROMO_LEVEL
        ora PROMO
        sta PROMO
:       ldx st_max
        jsr fee_num
        jsr sp_ge
        bcc :+
        lda #PROMO_SP
        ora PROMO
        sta PROMO
:       ldx st_max
        jsr review_passed
        beq :+
        lda #PROMO_REVIEW
        ora PROMO
        sta PROMO
:       rts

; C=1 when promotion-ready (everything but the review): HR will see you.
promo_ready:
        jsr promo_status
        lda PROMO
        and #PROMO_STARS | PROMO_LEVEL | PROMO_SP
        cmp #PROMO_STARS | PROMO_LEVEL | PROMO_SP
        rts

; ---- cooldowns (page 2) and best stars (page 3) ----------------------------------------------------------------
; A = key (station 0-13, CD_MACHINE, CD_REVIEW) -> PT = st_floor's deadline for it (X kept). Without an entry the
; one that ends first is taken (a free or expired one, unless all CD_N are running), with the deadline "passed".
floor_dl_ptr:
cd_lookup:
        sta CKEY
        stx CSAVE
        ldx #CD_N - 1
@find:  lda st_cfloor,x
        cmp st_floor
        bne :+
        lda st_ckey,x
        cmp CKEY
        beq @ptr
:       dex
        bpl @find
        ldx #CD_N - 1           ; the entry that ends first
        ldy #(CD_N - 1) * 3
@best:  stx CI
        sty CO
        lda st_cdl,y
        sta CB
        lda st_cdl+1,y
        sta CB+1
        lda st_cdl+2,y
        sta CB+2
@min:   dex
        bmi @take
        dey
        dey
        dey
        lda st_cdl,y
        cmp CB
        lda st_cdl+1,y
        sbc CB+1
        lda st_cdl+2,y
        sbc CB+2
        bcc @best
        bcs @min
@take:  ldx CI
        lda st_floor
        sta st_cfloor,x
        lda CKEY
        sta st_ckey,x
        ldy CO
        lda #0
        sta st_cdl,y
        sta st_cdl+1,y
        sta st_cdl+2,y
@ptr:   stx CI                  ; PT = st_cdl + 3 × X
        txa
        asl
        adc CI
        adc #<st_cdl
        sta PT
        lda #>st_cdl
        adc #0
        sta PT+1
        ldx CSAVE
        rts

; PT = this floor's station X cooldown deadline (X kept).
station_cd_ptr:
        txa
        jmp cd_lookup

; X = station on this floor -> Y = its byte in st_bestn, C=1: the high nibble (X kept).
best_addr:
        stx T3
        ldy st_floor
        txa
        lsr
        clc
        adc best_base-1,y
        tay
        lda T3
        lsr
        rts

; X = station on this floor -> A = its best stars, $ff (N=1) when not attempted (X kept).
best_get:
        jsr best_addr
        lda st_bestn,y
        bcc :+
        lsr
        lsr
        lsr
        lsr
:       and #$0f
        cmp #$0f
        bne :+
        lda #$ff
:       ora #0
        rts

; X = station on this floor, A = its new best stars.
best_set:
        sta T2
        jsr best_addr
        bcs :+
        lda st_bestn,y
        and #$f0
        ora T2
        sta st_bestn,y
        rts
:       lda T2
        asl
        asl
        asl
        asl
        sta T2
        lda st_bestn,y
        and #$0f
        ora T2
        sta st_bestn,y
        rts

; ---- reviews: one bit per floor -----------------------------------------------------------------------------
; X = floor -> Y = byte in st_reviews, A = its bit.
review_bit:
        dex
        txa
        lsr
        lsr
        lsr
        tay
        txa
        and #7
        tax
        lda bit_tab,x
        rts

; X = floor: Z=0 if its HR review is passed.
review_passed:
        jsr review_bit
        and st_reviews,y
        rts

; X = floor: its HR review passed.
review_pass:
        jsr review_bit
        ora st_reviews,y
        sta st_reviews,y
        rts
