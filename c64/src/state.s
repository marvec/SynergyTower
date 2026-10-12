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
RXP:       .res 2
LEVELUPS:  .res 1
PROMO:     .res 1               ; promo_status flags
PROMO_STARS = 1
PROMO_LEVEL = 2
PROMO_SP    = 4
PROMO_REVIEW = 8

.segment "CODE"

; New career: names and looks already in st_corp/st_name/st_color/st_skin/st_hair/st_hstyle.
st_new:
        ldx #ST_END - st_floor  ; everything after the names and looks
        lda #0
:       sta st_floor-1,x
        dex
        bne :-
        ldx #2 * STATIONS_MAX
        lda #$ff
:       sta st_best-1,x
        dex
        bne :-
        lda #'S'
        sta st_magic
        lda #'T'
        sta st_magic+1
        lda #1
        sta st_ver
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

; A = stars, st_floor: RSP / RXP = economy.taskReward(floor, stars, perks).
reward_calc:
        sta T3
        ; sp: ((floor - 1) * 12 + monitor * 2 + stapler) * 4 + stars
        ldx st_floor
        dex
        txa
        asl
        asl
        sta T2                  ; (floor-1) * 4
        asl
        adc T2                  ; * 12
        sta T2
        lda st_perks + PERK_MONITOR
        asl
        adc st_perks + PERK_STAPLER
        adc T2
        asl
        asl
        adc T3
        tax
        lda sp_lo,x
        sta RSP
        lda sp_hi,x
        sta RSP+1
        ; xp: ((floor - 1) * 6 + chair) * 4 + stars
        ldx st_floor
        dex
        txa
        asl
        sta T2
        asl
        adc T2                  ; * 6
        adc st_perks + PERK_CHAIR
        asl
        asl
        adc T3
        tax
        lda xp_lo,x
        sta RXP
        lda xp_hi,x
        sta RXP+1
        rts

; st_sp += RSP (saturating at 65535).
add_sp:
        lda st_sp
        clc
        adc RSP
        sta st_sp
        lda st_sp+1
        adc RSP+1
        sta st_sp+1
        bcc :+
        lda #$ff
        sta st_sp
        sta st_sp+1
:       rts

; A = Stock Options to add.
add_so:
        clc
        adc st_so
        sta st_so
        bcc :+
        inc st_so+1
:       rts

; st_xp += RXP with level-ups (+1 Stock Option each). LEVELUPS = levels gained.
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
@lv:    ldx st_level
        cpx #99
        bcs @done
        lda st_xp               ; xp >= xpToNext(level)?
        sec
        sbc xpn_lo,x
        tay
        lda st_xp+1
        sbc xpn_hi,x
        bcc @done
        sta st_xp+1
        sty st_xp
        inc st_level
        inc LEVELUPS
        lda #1
        jsr add_so
        jmp @lv
@done:  rts

; T0/T1 = XP still needed for the next level.
xp_needed:
        ldx st_level
        lda xpn_lo,x
        sec
        sbc st_xp
        sta T0
        lda xpn_hi,x
        sbc st_xp+1
        sta T1
        rts

; A = game tier (1-3, 0 = HR review), st_floor: T0/T1 = cooldown in seconds.
cooldown_secs:
        sta T2
        lda st_perks + PERK_PLANT
        asl
        clc
        adc st_floor
        sec
        sbc #1
        asl
        asl
        adc T2
        tax
        lda cd_lo,x
        sta T0
        lda cd_hi,x
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
        lda st_sp
        cmp fee_lo,x
        lda st_sp+1
        sbc fee_hi,x
        bcc :+
        lda #PROMO_SP
        ora PROMO
        sta PROMO
:       ldx st_max
        lda st_reviews
        and bit_tab-1,x
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

; PT = this floor's station X cooldown deadline (st_floor).
station_cd_ptr:
        txa
        ldy st_floor
        cpy #2
        bne :+
        clc
        adc #STATIONS_MAX
:       sta T2
        asl
        adc T2                  ; × 3
        clc
        adc #<st_cd
        sta PT
        lda #>st_cd
        adc #0
        sta PT+1
        rts

; X = station on this floor -> Y = index into st_best.
station_best_index:
        txa
        ldy st_floor
        cpy #2
        bne :+
        clc
        adc #STATIONS_MAX
:       tay
        rts

; PT = deadline at st_revcd / st_machcd + (floor - 1) × 3. A = <table, X = >table.
floor_dl_ptr:
        sta PT
        stx PT+1
        ldx st_floor
        dex
        txa
        sta T2
        asl
        adc T2
        clc
        adc PT
        sta PT
        bcc :+
        inc PT+1
:       rts
