; Lost Password (src/minigames/lostpw.js + the floor part in src/scenes/floorQuest.js) as a disk-loaded overlay at
; $4000. A floor quest: QUEST_SETUP rolls whiteboards onto the floor (one shows your pet; the floor's quest code in
; src/quest.s runs the search), QUEST_VIEW draws a board's close-up, and the desk part is the mini-game below: log
; back in with your pet's name, picked from six autofill suggestions, three attempts.
; Floors 1-2 (d up to 0.17): 3 boards, no other people's pets (from d 0.17 one), 72 s to search, 29 s at the desk.
; Score: attempt (1, 0.55, 0.3) × (0.75 + 0.25 × speed bonus of the search).

.include "api.inc"
.include "state.inc"

OPTIONS  = 6
WELCOME_T = 50                  ; 1 s of "Welcome back!"
OPT_Y    = 10

.zeropage
pet:      .res 1                ; species
pname:    .res 1                ; name index
ndecoy:   .res 1
nboards:  .res 1
attempt:  .res 1
wrong:    .res 1                ; bit k: option k tried
focus:    .res 1
welcome:  .res 1
done:     .res 1
right:    .res 1                ; the option with the pet's name
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
p0:       .res 2
p1:       .res 2
bx:       .res 1                ; placement
by:       .res 1
bestx:    .res 1
besty:    .res 1
bestd:    .res 1
tries:    .res 1
prevkey:  .res 1
row:      .res 1
col:      .res 1
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help
        jmp quest_setup
        jmp quest_view

.include "mgkit.s"

; ---- the floor part ------------------------------------------------------------------------------------------------
; A = difficulty: the pet, the boards' contents and places (QB_*), the time limit, the board sprites.
quest_setup:
        sta t3
        lda #N_SPECIES
        jsr API_RMOD
        sta pet
        lda #N_NAMES
        jsr API_RMOD
        sta pname
        lda t3                  ; other people's pets: round(3 d)
        jsr times3_div255
        sta ndecoy
        lda t3                  ; boards: round(3 + 3 d), at least decoys + 2
        jsr times3_div255
        clc
        adc #3
        sta nboards
        lda ndecoy
        clc
        adc #2
        cmp nboards
        bcc :+
        sta nboards
:       lda nboards
        cmp #7
        bcc :+
        lda #6
        sta nboards
:       sta QB_N
        lda #0                  ; time: 75 - round(25 d / 255) (25 d / 256, rounded)
        sta t1
        lda t3
        asl                     ; d × 8
        rol t1
        asl
        rol t1
        asl
        rol t1
        sta t0
        lda t1                  ; × 3 = d × 24 ...
        sta t2
        lda t0
        asl
        rol t2
        clc
        adc t0
        sta t0
        lda t2
        adc t1
        sta t1
        lda t0                  ; ... + d = d × 25, + 128
        clc
        adc t3
        bcc :+
        inc t1
:       clc
        adc #128
        bcc :+
        inc t1
:       lda #75
        sec
        sbc t1
        sta Q_LIMIT
        ldx pet
        lda spname_lo,x
        sta Q_SPEC
        lda spname_hi,x
        sta Q_SPEC+1
        ; contents: board 0 yours, then the decoy pets, then notes; shuffled into board order
        ldx #0
:       txa
        sta order,x
        inx
        cpx #6
        bne :-
        ldx nboards             ; Fisher-Yates over the boards
        dex
@sh:    beq @shd
        stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda order,x
        pha
        lda order,y
        sta order,x
        pla
        sta order,y
        dex
        jmp @sh
@shd:   ldx #0                  ; board i shows content order[i]: 0 = yours
:       lda order,x
        bne :+
        stx QB_MINE
:       inx
        cpx nboards
        bne :--
        jsr pick_notes
        jsr pick_owners
        ; places: farthest-point sampling over random spots, like src/core/quests.js placeProps
        ldx #0
@pl:    stx t2
        jsr place_one
        ldx t2
        lda bestx
        sta QB_X,x
        lda besty
        sta QB_Y,x
        inx
        cpx nboards
        bne @pl
        ldx #127                ; the board sprites to $e300 (pointers 140, 141)
:       lda board_sprites,x
        sta $e300,x
        dex
        bpl :-
        rts

; A = d (0-255) -> A = round(3 d / 255)
times3_div255:
        sta t0
        lda #0
        sta t1
        lda t0                  ; 3 d (16 bit) + 127
        asl
        rol t1
        clc
        adc t0
        bcc :+
        inc t1
:       clc
        adc #127
        bcc :+
        inc t1
:       sta t0
        ldx #0                  ; / 255
:       lda t0
        sec
        sbc #255
        tay
        lda t1
        sbc #0
        bcc :+
        sta t1
        sty t0
        inx
        bne :-
:       txa
        rts

; Random notes for the note boards (distinct): notes[i] for content ids ndecoy+1.. .
pick_notes:
        ldx #0
:       txa
        sta notes,x
        inx
        cpx #N_NOTES
        bne :-
        ldx #N_NOTES - 1
@s:     beq @d
        stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda notes,x
        pha
        lda notes,y
        sta notes,x
        pla
        sta notes,y
        dex
        jmp @s
@d:     rts

; Other people's pets: species, names (not yours), owners.
pick_owners:
        ldx #0
@o:     cpx ndecoy
        bcs @d
        stx t0
        jsr API_RAND            ; half the time the same species as yours
        bmi :+
        lda pet
        jmp :++
:       lda #N_SPECIES
        jsr API_RMOD
:       ldx t0
        sta dspec,x
@n:     lda #N_NAMES
        jsr API_RMOD
        cmp pname
        beq @n
        ldx t0
        sta dname,x
        lda #N_OWNERS
        jsr API_RMOD
        ldx t0
        sta downer,x
        inx
        bne @o
@d:     rts

; One board's place -> bestx, besty: 40 random spots, the farthest from the boards so far wins.
place_one:
        lda #0
        sta bestd
        sta bestx
        lda #200
        sta tries
@try:   dec tries
        beq @done
        lda #38                 ; x 1-38, y 4-26
        jsr API_RMOD
        clc
        adc #1
        sta bx
        lda #23
        jsr API_RMOD
        clc
        adc #4
        sta by
        jsr spot_ok
        bcc @try
        ldx #0                  ; distance to the nearest board placed so far (Manhattan)
        lda #$ff
        sta t3
@m:     cpx t2
        bcs @md
        lda QB_X,x
        sec
        sbc bx
        bcs :+
        eor #$ff
        adc #1
:       sta t0
        lda QB_Y,x
        sec
        sbc by
        bcs :+
        eor #$ff
        adc #1
:       clc
        adc t0
        cmp t3
        bcs :+
        sta t3
:       inx
        bne @m
@md:    lda t2                  ; the first board: anywhere
        bne :+
        jsr API_RAND
        sta t3
:       lda t3
        cmp bestd
        bcc @next
        sta bestd
        lda bx
        sta bestx
        lda by
        sta besty
@next:  lda tries               ; 40 good candidates are enough
        cmp #160
        bcs @try
        lda bestx
        beq @try
@done:  rts

; bx, by: walkable, open (3 walkable neighbours), away from the player, the station and the elevator. C=1 if fine.
spot_ok:
        ldx bx
        ldy by
        jsr walkable
        bcc @no
        lda #0
        sta t0
        ldx bx
        inx
        ldy by
        jsr walkable
        bcc :+
        inc t0
:       ldx bx
        dex
        ldy by
        jsr walkable
        bcc :+
        inc t0
:       ldx bx
        ldy by
        iny
        jsr walkable
        bcc :+
        inc t0
:       ldx bx
        ldy by
        dey
        jsr walkable
        bcc :+
        inc t0
:       lda t0
        cmp #3
        bcc @no
        lda Q_PX                ; the player (5), the station (4), the elevator (5)
        ldy Q_PY
        ldx #6
        jsr far_from
        bcc @no
        lda Q_SX
        ldy Q_SY
        ldx #5
        jsr far_from
        bcc @no
        lda #20
        ldy #2
        ldx #6
        jmp far_from
@no:    clc
        rts

; A = x, Y = y, X = minimum distance: C=1 if |x - bx| + |y - by| >= X.
far_from:
        stx t1
        sec
        sbc bx
        bcs :+
        eor #$ff
        adc #1
:       sta t0
        tya
        sec
        sbc by
        bcs :+
        eor #$ff
        adc #1
:       clc
        adc t0
        cmp t1
        rts

; X, Y = tile: C=1 if walkable (grid value 1).
walkable:
        cpx #40
        bcs @no
        cpy #28
        bcs @no
        lda #0
        sta p0+1
        tya                     ; y × 40 = y × 32 + y × 8
        asl
        asl
        asl
        sta p0
        asl
        rol p0+1
        asl
        rol p0+1
        clc
        adc p0
        sta p0
        lda p0+1
        adc #0
        sta p0+1
        txa
        clc
        adc p0
        sta p0
        lda p0+1
        adc #>FL_INFO_ADDR
        sta p0+1
        lda p0
        clc
        adc #<FL_INFO_ADDR
        sta p0
        bcc :+
        inc p0+1
:       ldy #0
        lda (p0),y
        cmp #1
        bne @no
        sec
        rts
@no:    clc
        rts

; ---- a board's close-up ----------------------------------------------------------------------------------------------
; A = board: the whole screen, on a white background (the floor code puts black back afterwards).
quest_view:
        tax
        lda order,x
        sta t3                  ; content: 0 yours, 1..ndecoy other pets, then notes
        lda #1
        sta $d021
        lda #11
        sta $d020
        lda #0
        sta COLOR
        jsr API_CLS
        lda #0
        sta COLOR
        lda #<s_board
        ldx #>s_board
        ldy #1
        jsr API_CENTER
        lda #6                  ; the board's frame
        sta COLOR
        lda #38
        sta FILL_W
        lda #20
        sta FILL_H
        ldx #1
        ldy #3
        jsr API_BOX
        lda #0
        sta COLOR
        lda #<s_ok
        ldx #>s_ok
        ldy #24
        jsr API_CENTER
        lda t3
        beq @mine
        cmp ndecoy
        beq :+
        bcc :+
        jmp @note
:       tax                     ; someone else's pet
        dex
        lda dspec,x
        sta t2
        lda dname,x
        sta t1
        lda downer,x
        tax
        lda owner_lo,x
        sta p1
        lda owner_hi,x
        sta p1+1
        jmp @pet
@mine:  lda pet
        sta t2
        lda pname
        sta t1
        lda #<st_name           ; your first name
        sta p1
        lda #>st_name
        sta p1+1
@pet:   jsr draw_photo
        ldx t1                  ; the name in big spaced capitals, blue
        lda pname_lo,x
        sta p0
        lda pname_hi,x
        sta p0+1
        lda #6
        sta COLOR
        lda #19
        sta col
        ldy #0
:       lda (p0),y
        beq :+
        cmp #'a'
        bcc @up
        and #$df
@up:    sty t0
        ldx col
        ldy #6
        jsr API_PUTC
        inc col
        inc col
        ldy t0
        iny
        bne :-
:       lda #2                  ; "<owner>'s <species>" in red
        sta COLOR
        lda #19
        sta col
        ldy #0
:       lda (p1),y
        beq :+
        cmp #' '
        beq :+
        sty t0
        ldx col
        ldy #9
        jsr API_PUTC
        inc col
        ldy t0
        iny
        bne :-
:       lda #$27
        jsr putc_col
        lda #'s'
        jsr putc_col
        lda #' '
        jsr putc_col
        ldx t2
        lda spname_lo,x
        sta p0
        lda spname_hi,x
        sta p0+1
        ldy #0
:       lda (p0),y
        beq :+
        sty t0
        jsr putc_col
        ldy t0
        iny
        bne :-
:       ldx #0                  ; a hand-drawn heart
@h:     lda heart_x,x
        bmi @hd
        sta col
        lda heart_y,x
        sta row
        stx t0
        lda #2
        sta COLOR
        lda #CH_BLOCK
        ldx col
        ldy row
        jsr API_PUTC
        ldx t0
        inx
        bne @h
@hd:    lda #5
        sta COLOR
        lda #<s_best
        sta PTR
        lda #>s_best
        sta PTR+1
        ldx #19
        ldy #17
        jmp API_PRINT
@note:  sec                     ; a note: title and three lines
        sbc ndecoy
        sbc #1
        tax
        lda notes,x
        tax
        lda note_lo,x
        sta p0
        lda note_hi,x
        sta p0+1
        lda #2
        sta COLOR
        lda p0
        ldx p0+1
        ldy #6
        jsr API_CENTER
        lda #0
        sta t1
@l:     jsr next_str
        ldx t1
        lda note_col,x
        sta COLOR
        lda p0
        sta PTR
        lda p0+1
        sta PTR+1
        lda t1
        asl
        clc
        adc #10
        tay
        ldx #5
        jsr API_PRINT
        inc t1
        lda t1
        cmp #3
        bne @l
        lda #6                  ; doodle: a box with an arrow under it
        sta COLOR
        lda #7
        sta FILL_W
        lda #4
        sta FILL_H
        ldx #29
        ldy #10
        jsr API_BOX
        lda #5
        sta COLOR
        lda #'|'
        ldx #32
        ldy #14
        jsr API_PUTC
        lda #'v'
        ldx #32
        ldy #15
        jmp API_PUTC

; p0 -> the string after the current one.
next_str:
        ldy #0
:       lda (p0),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc p0
        sta p0
        bcc :+
        inc p0+1
:       rts

putc_col:
        ldx col
        ldy #9
        jsr API_PUTC
        inc col
        rts

; t2 = species: the 12 × 12 photo taped at columns 4-15, rows 5-16.
draw_photo:
        lda #4                  ; the photo's edge
        sta COLOR
        lda #14
        sta FILL_W
        lda #14
        sta FILL_H
        ldx #3
        ldy #4
        jsr API_BOX
        lda #7                  ; tape
        sta COLOR
        lda #4
        sta FILL_W
        lda #1
        sta FILL_H
        lda #CH_BLOCK
        ldx #8
        ldy #4
        jsr API_FILL
        ldx t2
        lda petmap_lo,x
        sta p0
        lda petmap_hi,x
        sta p0+1
        lda petcol_lo,x
        sta p1
        lda petcol_hi,x
        sta p1+1
        jsr API_RAND            ; one of the species' colours
        and #3
        tay
        lda (p1),y
        sta t0                  ; pet colour
        lda #0
        sta row
@r:     lda #0
        sta col
@c:     lda row                 ; map[row * 12 + col]
        asl
        adc row
        asl
        asl
        adc col
        tay
        lda (p0),y
        cmp #'.'
        beq @next
        cmp #'w'
        beq @next               ; white: the background
        ldx #0
        cmp #'k'
        beq @put
        ldx #2
        cmp #'p'
        beq @put
        ldx t0
@put:   stx COLOR
        lda col
        clc
        adc #4
        tax
        lda row
        clc
        adc #5
        tay
        lda #CH_BLOCK
        jsr API_PUTC
@next:  inc col
        lda col
        cmp #12
        bne @c
        inc row
        lda row
        cmp #12
        bne @r
        rts

; ---- the desk part: log back in -------------------------------------------------------------------------------------
init:
        lda #0
        sta attempt
        sta wrong
        sta focus
        sta welcome
        sta done
        sta prevkey
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        ; six suggestions: your pet's name, the other pets' names, then random names; shuffled
        lda pname
        sta opt
        ldx #0
:       cpx ndecoy
        bcs :+
        lda dname,x
        sta opt+1,x
        inx
        bne :-
:       inx
        stx t3                  ; filled
@fill:  lda t3
        cmp #OPTIONS
        bcs @shuf
        lda #N_NAMES
        jsr API_RMOD
        ldx #0
:       cpx t3
        bcs :+
        cmp opt,x
        beq @fill
        inx
        bne :-
:       ldx t3
        sta opt,x
        inc t3
        bne @fill
@shuf:  ldx #OPTIONS - 1
@s:     stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda opt,x
        pha
        lda opt,y
        sta opt,x
        pla
        sta opt,y
        dex
        bne @s
        ldx #OPTIONS - 1
:       lda opt,x
        cmp pname
        beq :+
        dex
        bpl :-
:       stx right
        ; the screen
        text 1, 0, s_name, 7
        jsr draw_attempts
        lda #6
        sta COLOR
        lda #36
        sta FILL_W
        lda #18
        sta FILL_H
        ldx #2
        ldy #2
        jsr API_BOX
        text 4, 4, s_user, 1
        lda #<login
        sta PTR
        lda #>login
        sta PTR+1
        jsr make_login
        lda #1
        sta COLOR
        ldx #10
        ldy #4
        jsr API_PRINT
        jsr draw_hint
        text 4, 8, s_autofill, 3
        jsr draw_options
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        lda #<(29 * 50)         ; byDiff(d, 30, 20): 29 s on floors 1-2
        ldx #>(29 * 50)
        jmp timer_start

; Your login: the name in lower case letters and digits, at most 12 ("newhire" if none).
make_login:
        ldx #0
        ldy #0
@n:     lda st_name,x
        beq @d
        inx
        cmp #'A'
        bcc @dig
        cmp #'Z' + 1
        bcs :+
        ora #$20
        bne @add
:       cmp #'a'
        bcc @n
        cmp #'z' + 1
        bcs @n
        bcc @add
@dig:   cmp #'0'
        bcc @n
        cmp #'9' + 1
        bcs @n
@add:   sta login,y
        iny
        cpy #12
        bne @n
@d:     cpy #0
        bne :+
        ldy #0
@nh:    lda s_newhire,y
        sta login,y
        beq @x
        iny
        bne @nh
:       lda #0
        sta login,y
@x:     rts

draw_hint:
        lda welcome
        beq :+
        text 4, 5, s_logging, 5
        rts
:       text 4, 5, s_hint, 3
        ldx pet                 ; "Hint: my <species>'s name"
        lda spname_lo,x
        sta PTR
        lda spname_hi,x
        sta PTR+1
        ldx #13
        ldy #5
        jsr API_PRINT
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #13
        tax
        lda #<s_hint2
        sta PTR
        lda #>s_hint2
        sta PTR+1
        ldy #5
        jsr API_PRINT
        lda Q_SEEN
        beq :+
        text 4, 6, s_remember, 7
        rts
:       text 4, 6, s_ifonly, 6
        rts

draw_attempts:
        text 25, 0, s_attempts, 1
        lda #3
        sec
        sbc attempt
        ldx #39
        ldy #0
        jmp API_NUM

; Two columns of three: "k ***** Name".
draw_options:
        lda #0
        sta t1
@o:     ldx t1
        lda #6                  ; idle blue, focus yellow, tried red, the right one green when logging in
        cpx focus
        bne :+
        lda #7
:       lda wrong
        and bit_of,x
        beq :+
        lda #2
        bne @c
:       cpx focus
        bne :+
        lda #7
        bne @c
:       lda welcome
        beq :+
        cpx right
        bne :+
        lda #5
        bne @c
:       lda #6
@c:     sta COLOR
        lda opt_x,x
        sta col
        lda opt_y,x
        sta row
        lda #17
        sta FILL_W
        lda #3
        sta FILL_H
        ldx col
        ldy row
        jsr API_BOX
        inc row
        lda #1
        sta COLOR
        lda t1
        clc
        adc #'1'
        ldx col
        inx
        ldy row
        jsr API_PUTC
        ldx t1                  ; stars: up to 4, for the name's length
        lda opt,x
        tax
        lda pname_lo,x
        sta PTR
        lda pname_hi,x
        sta PTR+1
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        cpy #4
        bne :-
:       sty t2
        ldy #0
:       cpy t2
        beq :+
        sty t0
        tya
        clc
        adc col
        adc #3
        tax
        ldy row
        lda #'*'
        jsr API_PUTC
        ldy t0
        iny
        bne :-
:       lda col
        clc
        adc #8
        tax
        ldy row
        jsr API_PRINT
        inc t1
        lda t1
        cmp #OPTIONS
        beq :+
        jmp @o
:       rts

; One frame. C=1 when over.
frame:
        lda done
        beq :+
        sec
        rts
:       lda welcome
        beq @play
        dec welcome
        bne @wait
        ldx attempt             ; score = attempt score × (0.75 + 0.25 × speed)
        lda att_score,x
        sta t0
        lda Q_SPEED
        lsr
        lsr
        clc
        adc #192                ; (192 + speed / 4) / 256
        sta t1
        jsr mul8                ; t0 × t1 / 256
        jmp finish
@wait:  clc
        rts
@play:  jsr timer_tick
        bcc :+
        lda #0
        jmp finish
:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #40
        bne :+
        lda right
        jmp pick
:
.endif
        jsr key16               ; keys 1-6
        cmp #OPTIONS
        bcs :+
        jmp pick
:       lda focus
        sta t3
        lda JOYP
        and #J_RIGHT | J_LEFT
        beq :+
        lda focus
        eor #1
        sta focus
        jmp @moved
:       lda JOYP
        and #J_DOWN
        beq :+
        lda focus
        clc
        adc #2
        cmp #OPTIONS
        bcc @set
        and #1
        jmp @set
:       lda JOYP
        and #J_UP
        beq :+
        lda focus
        sec
        sbc #2
        bcs @set
        adc #OPTIONS
        jmp @set
:       lda JOYP
        and #J_FIRE
        beq @out
        lda focus
        jmp pick
@set:   sta focus
@moved: lda #SFX_BLIP
        jsr API_SFX
        jsr draw_options
@out:   clc
        rts

; A = option picked.
pick:   tax
        lda wrong
        and bit_of,x
        beq :+
        clc                     ; tried already
        rts
:       cpx right
        bne @wrong
        lda #SFX_GOOD
        jsr API_SFX
        lda #WELCOME_T
        sta welcome
        jsr draw_hint
        jsr draw_options
        lda #5
        ldx #<s_welcomeback
        ldy #>s_welcomeback
        jsr message
        clc
        rts
@wrong: lda wrong
        ora bit_of,x
        sta wrong
        inc attempt
        lda #SFX_BAD
        jsr API_SFX
        jsr draw_attempts
        jsr draw_options
        lda attempt
        cmp #3
        bcc :+
        lda #2
        ldx #<s_locked
        ldy #>s_locked
        jsr message
        lda #0
        jmp finish
:       lda #2                  ; "Incorrect password (n left)"
        ldx #<s_incorrect
        ldy #>s_incorrect
        jsr message
        lda #3
        sec
        sbc attempt
        ldx #31
        ldy #21
        jsr API_NUM
        clc
        rts

; A = colour, X/Y = text: centred on row 21.
message:
        sta COLOR
        stx PTR
        sty PTR+1
        lda #38
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #1
        ldy #21
        jsr API_FILL
        lda PTR
        ldx PTR+1
        ldy #21
        jmp API_CENTER

; A = score 0-255.
finish: sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; t0 × t1 / 256 -> A
mul8:   lda #0
        ldx #8
:       lsr t1
        bcc :+
        clc
        adc t0
:       ror
        dex
        bne :--
        rts

; Keys 1-6 held (KERNAL matrix codes), edge-detected: A = 0-5, or $ff.
key16:  lda $cb
        cmp prevkey
        beq @none
        sta prevkey
        ldx #OPTIONS - 1
:       cmp key6_codes,x
        beq :+
        dex
        bpl :-
:       txa
        rts
@none:  lda #$ff
        rts

.rodata
s_name:      .byte "Lost Password", 0
s_help:      .byte "Log back in with your pet's name.", 0
s_board:     .byte "Whiteboard", 0
s_ok:        .byte "FIRE: OK", 0
s_best:      .byte "best colleague ever", 0
s_user:      .byte "user:", 0
s_hint:      .byte "Hint: my", 0
s_hint2:     .byte "'s name", 0
s_logging:   .byte "Logging in...                ", 0
s_remember:  .byte "You remember the photo...", 0
s_ifonly:    .byte "If only you could remember...", 0
s_autofill:  .byte "Autofill suggestions:", 0
s_attempts:  .byte "Attempts left:", 0
s_keys:      .byte "Joystick + FIRE, or keys 1-6", 0
s_welcomeback: .byte "Welcome back!", 0
s_locked:    .byte "Account locked. Call IT.", 0
s_incorrect: .byte "Incorrect password (  left)", 0
s_newhire:   .byte "newhire", 0
att_score:   .byte 255, 140, 77         ; 1, 0.55, 0.3
bit_of:      .byte 1, 2, 4, 8, 16, 32
opt_x:       .byte 3, 20, 3, 20, 3, 20
opt_y:       .byte OPT_Y, OPT_Y, OPT_Y + 3, OPT_Y + 3, OPT_Y + 6, OPT_Y + 6
key6_codes:   .byte 56, 59, 8, 11, 16, 19
note_col:    .byte 6, 5, 0
heart_x:     .byte 20, 22, 19, 20, 21, 22, 23, 20, 21, 22, 21, $ff
heart_y:     .byte 12, 12, 13, 13, 13, 13, 13, 14, 14, 14, 15

.include "gen/mg_lostpw_data.s"

.bss
order:       .res 6                     ; board -> content
notes:       .res 10
dspec:       .res 3
dname:       .res 3
downer:      .res 3
opt:         .res OPTIONS
login:       .res 13
