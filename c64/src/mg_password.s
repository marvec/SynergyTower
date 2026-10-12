; Password Policy (src/minigames/password.js) as a disk-loaded overlay at $4000.
; IT forces a password change. The policy's rules appear one at a time: each time the password passes every rule
; shown and is submitted, a new (sillier) rule is appended, until the whole policy is satisfied at once. A failing
; submit costs one of 3 attempts (this keeps keyboard mashing from scoring). Type on the keyboard, or pick the key
; tiles with the joystick (chunk tiles like "venti" or "SYNERGY" arrive with the rules that want them).
; Difficulty (d = MG_DIFF / 255), as in the JS: rules round(4 + 4 d) (4 -> 8), min length round(6 + 2 d),
; more mid/absurd-tier rules with d, time byDiff(75 s, 60 s). The policies are made by the JS generator at build
; time (tools/mg/password.js, 5 per difficulty band); one is picked at random.
; Score: all rules at once = 0.86 + 0.14 × time left - 0.05 per strike; otherwise
; 0.82 × (rules cleared / rules)^1.15 - 0.12 per strike (a lock-out after 3 strikes ends the game).
; Content: gen/mg_password_data.s.

.include "api.inc"

MAX_LEN   = 24
MAX_STRIKES = 3
MAX_RULES = 8
MAX_TILES = 48
MAX_DEAL  = 24
DONE_T    = 60                  ; 1.2 s "accepted" before the end
LOCK_T    = 70                  ; 1.4 s "locked out"
NEW_T     = 60                  ; the newest rule flashes 1.2 s
MSG_T     = 45
BAD_T     = 15
TOTAL_T   = 3750                ; 75 s at d 0, - 3 × round(250 d) frames (60 s at d 1)
; layout
TITLE_Y   = 2
FIELD_Y   = 3
FIELD_X   = 14
COUNT_Y   = 4
STAT_Y    = 5                   ; two lines
SEP_Y     = 7
RULE_Y    = 8
KEY_Y     = 16                  ; key rows 16-17, chunk rows 18-20
CHUNK_Y   = 18
CHUNK_LAST = 20
MSG_Y     = 22
SUBMIT_X  = 33
DEL_X     = 25
CLR_X     = 29
STR_R     = 29                  ; strength word: right edge
BAR_X     = 31                  ; strength bar: 8 cells
; tile kinds
T_SUBMIT  = 0
T_CHAR    = 1
T_DEL     = 2
T_CLR     = 3
T_CHUNK   = 4
; key matrix codes ($cb)
K_DEL     = 0
K_RETURN  = 1
K_NONE    = 64
SHFLAG    = $028d               ; KERNAL: bit 0 = a SHIFT key is down

.zeropage
diff:     .res 1
pol:      .res 2                ; the policy record
n:        .res 1                ; rules in the policy
minlen:   .res 1
maxlen:   .res 1
sumt:     .res 1
floorn:   .res 1
quarter:  .res 1
roman:    .res 1
ndeal:    .res 1
unlocked: .res 1
strikes:  .res 1
completed: .res 1
locked:   .res 1
end_t:    .res 1
new_t:    .res 1
msg_t:    .res 1
bad_t:    .res 1
border_t: .res 1
stat_bad: .res 1
focus:    .res 1
ntiles:   .res 1
plen:     .res 1
lastkey:  .res 1
final:    .res 1                ; score when completed
quip_i:   .res 1
done:     .res 1
vec:      .res 2                ; check routine
sp:       .res 2
sp2:      .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
t4:       .res 1
ci:       .res 1                ; contains: case-insensitive
stat_almost: .res 1             ; the status is a quip
tl:       .res 1                ; draw_tile: the tile
tc:       .res 1                ; draw_tiles: counter
.if .defined(AUTOPLAY)
sol:      .res 2
bot_t:    .res 1
.endif
zp_end:

.segment "CODE"
        jmp init
        jmp frame
        .word s_name, s_help

.include "mgkit.s"

; ---- setup -------------------------------------------------------------------------------------------------------

init:
        sta diff
        ldx #zp_end - pol - 1
        lda #0
:       sta pol,x
        dex
        bpl :-
        lda #K_NONE
        sta lastkey
        lda #1
        sta unlocked
        sta focus
        ; the policy: a random one of the band's
        ldx #BANDS - 1
:       lda diff
        cmp band_from,x
        bcs :+
        dex
        bne :-
:       jsr pick_policy
        jsr read_policy
        ; IT's quips in a shuffled order
        ldx #QUIP_N - 1
:       txa
        sta quipdeck,x
        dex
        bpl :-
        ldx #QUIP_N - 1
@shuf:  stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda quipdeck,x
        pha
        lda quipdeck,y
        sta quipdeck,x
        pla
        sta quipdeck,y
        dex
        bne @shuf
        ; the screen
        lda #TITLE_N
        jsr API_RMOD
        tax
        lda stitle_lo,x
        sta title_p
        lda stitle_hi,x
        sta title_p+1
        lda #<s_rule1
        sta stat_p
        lda #>s_rule1
        sta stat_p+1
        jsr layout
        jsr draw_all
        ; time: 75 s - 15 s × d
        lda #0
        ldx #250
        jsr byd
        sta t0
        asl
        sta t1
        lda #0
        rol
        sta t2
        lda t1
        clc
        adc t0
        sta t1
        bcc :+
        inc t2
:       lda #<TOTAL_T
        sec
        sbc t1
        pha
        lda #>TOTAL_T
        sbc t2
        tax
        pla
        jmp timer_start

; X = band: pol = one of its POLICIES records at random.
pick_policy:
        txa
        sta t0
        asl
        asl
        clc
        adc t0                  ; × 5
.assert POLICIES = 5, error, "pick_policy multiplies by 5"
        sta t0
        lda #POL_PICK           ; (test builds: the first 3, see tools/mg/password.js)
        jsr API_RMOD
        clc
        adc t0
        tax
        lda pol_lo,x
        sta pol
        lda pol_hi,x
        sta pol+1
        rts

; The record: n, min, max, sum, floor, quarter, roman, n rule ids, (rule, chunk) pairs, $ff [, solution].
read_policy:
        ldy #0
        lda (pol),y
        sta n
        ldx #0
:       iny
        lda (pol),y
        sta n+1,x               ; minlen .. roman
        inx
        cpx #6
        bne :-
.assert minlen = n + 1 && roman = n + 6, error, "policy header order"
        ldx #0
:       iny
        lda (pol),y
        sta ids,x
        inx
        cpx n
        bne :-
        ldx #0
@deal:  iny
        lda (pol),y
        cmp #$ff
        beq @end
        sta deal_r,x
        iny
        lda (pol),y
        sta deal_c,x
        inx
        bne @deal
@end:   stx ndeal
.if .defined(AUTOPLAY)
        iny
        tya
        clc
        adc pol
        sta sol
        lda pol+1
        adc #0
        sta sol+1
.endif
        ; strings for the rules: the floor number, "q<n>"
        lda floorn
        ldx #<floorstr
        ldy #>floorstr
        jsr num_str
        lda #'q'
        sta qstr
        lda quarter
        ora #'0'
        sta qstr+1
        lda #0
        sta qstr+2
        rts

; A = number -> decimal string at X/Y (lo/hi), 0-terminated.
num_str:
        stx sp2
        sty sp2+1
        ldy #0
        ldx #0                  ; hundreds, tens
@h:     cmp #100
        bcc :+
        sbc #100
        inx
        bne @h
:       cpx #0
        beq @t0
        pha
        txa
        ora #'0'
        sta (sp2),y
        iny
        pla
@t0:    ldx #0
@t:     cmp #10
        bcc :+
        sbc #10
        inx
        bne @t
:       cpy #0
        bne :+
        cpx #0
        beq @u
:       pha
        txa
        ora #'0'
        sta (sp2),y
        iny
        pla
@u:     ora #'0'
        sta (sp2),y
        iny
        lda #0
        sta (sp2),y
        rts

; byDiff: A = value at d 0, X = value at d 1 -> A = a + round((b - a) × d)  (b >= a here)
byd:
        sta t3
        txa
        sec
        sbc t3
        sta t0                  ; (b - a) × diff
        lda #0
        sta t1
        sta t2
        ldx #8
        lda diff
        sta t4
:       asl t1
        rol t2
        asl t4
        bcc :+
        lda t1
        clc
        adc t0
        sta t1
        bcc :+
        inc t2
:       dex
        bne :--
        lda t1                  ; + 127, / 255 = (x + (x >> 8) + 1) >> 8
        clc
        adc #127
        sta t1
        bcc :+
        inc t2
:       lda t1
        sec
        adc t2
        lda t2
        adc #0
        clc
        adc t3
        rts

; ---- tiles -------------------------------------------------------------------------------------------------------

; Tiles: SUBMIT, the two fixed key rows, then the unlocked rules' chunk tiles flowing over rows 18-20.
layout:
        ldx #0
        lda #T_SUBMIT
        sta tile_kind,x
        lda #SUBMIT_X
        sta tile_col,x
        lda #KEY_Y
        sta tile_row,x
        lda #6
        sta tile_len,x
        inx
        ldy #0                  ; row 1: digits and specials
@r1:    lda row1,y
        sta tile_val,x
        tya
        asl
        adc #1
        sta tile_col,x
        lda #KEY_Y
        sta tile_row,x
        jsr @char
        iny
        cpy #ROW1_N
        bne @r1
        ldy #0                  ; row 2: letters, DEL, CLR
@r2:    lda row2,y
        sta tile_val,x
        tya
        asl
        adc #1
        sta tile_col,x
        lda #KEY_Y + 1
        sta tile_row,x
        jsr @char
        iny
        cpy #ROW2_N
        bne @r2
        lda #T_DEL
        sta tile_kind,x
        lda #DEL_X
        sta tile_col,x
        jsr @word
        lda #T_CLR
        sta tile_kind,x
        lda #CLR_X
        sta tile_col,x
        jsr @word
        ; chunks
        lda #1
        sta t1                  ; column
        lda #CHUNK_Y
        sta t2                  ; row
        ldy #0
@ch:    cpy ndeal
        bcs @done
        lda deal_r,y
        cmp unlocked
        bcs @done               ; (pairs come in rule order)
        lda deal_c,y
        sta tile_val,x
        sty t3
        jsr chunk_ptr
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        sta tile_len,x
        clc
        adc t1
        cmp #40
        bcc @fits
        lda #1                  ; next row
        sta t1
        inc t2
        lda t2
        cmp #CHUNK_LAST + 1
        bcs @done               ; (no room: never with the generated policies)
@fits:  lda t1
        sta tile_col,x
        sec
        adc tile_len,x
        sta t1
        lda t2
        sta tile_row,x
        lda #T_CHUNK
        sta tile_kind,x
        inx
        ldy t3
        iny
        bne @ch
@done:  stx ntiles
        lda focus
        cmp ntiles
        bcc :+
        dex
        stx focus
:       rts
@char:  lda #T_CHAR
        sta tile_kind,x
        lda #1
        sta tile_len,x
        inx
        rts
@word:  lda #KEY_Y + 1
        sta tile_row,x
        lda #3
        sta tile_len,x
        inx
        rts

; A = chunk id -> sp = its string.
chunk_ptr:
        tay
        lda chunk_lo,y
        sta sp
        lda chunk_hi,y
        sta sp+1
        rts

; All tiles.
draw_tiles:
        lda #KEY_Y
        ldx #CHUNK_LAST - KEY_Y + 1
        jsr clear_rows
        lda #0
        sta tc
:       lda tc
        jsr draw_tile
        inc tc
        lda tc
        cmp ntiles
        bne :-
        rts

; Tile A: the focus arrow in front of it, its label in the colour of its kind (yellow in focus).
draw_tile:
        sta tl
        tax
        lda #7
        sta COLOR
        lda #' '
        cpx focus
        bne :+
        lda #CH_ARROW
:       pha
        ldy tile_row,x
        lda tile_col,x
        tax
        dex
        pla
        jsr API_PUTC
        ldx tl
        ldy tile_kind,x
        lda kind_col,y
        cpy #T_SUBMIT
        bne @c
        jsr ready               ; SUBMIT: green when every shown rule passes
        lda #6
        bcc @c
        lda #5
@c:     ldx tl
        cpx focus
        bne :+
        lda #7
:       sta COLOR
        lda tile_kind,x
        cmp #T_CHAR
        bne @str
        lda tile_val,x
        pha
        lda tile_col,x
        ldy tile_row,x
        tax
        pla
        jmp API_PUTC
@str:   cmp #T_CHUNK
        bne :+
        lda tile_val,x
        jsr chunk_ptr
        jmp @print
:       tay
        lda kind_str_lo,y
        sta sp
        lda kind_str_hi,y
        sta sp+1
@print: lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        ldx tl
        ldy tile_row,x
        lda tile_col,x
        tax
        jmp API_PRINT

; Joystick up/down: the nearest tile (by its centre) on the row above (A = $ff) or below (A = 1).
move_vert:
        ldx focus
        clc
        adc tile_row,x
        sta t0                  ; wanted row
        lda tile_col,x          ; centre × 2 = col × 2 + len
        asl
        adc tile_len,x
        sta t1
        lda #$ff
        sta t2                  ; best distance
        ldx #0
@t:     lda tile_row,x
        cmp t0
        bne @n
        lda tile_col,x
        asl
        adc tile_len,x
        sec
        sbc t1
        bcs :+
        eor #$ff
        adc #1
:       cmp t2
        bcs @n
        sta t2
        stx t3
@n:     inx
        cpx ntiles
        bne @t
        lda t2
        cmp #$ff
        beq @none
        lda t3
        jmp set_focus
@none:  rts

; A = new focus: redraw the old and the new tile.
set_focus:
        ldx focus
        sta focus
        txa
        jsr draw_tile
        lda focus
        jsr draw_tile
        lda #SFX_BLIP
        jmp API_SFX

; ---- rules -------------------------------------------------------------------------------------------------------

; Rule X of the policy (0..n-1): C=1 if the password passes it.
check:
        lda ids,x
        asl
        tay
        lda checks,y
        sta vec
        lda checks+1,y
        sta vec+1
        jmp (vec)

; C=1 if every shown rule passes.
all_pass:
        ldx #0
:       stx t4
        jsr check
        bcc @no
        ldx t4
        inx
        cpx unlocked
        bne :-
        sec
@no:    rts

; C=1 if SUBMIT is ready: every shown rule green, still playing.
ready:
        lda completed
        ora locked
        bne @no
        jmp all_pass
@no:    clc
        rts

; Rule checks: C=1 = pass.
ck_len:
        lda plen
        cmp minlen
        bcc fail
        lda maxlen
        cmp plen
        rts
ck_digit:
        lda #'0'
        ldx #'9'
        jmp has_range
ck_upper:
        lda #'A'
        ldx #'Z'
        jmp has_range
ck_lower:
        lda #'a'
        ldx #'z'
        jmp has_range
ck_special:
        ldy #SPECIAL_N - 1
:       sty t3
        lda specials,y
        tax
        jsr has_range
        bcs @y
        ldy t3
        dey
        bpl :-
        clc
@y:     rts
ck_nopass:
        lda #<s_password
        ldx #>s_password
        ldy #1
        jmp not_contains
ck_no123:
        lda #<s_123
        ldx #>s_123
        ldy #0
not_contains:
        jsr contains
        jmp invert
ck_sum:
        ldx #0
        lda #0
        sta t0
@c:     cpx plen
        beq @e
        lda pw,x
        inx
        cmp #'0'
        bcc @c
        cmp #'9' + 1
        bcs @c
        sbc #'0' - 1            ; (C = 0: '0' - 1 + 1)
        clc
        adc t0
        sta t0
        jmp @c
@e:     lda t0
        cmp sumt
        beq pass
fail:   clc
        rts
pass:   sec
        rts
ck_month:
        lda #<l_months
        ldx #>l_months
        ldy #1
        jmp contains_list
ck_fruit:
        lda #<l_fruits
        ldx #>l_fruits
        ldy #1
        jmp contains_list
ck_coffee:
        lda #<l_coffee
        ldx #>l_coffee
        ldy #1
        jmp contains_list
ck_animal:
        lda #<l_animals
        ldx #>l_animals
        ldy #1
        jmp contains_list
ck_value:
        lda #<l_values
        ldx #>l_values
        ldy #0
        jmp contains_list
ck_floor:
        lda #<floorstr
        ldx #>floorstr
        ldy #0
        jmp contains
ck_quarter:
        lda #<qstr
        ldx #>qstr
        ldy #1
        jmp contains
ck_dept:
        lda #<dept_word
        ldx #>dept_word
        ldy #0
        jmp contains
ck_synergy:
        lda #<s_synergy
        ldx #>s_synergy
        ldy #0
        jmp contains
ck_roman:
        ldx roman
        lda roman_lo,x
        pha
        lda roman_hi,x
        tax
        pla
        ldy #0
        jmp contains
ck_bang:
        ldx plen
        beq fail
        lda pw-1,x
        cmp #'!'
        beq pass
        clc
        rts
ck_start:
        lda plen
        beq fail
        lda pw
        cmp #'A'
        bcc fail
        cmp #'Z' + 1
        jmp invert
ck_triple:
        ldx #2
:       cpx plen
        bcs @p
        lda pw,x
        cmp pw-1,x
        bne :+
        cmp pw-2,x
        beq @f
:       inx
        bne :--
@f:     clc
        rts
@p:     sec
        rts
ck_nozero:
        lda #'0'
        tax
        jsr has_range
        jmp invert
ck_even:
        lda plen
        lsr
        jmp invert
ck_caps3:
        ldx #0
        ldy #0
:       cpx plen
        beq :+
        lda pw,x
        inx
        cmp #'A'
        bcc :-
        cmp #'Z' + 1
        bcs :-
        iny
        bne :-
:       cpy #3
        rts
ck_noe:
        lda #'e'
        tax
        jsr has_range
        bcs @f
        lda #'E'
        tax
        jsr has_range
        jmp invert
@f:     clc
        rts
ck_prime:
        lda plen
        lsr
        lsr
        lsr
        tax
        lda plen
        and #7
        tay
        lda primes,x
        and bit8,y
        cmp #1                  ; C=1 if set
        rts
ck_len14:
        lda plen
        cmp #14
        rts

invert: rol
        eor #1
        ror
        rts

; C=1 if the password has a character in A..X.
has_range:
        sta t0
        stx t1
        ldx plen
@c:     dex
        bmi @no
        lda pw,x
        cmp t0
        bcc @c
        cmp t1
        beq @y
        bcs @c
@y:     sec
        rts
@no:    clc
        rts

; A/X = list of 0-terminated strings (ends with an empty one), Y = 1: ignore case. C=1 if the password has one.
contains_list:
        sta sp2
        stx sp2+1
        sty ci
@w:     ldy #0
        lda (sp2),y
        beq @no
        jsr find
        bcs @y
        ldy #0                  ; next word
:       lda (sp2),y
        iny
        cmp #0
        bne :-
        tya
        clc
        adc sp2
        sta sp2
        bcc @w
        inc sp2+1
        bne @w
@no:    clc
@y:     rts

; A/X = string, Y = 1: ignore case. C=1 if the password contains it.
contains:
        sta sp2
        stx sp2+1
        sty ci
        ; fall through
; C=1 if the password contains the string at sp2 (case-insensitive if ci; the needle is lower case then).
find:
        lda #0
        sta t1                  ; start in the password
@s:     lda t1
        sta t0
        ldy #0
@c:     lda (sp2),y
        beq @y                  ; the whole needle matched
        ldx t0
        cpx plen
        bcs @no                 ; past the end: later starts can't fit either
        lda pw,x
        ldx ci
        beq @cmp
        cmp #'A'
        bcc @cmp
        cmp #'Z' + 1
        bcs @cmp
        ora #$20
@cmp:   cmp (sp2),y
        bne @next
        iny
        inc t0
        bne @c
@next:  inc t1
        lda t1
        cmp plen
        bcc @s
@no:    clc
        rts
@y:     sec
        rts

; ---- drawing -----------------------------------------------------------------------------------------------------

draw_all:
        lda #7
        sta COLOR
        lda #<s_name
        sta PTR
        lda #>s_name
        sta PTR+1
        ldx #1
        ldy #0
        jsr API_PRINT
        jsr draw_header
        jsr draw_title
        lda #3
        sta COLOR
        lda #<s_newpw
        sta PTR
        lda #>s_newpw
        sta PTR+1
        ldx #0
        ldy #FIELD_Y
        jsr API_PRINT
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #6
        sta COLOR
        lda #CH_B
        ldx #0
        ldy #SEP_Y
        jsr API_FILL
        jsr draw_field
        jsr draw_status
        jsr draw_rules
        jsr draw_tiles
        lda #<s_keys
        ldx #>s_keys
        jmp footer

; "Rules c/N  Attempts a" at the top right.
draw_header:
        lda #7
        sta COLOR
        lda #<s_rules
        sta PTR
        lda #>s_rules
        sta PTR+1
        ldx #19
        ldy #0
        jsr API_PRINT
        jsr cleared
        ora #'0'
        ldx #25
        ldy #0
        jsr API_PUTC
        lda n
        ora #'0'
        ldx #27
        ldy #0
        jsr API_PUTC
        lda #MAX_STRIKES
        sec
        sbc strikes
        ora #'0'
        ldx #39
        ldy #0
        jmp API_PUTC

; A = rules cleared (all once completed).
cleared:
        lda completed
        beq :+
        lda n
        rts
:       ldx unlocked
        dex
        txa
        rts

draw_title:
        lda #TITLE_Y
        ldx #1
        jsr clear_rows
        lda completed
        beq :+
        ldy #5
        lda #<s_accepted
        ldx #>s_accepted
        bne @p
:       lda locked
        beq :+
        ldy #2
        lda #<s_lockedt
        ldx #>s_lockedt
        bne @p
:       ldy #6
        lda title_p
        ldx title_p+1
@p:     sty COLOR
        sta PTR
        stx PTR+1
        ldx #0
        ldy #TITLE_Y
        jsr API_PRINT
        lda #7
        sta COLOR
        lda #CH_LOCK
        ldx #39
        ldy #TITLE_Y
        jmp API_PUTC

; The password, its length and the strength meter (rows 3-4).
draw_field:
        lda #MAX_LEN + 2
        sta FILL_W
        lda #1
        sta FILL_H
        lda #' '
        ldx #FIELD_X
        ldy #FIELD_Y
        jsr API_FILL
        ldx plen
        lda #0
        sta pw,x
        lda #1                  ; white, red after a refused key, green once accepted
        ldx bad_t
        beq :+
        lda #2
:       ldx completed
        beq :+
        lda #5
:       sta COLOR
        lda #<pw
        sta PTR
        lda #>pw
        sta PTR+1
        ldx #FIELD_X
        ldy #FIELD_Y
        jsr API_PRINT
        jsr draw_caret
        ; "12/24 chars"
        lda #40
        sta FILL_W
        lda #' '
        ldx #0
        ldy #COUNT_Y
        jsr API_FILL
        lda #6
        sta COLOR
        lda plen
        ldx #<nbuf
        ldy #>nbuf
        jsr num_str
        lda #<nbuf
        sta PTR
        lda #>nbuf
        sta PTR+1
        ldx #0
        ldy #COUNT_Y
        jsr API_PRINT
        lda #<s_chars
        sta PTR
        lda #>s_chars
        sta PTR+1
        ldx #2
        lda plen
        cmp #10
        bcs :+
        dex
:       ldy #COUNT_Y
        jsr API_PRINT
        ; strength: STRENGTH[floor(cleared × 7.99 / N)] = (8 × cleared - 1) / N, and 8 × cleared / N cells
        jsr cleared
        sta t2
        asl
        asl
        asl
        sta t3                  ; 8 × cleared
        ldx #0
        lda t3
        beq @w
        sec
        sbc #1
:       cmp n
        bcc @w
        sbc n
        inx
        bne :-
@w:     lda #1
        sta COLOR
        lda str_lo,x
        sta PTR
        lda str_hi,x
        sta PTR+1
        ldy #0
:       lda (PTR),y
        beq :+
        iny
        bne :-
:       sty t0
        lda #STR_R + 1
        sec
        sbc t0
        tax
        ldy #COUNT_Y
        jsr API_PRINT
        ldx #0                  ; cells = 8 × cleared / N
        lda t3
:       cmp n
        bcc :+
        sbc n
        inx
        bne :-
:       stx t1
        lda t2                  ; colour: red, yellow past half, green when done
        cmp n
        bne :+
        lda #5
        bne @col
:       asl
        cmp n
        beq @red
        bcc @red
        lda #7
        bne @col
@red:   lda #2
@col:   sta t0
        ldx #0
@cell:  stx t4
        lda t0
        ldy #CH_BLOCK
        cpx t1
        bcc :+
        lda #6
        ldy #'-'
:       sta COLOR
        txa
        clc
        adc #BAR_X
        tax
        tya
        ldy #COUNT_Y
        jsr API_PUTC
        ldx t4
        inx
        cpx #8
        bne @cell
        rts

; The blinking caret after the password.
draw_caret:
        lda #3
        sta COLOR
        lda plen
        clc
        adc #FIELD_X
        tax
        lda completed
        bne @sp
        lda FRAME
        and #16
        beq @sp
        lda #CH_CURSOR
        bne @p
@sp:    lda #' '
@p:     ldy #FIELD_Y
        jmp API_PUTC

; The status line (two rows): stat_p, or the "Rejected" text built in rbuf.
draw_status:
        lda #STAT_Y
        ldx #2
        jsr clear_rows
        lda #4                  ; IT purple, red when bad, green when done
        ldx stat_bad
        beq :+
        lda #2
:       ldx completed
        beq :+
        lda #5
:       sta COLOR
        lda stat_p
        sta sp
        lda stat_p+1
        sta sp+1
        lda #STAT_Y
        sta t3
        ldx #0
        lda stat_almost         ; a quip: "Almost! " in front
        beq @l
        lda #<s_almost
        sta PTR
        lda #>s_almost
        sta PTR+1
        ldy #STAT_Y
        jsr API_PRINT
        ldx #8
@l:     lda sp
        sta PTR
        lda sp+1
        sta PTR+1
        ldy t3
        jsr API_PRINT
        ldx #0
        ldy #0
:       lda (sp),y
        iny
        cmp #0
        bne :-
        tya
        clc
        adc sp
        sta sp
        bcc :+
        inc sp+1
:       inc t3
        lda t3
        cmp #STAT_Y + 2
        bne @l
        rts

; The shown rules with their marks, and "N more rules pending...".
draw_rules:
        lda #RULE_Y
        ldx #MAX_RULES
        jsr clear_rows
        ldx #0
:       stx t2
        jsr draw_rule
        ldx t2
        inx
        cpx unlocked
        bne :-
        lda completed
        bne @out
        lda n
        sec
        sbc unlocked
        beq @out
        tax
        ora #'0'
        sta s_pend1
        sta s_pendn
        lda #6
        sta COLOR
        lda #<s_pend1
        ldy #>s_pend1
        cpx #1
        beq :+
        lda #<s_pendn
        ldy #>s_pendn
:       sta PTR
        sty PTR+1
        lda unlocked
        clc
        adc #RULE_Y
        tay
        ldx #4
        jsr API_PRINT
@out:   rts

; Rule X: a green check or a red cross, "N." and its text; the newest flashes yellow for a while.
draw_rule:
        stx t2
        jsr check
        lda #0
        rol
        sta t1                  ; passes
        lda t2
        clc
        adc #RULE_Y
        sta t0                  ; row
        lda #2
        ldy t1
        beq :+
        lda #5
:       sta COLOR
        lda #'x'
        ldy t1
        beq :+
        lda #CH_CHECK
:       ldx #0
        ldy t0
        jsr API_PUTC
        lda t2                  ; number
        clc
        adc #'1'
        ldx #1
        ldy t0
        jsr API_PUTC
        lda #'.'
        ldx #2
        ldy t0
        jsr API_PUTC
        ldx t2                  ; flashing?
        inx
        cpx unlocked
        bne :+
        lda new_t
        and #8
        beq :+
        lda #7
        sta COLOR
:       ldx t2
        jsr expand
        lda #<rbuf
        sta PTR
        lda #>rbuf
        sta PTR+1
        ldx #4
        ldy t0
        jmp API_PRINT

; Rule X's text with its numbers filled in -> rbuf.
expand:
        ldy ids,x
        lda rtext_lo,y
        sta sp
        lda rtext_hi,y
        sta sp+1
        ldy #0
        ldx #0
@c:     lda (sp),y
        beq @end
        iny
        cmp #7
        bcs @put
        sty t3
        stx t4
        tay
        lda n,y                 ; $01-$05: minlen, maxlen, sumt, floorn, quarter
        cpy #6                  ; $06: the Roman numeral's value
        bne :+
        ldx roman
        lda roman_val,x
:       pha
        lda t4
        clc
        adc #<rbuf
        tax
        lda #>rbuf
        adc #0
        tay
        pla
        jsr num_str
        ldx t4                  ; past the digits
:       lda rbuf,x
        beq :+
        inx
        bne :-
:       ldy t3
        jmp @c
@put:   sta rbuf,x
        inx
        bne @c
@end:   sta rbuf,x
        rts

; A message on row MSG_Y: A/X = string, Y = colour.
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

; ---- playing -----------------------------------------------------------------------------------------------------

frame:
        lda done
        beq :+
        sec
        rts
:       jsr ticks
        lda completed
        ora locked
        beq @play
        dec end_t
        bne @wait
        lda completed
        beq :+
        lda final
        jmp finish
:       jsr part_score
        jmp finish
@wait:  clc
        rts
@play:  jsr timer_tick
        bcc :+
        jsr part_score
        jmp finish
:
.if .defined(AUTOPLAY)
        jsr bot
        lda #0                  ; only the bot plays
        sta JOYP
        lda done
        ora completed
        ora locked
        bne @wait
.endif
        jsr keyboard
        lda JOYP
        and #J_FIRE
        beq :+
        lda focus
        jsr activate
        clc
        rts
:       lda JOYP
        and #J_RIGHT
        beq :+
        ldx focus
        inx
        cpx ntiles
        bcc @set
        ldx #0
@set:   txa
        jsr set_focus
        clc
        rts
:       lda JOYP
        and #J_LEFT
        beq :+
        ldx focus
        dex
        bpl @set
        ldx ntiles
        dex
        bpl @set
:       lda JOYP
        and #J_UP
        beq :+
        lda #$ff
        jsr move_vert
        clc
        rts
:       lda JOYP
        and #J_DOWN
        beq :+
        lda #1
        jsr move_vert
:       clc
        rts

; Timers of the decorations: message, refused key, the flashing rule, the caret, the border.
ticks:
        lda msg_t
        beq :+
        dec msg_t
        bne :+
        lda #MSG_Y
        ldx #1
        jsr clear_rows
:       lda bad_t
        beq :+
        dec bad_t
        bne :+
        jsr draw_field
:       lda border_t
        beq :+
        dec border_t
        bne :+
        lda #0
        sta $d020
:       lda new_t
        beq :+
        dec new_t
        lda new_t
        and #7
        bne :+
        ldx unlocked
        dex
        jsr draw_rule
:       lda FRAME
        and #15
        bne :+
        jsr draw_caret
:       rts

; Keys: letters, digits and signs type (SHIFT for capitals and !"#$%&'()[]<>?), DEL deletes, RETURN submits.
; WASD both type and move the joystick focus: a typed letter cancels that frame's direction.
keyboard:
        lda $cb
        cmp #9                  ; W A S D
        beq @wasd
        cmp #10
        beq @wasd
        cmp #13
        beq @wasd
        cmp #18
        bne :+
@wasd:  lda JOYP
        and #J_FIRE
        sta JOYP
        lda $cb
:       cmp lastkey
        beq @out
        sta lastkey
        cmp #K_NONE
        beq @out
        cmp #K_RETURN
        bne :+
        lda JOYP                ; (RETURN is also FIRE)
        and #<~J_FIRE
        sta JOYP
        jmp submit
:       cmp #K_DEL
        bne :+
        jmp do_del
:       tax
        lda SHFLAG
        lsr
        lda key_lo,x
        bcc :+
        lda key_hi,x
:       cmp #0
        beq @out
        jmp ins_char
@out:   rts

; Tile A pressed.
activate:
        tax
        lda tile_kind,x
        bne :+
        jmp submit
:       cmp #T_DEL
        beq do_del
        cmp #T_CLR
        beq do_clr
        cmp #T_CHAR
        bne :+
        lda tile_val,x
        jmp ins_char
:       lda tile_val,x          ; a chunk
        jsr chunk_ptr
        ldy #0
:       lda (sp),y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc plen
        cmp #MAX_LEN + 1
        bcs too_long
        ldx plen
        ldy #0
:       lda (sp),y
        beq :+
        sta pw,x
        inx
        iny
        bne :-
:       stx plen
        jmp edited

do_del: lda plen
        beq no_edit
        dec plen
        jmp edited
do_clr: lda plen
        beq no_edit
        lda #0
        sta plen
        jmp edited

; A = character typed.
ins_char:
        ldx plen
        cpx #MAX_LEN
        bcs too_long
        sta pw,x
        inc plen
edited: lda completed
        ora locked
        bne no_edit
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_field
        jsr draw_rules
        lda #0                  ; SUBMIT's colour
        jmp draw_tile
no_edit:
        rts
too_long:
        lda #SFX_BAD
        jsr API_SFX
        lda #BAD_T
        sta bad_t
        jsr draw_field
        lda #<s_max
        ldx #>s_max
        ldy #2
        jmp message

submit:
        lda completed
        ora locked
        bne no_edit
        sta stat_almost         ; (A = 0)
        ldx #0                  ; the first failing rule
@chk:   stx t2
        jsr check
        bcs :+
        jmp @fail
:       ldx t2
        inx
        cpx unlocked
        bne @chk
        lda #0
        sta stat_bad
        lda unlocked
        cmp n
        bcc @more
        ; all rules at once: accepted
        lda #1
        sta completed
        lda #DONE_T
        sta end_t
        lda tm_cells            ; 0.86 + 0.14 × time left - 0.05 per strike
        ldx #36
        jsr mul8
        lda #38
        jsr div16
        clc
        adc #219
        bcc :+
        lda #255
:       ldx strikes
        beq :++
:       sec
        sbc #13
        dex
        bne :-
:       sta final
        lda #DONE_N
        jsr API_RMOD
        tax
        lda doneln_lo,x
        sta stat_p
        lda doneln_hi,x
        sta stat_p+1
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_acc
        ldx #>s_acc
        ldy #5
        jsr message
        jmp @redraw
@more:  inc unlocked            ; a new rule
        lda #NEW_T
        sta new_t
        ldx quip_i
        inc quip_i
        lda quip_i
        cmp #QUIP_N
        bcc :+
        lda #0
        sta quip_i
:       ldy quipdeck,x
        lda quip_lo,y
        sta stat_p
        lda quip_hi,y
        sta stat_p+1
        inc stat_almost
        jsr layout
        jsr draw_tiles
        lda #SFX_GOOD
        jsr API_SFX
        lda #<s_more
        ldx #>s_more
        ldy #7
        jsr message
        jmp @redraw
@fail:  inc strikes
        lda #1
        sta stat_bad
        lda #2
        sta $d020
        lda #12
        sta border_t
        lda #SFX_BAD
        jsr API_SFX
        lda strikes
        cmp #MAX_STRIKES
        bcc @rej
        lda #1
        sta locked
        lda #LOCK_T
        sta end_t
        lda #<s_lockst
        sta stat_p
        lda #>s_lockst
        sta stat_p+1
        lda #<s_lockout
        ldx #>s_lockout
        ldy #2
        jsr message
        jmp @redraw
@rej:   lda t2                  ; "Rejected: rule N says no." / "K attempts left."
        clc
        adc #'1'
        sta s_rej1 + REJ_N
        lda #MAX_STRIKES
        sec
        sbc strikes
        ora #'0'
        sta s_rej2
        ldy #0                  ; "attempts left." / "attempt left."
        lda strikes
        cmp #MAX_STRIKES - 1
        bne :+
        ldy #s_left1 - s_lefts
:       ldx #0
:       lda s_lefts,y
        sta s_rej2 + REJ_S,x
        iny
        inx
        cpx #8
        bne :-
        lda #<s_rej1
        sta stat_p
        lda #>s_rej1
        sta stat_p+1
        lda #<s_rejected
        ldx #>s_rejected
        ldy #2
        jsr message
@redraw:
        jsr draw_header
        jsr draw_title
        jsr draw_field
        jsr draw_status
        jsr draw_rules
        lda #0
        jmp draw_tile

; A = partial score: 0.82 × (cleared / N)^1.15 - 0.12 per strike.
part_score:
        lda n
        sec
        sbc #4
        asl
        asl
        asl
        sta t0
        jsr cleared
        clc
        adc t0
        tax
        lda partial,x
        ldx strikes
        beq @out
:       sec
        sbc #31
        bcc @zero
        dex
        bne :-
@out:   rts
@zero:  lda #0
        rts

finish:
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

; t1/t2 = A × X
mul8:
        sta t0
        stx t3
        lda #0
        sta t1
        sta t2
        ldx #8
:       asl t1
        rol t2
        asl t3
        bcc :+
        lda t1
        clc
        adc t0
        sta t1
        bcc :+
        inc t2
:       dex
        bne :--
        rts

; A = t1/t2 / A (quotient < 256)
div16:
        sta t0
        ldx #0
:       lda t1
        sec
        sbc t0
        tay
        lda t2
        sbc #0
        bcc :+
        sta t2
        sty t1
        inx
        bne :-
:       txa
        rts

.if .defined(AUTOPLAY)
; ---- test builds: types the policy's reference solution (it passes every rule), then submits once per rule.
BOT_TYPE  = 4                   ; frames per key
BOT_SUBMIT = 25                 ; frames between submits (the new rule is read in the meantime)
bot:
        inc bot_t
        ldy plen
        lda (sol),y
        beq @sub
        lda bot_t
        cmp #BOT_TYPE
        bcc @out
        lda #0
        sta bot_t
        ldy plen
        lda (sol),y
        jmp ins_char
@sub:   lda bot_t
        cmp #BOT_SUBMIT
        bcc @out
        lda #0
        sta bot_t
        jmp submit
@out:   rts
.endif

.rodata
s_name:     .byte "Password Policy", 0
s_help:     .byte "Satisfy every new password rule.", 0
s_keys:     .byte "Type or joystick+FIRE. RETURN submits", 0
s_rules:    .byte "Rules 0/0  Attempts 0", 0
s_newpw:    .byte "New password:", 0
s_chars:    .byte "/24 chars", 0
s_accepted: .byte "IT SECURITY - Password accepted", 0
s_lockedt:  .byte "IT SECURITY - Account locked", 0
s_rule1:    .byte "Rule 1 of the new policy. More may", 0, "follow.", 0
s_lockst:   .byte "ACCOUNT LOCKED. Please visit IT in", 0, "person.", 0
s_max:      .byte "Max 24 characters!", 0
s_almost:   .byte "Almost! ", 0
s_acc:      .byte "ACCEPTED!", 0
s_more:     .byte "One more thing...", 0
s_lockout:  .byte "LOCKED OUT", 0
s_rejected: .byte "Rejected!", 0
s_password: .byte "password", 0
s_123:      .byte "123", 0
s_synergy:  .byte "SYNERGY", 0
s_submit:   .byte "SUBMIT", 0
s_del:      .byte "DEL", 0
s_lefts:    .byte "s left.", 0
s_left1:    .byte " left.", 0, 0
s_clr:      .byte "CLR", 0
specials:   .byte "!?#%&*"
SPECIAL_N = * - specials
row1:       .byte "1234567890!?#%&*"
ROW1_N = * - row1
row2:       .byte "aoukzKQZIVXL"
ROW2_N = * - row2
kind_col:   .byte 6, 1, 4, 4, 3         ; submit (see draw_tile), key, DEL, CLR, chunk
kind_str_lo: .byte <s_submit, 0, <s_del, <s_clr
kind_str_hi: .byte >s_submit, 0, >s_del, >s_clr
str_lo:     .byte <st0, <st1, <st2, <st3, <st4, <st5, <st6, <st7
str_hi:     .byte >st0, >st1, >st2, >st3, >st4, >st5, >st6, >st7
st0:        .byte "Laughable", 0            ; STRENGTH in password.js
st1:        .byte "Weak", 0
st2:        .byte "Meh", 0
st3:        .byte "Okay", 0
st4:        .byte "Decent", 0
st5:        .byte "Corporate", 0
st6:        .byte "Fortress", 0
st7:        .byte "Unhackable", 0
primes:     .byte %10101100, %00101000, %10001010, %00000000   ; bit n: n is prime (2 3 5 7 11 13 17 19 23)
bit8:       .byte 1, 2, 4, 8, 16, 32, 64, 128
checks:     .word ck_len, ck_digit, ck_upper, ck_special, ck_lower, ck_nopass, ck_no123, ck_sum, ck_month
            .word ck_fruit, ck_floor, ck_quarter, ck_bang, ck_start, ck_triple, ck_nozero, ck_even, ck_coffee
            .word ck_dept, ck_caps3, ck_value, ck_synergy, ck_roman, ck_noe, ck_prime, ck_len14, ck_animal
.assert (* - checks) / 2 = R_COUNT, error, "one check per rule"
; key matrix ($cb) -> ASCII, without and with SHIFT (0 = not typable)
key_lo:     .byte 0, 0, 0, 0, 0, 0, 0, 0,  "3wa4zse", 0,  "5rd6cftx",  "7yg8bhuv"
            .byte "9ij0mkon",  "+pl-.:@,",  0, "*;", 0, 0, "=", 0, "/",  "1", 0, 0, "2", 0, 0, "q", 0
.assert * - key_lo = 64, error, "key_lo: 64 matrix codes"
key_hi:     .byte 0, 0, 0, 0, 0, 0, 0, 0,  "#WA$ZSE", 0,  "%RD&CFTX",  "'YG(BHUV"
            .byte ")IJ", 0, "MKON",  0, "PL", 0, ">[", 0, "<",  0, 0, "]", 0, 0, 0, 0, "?",  "!", 0, 0, 34, 0, 0, "Q", 0

.assert * - key_hi = 64, error, "key_hi: 64 matrix codes"

.include "gen/mg_password_data.s"

.data
; "Rejected: rule N says no." + "K attempts left." (patched)
s_rej1:     .byte "Rejected: rule "
REJ_N = * - s_rej1
            .byte "1 says no.", 0
s_rej2:     .byte "3 attempt"
REJ_S = * - s_rej2
            .byte "s left.", 0
s_pend1:    .byte "1 more rule pending...", 0
s_pendn:    .byte "2 more rules pending...", 0

.bss
quipdeck:   .res QUIP_N
ids:        .res MAX_RULES
deal_r:     .res MAX_DEAL
deal_c:     .res MAX_DEAL
tile_kind:  .res MAX_TILES
tile_col:   .res MAX_TILES
tile_row:   .res MAX_TILES
tile_len:   .res MAX_TILES
tile_val:   .res MAX_TILES
pw:         .res MAX_LEN + 1
rbuf:       .res 44
nbuf:       .res 4
floorstr:   .res 4
qstr:       .res 3
title_p:    .res 2
stat_p:     .res 2
