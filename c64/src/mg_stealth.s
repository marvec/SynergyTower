; Boss Alert (src/minigames/stealth.js) as a disk-loaded overlay at $4000.
; Colleagues walk past your cubicle; press FIRE to alt-tab to the spreadsheet just before the BOSS (dark
; suit, red tie) passes your desk. False alarms cost half a dodge. Difficulty 0 (floor 1): 8 walkers, 3 of
; them the boss, one every ~3.2 s, the work screen stays up 1.6 s.
; Walkers are expanded sprites; the boss frames come with the overlay (gen/boss.bin -> $e300).

.include "api.inc"
.include "gen/chars.inc"

WALKERS   = 8
BOSSES    = 3
SLOTS     = 7                   ; sprites 0-6 walk, sprite 7 stands in the legend
WORK_T    = 80                  ; 1.6 s
DESK_X    = 160                 ; sprite x where a walker's middle passes the desk
NEAR_X    = 100                 ; a boss this close makes FIRE a good call
WALK_Y    = 117                 ; feet on the corridor floor (screen row 13)
BOSS_PTR  = ($e300 - $c000) / 64
PERSON_PTR = ($e000 - $c000) / 64 + 6   ; walking left: frames 6-8, right: 9-11

.zeropage
now:      .res 2                ; frames since the start
total:    .res 2
work_t:   .res 1
dodged:   .res 1
caught:   .res 1
falses:   .res 1
done:     .res 1
msg_t:    .res 1
flash_t:  .res 1
anim:     .res 1
shown:    .res 1                ; screen content drawn: 0 fun, 1 work
t0:       .res 1
t1:       .res 1
t2:       .res 1
spawn_t:  .res 2
xmsb:     .res 1
enable:   .res 1

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

init:
        lda #0
        sta now
        sta now+1
        sta work_t
        sta dodged
        sta caught
        sta falses
        sta done
        sta msg_t
        sta flash_t
        sta anim
        ; boss frames into the sprite area
        ldx #0
:       lda boss_frames,x
        sta $e300,x
        lda boss_frames+128,x
        sta $e380,x
        lda boss_frames+256,x
        sta $e400,x
        inx
        bpl :-
        ; which walkers are the boss: pick BOSSES of WALKERS
        ldx #WALKERS-1
        lda #0
:       sta w_boss,x
        sta w_state,x
        dex
        bpl :-
        ldy #BOSSES
:       lda #WALKERS
        jsr API_RMOD
        tax
        lda w_boss,x
        bne :-
        lda #1
        sta w_boss,x
        dey
        bne :-
        ; spawn times, directions, speeds, shirts
        lda #60
        sta spawn_t
        lda #0
        sta spawn_t+1
        ldx #0
@w:     stx t0
        lda spawn_t
        sta w_spawn_lo,x
        lda spawn_t+1
        sta w_spawn_hi,x
        lda #97                 ; next one 112-208 frames later (3.2 s × 0.7-1.3)
        jsr API_RMOD
        clc
        adc #112
        adc spawn_t
        sta spawn_t
        bcc :+
        inc spawn_t+1
:       lda #53                 ; speed 203-255 / 256 px per frame (70 px/s × 0.85-1.07, scaled to 320 px;
        jsr API_RMOD            ; the speed is one byte, so the top of the browser's range is cut off)
        clc
        adc #203
        ldx t0
        sta w_speed,x
        jsr API_RAND
        and #1
        sta w_dir,x             ; 0 = walking right, 1 = left
        lda #6
        jsr API_RMOD
        tay
        lda shirt_tab,y
        ldx t0
        sta w_col,x
        lda w_boss,x
        beq :+
        lda #2                  ; the boss's tie: red
        sta w_col,x
:       inx
        cpx #WALKERS
        bne @w
        ; total = last spawn + the slowest crossing (~450 frames)
        lda spawn_t
        clc
        adc #<450
        sta total
        lda spawn_t+1
        adc #>450
        sta total+1
        ; sprites: all expanded, multicolour, walkers off for now
        lda #$ff
        sta $d017
        sta $d01d
        sta $d01c
        lda #0
        sta $d01b
        lda #$80
        sta enable
        sta $d015
        lda #48                 ; the legend boss
        sta $d00e
        lda #177
        sta $d00f
        lda #2
        sta $d02e
        lda #BOSS_PTR + 3
        sta SCREEN + $3ff
        jsr draw_scene
        lda total
        ldx total+1
        jmp timer_start

draw_scene:
        text 1, 0, s_name, 7
        jsr draw_dodged
        ; corridor: ceiling, wall, doors, windows, floor
        lda #2
        ldy #MC_A
        ldx #2
        jsr band
        lda #4
        ldy #MC_B
        ldx #9
        jsr band
        lda #13
        ldy #MC_A
        ldx #1
        jsr band
        lda #14
        ldy #MC_HALL
        ldx #1
        jsr band
        ldx #2
:       stx t2
        lda door_x,x
        tax
        lda #3
        sta FILL_W
        lda #7
        sta FILL_H
        lda #2 | 8
        sta COLOR
        ldy #6
        lda #MC_C
        jsr API_FILL
        ldx t2
        lda door_x,x
        clc
        adc #2
        tax
        ldy #9
        lda #MC_KNOB
        jsr API_PUTC
        ldx t2
        lda door_x,x
        clc
        adc #5
        tax
        lda #4
        sta FILL_W
        lda #3
        sta FILL_H
        lda #6 | 8
        sta COLOR
        ldy #5
        lda #MC_C
        jsr API_FILL
        ldx t2
        dex
        bpl :-
        ; monitor, your head, the cubicle wall
        lda #8
        sta COLOR
        lda #10
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #15
        ldy #15
        lda #MC_A
        jsr API_FILL
        lda #1 | 8
        sta COLOR
        lda #16
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #12
        ldy #20
        lda #MC_C
        jsr API_FILL
        lda #8
        sta COLOR
        lda #2
        sta FILL_H
        ldx #12
        ldy #21
        lda #MC_B
        jsr API_FILL
        lda #2
        sta COLOR
        ldx #19
        ldy #18
        lda #CH_HAIRL
        jsr API_PUTC
        ldx #20
        ldy #18
        lda #CH_HAIRR
        jsr API_PUTC
        lda #2
        sta FILL_W
        lda #1
        sta FILL_H
        ldx #19
        ldy #19
        lda #CH_BLOCK
        jsr API_FILL
        lda #$ff
        sta shown
        jsr draw_monitor
        ; legend and status panels
        lda #1
        sta COLOR
        lda #12
        sta FILL_W
        lda #8
        sta FILL_H
        ldx #0
        ldy #15
        jsr API_BOX
        lda #12
        sta FILL_W
        lda #8
        sta FILL_H
        ldx #28
        ldy #15
        jsr API_BOX
        lda #8                  ; grey behind the legend boss (his suit is black)
        sta COLOR
        lda #10
        sta FILL_W
        lda #5
        sta FILL_H
        ldx #1
        ldy #16
        lda #MC_B
        jsr API_FILL
        text 2, 15, s_theboss, 7
        text 3, 21, s_redtie, 7
        text 30, 15, s_status, 7
        jsr draw_status
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; A = first row, X = rows, Y = char: full-width band in multicolour (shared greys only).
band:
        stx FILL_H
        pha
        lda #40
        sta FILL_W
        lda #8
        sta COLOR
        tya
        tax
        pla
        tay
        txa
        ldx #0
        jmp API_FILL

; The monitor shows solitaire, or the spreadsheet while you look busy.
draw_monitor:
        lda work_t
        beq :+
        lda #1
:       cmp shown
        beq @done
        sta shown
        tax
        lda mon_col,x
        sta COLOR
        lda #8
        sta FILL_W
        lda #2
        sta FILL_H
        lda mon_char,x
        ldx #16
        ldy #16
        jsr API_FILL
        lda #1
        sta COLOR
        ldx shown
        lda mon_lo,x
        sta PTR
        lda mon_hi,x
        sta PTR+1
        ldx #31
        ldy #20
        jsr API_PRINT
@done:  rts

draw_dodged:
        text 28, 0, s_dodged, 1
        ldx #35
        ldy #0
        lda dodged
        jsr API_NUM
        lda #'/'
        ldx #36
        ldy #0
        jsr API_PUTC
        ldx #37
        ldy #0
        lda #BOSSES
        jmp API_NUM

draw_status:
        text 30, 17, s_caught, 1
        ldx #37
        ldy #17
        lda caught
        jsr API_NUM
        text 30, 18, s_false, 1
        ldx #37
        ldy #18
        lda falses
        jmp API_NUM

; A/X = message, Y = colour, on row 23 for a second.
message:
        sty t0
        pha
        txa
        pha
        lda #23
        ldx #1
        jsr clear_rows
        lda t0
        sta COLOR
        pla
        tax
        pla
        ldy #23
        jsr API_CENTER
        lda #50
        sta msg_t
        rts

; One frame. C=1 when the game is over.
frame:
        lda done
        beq :+
        sec
        rts
:       inc now
        bne :+
        inc now+1
:       inc anim
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #23
        ldx #1
        jsr clear_rows
:       lda flash_t
        beq :+
        dec flash_t
        bne :+
        lda #0
        sta $d020
:       lda work_t
        beq :+
        dec work_t
        bne :+
        jsr draw_monitor
:       jsr timer_tick
        bcc :+
        jmp finish
:       jsr walk
        jsr place_sprites
.if .defined(AUTOPLAY)
        jsr bot
.endif
        lda JOYP
        and #J_FIRE
        beq @out
        jsr boss_near
        bcs :+
        inc falses
        jsr draw_status
        lda #SFX_BAD
        jsr API_SFX
        lda #<s_falsealarm
        ldx #>s_falsealarm
        ldy #7
        jsr message
        jmp @work
:       lda #SFX_BLIP
        jsr API_SFX
@work:  lda #WORK_T
        sta work_t
        jsr draw_monitor
@out:   ldx #WALKERS-1          ; everybody gone?
:       lda w_state,x
        cmp #2
        bne :+
        dex
        bpl :-
        jmp finish
:       clc
        rts

; Spawn, move and retire walkers; check the boss as he passes the desk.
walk:
        ldx #WALKERS-1
:       stx t2
        jsr walk_one
        ldx t2
        dex
        bpl :-
        rts

; X = walker.
walk_one:
        lda w_state,x
        bne @active
        lda now+1               ; time to come in?
        cmp w_spawn_hi,x
        bcc @wait
        bne :+
        lda now
        cmp w_spawn_lo,x
        bcs :+
@wait:  rts
:       lda #1
        sta w_state,x
        lda #0
        sta w_frac,x
        sta w_checked,x
        lda w_dir,x
        bne :+
        lda #<(512 - 8)         ; walking right: from just left of the screen (x = -8)
        sta w_xlo,x
        lda #$ff
        sta w_xhi,x
        rts
:       lda #<344               ; walking left: from just right of it
        sta w_xlo,x
        lda #>344
        sta w_xhi,x
        rts
@active:
        cmp #2
        bne :+
        rts
:
        lda w_xlo,x             ; remember which side of the desk he was on
        sec
        sbc #DESK_X
        lda w_xhi,x
        sbc #0
        sta t1                  ; bit 7: left of the desk
        lda w_dir,x
        bne @left
        lda w_frac,x
        clc
        adc w_speed,x
        sta w_frac,x
        lda w_xlo,x
        adc #0
        sta w_xlo,x
        lda w_xhi,x
        adc #0
        sta w_xhi,x
        cmp #>344               ; off the right edge? (x >= 344; $ff = still left of 0)
        bne @passed
        lda w_xlo,x
        cmp #<344
        bcc @passed
        bcs @gone
@left:  lda w_frac,x
        sec
        sbc w_speed,x
        sta w_frac,x
        lda w_xlo,x
        sbc #0
        sta w_xlo,x
        lda w_xhi,x
        sbc #0
        sta w_xhi,x
        bpl @passed
        lda w_xlo,x
        cmp #<(512 - 8)
        bcs @passed
@gone:  lda #2
        sta w_state,x
        bne @next
@passed:
        lda w_boss,x
        beq @next
        lda w_checked,x
        bne @next
        lda w_xlo,x
        sec
        sbc #DESK_X
        lda w_xhi,x
        sbc #0
        eor t1
        bpl @next               ; same side as before
        lda #1
        sta w_checked,x
        jmp boss_passes
@next:  rts

boss_passes:
        lda work_t
        beq @caught
        inc dodged
        jsr draw_dodged
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_busy
        ldx #>s_busy
        ldy #5
        jmp message
@caught:
        inc caught
        jsr draw_status
        lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta $d020
        lda #20
        sta flash_t
        lda #<s_caught2
        ldx #>s_caught2
        ldy #2
        jmp message

; C=1 if a boss who hasn't passed yet is within NEAR_X of the desk.
boss_near:
        ldx #WALKERS-1
@b:     lda w_state,x
        cmp #1
        bne @next
        lda w_boss,x
        beq @next
        lda w_checked,x
        bne @next
        jsr dist
        cmp #NEAR_X
        bcc @yes
@next:  dex
        bpl @b
        clc
        rts
@yes:   sec
        rts

; A = |x - DESK_X| of walker X, capped at 255.
dist:
        lda w_xlo,x
        sec
        sbc #DESK_X
        sta t0
        lda w_xhi,x
        sbc #0
        bmi @neg
        bne @far
        lda t0
        rts
@neg:   cmp #$ff
        bne @far
        lda t0
        eor #$ff
        clc
        adc #1
        beq @far
        rts
@far:   lda #255
        rts

; Walker sprites: slot = walker mod 7.
place_sprites:
        lda #0
        sta xmsb
        lda #$80
        sta enable
        ldx #0
@s:     lda w_state,x
        cmp #1
        bne @next
        txa
        cmp #SLOTS
        bcc :+
        sbc #SLOTS
:       sta t0                  ; slot
        asl
        tay
        lda w_xlo,x
        sta $d000,y
        lda #WALK_Y
        sta $d001,y
        ldy t0
        lda w_xhi,x             ; bit 8 of x (also set for x < 0, which wraps to 504-511)
        and #1
        beq :+
        lda bit_tab,y
        ora xmsb
        sta xmsb
:       lda bit_tab,y
        ora enable
        sta enable
        lda w_col,x
        sta $d027,y
        lda anim                ; frame: stand / step A / step B
        lsr
        lsr
        lsr
        and #1
        clc
        adc #1
        sta t1
        lda w_dir,x
        beq :+
        lda #0                  ; left: frames 0-2
        .byte $2c
:       lda #3                  ; right: frames 3-5
        clc
        adc t1
        sta t1
        lda w_boss,x
        beq :+
        lda #BOSS_PTR
        .byte $2c
:       lda #PERSON_PTR
        clc
        adc t1
        sta SCREEN + $3f8,y
@next:  inx
        cpx #WALKERS
        bne @s
        lda xmsb                ; the legend boss (sprite 7) sits left of x 256
        sta $d010
        lda enable
        sta $d015
        rts

.if .defined(AUTOPLAY)
; Perfect player (test builds): alt-tab when a boss is 40 px from the desk and the screen shows solitaire.
bot:    lda work_t
        bne @no
        ldx #WALKERS-1
@b:     lda w_state,x
        cmp #1
        bne @n
        lda w_boss,x
        beq @n
        lda w_checked,x
        bne @n
        jsr dist
        cmp #40
        bcs @n
        lda #J_FIRE
        sta JOYP
        rts
@n:     dex
        bpl @b
@no:    rts
.endif

; score = clamp(2 × dodged - false alarms, 0, 6) × 255 / 6
finish:
        lda #0
        sta $d015
        sta $d017
        sta $d01d
        sta $d020
        lda dodged
        asl
        sec
        sbc falses
        bcs :+
        lda #0
:       bpl :+
        lda #0
:       cmp #7
        bcc :+
        lda #6
:       tax
        lda score_tab,x
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:      .byte "Boss Alert", 0
s_help:      .byte "Alt-tab right before the BOSS walks by.", 0
s_keys:      .byte "FIRE = alt-tab to the spreadsheet", 0
s_dodged:    .byte "Dodged", 0
s_theboss:   .byte "THE BOSS", 0
s_redtie:    .byte "red tie", 0
s_status:    .byte "STATUS", 0
s_caught:    .byte "Caught", 0
s_false:     .byte "False", 0
s_busy:      .byte "Looking busy!", 0
s_caught2:   .byte "CAUGHT!", 0
s_falsealarm: .byte "False alarm!", 0
s_fun:       .byte "FUN ", 0
s_work:      .byte "WORK", 0
mon_lo:      .byte <s_fun, <s_work
mon_hi:      .byte >s_fun, >s_work
mon_col:     .byte 5 | 8, 1 | 8
mon_char:    .byte MC_CARDS, MC_GRID
door_x:      .byte 2, 15, 28
shirt_tab:   .byte 6, 5, 7, 3, 4, 1
bit_tab:     .byte 1, 2, 4, 8, 16, 32, 64, 128
score_tab:   .byte 0, 43, 85, 128, 170, 213, 255
boss_frames: .incbin "gen/boss.bin"

.bss
w_spawn_lo:  .res WALKERS
w_spawn_hi:  .res WALKERS
w_xlo:       .res WALKERS
w_xhi:       .res WALKERS
w_frac:      .res WALKERS
w_speed:     .res WALKERS
w_dir:       .res WALKERS
w_boss:      .res WALKERS
w_col:       .res WALKERS
w_state:     .res WALKERS       ; 0 waiting, 1 walking, 2 gone
w_checked:   .res WALKERS
