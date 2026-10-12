; Reply-All Apocalypse (src/minigames/replyall.js) as a disk-loaded overlay at $4000.
; Someone mailed ALL STAFF. Delete the reply-alls (RE:) before they multiply and the inbox overflows, but leave the
; starred important mail alone: it files itself away once read.
; Difficulty (d = MG_DIFF / 255), d=0 -> d=1:
;   round length 32 s -> 40 s; a fresh reply-all every 1.7 s -> 0.8 s (× U(0.6, 1.4)); each surviving reply breeds
;   another at 3.5 %/s -> 6.5 %/s; starred mails 3 -> 7 (round(3 + 4 d)), read in 7 s -> 5 s;
;   from d 0.45 lookalikes ("RE: " + a starred subject, sometimes with "?") at 10 % + 30 % × d of the reply-alls;
;   from d 0.5 the starred rows no longer stand out (subject white instead of yellow): only the star and the
;   sender's colour give them away.
; 12 rows fit; above that the overflow meter fills (0.3 + 0.07 × extra mails per s, drains 0.2 per s) and a full
; meter ends the round at half score. Score = deleted / reply-alls (× 0.5 if overflowed) - 0.2 per starred mail
; deleted - 0.02 per press on an empty inbox. Content: src/data/mg-replyall.js, the department's thread topics
; (gen/mg_replyall_data.s).

.include "api.inc"

CAP       = 12                  ; visible rows
MAX_MAILS = CAP + 7             ; reply-alls stop arriving here
VIP_MAX   = 7                   ; round(byDiff(d, 3, 7)) starred mails
MAXM      = MAX_MAILS + VIP_MAX ; + the starred ones, which arrive regardless
LOOK_D    = 115                 ; lookalike subjects from d 0.45
TINT_D    = 128                 ; starred subjects in yellow below d 0.5
DUR_BASE  = 32 * 50             ; byDiff(d, 32, 40) s
ARR_BASE  = 85                  ; byDiff(d, 1.7, 0.8) s between fresh reply-alls
FIRST_ARR = 45                  ; 0.9 s
MULT_BASE = 46                  ; breeding: 0.035 per s = 46 / 65536 per frame
LIFE_BASE = 7 * 50              ; byDiff(d, 7, 5) s for a starred mail to be read
SPAWN_END = 75                  ; nothing new arrives in the last 1.5 s
VIP_START = 2 * 50              ; starred mail: 2 s + (duration - 9 s) × (k + U(0.15, 0.85)) / count
VIP_CUT   = 9 * 50
OV_FULL   = 50000               ; overflow meter: 1.0
OV_INC    = 300                 ; + (0.3 + 0.07 × extra) per s
OV_STEP   = 70
OV_DEC    = 200                 ; - 0.2 per s
MSG_T     = 40
FLASH_T   = 8                   ; red border (the JS screen shake)
BAR_W     = 20                  ; load and overflow bars

WIN_Y     = 2                   ; the mail window: rows 2-18
WIN_H     = 17
ROW0      = 5                   ; first mail row
STATUS_Y  = 17
LOAD_Y    = 19
OV_Y      = 20
STAT_Y    = 21
LEGEND_Y  = 22
MSG_Y     = 23
COL_ICON  = 2
COL_WHO   = 4
WHO_W     = 10
COL_TEXT  = 15
TEXT_W    = 23                  ; reply-alls; starred subjects stop before the reading bar
COL_RBAR  = 35
COL_BAR   = 12

C_FRAME   = 6
C_JUNK    = 6                   ; envelope of a reply-all (the JS grey)
C_SENDER  = 3                   ; its sender (blue would be unreadable on black)
CH_ENV    = CH_SO               ; a box with a cross: the envelope
CH_BARF   = 252                 ; quarter blocks: bottom half
CH_BARH   = 244                 ; bottom-left quarter

TRASH_PTR = ($e300 - $c000) / 64
TRASH_X   = 24 + 38 * 8 - 1 - 256   ; low byte, bit 8 set

.zeropage
count:    .res 1
cursor:   .res 1
deleted:  .res 1
vip_del:  .res 1
saved:    .res 1
whiffs:   .res 1
junk_tot: .res 1
overflow: .res 1
done:     .res 1
total:    .res 2                ; frames left
elapsed:  .res 2
arr_t:    .res 1
arr_int:  .res 1
mult:     .res 1
vip_n:    .res 1                ; starred mails this round
vip_next: .res 1
look:     .res 1                ; lookalike chance / 256, 0 = none
tint:     .res 1                ; 1: starred subjects in yellow
life:     .res 2                ; base reading time
ov:       .res 2
anim:     .res 1
msg_t:    .res 1
flash_t:  .res 1
dirty:    .res 1
spawning: .res 1
n0:       .res 1
k:        .res 1
mv:       .res 2                ; mul16x8
mf:       .res 1
mh:       .res 2
sp:       .res 2
bufi:     .res 1
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---------------------------------------------------------------- set-up

; A = difficulty
init:
        sta t0
        lsr                     ; duration: 32 s + (1.5 + 1/16) × A frames (40 s at A = 255)
        sta t1
        lda t0
        lsr
        lsr
        lsr
        lsr
        clc
        adc t1
        adc t0
        sta t1
        lda #0
        adc #0
        sta t2
        lda t1
        clc
        adc #<DUR_BASE
        sta total
        lda t2
        adc #>DUR_BASE
        sta total+1
        lda t0                  ; fresh reply-alls every 85 - 0.19 × A frames
        lsr
        lsr
        lsr
        sta t1
        lsr
        clc
        adc t1
        eor #$ff
        sec
        adc #ARR_BASE
        sta arr_int
        lda t1                  ; breeding 46 + 5/32 × A per 65536 frames (0.035 -> 0.065 per s)
        lsr
        lsr
        clc
        adc t1
        adc #MULT_BASE
        sta mult
        ldx #3                  ; round(byDiff(d, 3, 7)) starred mails: one more from d 0.125, 0.375, ...
        lda t0
:       cmp vip_steps-3,x
        bcc :+
        inx
        cpx #VIP_MAX
        bne :-
:       stx vip_n
        lda t0                  ; reading time 350 - 0.39 × A frames
        lsr
        lsr
        sta t2
        lsr
        clc
        adc t2
        sta t2
        lda t0
        lsr
        lsr
        lsr
        lsr
        lsr
        lsr
        clc
        adc t2
        sta t2
        lda #<LIFE_BASE
        sec
        sbc t2
        sta life
        lda #>LIFE_BASE
        sbc #0
        sta life+1
        ; lookalikes ("RE: " + a starred subject) from d 0.45: chance 0.1 + 0.3 d = (26 + 0.297 × A) / 256
        lda #0
        sta look
        lda t0
        cmp #LOOK_D
        bcc :+
        lsr
        lsr
        sta t1
        lda t0
        lsr
        lsr
        lsr
        lsr
        lsr
        sta t2
        lsr
        clc
        adc t2
        adc t1
        adc #26
        sta look
:       ldx #1                  ; starred rows stand out (yellow subject) below d 0.5
        lda t0
        cmp #TINT_D
        bcc :+
        dex
:       stx tint
        lda #0
        sta count
        sta cursor
        sta deleted
        sta vip_del
        sta saved
        sta whiffs
        sta junk_tot
        sta overflow
        sta done
        sta elapsed
        sta elapsed+1
        sta vip_next
        sta ov
        sta ov+1
        sta anim
        sta msg_t
        sta flash_t
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        lda #FIRST_ARR
        sta arr_t
        lda #1
        sta spawning
        ; starred mail schedule: seg = (duration - 9 s) / count, t_k = 2 s + seg × k + seg × U(0.15, 0.85)
        lda total
        sec
        sbc #<VIP_CUT
        sta t0
        lda total+1
        sbc #>VIP_CUT
        sta t1
        lda #0
        sta mv
        sta mv+1
:       lda t0                  ; t1:t0 / vip_n -> mv
        sec
        sbc vip_n
        tay
        lda t1
        sbc #0
        bcc :+
        sta t1
        sty t0
        inc mv
        bne :-
        inc mv+1
        bne :-
:       lda #<VIP_START
        sta t2
        lda #>VIP_START
        sta t3
        ldx #0
@vt:    stx k
        lda #180
        jsr API_RMOD
        clc
        adc #38
        jsr mul16x8
        ldx k
        lda t2
        clc
        adc mh
        sta vip_t_lo,x
        lda t3
        adc mh+1
        sta vip_t_hi,x
        lda t2                  ; next segment
        clc
        adc mv
        sta t2
        lda t3
        adc mv+1
        sta t3
        inx
        cpx vip_n
        bne @vt
        ; the thread: topic and a recipient count of 1200-9800
        lda #TOPIC_COUNT
        jsr API_RMOD
        sta topic
        lda #9
        jsr API_RMOD
        clc
        adc #1
        sta recip
        tax
        lda #10
        dex
        bne :+
        lda #8                  ; 1xxx: at least 1200
:       jsr API_RMOD
        ldx recip
        dex
        bne :+
        clc
        adc #2
:       sta recip+1
        lda #10
        jsr API_RMOD
        sta recip+2
        lda #10
        jsr API_RMOD
        sta recip+3
        ; three reply-alls to start with
        lda #1
        jsr add_junk
        lda #1
        jsr add_junk
        lda #1
        jsr add_junk
        jsr init_sprite
        jsr draw_static
        jsr draw_all
        lda total
        ldx total+1
        jmp timer_start

init_sprite:
        ldx #62
:       lda trash_spr,x
        sta $e300,x
        dex
        bpl :-
        lda #TRASH_PTR
        sta SCREEN + $3f8
        lda #$ff
        sta $d01c               ; multicolour, stripes in $d025 black
        lda #0
        sta $d017
        sta $d01d
        sta $d01b
        sta $d025
        lda #10
        sta $d026
        lda #TRASH_X
        sta $d000
        lda #1
        sta $d010
        rts

draw_static:
        text 1, 0, s_name, 7
        lda #C_FRAME
        sta COLOR
        lda #40
        sta FILL_W
        lda #WIN_H
        sta FILL_H
        ldx #0
        ldy #WIN_Y
        jsr API_BOX
        ; thread line and recipients
        jsr buf_reset
        lda #<s_thread
        ldx #>s_thread
        jsr buf_s
        ldy topic
        lda topic_hi,y
        tax
        lda topic_lo,y
        jsr buf_s
        lda #34
        jsr buf_c
        jsr buf_end
        lda #3
        sta COLOR
        ldx #1
        ldy #WIN_Y + 1
        jsr API_PRINT
        jsr buf_reset
        lda #<s_allstaff
        ldx #>s_allstaff
        jsr buf_s
        ldx #0
:       lda recip,x
        ora #'0'
        jsr buf_c
        inx
        cpx #4
        bne :-
        lda #')'
        jsr buf_c
        jsr buf_end
        lda #3
        sta COLOR
        ldx #1
        ldy #WIN_Y + 2
        jsr API_PRINT
        ; panel labels and the legend
        text 1, LOAD_Y, s_load, 1
        lda #7
        sta COLOR
        lda #CH_STAR
        ldx #1
        ldy #LEGEND_Y
        jsr API_PUTC
        text 3, LEGEND_Y, s_keep, 7
        lda #C_JUNK
        sta COLOR
        lda #CH_ENV
        ldx #12
        ldy #LEGEND_Y
        jsr API_PUTC
        text 14, LEGEND_Y, s_delre, 1
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; ---------------------------------------------------------------- the mail list

; A = depth: a reply-all from a random colleague at the bottom of the inbox.
add_junk:
        ldx count
        cpx #MAXM
        bcs @out
        sta m_depth,x
        lda #0
        sta m_vip,x
        inc junk_tot
        bne :+
        dec junk_tot            ; (saturate)
:       lda #SENDER_COUNT
        jsr API_RMOD
        ldx count
        sta m_who,x
        lda #REPLY_COUNT
        jsr API_RMOD
        ldx count
        sta m_what,x
        lda #0
        sta m_look,x
        lda look                ; a lookalike: "RE: " + a starred subject (+ "?" half the time)
        beq @add
        jsr API_RAND
        cmp look
        bcs @add
        lda #SUBJECT_COUNT
        jsr API_RMOD
        ldx count
        sta m_what,x
        jsr API_RAND
        and #1
        clc
        adc #1
        sta m_look,x
@add:   inc count
        lda #1
        sta dirty
@out:   rts

; A starred mail: one of the VIPs, one of their 3 subjects, read in life × U(0.9, 1.15).
add_vip:
        ldx count
        cpx #MAXM
        bcs @out
        lda #1
        sta m_vip,x
        lda #0
        sta m_age_lo,x
        sta m_age_hi,x
        lda #VSENDER_COUNT
        jsr API_RMOD
        ldx count
        sta m_who,x
        sta t0
        asl
        adc t0
        sta t0
        lda #3
        jsr API_RMOD
        clc
        adc t0
        ldx count
        sta m_what,x
        lda life
        sta mv
        lda life+1
        sta mv+1
        lda #230                ; 0.9
        jsr mul16x8
        ldx count
        lda mh
        sta m_life_lo,x
        lda mh+1
        sta m_life_hi,x
        lda #65                 ; + 0..0.25
        jsr API_RMOD
        jsr mul16x8
        ldx count
        lda m_life_lo,x
        clc
        adc mh
        sta m_life_lo,x
        lda m_life_hi,x
        adc mh+1
        sta m_life_hi,x
        inc count
        lda #1
        sta dirty
@out:   rts

; X = row: removed, the mails below move up.
remove:
:       cpx count
        beq @done
        lda m_vip+1,x
        sta m_vip,x
        lda m_who+1,x
        sta m_who,x
        lda m_what+1,x
        sta m_what,x
        lda m_depth+1,x
        sta m_depth,x
        lda m_look+1,x
        sta m_look,x
        lda m_age_lo+1,x
        sta m_age_lo,x
        lda m_age_hi+1,x
        sta m_age_hi,x
        lda m_life_lo+1,x
        sta m_life_lo,x
        lda m_life_hi+1,x
        sta m_life_hi,x
        inx
        bne :-
@done:  dec count
        lda #1
        sta dirty
        rts

; A = visible rows: min(count, CAP)
visible:
        lda count
        cmp #CAP
        bcc :+
        lda #CAP
:       rts

; mv × A / 256 -> mh (16 bits)
mul16x8:
        sta mf
        lda #0
        sta mh
        sta mh+1
        ldx #8
@l:     lsr mf
        bcc @s
        lda mh
        clc
        adc mv
        sta mh
        lda mh+1
        adc mv+1
        sta mh+1
@s:     ror mh+1
        ror mh
        dex
        bne @l
        rts

; ---------------------------------------------------------------- per frame

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       inc anim
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jsr clear_rows
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       jsr timer_tick          ; (the bar only: total decides)
        lda total
        bne :+
        dec total+1
:       dec total
        lda total
        ora total+1
        bne :+
        jmp finish
:       inc elapsed
        bne :+
        inc elapsed+1
:       lda total+1             ; spawning while more than 1.5 s are left
        bne :+
        lda total
        cmp #SPAWN_END
        bcs :+
        lda #0
        sta spawning
:       ; fresh reply-alls from outside: every arr_int × U(0.6, 1.4)
        dec arr_t
        bne @breed
        lda arr_int
        sta mv
        lda #0
        sta mv+1
        lda #154                ; 0.6
        jsr mul16x8
        lda mh
        sta t0
        lda #205                ; + 0..0.8
        jsr API_RMOD
        jsr mul16x8
        lda mh
        clc
        adc t0
        bne :+
        lda #1
:       sta arr_t
        lda spawning
        beq @breed
        lda count
        cmp #MAX_MAILS
        bcs @breed
        lda #2
        jsr API_RMOD
        clc
        adc #1
        jsr add_junk
@breed: ; every reply that survives breeds more; starred mail is being read
        lda count
        sta n0
        ldx #0
@b:     cpx n0
        beq @vips
        stx k
        lda m_vip,x
        beq :+
        inc m_age_lo,x
        bne @nb
        inc m_age_hi,x
        jmp @nb
:       lda spawning
        beq @nb
        lda count
        cmp #MAX_MAILS
        bcs @nb
        jsr API_RAND            ; chance mult / 65536
        bne @nb
        jsr API_RAND
        cmp mult
        bcs @nb
        ldx k
        lda m_depth,x
        clc
        adc #1
        cmp #99
        bcc :+
        lda #99
:       jsr add_junk
@nb:    ldx k
        inx
        bne @b
@vips:  ; starred mail on schedule
        lda vip_next
        cmp vip_n
        bcs @read
        tax
        lda elapsed
        cmp vip_t_lo,x
        lda elapsed+1
        sbc vip_t_hi,x
        bcc @read
        inc vip_next
        jsr add_vip
        jmp @vips
@read:  ; starred mail files itself away once read (counts as saved)
        ldx count
@r:     dex
        bmi @ov
        lda m_vip,x
        beq @r
        lda m_age_lo,x
        cmp m_life_lo,x
        lda m_age_hi,x
        sbc m_life_hi,x
        bcc @r
        stx k
        jsr remove
        inc saved
        lda #SFX_GOOD
        jsr API_SFX
        lda k
        cmp #CAP
        bcs :+
        lda #<s_savedf
        ldx #>s_savedf
        ldy #7
        jsr message
:       ldx k
        jmp @r
@ov:    ; overflow meter
        lda count
        cmp #CAP + 1
        bcc @drain
        sbc #CAP                ; extra mails
        tax
        lda ov
        clc
        adc #<OV_INC
        sta ov
        lda ov+1
        adc #>OV_INC
        sta ov+1
:       lda ov
        clc
        adc #OV_STEP
        sta ov
        bcc :+
        inc ov+1
:       dex
        bne :--
        lda ov
        cmp #<OV_FULL
        lda ov+1
        sbc #>OV_FULL
        bcc @input
        lda #1                  ; the inbox overflowed
        sta overflow
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        jmp finish
@drain: lda ov
        sec
        sbc #<OV_DEC
        sta t0
        lda ov+1
        sbc #>OV_DEC
        bcs :+
        lda #0
        sta t0
:       sta ov+1
        lda t0
        sta ov
@input:
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda JOYP
        and #J_UP
        beq :+
        lda cursor
        beq :+
        dec cursor
:       lda JOYP
        and #J_DOWN
        beq :+
        inc cursor
:       jsr clamp_cursor
        lda JOYP
        and #J_UP | J_DOWN
        beq :+
        jsr draw_cursor
:
        lda JOYP
        and #J_FIRE
        beq @draw
        ldx cursor
        jsr del
        jsr clamp_cursor
@draw:  lda dirty
        beq :+
        jsr draw_all
        jmp @out
:       lda anim
        and #3
        bne @out
        jsr draw_vip_bars
        jsr draw_meter
        lda anim
        and #7
        bne @out
        jsr draw_status         ; (flashes when full)
@out:   clc
        rts

; cursor = min(cursor, visible - 1), 0 on an empty inbox
clamp_cursor:
        jsr visible
        sec
        sbc #1
        bcs :+
        lda #0
:       cmp cursor
        bcs :+
        sta cursor
:       rts

; X = row: delete it (an empty row is a whiff).
del:
        jsr visible
        sta t3
        cpx t3
        bcc :+
        inc whiffs
        lda #SFX_BLIP
        jsr API_SFX
        lda #<s_empty
        ldx #>s_empty
        ldy #C_JUNK
        jmp message
:       lda m_vip,x
        beq @junk
        jsr remove
        inc vip_del
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #FLASH_T
        sta flash_t
        lda #OOPS_COUNT
        jsr API_RMOD
        tay
        lda oops_hi,y
        tax
        lda oops_lo,y
        ldy #2
        jmp message
@junk:  jsr remove
        inc deleted
        lda deleted             ; a coin every 5th
:       cmp #5
        bcc :+
        sbc #5
        bcs :-
:       tax
        lda #SFX_BLIP
        cpx #0
        bne :+
        lda #SFX_GOOD
:       jsr API_SFX
        lda #<s_plus1
        ldx #>s_plus1
        ldy #5
        jmp message

.if .defined(AUTOPLAY)
; Perfect player (test builds): every 4 frames a step towards the topmost reply-all, FIRE on it.
bot:    dec bot_t
        bpl @out
        lda #3
        sta bot_t
        jsr visible
        sta t3
        ldx #0
:       cpx t3
        beq @out
        lda m_vip,x
        beq :+
        inx
        bne :-
:       cpx cursor
        beq @fire
        lda #J_DOWN
        bcs :+
        lda #J_UP
:       sta JOYP
@out:   rts
@fire:  lda #J_FIRE
        sta JOYP
        rts
.endif

; A/X = message, Y = colour: centred on the message row for a moment.
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

; ---------------------------------------------------------------- drawing

draw_all:
        lda #0
        sta dirty
        jsr draw_title
        ldx #0
:       stx k
        jsr draw_row
        ldx k
        inx
        cpx #CAP
        bne :-
        jsr draw_trash
        jsr draw_status
        jsr draw_load
        jsr draw_meter
        ; fall through
draw_stats:
        text 30, 0, s_deleted, 7
        lda #7
        sta COLOR
        ldx #38
        ldy #0
        lda deleted
        jsr API_NUM
        lda #STAT_Y
        ldx #1
        jsr clear_rows
        text 1, STAT_Y, s_deleted, 1
        lda #1
        sta COLOR
        ldx #9
        ldy #STAT_Y
        lda deleted
        jsr API_NUM
        text 14, STAT_Y, s_saved, 7
        lda #7
        sta COLOR
        ldx #20
        ldy #STAT_Y
        lda saved
        jsr API_NUM
        lda vip_del
        beq :+
        text 26, STAT_Y, s_oops, 2
        lda #2
        sta COLOR
        ldx #31
        ldy #STAT_Y
        lda vip_del
        jmp API_NUM
:       rts

; " MailDrone 2000 - Inbox (N) " on the window's top edge.
draw_title:
        jsr buf_reset
        lda #<s_title
        ldx #>s_title
        jsr buf_s
        lda count
        jsr buf_n
        lda #<s_title2
        ldx #>s_title2
        jsr buf_s
        jsr buf_end
        lda #1
        sta COLOR
        ldx #2
        ldy #WIN_Y
        jsr API_PRINT
        lda #C_FRAME            ; the edge again after it (the count may have lost a digit)
        sta COLOR
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        lda bufi
        clc
        adc #1                  ; 2 + length - 1 (bufi counts the 0)
        tax
        ldy #WIN_Y
        lda #CH_T
        jmp API_FILL

; Row k of the list.
draw_row:
        lda #38
        sta FILL_W
        lda #1
        sta FILL_H
        lda k
        clc
        adc #ROW0
        sta t2                  ; screen row
        tay
        ldx #1
        lda #' '
        jsr API_FILL
        ldx k
        cpx count
        bcc :+
        rts
:       cpx cursor
        bne :+
        lda #7
        sta COLOR
        lda #CH_ARROW
        ldx #1
        ldy t2
        jsr API_PUTC
        ldx k
:       lda m_vip,x
        beq :+
        jmp @vip
:       ; reply-all: envelope, sender, "RE: " × depth + the reply, cut to fit
        lda #C_JUNK
        sta COLOR
        lda #CH_ENV
        ldx #COL_ICON
        ldy t2
        jsr API_PUTC
        jsr buf_reset
        ldx k
        ldy m_who,x
        lda sender_hi,y
        tax
        lda sender_lo,y
        jsr buf_s
        lda #WHO_W
        jsr buf_fit
        lda #C_SENDER
        sta COLOR
        ldx #COL_WHO
        ldy t2
        jsr API_PRINT
        jsr buf_reset
        ldx k
        lda m_look,x
        beq :+
        jmp @look
:       lda m_depth,x
        cmp #3
        bcs @deep
        lda #<s_re
        ldx #>s_re
        jsr buf_s
        ldx k
        lda m_depth,x
        cmp #2
        bcc @text
        lda #<s_re
        ldx #>s_re
        jsr buf_s
        jmp @text
@deep:  lda #<s_reb             ; RE[n]:
        ldx #>s_reb
        jsr buf_s
        ldx k
        lda m_depth,x
        jsr buf_n
        lda #<s_reb2
        ldx #>s_reb2
        jsr buf_s
@text:  ldx k
        ldy m_what,x
        lda reply_hi,y
        tax
        lda reply_lo,y
        jsr buf_s
        jmp @fit
@look:  lda #<s_re              ; lookalike: "RE: " + a starred subject (+ "?")
        ldx #>s_re
        jsr buf_s
        ldx k
        ldy m_what,x
        lda subject_hi,y
        tax
        lda subject_lo,y
        jsr buf_s
        ldx k
        lda m_look,x
        cmp #2
        bne @fit
        lda #'?'
        jsr buf_c
@fit:   lda #TEXT_W
        jsr buf_fit
        lda #1
        sta COLOR
        ldx #COL_TEXT
        ldy t2
        jmp API_PRINT
@vip:   ; starred: star, the sender in their colour, the subject in yellow, the reading bar
        lda #7
        sta COLOR
        lda #CH_STAR
        ldx #COL_ICON
        ldy t2
        jsr API_PUTC
        ldx k
        ldy m_who,x
        lda vip_color,y
        sta COLOR
        lda vsender_lo,y
        sta PTR
        lda vsender_hi,y
        sta PTR+1
        ldx #COL_WHO
        ldy t2
        jsr API_PRINT
        ldx k
        ldy m_what,x
        lda subject_lo,y
        sta PTR
        lda subject_hi,y
        sta PTR+1
        lda #1                  ; yellow while starred rows are tinted (d < 0.5), then plain white
        ldx tint
        beq :+
        lda #7
:       sta COLOR
        ldx #COL_TEXT
        ldy t2
        jsr API_PRINT
        ldx k
        ; fall through

; X = row (a starred mail): 3 cells, age / life in half cells.
draw_rbar:
        stx t1
        lda m_age_lo,x          ; t0 = age × 6 / life (0..6)
        sta mv
        lda m_age_hi,x
        sta mv+1
        asl mv
        rol mv+1
        lda mv
        clc
        adc m_age_lo,x
        sta mv
        lda mv+1
        adc m_age_hi,x
        sta mv+1                ; × 3
        asl mv
        rol mv+1                ; × 6
        ldy #0
:       lda mv
        sec
        sbc m_life_lo,x
        sta t0
        lda mv+1
        sbc m_life_hi,x
        bcc :+
        sta mv+1
        lda t0
        sta mv
        iny
        cpy #6
        bne :-
:       sty t0
        lda t1
        clc
        adc #ROW0
        sta t2
        lda #0
        sta t3                  ; cell
@c:     lda t3
        asl
        sta mf                  ; 2 × cell
        lda t0
        sec
        sbc mf
        bcc @empty
        beq @empty
        cmp #1
        beq @half
        lda #CH_BARF            ; read past this cell
        ldx #7
        bne @put
@half:  lda #CH_BARH
        ldx #7
        bne @put
@empty: lda #CH_BARF
        ldx #6
@put:   stx COLOR
        pha
        lda t3
        clc
        adc #COL_RBAR
        tax
        ldy t2
        pla
        jsr API_PUTC
        inc t3
        lda t3
        cmp #3
        bne @c
        rts

draw_vip_bars:
        jsr visible
        sta t3
        ldx #0
@v:     cpx t3
        beq @done
        lda m_vip,x
        beq :+
        stx k
        lda t3
        pha
        jsr draw_rbar
        pla
        sta t3
        ldx k
:       inx
        bne @v
@done:  rts

; The arrow on the cursor row, then the trash can.
draw_cursor:
        lda #7
        sta COLOR
        ldx #0
:       stx k
        lda #' '
        cpx cursor
        bne :+
        cpx count
        bcs :+
        lda #CH_ARROW
:       pha
        txa
        clc
        adc #ROW0
        tay
        ldx #1
        pla
        jsr API_PUTC
        ldx k
        inx
        cpx #CAP
        bne :--
        ; fall through

; The trash can on the cursor row (red over starred mail), hidden on an empty inbox.
draw_trash:
        lda count
        bne :+
        lda #0
        sta $d015
        rts
:       lda cursor
        asl
        asl
        asl
        clc
        adc #50 + ROW0 * 8
        sta $d001
        ldx cursor
        lda #12
        ldy m_vip,x
        beq :+
        lda #2
:       sta $d027
        lda #1
        sta $d015
        rts

; "N of 12 slots used", or "+N more! INBOX FULL" flashing.
draw_status:
        lda #38
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #1
        ldy #STATUS_Y
        jsr API_FILL
        jsr buf_reset
        lda count
        cmp #CAP + 1
        bcs @full
        jsr buf_n
        lda #<s_slots
        ldx #>s_slots
        jsr buf_s
        jsr buf_end
        lda #3
        bne @print
@full:  lda #'+'
        jsr buf_c
        lda count
        sec
        sbc #CAP
        jsr buf_n
        lda #<s_more
        ldx #>s_more
        jsr buf_s
        jsr buf_end
        lda anim
        and #8
        beq :+
        lda #2
        bne @print
:       lda #1
@print: sta COLOR
        lda #<buf
        ldx #>buf
        ldy #STATUS_Y
        jmp API_CENTER

; Inbox load: count / 12 over the bar, green / yellow above 3/4 / red above full.
draw_load:
        ldx count
        cpx #MAXM
        bcc :+
        ldx #MAXM - 1
:       lda load_cells,x
        sta t0
        lda #5
        cpx #10
        bcc :+
        lda #7
        cpx #CAP + 1
        bcc :+
        lda #2
:       ldy #LOAD_Y
        jmp draw_bar

; OVERFLOW: the meter, flickering red while it fills.
draw_meter:
        lda #6
        ldx ov
        bne :+
        ldx ov+1
        beq :++
:       lda #2
:       sta COLOR
        lda #<s_overflow
        sta PTR
        lda #>s_overflow
        sta PTR+1
        ldx #1
        ldy #OV_Y
        jsr API_PRINT
        lda ov                  ; cells = ov / 2500
        sta mv
        lda ov+1
        sta mv+1
        ldx #0
:       lda mv
        sec
        sbc #<(OV_FULL / BAR_W)
        tay
        lda mv+1
        sbc #>(OV_FULL / BAR_W)
        bcc :+
        sta mv+1
        sty mv
        inx
        cpx #BAR_W
        bne :-
:       stx t0
        lda anim
        and #4
        beq :+
        lda #2
        .byte $2c
:       lda #4
        ldy #OV_Y
        jsr draw_bar
        ; "FULL!" blinking while the meter is up
        lda #7
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #33
        ldy #OV_Y
        jsr API_FILL
        lda t0
        beq :+
        lda anim
        and #16
        beq :+
        text 33, OV_Y, s_full, 2
:       rts

; Y = row, A = colour, t0 = filled cells: a BAR_W bar at COL_BAR, the rest hatched.
draw_bar:
        sta COLOR
        sty t1
        lda t0
        beq :+
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #COL_BAR
        lda #CH_BLOCK
        jsr API_FILL
:       lda #BAR_W
        sec
        sbc t0
        beq :+
        sta FILL_W
        lda #1
        sta FILL_H
        lda #6
        sta COLOR
        lda t0
        clc
        adc #COL_BAR
        tax
        ldy t1
        lda #CH_CHECKER
        jmp API_FILL
:       rts

; ---- a small string builder
buf_reset:
        lda #0
        sta bufi
        rts
buf_c:  stx t3
        ldx bufi
        sta buf,x
        inc bufi
        ldx t3
        rts
; A/X = string: appended
buf_s:  sta sp
        stx sp+1
        ldy #0
:       lda (sp),y
        beq :+
        jsr buf_c
        iny
        bne :-
:       rts
; A = 0..99 in decimal
buf_n:  ldx #0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        txa
        beq :+
        ora #'0'
        jsr buf_c
:       pla
        ora #'0'
        jmp buf_c
; A = width: cut to it with "..", then terminated (PTR = buf)
buf_fit:
        cmp bufi
        bcs buf_end
        sta bufi
        tax
        lda #'.'
        sta buf-1,x
        sta buf-2,x
buf_end:
        lda #0
        jsr buf_c
        lda #<buf
        sta PTR
        lda #>buf
        sta PTR+1
        rts

; score = deleted × 255 / reply-alls (halved if overflowed) - 51 per starred mail deleted - 5 per whiff
finish:
        lda #0
        sta t2
        lda deleted
        beq @pen
        sta t0
        lda #0                  ; t1:A = deleted × 255
        sec
        sbc t0
        pha
        lda t0
        sbc #0
        sta t1
        pla
        ldx #0
@div:   sec
        sbc junk_tot
        tay
        lda t1
        sbc #0
        bcc @q
        sta t1
        tya
        inx
        bne @div
        dex
@q:     stx t2
        lda overflow
        beq @pen
        lsr t2
@pen:   ldx vip_del
        beq @wh
@vp:    lda t2
        sec
        sbc #51
        bcs :+
        lda #0
:       sta t2
        dex
        bne @vp
@wh:    ldx whiffs
        beq @st
@wp:    lda t2
        sec
        sbc #5
        bcs :+
        lda #0
:       sta t2
        dex
        bne @wp
@st:    lda t2
        sta MG_SCORE
        lda #0
        sta $d015
        lda #1
        sta done
        sec
        rts

.rodata
s_name:     .byte "Reply-All Apocalypse", 0
s_help:     .byte "Delete the RE: replies. Never the starred mail!", 0
s_keys:     .byte "Up/down + FIRE: delete. Keep the stars!", 0
s_title:    .byte " MailDrone 2000 - Inbox (", 0
s_title2:   .byte ") ", 0
s_thread:   .byte "Thread: ", 34, 0
s_allstaff: .byte "to ALL STAFF (", 0
s_load:     .byte "Inbox load", 0
s_overflow: .byte "OVERFLOW", 0
s_full:     .byte "FULL!", 0
s_keep:     .byte "KEEP", 0
s_delre:    .byte "DELETE RE:", 0
s_deleted:  .byte "Deleted", 0
s_saved:    .byte "Saved", 0
s_oops:     .byte "Oops", 0
s_slots:    .byte " of 12 slots used", 0
s_more:     .byte " more! INBOX FULL", 0
s_re:       .byte "RE: ", 0
s_reb:      .byte "RE[", 0
s_reb2:     .byte "]: ", 0
s_plus1:    .byte "+1", 0
s_savedf:   .byte "Saved!", 0
s_empty:    .byte "empty", 0
vip_steps:  .byte 32, 96, 160, 224     ; A where round(3 + 4 d) steps up
load_cells: .repeat MAXM, I     ; min(BAR_W, round(count × BAR_W / CAP))
            .byte (I * BAR_W * 2 + CAP) / (CAP * 2) * (I <= CAP) + BAR_W * (I > CAP)
            .endrepeat

.include "gen/mg_replyall_data.s"

.bss
m_vip:      .res MAXM + 1
m_who:      .res MAXM + 1
m_what:     .res MAXM + 1
m_depth:    .res MAXM + 1
m_age_lo:   .res MAXM + 1
m_age_hi:   .res MAXM + 1
m_life_lo:  .res MAXM + 1
m_life_hi:  .res MAXM + 1
vip_t_lo:   .res VIP_MAX
vip_t_hi:   .res VIP_MAX
m_look:     .res MAXM + 1       ; reply-all: 0 plain, 1 lookalike, 2 lookalike with "?"
topic:      .res 1
recip:      .res 4
buf:        .res 48
