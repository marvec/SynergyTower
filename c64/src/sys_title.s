; Title screen, career setup and the street intro (src/scenes/title.js, setup.js, exterior.js) as an overlay
; at $4000. Called with A = 1 if the disk holds a career. Returns A = 1 for a new career (names and looks
; written to the state block, the intro shown), A = 0 to continue the saved one.

.include "api.inc"
.include "state.inc"
.include "gen/chars.inc"

SPR0    = $e000 / 64 - $c000 / 64     ; sprite pointer of the first person frame (128)
PORTRAIT = SPR0 + 12                  ; the badge portraits, copied to $e300
K_RETURN = 13
K_DEL    = 20
K_UP     = 145
K_DOWN   = 17
K_LEFT   = 157
K_RIGHT  = 29
K_STOP   = 3

.zeropage
have:     .res 1
sel:      .res 1                ; menu / setup focus
nsel:     .res 1
p0:       .res 2
p1:       .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
joy:      .res 1                ; port 2, held (bits as JOY)
joyp:     .res 1                ; pressed this frame
key:      .res 1
fire:     .res 1                ; FIRE / RETURN / SPACE this frame
cycle:    .res 1
ccol:     .res 1                ; corp colour shown on the title
off:      .res 1                ; intro: scene row at the top of the screen
px:       .res 2                ; intro: player x
anim:     .res 1
col:      .res 1
row:      .res 1
len:      .res 1
wbase:    .res 2
auto:     .res 1

.segment "CODE"
        jmp title_main
        jmp hair_to_floor       ; $4003: just your hair's sprite frames (test careers skip the title)

title_main:
        sta have
        lda #0
        sta cycle
        sta t0
        ldx #2                  ; the title music
        jsr API_SONG
        lda #0
        sta $d015
        sta $d017
        sta $d01d
@title: jsr draw_title
        jsr menu
        cmp #$ff
        beq @title
        cmp #0
        bne :+
        lda have
        beq @new                ; no save: the first button starts a career
        jmp @cont
:       cmp #1
        beq @new
        jsr how_to              ; 2
        jmp @title
@cont:  lda st_intro
        bne :+
        jsr intro
        lda #1
        sta st_intro
:       jsr hair_to_floor
        lda #0
        rts
@new:   jsr setup
        bcc @title              ; RUN/STOP: back to the title
        jsr intro
        jsr hair_to_floor
        lda #1
        rts

; Your hair style's four frames (down, up, left, right) for the floor's hair sprite: to $fd00 (pointers 244-247,
; RAM under the KERNAL that no overlay uses).
hair_to_floor:
        lda #$ff                ; (the badge made sprite 0 the only multicolour one)
        sta $d01c
        lda st_hstyle           ; style × 256 (4 frames × 64 bytes): + style to the high byte
        and #3
        clc
        adc #>hair_frames
        sta p0+1
        lda #<hair_frames
        sta p0
        ldy #0
:       lda (p0),y
        sta $fd00,y
        iny
        bne :-
        rts

; ---- input: joystick port 2 + keyboard buffer (letters stay letters while typing) ---------------------------
poll:
        jsr API_WAIT
        lda $dc00
        eor #$ff
        and #$1f
        tax
        eor joy
        stx joy
        and joy
        sta joyp
        jsr API_KEY
        sta key
        lda #0
        sta fire
        lda joyp
        and #J_FIRE
        bne @f
        lda key
        cmp #K_RETURN
        beq @f
        cmp #' '
        bne @k
@f:     inc fire
@k:     lda key                 ; cursor keys as joystick presses
        cmp #K_UP
        bne :+
        lda #J_UP
        bne @or
:       cmp #K_DOWN
        bne :+
        lda #J_DOWN
        bne @or
:       cmp #K_LEFT
        bne :+
        lda #J_LEFT
        bne @or
:       cmp #K_RIGHT
        bne :+
        lda #J_RIGHT
@or:    ora joyp
        sta joyp
:       rts

; ---- title ---------------------------------------------------------------------------------------------------
draw_title:
        lda #0
        sta COLOR
        jsr API_CLS
        lda #0
        sta $d020
        jsr skyline
        lda #7                  ; SYNERGY (gold), TOWER (white)
        sta COLOR
        lda #logo_a_W
        sta wbase
        lda #<logo_a0
        ldx #>logo_a0
        ldy #2
        jsr logo_rows
        lda #1
        sta COLOR
        lda #logo_b_W
        sta wbase
        lda #<logo_b0
        ldx #>logo_b0
        ldy #7
        jsr logo_rows
        ldx #1
        ldy #12
        lda #4
        jsr text_at
        .word s_climb
        ldx #1
        ldy #13
        lda #7
        jsr text_at
        .word s_disk
        lda have
        beq :+
        jsr save_info
:       ldx #0
        ldy #22
        lda #3
        jsr text_at
        .word s_footer
        ldx #0
        ldy #23
        lda #1
        jsr text_at
        .word s_tip
        ldx #0
        ldy #24
        lda #1
        jsr text_at
        .word s_feedback
        rts

; The 4 rows of a logo map (width in wbase) at column 1. A/X = row 0, Y = screen row.
logo_rows:
        sta p0
        stx p0+1
        sty row
        ldx #4
@r:     stx t2
        lda p0
        sta PTR
        lda p0+1
        sta PTR+1
        ldy #0                  ; print the row's chars one by one (codes 241-255 are the quarter blocks)
@c:     lda (PTR),y
        sty t1
        pha
        tya
        clc
        adc #1
        tax
        ldy row
        pla
        jsr API_PUTC
        ldy t1
        iny
        cpy wbase
        bne @c
        lda p0                  ; next row: + width
        clc
        adc wbase
        sta p0
        bcc :+
        inc p0+1
:       inc row
        ldx t2
        dex
        bne @r
        rts

; The skyline and the corp's tower on the right; the sign shows the corp (or cycles the colours).
skyline:
        lda have
        beq :+
        ldx st_color
        lda color_c64,x
        sta ccol
        jmp @draw
:       ldx cycle
        lda color_c64,x
@draw:  and #7                  ; (hires cells: colours 0-7)
        sta ccol
        ldx #24                 ; buildings: dark blocks
@b:     txa
        and #3
        clc
        adc #17
        tay                     ; top row of this column
        lda #6
        sta COLOR
@col:   stx t0
        sty t1
        lda #CH_CHECKER
        jsr API_PUTC
        ldx t0
        ldy t1
        iny
        cpy #22
        bne @col
        inx
        cpx #40
        bne @b
        ldx #30                 ; the tower: corp colour, lit windows (behind the text rows 11-14)
@t:     ldy #3
@ty:    cpy #11
        bcc :+
        cpy #15
        bcs :+
        ldy #15
:       stx t0
        sty t1
        lda ccol
        sta COLOR
        lda #CH_BLOCK
        txa
        and #1
        beq :+
        tya
        and #1
        bne :+
        lda #7                  ; a lit window
        sta COLOR
        lda #CH_HALF
        bne :++
:       lda #CH_BLOCK
:       ldx t0
        ldy t1
        jsr API_PUTC
        ldx t0
        ldy t1
        iny
        cpy #22
        bne @ty
        inx
        cpx #36
        bne @t
        lda #1                  ; the sign above the tower
        sta COLOR
        lda #24
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #16
        ldy #1
        jsr API_FILL
        lda #17
        sta col
        lda #1
        sta row
        lda have
        beq :+
        lda #<st_corp
        sta PTR
        lda #>st_corp
        sta PTR+1
        jmp print_after
:       ldx cycle
        lda cname_lo,x
        sta PTR
        lda cname_hi,x
        sta PTR+1
        jsr print_after
        lda #<s_corp
        sta PTR
        lda #>s_corp
        sta PTR+1
        jmp print_after

; "name - title - F<max>"
save_info:
        lda #3
        sta COLOR
        lda #1
        sta col
        lda #14
        sta row
        lda #<st_name
        sta PTR
        lda #>st_name
        sta PTR+1
        jsr print_after
        lda #<s_sep
        sta PTR
        lda #>s_sep
        sta PTR+1
        jsr print_after
        ldx st_max
        lda ttl_lo-1,x
        sta PTR
        lda ttl_hi-1,x
        sta PTR+1
        jsr print_after
        lda #<s_sepf
        sta PTR
        lda #>s_sepf
        sta PTR+1
        jsr print_after
        lda st_max
        ldx col
        ldy row
        jmp API_NUM

; Print PTR right after the last print (col, row kept by text_at / print_after).
print_after:
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       sty len
        ldx col
        ldy row
        jsr API_PRINT
        lda col
        clc
        adc len
        sta col
        rts

; X = column, Y = row, A = colour, the word after the JSR = string.
text_at:
        sta COLOR
        stx col
        sty row
        pla
        sta p1
        pla
        sta p1+1
        ldy #1
        lda (p1),y
        sta PTR
        iny
        lda (p1),y
        sta PTR+1
        lda p1
        clc
        adc #2
        tax
        lda p1+1
        adc #0
        pha
        txa
        pha
        jmp print_after

; The menu: returns A = 0 continue / start, 1 new career, 2 how to play ($ff: redraw).
menu:
        lda #0
        sta sel
        lda #3
        ldx have
        bne :+
        lda #2                  ; no save: start your career, how to play
:       sta nsel
@draw:  ldx #0
@b:     stx t2
        txa
        clc
        adc #16
        sta row
        lda #20
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #2
        ldy row
        jsr API_FILL
        ldx t2
        lda #1
        cpx sel
        bne :+
        lda #7
:       sta COLOR
        cpx sel
        bne :+
        lda #CH_ARROW
        ldx #2
        ldy row
        jsr API_PUTC
:       ldx t2                  ; label
        lda have
        bne :+
        inx                     ; (no save: skip "Continue career")
:       lda menu_lo,x
        sta PTR
        lda menu_hi,x
        sta PTR+1
        lda have
        bne :+
        cpx #1
        bne :+
        lda #<s_start
        sta PTR
        lda #>s_start
        sta PTR+1
:       ldx #4
        ldy row
        jsr API_PRINT
        ldx t2
        inx
        cpx nsel
        bne @b
@loop:  jsr poll
        inc t0                  ; every 3 s a new colour on the sign (no save)
        lda t0
        cmp #150
        bne :+
        lda #0
        sta t0
        lda have
        bne :+
        inc cycle
        lda cycle
        cmp #N_COLORS
        bcc @sk
        lda #0
        sta cycle
@sk:    jsr skyline
:       lda key                 ; M: music on / off
        cmp #'M'
        bne :+
        lda st_music
        eor #1
        sta st_music
        ldx #2
        jsr API_SONG
:       lda fire
        bne @pick
        lda joyp
        and #J_UP
        beq :+
        lda sel
        beq @loop
        dec sel
        jmp @moved
:       lda joyp
        and #J_DOWN
        beq @loop
        ldx sel
        inx
        cpx nsel
        bcs @loop
        stx sel
@moved: lda #SFX_BLIP
        jsr API_SFX
        jmp @draw
@pick:  lda #SFX_BLIP
        jsr API_SFX
        lda sel
        ldx have
        bne :+
        cmp #0                  ; no save: 0 = start (new), 1 = how to play
        beq @n
        lda #2
        rts
@n:     lda #1
        rts
:       rts

how_to:
        lda #0
        sta COLOR
        jsr API_CLS
        lda #7
        sta COLOR
        lda #<s_howtitle
        ldx #>s_howtitle
        ldy #1
        jsr API_CENTER
        lda #3
        sta row
        ldx #0
@p:     stx t2
        lda howto_lo,x
        sta PTR
        lda howto_hi,x
        sta PTR+1
        lda #1
        sta COLOR
        jsr wrap
        inc row
        ldx t2
        inx
        cpx #N_HOWTO
        bne @p
        lda #5
        sta COLOR
        lda #<s_pressfire
        ldx #>s_pressfire
        ldy #24
        jsr API_CENTER
:       jsr poll
        lda fire
        bne :+
        lda key
        cmp #K_STOP
        bne :-
:       rts

; PTR = text, wrapped into columns 1-38 from `row` (row ends after it).
wrap:
        lda #1
        sta col
        ldy #0
@word:  sty t0
        ldx #0
@m:     lda (PTR),y
        beq @me
        cmp #' '
        beq @me
        inx
        iny
        bne @m
@me:    txa
        clc
        adc col
        cmp #39
        bcc :+
        lda #1
        sta col
        inc row
:       ldy t0
@pc:    cpx #0
        beq @sep
        lda (PTR),y
        stx t1
        sty t0
        ldx col
        ldy row
        jsr API_PUTC
        inc col
        ldx t1
        ldy t0
        iny
        dex
        jmp @pc
@sep:   lda (PTR),y
        beq @end
        iny
        inc col
        jmp @word
@end:   inc row
        rts

; ---- setup ---------------------------------------------------------------------------------------------------
; Fields: 0 corp name, 1 your name, 2 colour, 3 skin, 4 hair colour, 5 hair style, 6 start. C=1 when started.
setup:
        jsr API_RAND            ; a corp name to start from
        and #15
        cmp #N_CORPS
        bcc :+
        sbc #N_CORPS
:       tax
        lda corpn_lo,x
        sta p0
        lda corpn_hi,x
        sta p0+1
        ldy #0
:       lda (p0),y
        sta st_corp,y
        beq :+
        iny
        bne :-
:       lda #0
        sta st_name
        sta st_color
        sta st_skin
        sta st_hair
        sta st_hstyle
        sta sel
        sta err
        ldx #0                  ; the badge portraits to $e300 (sprite pointers 140-143)
:       lda portraits,x
        sta $e300,x
        inx
        bne :-
@redraw:
        jsr draw_setup
@loop:  jsr poll
        jsr cursor_blink
        lda key
        cmp #K_STOP
        bne :+
        lda #0
        sta $d015
        clc
        rts
:       lda sel                 ; text fields take the typed keys
        cmp #2
        bcs @nav
        lda key
        beq @nav
        cmp #K_DEL
        bne :+
        jsr del_char
        jmp @redraw
:       jsr petscii_ascii
        beq @nav
        jsr add_char
        jmp @redraw
@nav:   lda fire
        beq @nofire
        lda sel
        cmp #6
        beq @start
        inc sel                 ; RETURN / FIRE: next field
        jmp @moved
@nofire:
        lda joyp
        and #J_UP
        beq :+
        lda sel
        beq @loop
        dec sel
        jmp @moved
:       lda joyp
        and #J_DOWN
        beq :+
        lda sel
        cmp #6
        beq @loop
        inc sel
        jmp @moved
:       lda joyp
        and #J_LEFT | J_RIGHT
        beq @loop
        jsr change
@moved: lda #SFX_BLIP
        jsr API_SFX
        jmp @redraw
@start: lda st_corp             ; names needed
        bne :+
        lda #1
        sta err
        lda #0
        sta sel
        jmp @bad
:       lda st_name
        bne :+
        lda #2
        sta err
        lda #1
        sta sel
@bad:   lda #SFX_BAD
        jsr API_SFX
        jmp @redraw
:       lda #0
        sta $d015
        sta $d017
        sta $d01d
        lda #SFX_GOOD
        jsr API_SFX
        sec
        rts

; Left/right on a choice field.
change:
        ldx sel
        lda joyp
        and #J_LEFT
        bne @left
        lda choice_ptr - 2,x    ; right: +1, wrapping at the count
        tay
        lda ST_BASE,y
        clc
        adc #1
        cmp choice_n - 2,x
        bcc :+
        lda #0
:       sta ST_BASE,y
        rts
@left:  lda choice_ptr - 2,x
        tay
        lda ST_BASE,y
        bne :+
        lda choice_n - 2,x
:       sec
        sbc #1
        sta ST_BASE,y
        rts
choice_ptr: .byte ST::color, ST::skin, ST::hair, ST::hstyle
choice_n:   .byte N_COLORS, N_SKINS, N_HAIRS, 4

; The focused text field: PT = its buffer, A = its max length.
field_buf:
        lda sel
        bne :+
        lda #<st_corp
        sta p0
        lda #>st_corp
        sta p0+1
        lda #CORP_LEN
        rts
:       lda #<st_name
        sta p0
        lda #>st_name
        sta p0+1
        lda #NAME_LEN
        rts

; A = ASCII char: append to the focused field.
add_char:
        sta t1
        jsr field_buf
        sta t2
        ldy #0
:       lda (p0),y
        beq :+
        iny
        bne :-
:       cpy t2
        bcs @full
        lda t1
        sta (p0),y
        iny
        lda #0
        sta (p0),y
@full:  rts

del_char:
        jsr field_buf
        ldy #0
:       lda (p0),y
        beq :+
        iny
        bne :-
:       cpy #0
        beq :+
        dey
        lda #0
        sta (p0),y
:       rts

; A = PETSCII key -> A = ASCII (Z=1 if not a name character).
petscii_ascii:
        cmp #65
        bcc @low
        cmp #91
        bcs :+
        ora #$20                ; unshifted letter -> lower case
        rts
:       cmp #193
        bcc @no
        cmp #219
        bcs @no
        and #$7f                ; shifted letter -> upper case
        rts
@low:   cmp #32
        bcc @no
        cmp #'"'
        beq @no
        rts                     ; digits, space, punctuation
@no:    lda #0
        rts

cursor_blink:
        lda sel
        cmp #2
        bcs @done
        jsr field_buf
        ldy #0
:       lda (p0),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #14
        tax
        lda sel
        asl
        adc #3
        tay
        lda #7
        sta COLOR
        lda $a2                 ; KERNAL jiffy clock: blink
        and #16
        beq :+
        lda #CH_CURSOR
        .byte $2c
:       lda #' '
        jmp API_PUTC
@done:  rts

draw_setup:
        lda #0
        sta COLOR
        jsr API_CLS
        lda #7
        sta COLOR
        lda #<s_newcareer
        ldx #>s_newcareer
        ldy #1
        jsr API_CENTER
        ldx #0                  ; labels
@l:     stx t2
        lda #1
        cpx sel
        bne :+
        lda #7
:       sta COLOR
        cpx sel
        bne :+
        txa
        asl
        adc #3
        tay
        lda #CH_ARROW
        ldx #0
        jsr API_PUTC
        ldx t2
:       lda label_lo,x
        sta PTR
        lda label_hi,x
        sta PTR+1
        txa
        asl
        adc #3
        tay
        ldx #1
        jsr API_PRINT
        ldx t2
        inx
        cpx #7
        bne @l
        lda #3                  ; values
        sta COLOR
        lda #<st_corp
        sta PTR
        lda #>st_corp
        sta PTR+1
        ldx #14
        ldy #3
        jsr API_PRINT
        lda #<st_name
        sta PTR
        lda #>st_name
        sta PTR+1
        ldx #14
        ldy #5
        jsr API_PRINT
        lda st_name             ; placeholder
        bne :+
        lda #6
        sta COLOR
        lda #<s_yourname
        sta PTR
        lda #>s_yourname
        sta PTR+1
        ldx #15
        ldy #5
        jsr API_PRINT
        lda #3
        sta COLOR
:       ldx st_color            ; "<name> (<hint>)"
        lda cname_lo,x
        sta PTR
        lda cname_hi,x
        sta PTR+1
        lda #14
        sta col
        lda #7
        sta row
        jsr print_after
        lda #' '
        ldx col
        ldy row
        jsr API_PUTC
        inc col
        ldx st_color
        lda chint_lo,x
        sta PTR
        lda chint_hi,x
        sta PTR+1
        jsr print_after
        lda st_skin             ; n / count
        ldx #N_SKINS
        ldy #9
        jsr of_n
        lda st_hair
        ldx #N_HAIRS
        ldy #11
        jsr of_n
        lda st_hstyle           ; A-D
        clc
        adc #'A'
        ldx #14
        ldy #13
        jsr API_PUTC
        lda #15
        sta COLOR
        lda #<s_hint
        ldx #>s_hint
        ldy #17
        jsr API_CENTER
        lda err
        beq :+
        tax
        lda #2
        sta COLOR
        lda err_lo-1,x
        pha
        lda err_hi-1,x
        tax
        pla
        ldy #16
        jsr API_CENTER
:       jmp badge

; A = value (0-based), X = count, Y = row: "n/count" at column 14.
of_n:
        sty row
        stx t1
        clc
        adc #1
        ldx #14
        jsr API_NUM
        lda #'/'
        ldx #15
        ldy row
        jsr API_PUTC
        lda t1
        ldx #16
        ldy row
        jmp API_NUM

; The badge: rows 18-24, portrait sprite on the left.
badge:
        ldx st_color
        lda color_c64,x
        and #7
        bne :+
        lda #6
:       sta COLOR
        lda #26
        sta FILL_W
        lda #7
        sta FILL_H
        ldx #7
        ldy #18
        jsr API_BOX
        lda #7
        sta COLOR
        lda #<st_corp
        sta PTR
        lda #>st_corp
        sta PTR+1
        ldx #9
        ldy #18
        jsr API_PRINT
        lda #15 & 7
        sta COLOR
        ldx #20
        ldy #19
        lda #1
        jsr text_at
        .word s_empid
        lda #<st_name
        sta PTR
        lda #>st_name
        sta PTR+1
        lda #7
        sta COLOR
        ldx #13
        ldy #20
        jsr API_PRINT
        ldx #13
        ldy #21
        lda #1
        jsr text_at
        .word s_intern
        ldx #13
        ldy #22
        lda #3
        jsr text_at
        .word s_floor1
        ldx #13
        ldy #23
        lda #3
        jsr text_at
        .word s_clearance
        ldx #9
        ldy #24
        lda #1
        jsr text_at
        .word s_barcode
        ; the portrait: sprite 0 expanded, hair = $d025, skin = $d026, shirt = corp colour
        lda #PORTRAIT
        clc
        adc st_hstyle
        sta $c3f8
        ldx st_hair
        lda hair_c64,x
        sta $d025
        ldx st_skin
        lda skin_c64,x
        sta $d026
        ldx st_color
        lda color_c64,x
        sta $d027
        lda #24 + 8 * 8 + 2
        sta $d000
        lda #0
        sta $d010
        lda #50 + 19 * 8 + 1
        sta $d001
        lda #1
        sta $d017
        sta $d01d
        sta $d01c
        sta $d015
        rts

; ---- the street: pan down the tower, walk to the door ----------------------------------------------------------
SCENE_H = 64                    ; scene rows: sky, the tower's 40 floors, the street
STREET  = SCENE_H - 4           ; first street row (pavement)
DOOR_X  = 19                    ; the entrance (columns 19-20)

intro:
        lda #0
        sta $d015
        sta $d017
        sta $d01d
        sta off
        lda #0                  ; default colours back (the badge used them)
        sta $d025
        lda #10
        sta $d026
        ldx #0                  ; the floor music
        jsr API_SONG
@pan:   jsr draw_scene
        lda #<s_banner1         ; "<corp> Tower - 40 floors - 1 corner office"
        jsr banner
        ldx #4
:       jsr poll
        lda fire
        bne @walk               ; FIRE skips the pan
        dex
        bne :-
        inc off
        lda off
        cmp #SCENE_H - 25 + 1
        bcc @pan
@walk:  lda #SCENE_H - 25
        sta off
        jsr draw_scene
        lda #<40                ; the player comes from the left on the pavement
        sta px
        lda #0
        sta px+1
        lda #0
        sta anim
        lda #15
        sta $d027
        lda #9                  ; facing right
        sta t2
        lda #1
        sta $d015
        lda #0
        sta auto
@step:  jsr poll
        jsr API_INPUT           ; held directions from the joystick and the keyboard (WASD / cursor keys)
        lda auto                ; FIRE walks to the door by itself (like a click in the browser)
        bne @right
        lda JOY
        and #J_RIGHT
        beq :+
@right: jsr walk_right
:       lda JOY
        and #J_LEFT
        beq :+
        jsr walk_left
:       jsr place_player
        jsr door_hint
        lda px                  ; at the door: FIRE / up enters
        cmp #DOOR_X * 8 + 24 - 6
        bcc @away
        cmp #DOOR_X * 8 + 24 + 14
        bcs @away
        lda auto
        bne @enter
        lda fire
        bne @enter
        lda joyp
        and #J_UP
        beq @step
        bne @enter
@away:  lda fire
        beq @step
        sta auto
        jmp @step
@enter: lda #SFX_GOOD           ; the door
        jsr API_SFX
        ldx #20                 ; walk in
:       dec $d001
        jsr API_WAIT
        jsr API_WAIT
        dex
        bne :-
        lda #0
        sta $d015
        rts

walk_right:
        inc px
        bne :+
        inc px+1
:       lda px+1
        beq :+
        lda #0
        sta px+1
        lda #255
        sta px
:       inc anim
        lda #9                  ; facing right
        sta t2
        rts
walk_left:
        lda px
        cmp #24
        bcc :+
        dec px
:       inc anim
        lda #6                  ; facing left
        sta t2
        rts

place_player:
        lda px
        sta $d000
        lda #0
        sta $d010
        lda #50 + 22 * 8 - 1    ; feet on the pavement
        sta $d001
        lda anim                ; frame: facing + step
        lsr
        lsr
        lsr
        and #1
        clc
        adc #1
        ldx JOY
        bne :+
        ldx auto
        bne :+
        lda #0
:       clc
        adc t2
        adc #SPR0
        sta $c3f8
        rts

; Row 0: where to go.
door_hint:
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #0
        sta COLOR
        lda #' '
        ldx #0
        ldy #0
        jsr API_FILL
        lda px
        cmp #DOOR_X * 8 + 24 - 6
        bcc :+
        cmp #DOOR_X * 8 + 24 + 14
        bcs :+
        lda #7
        sta COLOR
        lda #<s_enter
        ldx #>s_enter
        ldy #0
        jmp API_CENTER
:       lda #1
        sta COLOR
        lda #<s_walk
        ldx #>s_walk
        ldy #0
        jmp API_CENTER

; A = <banner (the corp name goes in front): row 0.
banner:
        lda #7
        sta COLOR
        lda #<st_corp
        sta PTR
        lda #>st_corp
        sta PTR+1
        lda #1
        sta col
        lda #0
        sta row
        jsr print_after
        lda #<s_banner1
        sta PTR
        lda #>s_banner1
        sta PTR+1
        jmp print_after

; The scene from row `off`: sky with stars, the tower (corp colour, windows), neighbours, the street.
draw_scene:
        ldx st_color
        lda color_c64,x
        and #7
        bne :+
        lda #6
:       sta ccol
        ldy #0
@row:   sty row
        tya
        clc
        adc off
        sta t1                  ; scene row
        lda #0
        sta col
@cell:  jsr scene_cell          ; -> A = char, COLOR
        ldx col
        ldy row
        jsr API_PUTC
        inc col
        lda col
        cmp #40
        bne @cell
        ldy row
        iny
        cpy #25
        bne @row
        rts

; t1 = scene row, col = column -> A = char, COLOR set.
scene_cell:
        lda t1
        cmp #STREET
        bcc @above
        cmp #STREET + 1
        bcs :+
        lda #8 | 4              ; pavement (multicolour: mid grey)
        sta COLOR
        lda #MC_B
        rts
:       lda #8                  ; road (dark grey) with a centre line
        sta COLOR
        lda t1
        cmp #STREET + 2
        bne :+
        lda col
        and #3
        bne :+
        lda #7
        sta COLOR
        lda #'-'
        rts
:       lda #MC_A
        rts
@above: lda col                 ; the tower: columns 14-25, from scene row 3
        cmp #14
        bcc @side
        cmp #26
        bcs @side
        lda t1
        cmp #3
        bcc @sky
        cmp #STREET - 1
        bne :+
        lda col                 ; the entrance
        cmp #DOOR_X
        bcc :+
        cmp #DOOR_X + 2
        bcs :+
        lda #7
        sta COLOR
        lda #CH_BLOCK
        rts
:       lda col                 ; windows: alternate columns, every other row lit
        and #1
        bne @wall
        lda t1
        and #1
        beq @wall
        lda #7
        sta COLOR
        lda #CH_HALF
        rts
@wall:  lda ccol
        sta COLOR
        lda #CH_BLOCK
        rts
@side:  lda t1                  ; neighbours: lower buildings
        cmp #STREET - 14
        bcc @sky
        lda col
        and #7
        cmp #6
        bcs @sky
        lda #6
        sta COLOR
        lda #CH_CHECKER
        rts
@sky:   lda col                 ; a few stars
        eor t1
        and #31
        bne :+
        lda #1
        sta COLOR
        lda #'.'
        rts
:       lda #' '
        rts

.segment "RODATA"
s_climb:    .byte "Climb 40 floors of corporate absurdity.", 0
s_disk:     .byte "This disk: floors 1-2 and ", '0' + GAMES_ON_DISK / 10, '0' + GAMES_ON_DISK .mod 10, " tasks.", 0
s_footer:   .byte "v1.0 C64 - works offline - M: music", 0
s_tip:      .byte "Buy a coffee: buymeacoffee.com/marvec", 0
s_feedback: .byte "Feedback: synergytower.co.uk/feedback", 0
s_corp:     .byte " Corp", 0
s_sep:      .byte " - ", 0
s_sepf:     .byte " - F", 0
s_continue: .byte "Continue career", 0
s_newc:     .byte "New career", 0
s_start:    .byte "Start your career", 0
s_how:      .byte "How to play", 0
menu_lo:    .byte <s_continue, <s_newc, <s_how
menu_hi:    .byte >s_continue, >s_newc, >s_how
s_howtitle: .byte "How to play", 0
s_pressfire: .byte "Press FIRE", 0
s_newcareer: .byte "Start your career", 0
s_l0:       .byte "Corporation", 0
s_l1:       .byte "Your name", 0
s_l2:       .byte "Colour", 0
s_l3:       .byte "Skin", 0
s_l4:       .byte "Hair colour", 0
s_l5:       .byte "Hair style", 0
s_l6:       .byte "Start my career  ->", 0
label_lo:   .byte <s_l0, <s_l1, <s_l2, <s_l3, <s_l4, <s_l5, <s_l6
label_hi:   .byte >s_l0, >s_l1, >s_l2, >s_l3, >s_l4, >s_l5, >s_l6
s_yourname: .byte "Your name", 0
s_hint:     .byte "RETURN confirms a field. Joystick to pick.", 0
s_err1:     .byte "Your corporation needs a name.", 0
s_err2:     .byte "HR needs your name for the badge.", 0
err_lo:     .byte <s_err1, <s_err2
err_hi:     .byte >s_err1, >s_err2
s_empid:    .byte "EMPLOYEE ID", 0
s_intern:   .byte "Unpaid Intern", 0
s_floor1:   .byte "Floor 1 - Lobby", 0
s_clearance: .byte "Clearance: none", 0
s_barcode:  .byte "|||| || ||| |  Valid until promoted", 0
s_banner1:  .byte " Tower - 40 floors - 1 corner office", 0
s_walk:     .byte "-> Walk to the entrance", 0
s_enter:    .byte "FIRE / UP  Enter the tower", 0
.include "gen/title_data.s"

.segment "BSS"
err:        .res 1
