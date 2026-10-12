; The workstation terminal (src/core/terminal.js, src/scenes/terminal.js): one image for $4000-$93ff, unpacked in
; place over the overlay slot, the load buffer and the floor (which is loaded again afterwards). A tiny fake Linux:
; commands, a virtual file system, "&&" / ";" chains, pipes to grep / head / tail / wc / lolcat.
; `systemctl isolate levelNN.target` returns A = NN (the floor to ride to), else A = 0.
;
; C64 keys for the missing ASCII: the pound key types "|", up arrow "~", back arrow "_". F1 completes.

.include "api.inc"
.include "state.inc"

HIST    = $c400                 ; 8 commands × 64 (the second screen is free while the terminal runs)
TAILB   = $c600                 ; tail: 10 lines × 40
SCREEN_ = $c000
GREEN   = 5
MAXARG  = 8
HISTN   = 8
K_RETURN = 13
K_DEL   = 20
K_UP    = 145
K_DOWN  = 17
K_STOP  = 3
K_F1    = 133

; pipe filters
P_GREP  = 1
P_HEAD  = 2
P_TAIL  = 3
P_WC    = 4
P_LOL   = 5
P_BAD   = 6

.zeropage
cx:       .res 1                ; screen cursor
cy:       .res 1
p0:       .res 2
p1:       .res 2
p2:       .res 2
t0:       .res 1
t1:       .res 1
t2:       .res 1
t3:       .res 1
llen:     .res 1                ; LB length
ilen:     .res 1                ; LINE length
argc:     .res 1
hcount:   .res 1                ; commands in the history
hpos:     .res 1                ; browsing the history
exitf:    .res 1
warpf:    .res 1
nfilt:    .res 1
fcount:   .res 1                ; lines through head / wc
tailn:    .res 1
sink:     .res 1                ; 0 output, 1 count (template length)
cnt:      .res 2
wpos:     .res 1
seg_s:    .res 1                ; segment start in WORK
seg_e:    .res 1
rp:       .res 1
wp:       .res 1
inq:      .res 1
num:      .res 2
d1:       .res 1                ; dec16's own
d2:       .res 1
d3:       .res 1
o0:       .res 1                ; the output path's own (emit, filters, contains)
o1:       .res 1
o2:       .res 1
o3:       .res 1
q1:       .res 1                ; decode_to_p0's own
q2:       .res 1
o2_p:     .res 2                ; the tail slot
dfl:      .res 1                ; ls flags: 1 all, 2 long

.segment "CODE"
        jmp term_main

term_main:
        ldx #14                 ; "levelNN.target"
:       lda n_unit0,x
        sta UNITB,x
        dex
        bpl :-
        lda #0
        sta exitf
        sta warpf
        sta hcount
        sta $d015
        jsr make_names
        lda #0
        sta COLOR
        jsr API_CLS
        lda #1
        sta COLOR
        lda #<n_title
        sta PTR
        lda #>n_title
        sta PTR+1
        ldx #0
        ldy #0
        jsr API_PRINT
        lda #<USER              ; "Terminal - user@host"
        sta PTR
        lda #>USER
        sta PTR+1
        ldx #11
        ldy #0
        jsr API_PRINT
        ldy #0
:       lda USER,y
        beq :+
        iny
        bne :-
:       tya
        clc
        adc #11
        tax
        stx t0
        lda #'@'
        ldy #0
        jsr API_PUTC
        lda #<HOST
        sta PTR
        lda #>HOST
        sta PTR+1
        ldx t0
        inx
        ldy #0
        jsr API_PRINT
        lda #0
        sta cx
        lda #1
        sta cy
        lda #<s_banner
        ldx #>s_banner
        jsr out_lines
        jsr flush
@loop:  jsr read_line
        bcs @close              ; RUN/STOP
        jsr run_line
        jsr flush
        lda warpf
        beq :+
        ldx #70                 ; "Calling the elevator..." for 1.4 s
@w:     jsr API_WAIT
        dex
        bne @w
        lda warpf
        rts
:       lda exitf
        beq @loop
@close: lda #0
        rts

; USER = login name from the player's name (lowercase letters + digits, max 12, else "newhire"),
; HOST = "fNN-wsID", HOME = "/home/<user>", CWD = HOME.
make_names:
        ldx #0
        ldy #0
@n:     lda st_name,x
        beq @nd
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
@add:   sta USER,y
        iny
        cpy #12
        bne @n
@nd:    cpy #0
        bne :+
        ldy #0                  ; newhire
@nh:    lda n_newhire,y
        sta USER,y
        beq @hn
        iny
        bne @nh
:       lda #0
        sta USER,y
@hn:    lda #'f'                ; host
        sta HOST
        lda st_floor
        jsr two_digits
        stx HOST+1
        sta HOST+2
        ldx #0
:       lda n_ws,x
        sta HOST+3,x
        inx
        cpx #3
        bne :-
        lda MG_WS
        jsr dec3
        ldx #0
:       lda numbuf,x
        sta HOST+6,x
        beq :+
        inx
        bne :-
:       ldx #0                  ; HOME, CWD
:       lda n_home,x
        sta HOME,x
        beq :+
        inx
        bne :-
:       ldy #0
:       lda USER,y
        sta HOME,x
        beq :+
        inx
        iny
        bne :-
:       ldx #0
:       lda HOME,x
        sta CWD,x
        beq :+
        inx
        bne :-
:       rts

; A = 0..99 -> X = tens char, A = ones char.
two_digits:
        ldx #'0'
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       ora #'0'
        rts

; A = 0..255 -> numbuf (decimal, no leading zeros).
dec3:   sta num
        lda #0
        sta num+1
; num (16 bit) -> numbuf.
dec16:  ldx #0
        stx d3                  ; started
        ldy #0
@pow:   lda #'0'
        sta d2
@sub:   lda num
        sec
        sbc p10lo,x
        sta d1
        lda num+1
        sbc p10hi,x
        bcc @out
        sta num+1
        lda d1
        sta num
        inc d2
        bne @sub
@out:   lda d2
        cpx #4
        beq :+
        cmp #'0'
        bne :+
        lda d3
        beq @next
        lda d2
:       sta numbuf,y
        iny
        inc d3
@next:  inx
        cpx #5
        bne @pow
        lda #0
        sta numbuf,y
        rts

; ---- screen: green text, rows 1-24 scroll ----------------------------------------------------------------------
scr_putc:
        cmp #10
        beq scr_nl
        pha
        lda #GREEN
        sta COLOR
        ldx cx
        ldy cy
        pla
        jsr API_PUTC
        inc cx
        lda cx
        cmp #40
        bne :+
scr_nl: lda #0
        sta cx
        inc cy
        lda cy
        cmp #25
        bcc :+
        jsr scroll
        lda #24
        sta cy
:       rts

; Rows 2-24 up by one, row 24 cleared (row 0 is the title).
scroll:
        ldx #0                  ; four parts one after another (each part's source is still intact)
:       lda SCREEN_ + 80,x
        sta SCREEN_ + 40,x
        inx
        cpx #230
        bne :-
        ldx #0
:       lda SCREEN_ + 80 + 230,x
        sta SCREEN_ + 40 + 230,x
        inx
        cpx #230
        bne :-
        ldx #0
:       lda SCREEN_ + 80 + 460,x
        sta SCREEN_ + 40 + 460,x
        inx
        cpx #230
        bne :-
        ldx #0
:       lda SCREEN_ + 80 + 690,x
        sta SCREEN_ + 40 + 690,x
        inx
        cpx #230
        bne :-
        lda #40
        sta FILL_W
        lda #1
        sta FILL_H
        lda #GREEN
        sta COLOR
        lda #' '
        ldx #0
        ldy #24
        jmp API_FILL

; ---- output: lines go through the pipe filters to the screen ----------------------------------------------------
; A = char into the current line (10 ends it).
out_char:
        ldx sink
        beq :+
        inc cnt                 ; counting (a file's size)
        bne @r
        inc cnt+1
@r:     rts
:       cmp #10
        beq emit
        ldx llen
        sta LB,x
        inc llen
        rts

; End the current line: through the filters.
emit:   ldx llen
        lda #0
        sta LB,x
        sta llen
        ldx #0
@f:     cpx nfilt
        bcs to_screen
        lda filt,x
        cmp #P_GREP
        bne @nogrep
        stx o3
        jsr contains
        ldx o3
        bcc @drop
@next:  inx
        bne @f
@nogrep:
        cmp #P_HEAD
        bne :+
        lda fcount
        cmp #10
        bcs @drop
        inc fcount
        bne @next
:       cmp #P_TAIL
        bne :+
        jmp tail_store
:       cmp #P_WC
        bne :+
        inc fcount
        rts
:       cmp #P_BAD
        beq @drop
        bne @next               ; lolcat: as is
@drop:  rts
to_screen:
        ldx #0
:       lda LB,x
        beq :+
        stx o2
        jsr scr_putc
        ldx o2
        inx
        bne :-
:       lda cx                  ; a line that filled the row exactly already moved down
        bne :+
        cpx #0
        bne @done
:       jmp scr_nl
@done:  rts

; The line into the tail ring (the last 10 lines, 39 chars each kept).
tail_store:
        lda tailn
        cmp #10
        bcc @add
        ldx #0                  ; full: the oldest goes (slots 1-9 move down a slot: 360 bytes)
:       lda TAILB + 40,x
        sta TAILB,x
        inx
        cpx #180
        bne :-
        ldx #0
:       lda TAILB + 220,x
        sta TAILB + 180,x
        inx
        cpx #180
        bne :-
        lda #9
        sta tailn
@add:   ldx tailn
        jsr tail_slot
        ldy #0
:       lda LB,y
        sta (o2_p),y
        beq :+
        iny
        cpy #39
        bne :-
        lda #0
        sta (o2_p),y
:       inc tailn
        rts

; X = slot -> o2_p = TAILB + 40 × X.
tail_slot:
        lda tslot_lo,x
        sta o2_p
        lda tslot_hi,x
        sta o2_p+1
        rts

; After a command: the last part line, then what tail / wc collected.
end_output:
        lda llen
        beq :+
        jsr emit
:       ldx nfilt
        beq @done
        dex
        lda filt,x
        cmp #P_TAIL
        bne @wc
        lda #0                  ; print the ring without filters
        sta nfilt
        ldx #0
@t:     cpx tailn
        bcs @done
        stx o3
        jsr tail_slot
        ldy #0
:       lda (o2_p),y
        sta LB,y
        beq :+
        iny
        bne :-
:       sty llen
        jsr emit
        ldx o3
        inx
        bne @t
@wc:    cmp #P_WC
        bne @bad
        lda fcount
        jsr dec3
        lda #0
        sta nfilt
        lda #<numbuf
        ldx #>numbuf
        jmp out_line
@bad:   cmp #P_BAD
        bne @done
        lda #0
        sta nfilt
        lda #<bad_cmd           ; '<pc>: pipes to "<pc>" are not in this quarter's budget.'
        ldx #>bad_cmd
        jsr out_str
        lda #<s_pipes1
        ldx #>s_pipes1
        jsr out_str
        lda #<bad_cmd
        ldx #>bad_cmd
        jsr out_str
        lda #<s_pipes2
        ldx #>s_pipes2
        jmp out_line
@done:  rts

flush:  rts

; C=1 if LB contains PAT (ignoring case).
contains:
        ldx #0
@start: ldy #0
        stx o0
@cmp:   lda PAT,y
        beq @yes
        lda LB,x
        beq @no
        jsr lower
        sta o1
        lda PAT,y
        jsr lower
        cmp o1
        bne @adv
        inx
        iny
        bne @cmp
@adv:   ldx o0
        inx
        lda LB-1,x
        bne @start
@no:    clc
        rts
@yes:   sec
        rts

lower:  cmp #'A'
        bcc :+
        cmp #'Z' + 1
        bcs :+
        ora #$20
:       rts

; A/X = string (10 = new line), then a new line.
out_line:
        jsr out_str
        lda #10
        jmp out_char
; A/X = string (byte pairs expand; plain text passes as it is).
out_str = out_tpl
; A/X = several plain lines (each 0-terminated, an empty one ends them).
out_lines:
        sta p2
        stx p2+1
@l:     ldy #0
        lda (p2),y
        beq @done
        lda p2
        ldx p2+1
        jsr out_line
        ldy #0
:       lda (p2),y
        beq :+
        iny
        bne :-
:       iny
        tya
        clc
        adc p2
        sta p2
        bcc @l
        inc p2+1
        bne @l
@done:  rts

; A/X = template (byte pairs + placeholders), then a new line.
out_tline:
        jsr out_tpl
        lda #10
        jmp out_char
; A/X = template.
out_tpl:
        sta p1
        stx p1+1
        ldy #0
@n:     lda (p1),y
        beq @done
        iny
        sty wpos
        jsr tchar
        ldy wpos
        jmp @n
@done:  rts
; A = template symbol: pairs expand, placeholders become their strings.
tchar:  cmp #$80
        bcc @lit
        tax
        lda tbpe_b - 128,x
        pha
        lda tbpe_a - 128,x
        jsr tchar
        pla
        jmp tchar
@lit:   cmp #13
        bcs @c
        cmp #10
        beq @c
        tax
        lda ph_lo,x
        sta p0
        lda ph_hi,x
        sta p0+1
        txa
        pha
        jsr ph_fill             ; some placeholders are computed
        pla
        lda p1
        pha
        lda p1+1
        pha
        lda wpos
        pha
        lda p0
        ldx p0+1
        jsr out_str_keep
        pla
        sta wpos
        pla
        sta p1+1
        pla
        sta p1
        rts
@c:     jmp out_char

; Like out_str but keeps p2 (used inside templates).
out_str_keep:
        sta p0
        stx p0+1
        ldy #0
:       lda (p0),y
        beq :+
        sty o3
        jsr out_char
        ldy o3
        iny
        bne :-
:       rts

; A = placeholder: computed ones into PHB (floor, units, title, floor name, department, command).
ph_fill:
        cmp #3
        bne :+
        lda st_floor            ; floor number
        jsr dec3
        lda #<numbuf
        sta p0
        lda #>numbuf
        sta p0+1
        rts
:       cmp #5
        bne :+
        ldx st_max              ; title of the highest floor
        dex
        lda ti_lo,x
        ldy ti_hi,x
        jmp decode_to_p0
:       cmp #6
        bne :+
        ldx st_floor
        dex
        lda fn_lo,x
        ldy fn_hi,x
        jmp decode_to_p0
:       cmp #11
        bne :+
        ldx st_floor            ; previous floor's unit (at least level01)
        dex
        bne @u
        inx
@u:     txa
        jmp unit_name
:       cmp #12
        bne :+
        lda st_floor
        jmp unit_name
:       rts

; A = floor -> p0 = "levelNN.target" (UNITB).
unit_name:
        jsr two_digits
        stx UNITB + 5
        sta UNITB + 6
        lda #<UNITB
        sta p0
        lda #>UNITB
        sta p0+1
        rts

; A/Y = template without placeholders (a name) -> decoded into DECB, p0 = DECB.
decode_to_p0:
        sta p0
        sty p0+1
        lda #0
        sta q2
        ldy #0
@n:     lda (p0),y
        beq @done
        iny
        sty q1
        jsr @emit
        ldy q1
        jmp @n
@done:  ldx q2
        lda #0
        sta DECB,x
        lda #<DECB
        sta p0
        lda #>DECB
        sta p0+1
        rts
@emit:  cmp #$80
        bcc @lit
        tax
        lda tbpe_b - 128,x
        pha
        lda tbpe_a - 128,x
        jsr @emit
        pla
        jmp @emit
@lit:   ldx q2
        sta DECB,x
        inc q2
        rts

; ---- input -------------------------------------------------------------------------------------------------------
; The prompt, then an edited line in LINE. C=1 for RUN/STOP (close).
read_line:
        jsr prompt
        lda #0
        sta ilen
        sta LINE
        lda hcount
        sta hpos
@k:     jsr cursor
        jsr API_WAIT
        jsr API_KEY
        beq @k
        cmp #K_STOP
        bne :+
        jsr uncursor
        sec
        rts
:       cmp #K_RETURN
        bne :+
        jsr uncursor
        jsr scr_nl
        ldx ilen
        lda #0
        sta LINE,x
        clc
        rts
:       cmp #K_DEL
        bne :+
        ldx ilen
        beq @k
        jsr uncursor
        dec ilen
        jsr back_cursor
        jmp @k
:       cmp #K_UP
        bne :+
        lda hpos
        beq @k
        dec hpos
        jsr recall
        jmp @k
:       cmp #K_DOWN
        bne :+
        lda hpos
        cmp hcount
        bcs @k
        inc hpos
        jsr recall
        jmp @k
:       cmp #K_F1
        bne :+
        jsr complete
        jmp @k
:       jsr key_ascii
        cmp #0
        beq @k
        ldx ilen
        cpx #63
        bcs @k
        sta LINE,x
        inc ilen
        pha
        jsr uncursor
        pla
        jsr scr_putc
        jmp @k

cursor: lda $a2
        and #16
        beq uncursor
        lda #31                 ; CH_CURSOR
        .byte $2c
uncursor:
        lda #' '
        pha
        lda #GREEN
        sta COLOR
        ldx cx
        ldy cy
        pla
        jmp API_PUTC

; One char back (also over a line break).
back_cursor:
        lda cx
        bne :+
        lda #40
        sta cx
        dec cy
:       dec cx
        lda #' '
        ldx cx
        ldy cy
        jmp API_PUTC

; History entry hpos (hcount = a new empty line) into LINE, redrawn.
recall:
        jsr uncursor
:       lda ilen
        beq :+
        dec ilen
        jsr back_cursor
        jmp :-
:       lda hpos
        cmp hcount
        bne :+
        lda #0
        sta LINE
        rts
:       asl
        asl
        asl
        asl
        asl
        asl
        tax
        ldy #0
:       lda HIST,x
        sta LINE,y
        beq :+
        jsr scr_putc_keep
        inx
        iny
        bne :-
:       sty ilen
        rts
scr_putc_keep:
        stx t0
        sty t1
        jsr scr_putc
        ldx t0
        ldy t1
        rts

; PETSCII -> ASCII (Z=1: not typable). Letters lower case, shifted upper case; pound "|", up arrow "~",
; back arrow "_".
key_ascii:
        cmp #92
        bne :+
        lda #'|'
        rts
:       cmp #94
        bne :+
        lda #'~'
        rts
:       cmp #95
        bne :+
        lda #'_'
        rts
:       cmp #65
        bcc @low
        cmp #91
        bcs :+
        ora #$20
        rts
:       cmp #193
        bcc @no
        cmp #219
        bcs @no
        and #$7f
        rts
@low:   cmp #32
        bcc @no
        rts
@no:    lda #0
        rts

; "user@host:cwd$ "
prompt: lda #<USER
        ldx #>USER
        jsr scr_str
        lda #'@'
        jsr scr_putc
        lda #<HOST
        ldx #>HOST
        jsr scr_str
        lda #':'
        jsr scr_putc
        jsr short_cwd
        lda #'$'
        jsr scr_putc
        lda #' '
        jmp scr_putc
scr_str:
        sta p0
        stx p0+1
        ldy #0
:       lda (p0),y
        beq :+
        sty t1
        jsr scr_putc
        ldy t1
        iny
        bne :-
:       rts

; CWD with HOME shown as "~".
short_cwd:
        ldx #0
:       lda HOME,x
        beq @home
        cmp CWD,x
        bne @full
        inx
        bne :-
@home:  lda CWD,x
        beq :+
        cmp #'/'
        bne @full
:       stx t0
        lda #'~'
        jsr scr_putc
        ldx t0
:       lda CWD,x
        beq @done
        stx t0
        jsr scr_putc
        ldx t0
        inx
        bne :-
@done:  rts
@full:  lda #<CWD
        ldx #>CWD
        jmp scr_str

; F1: complete the first word as a command.
complete:
        lda ilen
        beq @done
        ldx #0
:       lda LINE,x              ; only while typing the first word
        cmp #' '
        beq @done
        inx
        cpx ilen
        bne :-
        ldx #0
@c:     stx t2
        lda cm_lo,x
        sta p0
        lda cm_hi,x
        sta p0+1
        ldy #0
:       cpy ilen
        beq @hit
        lda (p0),y
        cmp LINE,y
        bne @next
        iny
        bne :-
@next:  ldx t2
        inx
        cpx #CMD_N
        bne @c
@done:  rts
@hit:   jsr uncursor
:       lda (p0),y              ; type the rest
        beq :+
        ldx ilen
        sta LINE,x
        inc ilen
        sty t1
        jsr scr_putc
        ldy t1
        iny
        bne :-
:       rts

; ---- running a line --------------------------------------------------------------------------------------------
run_line:
        lda ilen
        bne :+
        rts
:       jsr hist_add
        ldx #0                  ; WORK = LINE
:       lda LINE,x
        sta WORK,x
        beq :+
        inx
        bne :-
:       lda #0
        sta seg_s
@seg:   ldx seg_s               ; a segment ends at "&&", ";" or the end
        stx seg_e
:       ldx seg_e
        lda WORK,x
        beq @last
        cmp #';'
        beq @sep1
        cmp #'&'
        bne :+
        lda WORK+1,x
        cmp #'&'
        beq @sep2
:       inc seg_e
        jmp :--
@sep2:  lda #0
        sta WORK,x
        inc seg_e
        jmp @run
@sep1:  lda #0
        sta WORK,x
        jmp @run
@last:  lda #$ff
        sta t0
        jmp @run2
@run:   lda #0
        sta t0
@run2:  lda t0
        pha
        jsr run_segment
        pla
        bne @done               ; that was the last one
        lda exitf
        ora warpf
        bne @done
        ldx seg_e
        inx
        stx seg_s
        jmp @seg
@done:  rts

; Remember LINE (the last HISTN).
hist_add:
        lda hcount
        cmp #HISTN
        bcc :+
        ldx #0                  ; drop the oldest
@sh:    lda HIST + 64,x
        sta HIST,x
        lda HIST + 64 + 192,x
        sta HIST + 192,x
        inx
        cpx #192
        bne @sh
        dec hcount
:       lda hcount
        asl
        asl
        asl
        asl
        asl
        asl
        tax
        ldy #0
:       lda LINE,y
        sta HIST,x
        beq :+
        inx
        iny
        bne :-
:       inc hcount
        rts

; WORK[seg_s..]: the command and its pipes.
run_segment:
        lda #0
        sta nfilt
        sta fcount
        sta tailn
        sta sink
        ldx seg_s               ; pipes: from the end of the command part
@p:     lda WORK,x
        beq @np
        cmp #'|'
        beq @pipe
        inx
        bne @p
@pipe:  lda #0
        sta WORK,x
        inx
        jsr add_filter
        jmp @p
@np:    lda seg_s
        jsr tokenize
        jsr exec
        jmp end_output

; X = start of a pipe command in WORK: its filter (the rest of the pipe stays for the next one).
add_filter:
        stx t0
:       lda WORK,x              ; skip spaces
        cmp #' '
        bne :+
        inx
        bne :-
:       stx t0
        ldy #0                  ; the pipe's command word -> bad_cmd
:       lda WORK,x
        beq :+
        cmp #' '
        beq :+
        cmp #'|'
        beq :+
        sta bad_cmd,y
        iny
        inx
        cpy #15
        bne :-
:       lda #0
        sta bad_cmd,y
        stx t1
        ldx nfilt
        cpx #4
        bcs @end
        lda #<bad_cmd
        sta p0
        lda #>bad_cmd
        sta p0+1
        lda #<n_grep
        ldy #>n_grep
        jsr streq
        bne :+
        lda #P_GREP
        sta filt,x
        inc nfilt
        ldx t1                  ; its pattern: the next word
        jsr pattern
        jmp @end
:       lda #<n_head
        ldy #>n_head
        jsr streq
        bne :+
        lda #P_HEAD
        bne @set
:       lda #<n_tail
        ldy #>n_tail
        jsr streq
        bne :+
        lda #P_TAIL
        bne @set
:       lda #<n_wc
        ldy #>n_wc
        jsr streq
        bne :+
        lda #P_WC
        bne @set
:       lda #<n_lolcat
        ldy #>n_lolcat
        jsr streq
        bne :+
        lda #P_LOL
        bne @set
:       lda #P_BAD
@set:   ldx nfilt
        sta filt,x
        inc nfilt
@end:   ldx t1                  ; continue after this pipe's text (next "|" handled by the caller)
:       lda WORK,x
        beq :+
        cmp #'|'
        beq :+
        inx
        bne :-
:       dex
        rts

; X = in WORK after "grep": the next word -> PAT.
pattern:
:       lda WORK,x
        cmp #' '
        bne :+
        inx
        bne :-
:       ldy #0
:       lda WORK,x
        beq :+
        cmp #' '
        beq :+
        cmp #'|'
        beq :+
        cmp #'"'
        beq @q
        sta PAT,y
        iny
@q:     inx
        bne :-
:       lda #0
        sta PAT,y
        rts

; p0 = string, A/Y = string: Z=1 if equal.
streq:  sta p1
        sty p1+1
        ldy #0
:       lda (p0),y
        cmp (p1),y
        bne :+
        cmp #0
        beq :+
        iny
        bne :-
:       rts

; A = start in WORK: the words of the command (quotes group, $VARs expand) into ARGS; argv_lo/hi, argc.
tokenize:
        sta rp
        lda #0
        sta argc
        sta wp
@word:  ldx rp                  ; skip spaces
        lda WORK,x
        beq @end
        cmp #' '
        bne :+
        inc rp
        bne @word
:       lda argc
        cmp #MAXARG
        bcs @end
        tax
        lda wp
        clc
        adc #<ARGS
        sta argv_lo,x
        lda #>ARGS
        adc #0
        sta argv_hi,x
        inc argc
        lda #0
        sta inq
@ch:    ldx rp
        lda WORK,x
        beq @wend
        cmp #34                 ; "
        beq @quote
        cmp #$27                ; '
        beq @quote
        ldy inq
        bne :+
        cmp #' '
        beq @wend
:       cmp #'$'
        bne :+
        jsr dollar
        jmp @ch
:       jsr put_arg
        inc rp
        jmp @ch
@quote: lda inq
        eor #1
        sta inq
        inc rp
        jmp @ch
@wend:  lda #0
        jsr put_arg
        jmp @word
@end:   rts

; A -> ARGS[wp++].
put_arg:
        ldx wp
        sta ARGS,x
        inc wp
        rts

; rp at "$": "$?" -> 0, $NAME / ${NAME} -> its value (unknown: nothing).
dollar: inc rp
        ldx rp
        lda WORK,x
        cmp #'?'
        bne :+
        inc rp
        lda #'0'
        jmp put_arg
:       cmp #'{'
        bne :+
        inc rp
:       ldy #0                  ; the name: A-Z and _
@n:     ldx rp
        lda WORK,x
        cmp #'_'
        beq @c
        cmp #'A'
        bcc @nend
        cmp #'Z' + 1
        bcs @nend
@c:     sta VNAME,y
        iny
        inc rp
        cpy #15
        bne @n
@nend:  lda #0
        sta VNAME,y
        ldx rp
        lda WORK,x
        cmp #'}'
        bne :+
        inc rp
:       lda #<VNAME
        sta p0
        lda #>VNAME
        sta p0+1
        ldx #0
@v:     stx t2
        lda var_lo,x
        ldy var_hi,x
        jsr streq
        beq @hit
        ldx t2
        inx
        cpx #VAR_N
        bne @v
        rts
@hit:   ldx t2
        cpx #3                  ; FLOOR: the number
        bne :+
        lda st_floor
        jsr dec3
:       ldx t2
        lda val_lo,x
        sta p1
        lda val_hi,x
        sta p1+1
        ldy #0
:       lda (p1),y
        beq :+
        sty t3
        jsr put_arg
        ldy t3
        iny
        bne :-
:       rts

; argv word X -> p0.
argp:   lda argv_lo,x
        sta p0
        lda argv_hi,x
        sta p0+1
        rts

; ---- commands ------------------------------------------------------------------------------------------------------
exec:   lda argc
        bne :+
        rts
:       ldx #0
        jsr argp
        ldx #0                  ; the built-in commands
@c:     stx t2
        lda bi_lo,x
        ldy bi_hi,x
        jsr streq
        beq @bi
        ldx t2
        inx
        cpx #BI_N
        bne @c
        ldx #0                  ; the ones with a fixed text
@s:     stx t2
        lda sw_lo,x
        ldy sw_hi,x
        jsr streq
        beq @simple
        ldx t2
        inx
        cpx #SIMPLE_N
        bne @s
        jsr cmd0                ; "<cmd>: command not found"
        lda #<s_notfound
        ldx #>s_notfound
        jmp out_line
@bi:    lda t2
        asl
        tax
        lda bi_jump+1,x
        pha
        lda bi_jump,x
        pha
        rts
@simple:
        ldy #0                  ; the command's name (placeholder 9)
:       lda (p0),y
        sta cmdname,y
        beq :+
        iny
        cpy #15
        bne :-
:       ldx t2
        lda sw_out,x
        tax
        lda so_lo,x
        pha
        lda so_hi,x
        tax
        pla
        jsr out_tline
        ldx t2                  ; "exit" closes
        lda sw_out,x
        cmp #EXIT_OUT
        bne :+
        lda #1
        sta exitf
:       rts

; The command word (argv 0) to the output.
cmd0:   ldx #0
        jsr argp
        lda p0
        ldx p0+1
        jmp out_str

c_help: lda #<s_help1
        ldx #>s_help1
        jsr out_line
        lda #0
        sta t2
@row:   lda #' '
        jsr out_char
        lda #' '
        jsr out_char
        lda #9
        sta t3
@w:     ldx t2
        cpx #CMD_N
        bcs @end
        lda cm_lo,x
        ldy cm_hi,x
        tax
        tya
        stx p0
        sta p0+1
        lda p0
        ldx p0+1
        jsr out_str
        inc t2
        dec t3
        beq @nl
        lda #' '
        jsr out_char
        jmp @w
@nl:    lda #10
        jsr out_char
        jmp @row
@end:   lda #10
        jsr out_char
        lda #<s_help2
        ldx #>s_help2
        jmp out_line

c_echo: ldx #1
@a:     cpx argc
        bcs @nl
        stx t2
        jsr argp
        lda p0
        ldx p0+1
        jsr out_str
        ldx t2
        inx
        cpx argc
        bcs @nl
        stx t2
        lda #' '
        jsr out_char
        ldx t2
        bne @a
@nl:    lda #10
        jmp out_char

c_clear:
        lda #0
        sta COLOR
        lda #24
        sta FILL_H
        lda #40
        sta FILL_W
        lda #' '
        ldx #0
        ldy #1
        jsr API_FILL
        lda #0
        sta cx
        lda #1
        sta cy
        rts

c_pwd:  lda #<CWD
        ldx #>CWD
        jmp out_line

c_date: lda #<s_date            ; "Today 09:mm:ss SYNERGY TIME" (the C64 has no calendar clock)
        ldx #>s_date
        jsr out_str
        lda $dc0b               ; CIA time-of-day since boot, shown as office hours from 09:00
        lda $dc0a
        and #$7f
        jsr bcd2
        lda #':'
        jsr out_char
        lda $dc09
        jsr bcd2
        lda $dc08
        lda #<s_date2
        ldx #>s_date2
        jmp out_line
bcd2:   pha
        lsr
        lsr
        lsr
        lsr
        ora #'0'
        jsr out_char
        pla
        and #15
        ora #'0'
        jmp out_char

c_history:
        lda #0
        sta t2
@h:     lda t2
        cmp hcount
        bcs @done
        clc
        adc #1
        jsr dec3
        lda #' '
        jsr out_char
        lda #' '
        jsr out_char
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #' '
        jsr out_char
        jsr out_char
        lda t2
        asl
        asl
        asl
        asl
        asl
        asl
        clc
        adc #<HIST
        tay
        lda #>HIST
        adc #0
        tax
        tya
        jsr out_line
        inc t2
        bne @h
@done:  rts

c_man:  lda argc
        cmp #2
        bcs :+
        lda #<s_man0
        ldx #>s_man0
        jmp out_line
:       ldx #1
        jsr argp
        ldx #0
@m:     stx t2
        lda mw_lo,x
        ldy mw_hi,x
        jsr streq
        beq @hit
        ldx t2
        inx
        cpx #MAN_N
        bne @m
        lda #<s_noman
        ldx #>s_noman
        jsr out_str
        ldx #1
        jsr argp
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_noman2
        ldx #>s_noman2
        jmp out_line
@hit:   ldx t2
        lda mt_lo,x
        pha
        lda mt_hi,x
        tax
        pla
        jmp out_tline

c_sudo: jsr rest_args           ; the words after "sudo" -> TBUF
        lda #<TBUF
        sta p0
        lda #>TBUF
        sta p0+1
        lda #<n_sandwich
        ldy #>n_sandwich
        jsr streq
        bne :+
        lda #<s_okay
        ldx #>s_okay
        jmp out_line
:       lda st_max
        cmp #TFLOORS
        bcc :+
        lda #<s_ceo
        ldx #>s_ceo
        jmp out_line
:       lda #<s_sudopw
        ldx #>s_sudopw
        jsr out_str
        lda #<USER
        ldx #>USER
        jsr out_str
        lda #<s_sudopw2
        ldx #>s_sudopw2
        jsr out_line
        lda #<USER
        ldx #>USER
        jsr out_str
        lda #<s_sudoers
        ldx #>s_sudoers
        jmp out_line

; Words 1.. joined by spaces into TBUF.
rest_args:
        ldy #0
        ldx #1
@a:     cpx argc
        bcs @end
        stx t2
        jsr argp
        sty t1
        ldy #0
:       lda (p0),y
        beq :+
        sty t0
        ldy t1
        sta TBUF,y
        inc t1
        ldy t0
        iny
        bne :-
:       ldy t1
        ldx t2
        inx
        cpx argc
        bcs @end
        lda #' '
        sta TBUF,y
        iny
        bne @a
@end:   lda #0
        sta TBUF,y
        rts

c_rm:   ldx #1                  ; "rm -rf /": nice try
        lda #0
        sta t0                  ; has -r..
        sta t1                  ; has / or /*
        sta t3                  ; first operand
@a:     cpx argc
        bcs @eval
        stx t2
        jsr argp
        ldy #0
        lda (p0),y
        cmp #'-'
        bne @op
:       iny                     ; a flag with r?
        lda (p0),y
        beq @next
        cmp #'r'
        bne :-
        inc t0
        bne @next
@op:    lda t3
        bne :+
        stx t3
:       ldy #0
        lda (p0),y
        cmp #'/'
        bne @next
        iny
        lda (p0),y
        beq @slash
        cmp #'*'
        bne @next
        iny
        lda (p0),y
        bne @next
@slash: inc t1
@next:  ldx t2
        inx
        bne @a
@eval:  lda t0
        beq :+
        lda t1
        beq :+
        lda #<s_tower
        ldx #>s_tower
        jmp out_line
:       lda t3
        bne :+
        jsr cmd0
        lda #<s_missing
        ldx #>s_missing
        jmp out_line
:       jsr cmd0
        lda #<s_cantrm
        ldx #>s_cantrm
        jsr out_str
        ldx t3
        jsr argp
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_cantrm2
        ldx #>s_cantrm2
        jmp out_line

c_ping: ldx #1                  ; the host: first word without "-"
:       cpx argc
        bcs @lh
        jsr argp
        ldy #0
        lda (p0),y
        cmp #'-'
        bne :+
        inx
        bne :-
@lh:    lda #<n_localhost
        sta p0
        lda #>n_localhost
        sta p0+1
:       lda p0
        sta pinghost
        lda p0+1
        sta pinghost+1
        lda #<s_ping1
        ldx #>s_ping1
        jsr out_str
        jsr ping_host
        lda #<s_ping2
        ldx #>s_ping2
        jsr out_line
        ldx #0
@r:     stx t2
        lda #<s_ping3
        ldx #>s_ping3
        jsr out_str
        jsr ping_host
        lda #<s_ping4
        ldx #>s_ping4
        jsr out_str
        ldx t2
        txa
        clc
        adc #'1'
        jsr out_char
        lda #<s_ping5
        ldx #>s_ping5
        jsr out_str
        ldx t2
        lda pingt_lo,x
        ldy pingt_hi,x
        sta num
        sty num+1
        jsr dec16
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #<s_ms
        ldx #>s_ms
        jsr out_line
        ldx t2
        inx
        cpx #3
        bne @r
        lda #<s_ping6
        ldx #>s_ping6
        jsr out_str
        jsr ping_host
        lda #<s_ping7
        ldx #>s_ping7
        jsr out_line
        lda #<s_ping8
        ldx #>s_ping8
        jmp out_line
ping_host:
        lda pinghost
        ldx pinghost+1
        jmp out_str

c_ssh:  lda #<s_ssh1
        ldx #>s_ssh1
        jsr out_str
        lda argc
        cmp #2
        bcs :+
        lda #<s_nowhere
        ldx #>s_nowhere
        jsr out_str
        jmp @r
:       ldx #1
        jsr argp
        lda p0
        ldx p0+1
        jsr out_str
@r:     lda #<s_ssh2
        ldx #>s_ssh2
        jmp out_line

c_git:  lda argc
        cmp #2
        bcc @usage
        ldx #1
        jsr argp
        ldx #0
@g:     stx t2
        lda gs_lo,x
        ldy gs_hi,x
        jsr streq
        beq @hit
        ldx t2
        inx
        cpx #4
        bne @g
@usage: lda #<s_gitusage
        ldx #>s_gitusage
        jmp out_line
@hit:   ldx t2
        lda gt_lo,x
        pha
        lda gt_hi,x
        tax
        pla
        jmp out_lines

c_make: jsr rest_args
        lda #<TBUF
        sta p0
        lda #>TBUF
        sta p0+1
        lda #<n_mesandwich
        ldy #>n_mesandwich
        jsr streq
        bne :+
        lda #<s_makeit
        ldx #>s_makeit
        jmp out_line
:       lda #<s_make1
        ldx #>s_make1
        jsr out_str
        lda argc
        cmp #2
        bcs :+
        lda #<s_money
        ldx #>s_money
        jsr out_str
        jmp @r
:       ldx #1
        jsr argp
        lda p0
        ldx p0+1
        jsr out_str
@r:     lda #<s_make2
        ldx #>s_make2
        jmp out_line

c_fortune:
        lda #FORTUNE_N
        jsr API_RMOD
        tax
        lda fo_lo,x
        pha
        lda fo_hi,x
        tax
        pla
        jmp out_tline

c_cowsay:
        jsr rest_args
        lda TBUF
        bne :+
        ldx #0
@d:     lda n_moo,x
        sta TBUF,x
        beq :+
        inx
        bne @d
:       ldy #0                  ; length (max 60 for the bar)
:       lda TBUF,y
        beq :+
        iny
        bne :-
:       iny
        iny
        cpy #61
        bcc :+
        ldy #60
:       sty t3
        jsr cow_bar
        lda #'<'
        jsr out_char
        lda #' '
        jsr out_char
        lda #<TBUF
        ldx #>TBUF
        jsr out_str
        lda #<s_cowend
        ldx #>s_cowend
        jsr out_line
        jsr cow_bar
        lda #<s_cow
        ldx #>s_cow
        jmp out_lines
cow_bar:
        lda #' '
        jsr out_char
        ldx t3
:       stx t2
        lda #'-'
        jsr out_char
        ldx t2
        dex
        bne :-
        lda #10
        jmp out_char

c_which:
        lda argc
        cmp #2
        bcs :+
        rts
:       ldx #1
        jsr argp
        ldx #0
@w:     stx t2
        lda cm_lo,x
        ldy cm_hi,x
        jsr streq
        beq @hit
        ldx t2
        inx
        cpx #CMD_N
        bne @w
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_notfound2
        ldx #>s_notfound2
        jmp out_line
@hit:   lda #<s_usrbin
        ldx #>s_usrbin
        jsr out_str
        lda p0
        ldx p0+1
        jmp out_line

c_uname:
        ldx #1
:       cpx argc
        bcs @short
        jsr argp
        lda #<n_dasha
        ldy #>n_dasha
        jsr streq
        beq @long
        inx
        bne :-
@short: lda #<s_synergyos
        ldx #>s_synergyos
        jmp out_line
@long:  lda #<s_uname1
        ldx #>s_uname1
        jsr out_str
        lda #<HOST
        ldx #>HOST
        jsr out_str
        lda #<s_uname2
        ldx #>s_uname2
        jmp out_line

c_journal:
        ldx #1
:       cpx argc
        bcs @all
        jsr argp
        lda #<n_dashu
        ldy #>n_dashu
        jsr streq
        beq :+
        inx
        bne :-
@all:   lda #JOURNAL_OUT        ; (the full log is a fixed text)
        jmp simple_out
:       lda #<s_noentries
        ldx #>s_noentries
        jmp out_line
simple_out:
        tax
        lda so_lo,x
        pha
        lda so_hi,x
        tax
        pla
        jmp out_tline

; ---- files ------------------------------------------------------------------------------------------------------
; p0 = path argument -> RBUF = absolute path (cwd, ~, ., ..).
resolve:
        ldy #0
        lda (p0),y
        bne :+
        jmp @home
:       cmp #'/'
        bne :+
        lda #'/'                ; absolute
        sta RBUF
        lda #0
        sta RBUF+1
        iny
        jmp @segs
:       cmp #'~'
        bne @rel
        iny
        lda (p0),y
        beq @home
        cmp #'/'
        bne @rel0
        iny
        jsr @sethome
        jmp @segs
@rel0:  dey
@rel:   ldx #0                  ; from the cwd
:       lda CWD,x
        sta RBUF,x
        beq @segs
        inx
        bne :-
@home:  jsr @sethome
        rts
@sethome:
        ldx #0
:       lda HOME,x
        sta RBUF,x
        beq :+
        inx
        bne :-
:       rts
@segs:  sty t0                  ; segment by segment
@seg:   ldy t0
        lda (p0),y
        beq @done
        cmp #'/'
        bne :+
        inc t0
        bne @seg
:       cmp #'.'                ; "." or ".."
        bne @name
        iny
        lda (p0),y
        beq @dot
        cmp #'/'
        beq @dot
        cmp #'.'
        bne @name
        iny
        lda (p0),y
        beq @up
        cmp #'/'
        bne @name
@up:    sty t0                  ; ..: drop the last part
        jsr rlen
:       dex
        bmi :+
        lda RBUF,x
        cmp #'/'
        bne :-
:       cpx #0
        bne :+
        inx                     ; stay at "/"
:       lda #0
        sta RBUF,x
        jmp @seg
@dot:   sty t0
        jmp @seg
@name:  jsr rlen                ; append "/name"
        cpx #1
        bne :+
        dex                     ; RBUF is "/"
:       lda #'/'
        sta RBUF,x
        inx
        ldy t0
:       lda (p0),y
        beq :+
        cmp #'/'
        beq :+
        sta RBUF,x
        inx
        iny
        bne :-
:       lda #0
        sta RBUF,x
        sty t0
        jmp @seg
@done:  rts
rlen:   ldx #0
:       lda RBUF,x
        beq :+
        inx
        bne :-
:       rts

; Entry X's path (with ~ = HOME and the floor's unit name) -> PBUF.
fs_path:
        stx t1
        lda fp_lo,x
        sta p1
        lda fp_hi,x
        sta p1+1
        ldx #0
        ldy #0
        lda (p1),y
        cmp #'~'
        bne @c
        iny
:       lda HOME,x
        beq @c
        sta PBUF,x
        inx
        bne :-
@c:     lda (p1),y
        beq @end
        cmp #12                 ; this floor's unit
        bne @lit
        sty t0
        stx t3
        lda st_floor
        jsr unit_name
        ldx t3
        ldy #0
:       lda UNITB,y
        beq :+
        sta PBUF,x
        inx
        iny
        bne :-
:       ldy t0
        iny
        bne @c
@lit:   sta PBUF,x
        inx
        iny
        bne @c
@end:   lda #0
        sta PBUF,x
        ldx t1
        rts

; RBUF -> X = its entry, C=1 if none.
fs_find:
        ldx #0
@e:     stx t2
        jsr fs_path
        ldy #0
:       lda PBUF,y
        cmp RBUF,y
        bne @next
        cmp #0
        beq @hit
        iny
        bne :-
@next:  ldx t2
        inx
        cpx #FS_N
        bne @e
        sec
        rts
@hit:   ldx t2
        clc
        rts

; Is entry X a child of directory RBUF? C=1 if yes; p2 = its name (in PBUF).
fs_child:
        jsr fs_path
        ldy #0
:       lda RBUF,y              ; RBUF a prefix of PBUF
        beq @pre
        cmp PBUF,y
        bne @no
        iny
        bne :-
@pre:   cpy #1                  ; "/" itself: the name starts right after it
        beq @root
        lda PBUF,y
        cmp #'/'
        bne @no
        iny
@root:  lda PBUF,y              ; not "/" itself, and no further "/"
        beq @no
        sty t0
:       lda PBUF,y
        beq :+
        cmp #'/'
        beq @no
        iny
        bne :-
:       lda t0
        clc
        adc #<PBUF
        sta p2
        lda #>PBUF
        adc #0
        sta p2+1
        sec
        rts
@no:    clc
        rts

; cat / less / more / head / tail FILE...
c_cat:  lda #0
        sta t3
        ldx #1
@a:     cpx argc
        bcs @end
        stx t2
        jsr argp
        ldy #0
        lda (p0),y
        cmp #'-'
        beq @next
        inc t3
        jsr read_file
@next:  ldx t2
        inx
        bne @a
@end:   lda t3
        bne :+
        jsr cmd0
        lda #<s_catmiss
        ldx #>s_catmiss
        jmp out_line
:       rts

; p0 = file argument: its text, or the error (argv 0 = the command name).
read_file:
        lda p0
        sta argsave
        lda p0+1
        sta argsave+1
        jsr resolve
        jsr fs_find
        bcc :+
        jsr err_prefix          ; "cmd: arg: No such file or directory"
        lda #<s_nosuch
        ldx #>s_nosuch
        jmp out_line
:       lda f_flags,x
        lsr
        bcc :+
        stx t1
        jsr err_prefix
        lda #<s_isdir
        ldx #>s_isdir
        jmp out_line
:       lsr
        bcc @text
        stx t1
        jsr err_prefix
        lda #<s_denied
        ldx #>s_denied
        jsr out_str
        ldx t1
        lda fl_lo,x
        sta p1
        lda fl_hi,x
        sta p1+1
        ldy #0
        lda (p1),y
        beq :+
        lda #<s_paren
        ldx #>s_paren
        jsr out_str
        ldx t1
        lda fl_lo,x
        pha
        lda fl_hi,x
        tax
        pla
        jsr out_tpl
        lda #')'
        jsr out_char
:       lda #10
        jmp out_char
@text:  lda fx_lo,x
        pha
        lda fx_hi,x
        tax
        pla
        jmp out_tline
; "cmd: arg: "
err_prefix:
        jsr cmd0
        lda #<s_colsp
        ldx #>s_colsp
        jsr out_str
        lda argsave
        ldx argsave+1
        jsr out_str
        lda #<s_colsp
        ldx #>s_colsp
        jmp out_str

c_cd:   lda argc
        cmp #2
        bcs :+
        lda #<n_tilde           ; cd alone: home
        sta p0
        lda #>n_tilde
        sta p0+1
        jmp :++
:       ldx #1
        jsr argp
:       lda p0
        sta argsave
        lda p0+1
        sta argsave+1
        jsr resolve
        jsr fs_find
        bcc :+
        lda #<s_cdnosuch
        ldx #>s_cdnosuch
        bne @err
:       lda f_flags,x
        lsr
        bcs :+
        lda #<s_cdnotdir
        ldx #>s_cdnotdir
        bne @err
:       lsr
        bcc :+
        lda #<s_cddenied
        ldx #>s_cddenied
@err:   jsr out_str
        lda argsave
        ldx argsave+1
        jmp out_line
:       ldx #0                  ; CWD = RBUF
:       lda RBUF,x
        sta CWD,x
        beq :+
        inx
        bne :-
:       rts

c_ls:   lda #0
        sta dfl
        ldx #0
        jsr argp
        lda #<n_ll
        ldy #>n_ll
        jsr streq
        bne :+
        lda #3
        sta dfl
:       lda #0
        sta t3                  ; target argument
        ldx #1
@a:     cpx argc
        bcs @go
        stx t2
        jsr argp
        ldy #0
        lda (p0),y
        cmp #'-'
        bne @tg
@fl:    iny
        lda (p0),y
        beq @nx
        cmp #'a'
        bne :+
        lda dfl
        ora #1
        sta dfl
:       cmp #'l'
        bne @fl
        lda dfl
        ora #2
        sta dfl
        jmp @fl
@tg:    lda t3
        bne @nx
        stx t3
@nx:    ldx t2
        inx
        bne @a
@go:    lda t3
        beq :+
        tax
        jsr argp
        jmp :++
:       lda #<n_dot
        sta p0
        lda #>n_dot
        sta p0+1
:       lda p0
        sta argsave
        lda p0+1
        sta argsave+1
        jsr resolve
        jsr fs_find
        bcc :+
        lda #<s_lsnosuch1
        ldx #>s_lsnosuch1
        jsr out_str
        lda argsave
        ldx argsave+1
        jsr out_str
        lda #<s_lsnosuch2
        ldx #>s_lsnosuch2
        jmp out_line
:       lda f_flags,x
        cmp #3                  ; a locked directory
        bne :+
        lda #<s_lsdenied1
        ldx #>s_lsdenied1
        jsr out_str
        lda argsave
        ldx argsave+1
        jsr out_str
        lda #<s_lsdenied2
        ldx #>s_lsdenied2
        jmp out_line
:       lda f_flags,x
        lsr
        bcs @dir
        lda dfl                 ; a file: its name (or its long line)
        and #2
        beq :+
        stx t1
        lda #<s_total4
        ldx #>s_total4
        jsr out_line
        lda argsave
        sta p2
        lda argsave+1
        sta p2+1
        ldx t1
        jmp ls_long
:       lda argsave
        ldx argsave+1
        jmp out_line
@dir:   lda dfl                 ; long: "total N"
        and #2
        beq @short
        lda #0
        sta t3
        ldx #0
:       stx t2
        jsr fs_child
        ldx t2
        bcc @c
        ldy #0
        lda (p2),y
        cmp #'.'
        bne @cn
        lda dfl
        lsr
        bcc @c
@cn:    inc t3
@c:     inx
        cpx #FS_N
        bne :-
        lda dfl                 ; (with -a: . and .. too)
        lsr
        bcc :+
        inc t3
        inc t3
:       lda t3
        asl
        asl
        jsr dec3
        lda #<s_total
        ldx #>s_total
        jsr out_str
        lda #<numbuf
        ldx #>numbuf
        jsr out_line
        lda dfl
        lsr
        bcc @list
        lda #<n_dotname         ; . and .. as directories
        sta p2
        lda #>n_dotname
        sta p2+1
        jsr ls_dirline
        lda #<n_dotdot
        sta p2
        lda #>n_dotdot
        sta p2+1
        jsr ls_dirline
        jmp @list
@short: lda dfl
        lsr
        bcc @list
        lda #<s_dots
        ldx #>s_dots
        jsr out_str
@list:  ldx #0
@e:     stx t2
        jsr fs_child
        bcc @en
        ldy #0
        lda (p2),y
        cmp #'.'
        bne :+
        lda dfl
        lsr
        bcc @en
:       lda dfl
        and #2
        beq @sh
        ldx t2
        jsr ls_long
        jmp @en
@sh:    lda p2
        ldx p2+1
        jsr out_str
        ldx t2
        lda f_flags,x
        lsr
        bcc :+
        lda #'/'
        jsr out_char
:       lda #' '
        jsr out_char
        jsr out_char
@en:    ldx t2
        inx
        cpx #FS_N
        bne @e
        lda dfl
        and #2
        bne :+
        lda #10
        jmp out_char
:       rts

; Entry X, name p2: "drw-r--r-- 1 owner  size Oct 10 09:00 name"
ls_long:
        stx t1
        lda p2                  ; keep the name (fs_path is called again below)
        sta lsname
        lda p2+1
        sta lsname+1
        lda f_flags,x
        lsr
        php
        lda #'-'
        plp
        bcc :+
        lda #'d'
:       jsr out_char
        ldx t1
        lda f_flags,x
        and #2
        beq :+
        lda #<s_permlock
        ldx #>s_permlock
        bne :++
:       lda #<s_perm
        ldx #>s_perm
:       jsr out_str
        ldx t1                  ; owner: the user for files at home, else root
        jsr fs_path
        ldy #0
:       lda HOME,y
        beq @mine
        cmp PBUF,y
        bne @root
        iny
        bne :-
@mine:  lda #<USER
        ldx #>USER
        bne :+
@root:  lda #<s_root
        ldx #>s_root
:       jsr out_pad8
        lda #' '
        jsr out_char
        ldx t1                  ; size: 4096 for a directory, else the text's length
        lda f_flags,x
        lsr
        bcc :+
        lda #<4096
        sta num
        lda #>4096
        sta num+1
        jmp @sz
:       lda #0
        sta cnt
        sta cnt+1
        inc sink
        lda fx_lo,x
        pha
        lda fx_hi,x
        tax
        pla
        jsr out_tpl
        dec sink
        lda cnt
        sta num
        lda cnt+1
        sta num+1
@sz:    jsr dec16
        jsr pad5
        lda #<s_lsdate
        ldx #>s_lsdate
        jsr out_str
        lda lsname
        ldx lsname+1
        jmp out_line
ls_dirline:
        lda p2
        sta lsname
        lda p2+1
        sta lsname+1
        lda #<s_dirperm
        ldx #>s_dirperm
        jsr out_str
        lda #<USER
        ldx #>USER
        jsr out_pad8
        lda #<s_dirsize
        ldx #>s_dirsize
        jsr out_str
        lda lsname
        ldx lsname+1
        jmp out_line

; A/X = string, padded to 8.
out_pad8:
        sta p1
        stx p1+1
        ldy #0
:       lda (p1),y
        beq :+
        sty t0
        jsr out_char
        ldy t0
        iny
        bne :-
:       cpy #8
        bcs :+
        sty t0
        lda #' '
        jsr out_char
        ldy t0
        iny
        bne :-
:       rts

; numbuf right-aligned in 5.
pad5:   ldy #0
:       lda numbuf,y
        beq :+
        iny
        bne :-
:       sty t0
:       lda t0
        cmp #5
        bcs :+
        lda #' '
        jsr out_char
        inc t0
        bne :-
:       lda #<numbuf
        ldx #>numbuf
        jmp out_str

c_grep: ldx #1                  ; pattern and file: the first two words without "-"
        lda #0
        sta t3
        sta t1
@a:     cpx argc
        bcs @go
        stx t2
        jsr argp
        ldy #0
        lda (p0),y
        cmp #'-'
        beq @n
        lda t3
        bne :+
        stx t3
        jmp @n
:       lda t1
        bne @n
        stx t1
@n:     ldx t2
        inx
        bne @a
@go:    lda t3
        bne :+
        lda #<s_grepusage
        ldx #>s_grepusage
        jmp out_line
:       lda t1
        bne :+
        lda #<s_grepstdin
        ldx #>s_grepstdin
        jmp out_line
:       ldx t3                  ; the pattern as a grep filter in front of the others
        jsr argp
        ldy #0
:       lda (p0),y
        sta PAT,y
        beq :+
        iny
        bne :-
:       ldx nfilt               ; (insert at the front)
        beq @ins
:       lda filt-1,x
        sta filt,x
        dex
        bne :-
@ins:   lda #P_GREP
        sta filt
        inc nfilt
        ldx t1
        jsr argp
        ldx #0                  ; errors read "grep: ..."
        jmp read_file

; ---- systemctl ----------------------------------------------------------------------------------------------------
c_systemctl:
        lda argc                ; verb (default list-units), unit argument
        cmp #2
        bcs :+
        lda #<n_listunits
        sta verb
        lda #>n_listunits
        sta verb+1
        jmp @v
:       ldx #1
        jsr argp
        lda p0
        sta verb
        lda p0+1
        sta verb+1
@v:     lda #0
        sta unitp+1
        lda argc
        cmp #3
        bcc :+
        ldx #2
        jsr argp
        jsr unit_of             ; -> UARG (".service" added when there is no dot and it isn't levelNN)
:       lda verb
        sta p0
        lda verb+1
        sta p0+1
        ldx #0
@vb:    stx t2
        lda vb_lo,x
        ldy vb_hi,x
        jsr streq
        beq @hit
        ldx t2
        inx
        cpx #VB_N
        bne @vb
        lda #<s_unknownverb
        ldx #>s_unknownverb
        jsr out_str
        lda verb
        ldx verb+1
        jsr out_str
        lda #'.'
        jsr out_char
        lda #10
        jmp out_char
@hit:   lda t2
        asl
        tax
        lda vb_jump+1,x
        pha
        lda vb_jump,x
        pha
        rts

; p0 = unit argument -> UARG, unitp = UARG; level = its floor (0 if not levelNN[.target]).
unit_of:
        ldy #0
        lda #0
        sta t3                  ; has a dot
:       lda (p0),y
        sta UARG,y
        beq :+
        cmp #'.'
        bne @nd
        inc t3
@nd:    iny
        bne :-
:       jsr level_of
        lda level
        bne @done
        lda t3
        bne @done
        ldx #0                  ; + ".service"
:       lda n_dotservice,x
        sta UARG,y
        beq @done
        inx
        iny
        bne :-
@done:  lda #<UARG
        sta unitp
        lda #>UARG
        sta unitp+1
        rts

; UARG -> level = NN for "levelN", "levelNN", "levelN(N).target" (1-99), else 0.
level_of:
        lda #0
        sta level
        ldx #0
:       lda n_level,x
        beq :+
        cmp UARG,x
        bne @no
        inx
        bne :-
:       lda UARG,x
        jsr isdig
        bcc @no
        and #15
        sta t0
        inx
        lda UARG,x
        jsr isdig
        bcc @one
        and #15
        sta t1
        lda t0                  ; tens × 10 + ones
        asl
        asl
        adc t0
        asl
        adc t1
        sta t0
        inx
@one:   lda UARG,x
        beq @ok
        ldy #0                  ; or ".target"
:       lda n_dottarget,y
        beq :+
        cmp UARG,x
        bne @no
        inx
        iny
        bne :-
:       lda UARG,x
        bne @no
@ok:    lda t0
        bne :+
        lda #100                ; level0 / level00: not a floor, but a level unit
:       sta level
@no:    rts
isdig:  cmp #'0'
        bcc @n
        cmp #'9' + 1
        bcs @n
        sec
        rts
@n:     clc
        rts

; list-units / list-targets / --type=target
sc_list:
        lda #0
        sta t3
        ldx #0                  ; list-targets or --type=target / -t target
        jsr argp_verb_targets
        lda #<s_unithead
        ldx #>s_unithead
        jsr out_line
        lda t3
        beq @svc
        lda #1
        sta t2
@t:     lda t2                  ; all floors
        jsr unit_row_floor
        inc t2
        lda t2
        cmp #TFLOORS + 1
        bne @t
        lda #<s_rowsynergy
        ldx #>s_rowsynergy
        jsr out_line
        lda #10
        jsr out_char
        lda #TFLOORS + 1
        jsr dec3
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #<s_listed
        ldx #>s_listed
        jmp out_line
@svc:   ldx #0
@s:     stx t2
        lda svc_row_lo,x
        pha
        lda svc_row_hi,x
        tax
        pla
        jsr out_line
        ldx t2
        inx
        cpx #6
        bne @s
        lda st_floor
        jsr unit_row_floor
        lda #<s_listed7
        ldx #>s_listed7
        jmp out_lines
argp_verb_targets:
        lda verb                ; "list-targets"
        sta p0
        lda verb+1
        sta p0+1
        lda #<n_listtargets
        ldy #>n_listtargets
        jsr streq
        bne :+
        inc t3
        rts
:       ldx #1                  ; any "--type=target", or "-t" and "target"
@a:     cpx argc
        bcs @done
        stx t2
        jsr argp
        lda #<n_typetarget
        ldy #>n_typetarget
        jsr streq
        bne :+
        inc t3
:       lda #<n_target
        ldy #>n_target
        jsr streq
        bne :+
        inc t3
:       ldx t2
        inx
        bne @a
@done:  rts

; A = floor: "levelNN.target  active  Floor N - name" (compact for 40 columns)
unit_row_floor:
        sta t1
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #' '
        jsr out_char
        lda #' '
        jsr out_char
        lda t1
        cmp st_floor
        bne :+
        lda #<s_activecol
        ldx #>s_activecol
        bne :++
:       lda #<s_inactivecol
        ldx #>s_inactivecol
:       jsr out_str
; "Floor N - name"
floor_desc:
        lda #<s_floorsp
        ldx #>s_floorsp
        jsr out_str
        lda t1
        jsr dec3
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        ldx t1
        dex
        lda fn_lo,x
        pha
        lda fn_hi,x
        tax
        pla
        jmp out_tline

sc_status:
        lda unitp+1
        bne :+
        lda #<s_stat1           ; no unit: the host
        ldx #>s_stat1
        jsr out_str
        lda #<HOST
        ldx #>HOST
        jsr out_line
        lda #<s_stat2
        ldx #>s_stat2
        jmp out_lines
:       lda level
        bne :+
        jmp @svc
:       cmp #TFLOORS + 1
        bcc :+
        jmp not_found
:       sta t1
        lda #<s_star            ; "* levelNN.target - Floor N - name"
        ldx #>s_star
        jsr out_str
        lda t1
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        jsr floor_desc
        lda #<s_loaded1
        ldx #>s_loaded1
        jsr out_str
        lda t1
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_static
        ldx #>s_static
        jsr out_line
        lda t1
        cmp st_floor
        bne :+
        lda #<s_activehere
        ldx #>s_activehere
        bne :++
:       lda #<s_inactivedead
        ldx #>s_inactivedead
:       jsr out_line
        lda #<s_docs            ; "Docs: man:<title-slug>(7)"
        ldx #>s_docs
        jsr out_str
        ldx t1
        dex
        lda ti_lo,x
        ldy ti_hi,x
        jsr decode_to_p0
        ldy #0
        sty t0                  ; in a run of non-letters
@sl:    lda (p0),y
        beq @sle
        jsr lower
        cmp #'a'
        bcc @nl
        cmp #'z' + 1
        bcs @nl
        sty t2
        jsr out_char
        ldy t2
        lda #0
        sta t0
        iny
        bne @sl
@nl:    lda t0
        bne :+
        sty t2
        lda #'-'
        jsr out_char
        ldy t2
        inc t0
:       iny
        bne @sl
@sle:   lda #<s_seven
        ldx #>s_seven
        jmp out_line
@svc:   jsr svc_index
        bcc :+
        jmp not_found
:       stx t1
        lda #<s_star
        ldx #>s_star
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        ldx t1
        lda svc_desc_lo,x
        pha
        lda svc_desc_hi,x
        tax
        pla
        jsr out_line
        lda #<s_loaded1
        ldx #>s_loaded1
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_enabled
        ldx #>s_enabled
        jsr out_line
        lda #<s_activec
        ldx #>s_activec
        jsr out_str
        ldx t1
        lda svc_state_lo,x
        pha
        lda svc_state_hi,x
        tax
        pla
        jsr out_line
        ldx t1
        lda svc_extra_hi,x
        beq :+
        pha
        lda svc_extra_lo,x
        tay
        pla
        tax
        tya
        jmp out_line
:       rts

; unitp -> X = service, C=1 if not one.
svc_index:
        lda unitp
        sta p0
        lda unitp+1
        sta p0+1
        ldx #0
:       stx t2
        lda svc_lo,x
        ldy svc_hi,x
        jsr streq
        beq :+
        ldx t2
        inx
        cpx #6
        bne :-
        sec
        rts
:       ldx t2
        clc
        rts

not_found:
        lda #<s_unit
        ldx #>s_unit
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_notfoundu
        ldx #>s_notfoundu
        jmp out_line

sc_isolate:
        lda unitp+1
        bne :+
        lda #<s_toofew
        ldx #>s_toofew
        jmp out_line
:       lda level
        bne @lvl
        jsr svc_index
        bcs :+
        lda #<s_failstart
        ldx #>s_failstart
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_refused
        ldx #>s_refused
        jmp out_line
:       jsr fail_start_nf
        jmp out_nl
@lvl:   cmp #TFLOORS + 1
        bcc :+
        jsr fail_start_nf       ; "Floor N is a rumour."
        lda #10
        jsr out_char
        lda #<s_rumour1
        ldx #>s_rumour1
        jsr out_str
        lda level
        cmp #100
        bne @n
        lda #0
@n:     jsr dec3
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #<s_rumour2
        ldx #>s_rumour2
        jmp out_line
:       cmp st_floor
        bne :+
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_already
        ldx #>s_already
        jmp out_line
:       lda #<s_stopping        ; Stopping / Stopped / Starting / Reached
        ldx #>s_stopping
        jsr out_str
        lda st_floor
        sta t1
        jsr unit_desc
        lda #<s_dots3
        ldx #>s_dots3
        jsr out_line
        lda #<s_stopped
        ldx #>s_stopped
        jsr out_str
        lda st_floor
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #'.'
        jsr out_char
        lda #10
        jsr out_char
        lda #<s_starting
        ldx #>s_starting
        jsr out_str
        lda level
        sta t1
        jsr unit_desc
        lda #<s_dots3
        ldx #>s_dots3
        jsr out_line
        lda #<s_reached
        ldx #>s_reached
        jsr out_str
        lda level
        sta t1
        jsr unit_desc
        lda #'.'
        jsr out_char
        lda #10
        jsr out_char
        lda level               ; only floors 1-2 are on this disk
        cmp #FLOORS_ON_DISK + 1
        bcc :+
        lda #<s_notondisk
        ldx #>s_notondisk
        jmp out_lines
:       lda #<s_calling
        ldx #>s_calling
        jsr out_line
        lda level
        sta warpf
        rts
; t1 = floor: "levelNN.target - Floor N - name" (no new line: floor_desc adds one... so print without it)
unit_desc:
        lda t1
        jsr unit_name
        lda p0
        ldx p0+1
        jsr out_str
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        lda #<s_floorsp
        ldx #>s_floorsp
        jsr out_str
        lda t1
        jsr dec3
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        ldx t1
        dex
        lda fn_lo,x
        pha
        lda fn_hi,x
        tax
        pla
        jmp out_tpl
fail_start_nf:
        lda #<s_failstart
        ldx #>s_failstart
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_unitnf1
        ldx #>s_unitnf1
        jsr out_str
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_unitnf2
        ldx #>s_unitnf2
        jmp out_str
out_nl: lda #10
        jmp out_char

; start / stop / restart / enable / disable / kill / mask
sc_ctl: lda unitp+1
        bne :+
        lda #<s_toofew
        ldx #>s_toofew
        jmp out_line
:       lda unitp
        sta p0
        lda unitp+1
        sta p0+1
        lda #<n_coffeesvc
        ldy #>n_coffeesvc
        jsr streq
        bne @nc
        lda verb                ; coffee: start / restart are fine (access denied anyway), the rest refused
        sta p0
        lda verb+1
        sta p0+1
        lda #<n_start
        ldy #>n_start
        jsr streq
        beq @deny
        lda #<n_restart
        ldy #>n_restart
        jsr streq
        beq @deny
        lda #<s_refusecoffee
        ldx #>s_refusecoffee
        jmp out_line
@nc:    lda #<n_motivsvc
        ldy #>n_motivsvc
        jsr streq
        bne :+
        lda #<s_motivfail
        ldx #>s_motivfail
        jmp out_lines
:       lda level
        beq @deny
        lda #<s_floorsno
        ldx #>s_floorsno
        jsr out_str
        lda verb
        ldx verb+1
        jsr out_str
        lda #<s_floorsno2
        ldx #>s_floorsno2
        jmp out_line
@deny:  lda #<s_failto
        ldx #>s_failto
        jsr out_str
        lda verb
        ldx verb+1
        jsr out_str
        lda #' '
        jsr out_char
        lda unitp
        ldx unitp+1
        jsr out_str
        lda #<s_accessdenied
        ldx #>s_accessdenied
        jmp out_lines

; poweroff / reboot / halt / suspend
sc_power:
        lda #<s_failto
        ldx #>s_failto
        jsr out_str
        lda verb
        ldx verb+1
        jsr out_str
        lda #<s_powerfail
        ldx #>s_powerfail
        jmp out_lines

.segment "RODATA"
; built-in commands (the rest are fixed texts from gen/term_data.s)
bi_jump: .word c_help-1, c_ls-1, c_ls-1, c_cd-1, c_pwd-1, c_cat-1, c_cat-1, c_cat-1, c_cat-1, c_cat-1
         .word c_grep-1, c_echo-1, c_date-1, c_clear-1, c_history-1, c_man-1, c_sudo-1, c_rm-1, c_rm-1
         .word c_ping-1, c_ssh-1, c_git-1, c_make-1, c_fortune-1, c_cowsay-1, c_which-1, c_uname-1
         .word c_journal-1, c_systemctl-1
n_bhelp: .byte "help", 0
n_ls:    .byte "ls", 0
n_ll:    .byte "ll", 0
n_bcd:   .byte "cd", 0
n_bpwd:  .byte "pwd", 0
n_bcat:  .byte "cat", 0
n_bless: .byte "less", 0
n_bmore: .byte "more", 0
n_head:  .byte "head", 0
n_tail:  .byte "tail", 0
n_grep:  .byte "grep", 0
n_becho: .byte "echo", 0
n_bdate: .byte "date", 0
n_bclear: .byte "clear", 0
n_bhist: .byte "history", 0
n_bman:  .byte "man", 0
n_bsudo: .byte "sudo", 0
n_brm:   .byte "rm", 0
n_brmdir: .byte "rmdir", 0
n_bping: .byte "ping", 0
n_bssh:  .byte "ssh", 0
n_bgit:  .byte "git", 0
n_bmake: .byte "make", 0
n_bfort: .byte "fortune", 0
n_bcow:  .byte "cowsay", 0
n_bwhich: .byte "which", 0
n_buname: .byte "uname", 0
n_bjournal: .byte "journalctl", 0
n_bsysctl: .byte "systemctl", 0
bi_lo:   .byte <n_bhelp, <n_ls, <n_ll, <n_bcd, <n_bpwd, <n_bcat, <n_bless, <n_bmore, <n_head, <n_tail
         .byte <n_grep, <n_becho, <n_bdate, <n_bclear, <n_bhist, <n_bman, <n_bsudo, <n_brm, <n_brmdir
         .byte <n_bping, <n_bssh, <n_bgit, <n_bmake, <n_bfort, <n_bcow, <n_bwhich, <n_buname
         .byte <n_bjournal, <n_bsysctl
bi_hi:   .byte >n_bhelp, >n_ls, >n_ll, >n_bcd, >n_bpwd, >n_bcat, >n_bless, >n_bmore, >n_head, >n_tail
         .byte >n_grep, >n_becho, >n_bdate, >n_bclear, >n_bhist, >n_bman, >n_bsudo, >n_brm, >n_brmdir
         .byte >n_bping, >n_bssh, >n_bgit, >n_bmake, >n_bfort, >n_bcow, >n_bwhich, >n_buname
         .byte >n_bjournal, >n_bsysctl
BI_N = 29

; systemctl verbs
vb_jump: .word sc_list-1, sc_list-1, sc_status-1, sc_isolate-1
         .word sc_ctl-1, sc_ctl-1, sc_ctl-1, sc_ctl-1, sc_ctl-1, sc_ctl-1, sc_ctl-1
         .word sc_power-1, sc_power-1, sc_power-1, sc_power-1
n_listunits: .byte "list-units", 0
n_listtargets: .byte "list-targets", 0
n_vstatus: .byte "status", 0
n_visolate: .byte "isolate", 0
n_start: .byte "start", 0
n_vstop: .byte "stop", 0
n_restart: .byte "restart", 0
n_venable: .byte "enable", 0
n_vdisable: .byte "disable", 0
n_vkill: .byte "kill", 0
n_vmask: .byte "mask", 0
n_vpoweroff: .byte "poweroff", 0
n_vreboot: .byte "reboot", 0
n_vhalt: .byte "halt", 0
n_vsuspend: .byte "suspend", 0
vb_lo:   .byte <n_listunits, <n_listtargets, <n_vstatus, <n_visolate, <n_start, <n_vstop, <n_restart
         .byte <n_venable, <n_vdisable, <n_vkill, <n_vmask, <n_vpoweroff, <n_vreboot, <n_vhalt, <n_vsuspend
vb_hi:   .byte >n_listunits, >n_listtargets, >n_vstatus, >n_visolate, >n_start, >n_vstop, >n_restart
         .byte >n_venable, >n_vdisable, >n_vkill, >n_vmask, >n_vpoweroff, >n_vreboot, >n_vhalt, >n_vsuspend
VB_N = 15

; services
n_svc0:  .byte "coffee.service", 0
n_svc1:  .byte "elevator.service", 0
n_svc2:  .byte "printer.service", 0
n_svc3:  .byte "motivation.service", 0
n_svc4:  .byte "surveillance.service", 0
n_svc5:  .byte "synergy.target", 0
svc_lo:  .byte <n_svc0, <n_svc1, <n_svc2, <n_svc3, <n_svc4, <n_svc5
svc_hi:  .byte >n_svc0, >n_svc1, >n_svc2, >n_svc3, >n_svc4, >n_svc5
s_sd0:   .byte "Office Coffee Daemon", 0
s_sd1:   .byte "Elevator Controller", 0
s_sd2:   .byte "Printer (PC LOAD LETTER)", 0
s_sd3:   .byte "Employee Motivation", 0
s_sd4:   .byte "HR Wellbeing Monitor", 0
s_sd5:   .byte "Synergy", 0
svc_desc_lo: .byte <s_sd0, <s_sd1, <s_sd2, <s_sd3, <s_sd4, <s_sd5
svc_desc_hi: .byte >s_sd0, >s_sd1, >s_sd2, >s_sd3, >s_sd4, >s_sd5
s_ss0:   .byte "active (running)", 0
s_ss2:   .byte "failed (failed)", 0
s_ss3:   .byte "inactive (dead)", 0
s_ss5:   .byte "active (active)", 0
svc_state_lo: .byte <s_ss0, <s_ss0, <s_ss2, <s_ss3, <s_ss0, <s_ss5
svc_state_hi: .byte >s_ss0, >s_ss0, >s_ss2, >s_ss3, >s_ss0, >s_ss5
s_sx0:   .byte "     Memory: 2.1 L of espresso", 0
s_sx2:   .byte "     Result: paper-jam (since 1998)", 0
s_sx3:   .byte "     Since: Monday 09:00", 0
s_sx4:   .byte "      Tasks: 1 (watching you type this)", 0
svc_extra_lo: .byte <s_sx0, 0, <s_sx2, <s_sx3, <s_sx4, 0
svc_extra_hi: .byte >s_sx0, 0, >s_sx2, >s_sx3, >s_sx4, 0
s_sr0:   .byte "coffee.service    active   running", 0
s_sr1:   .byte "elevator.service  active   running", 0
s_sr2:   .byte "printer.service   failed   failed", 0
s_sr3:   .byte "motivation.servic inactive dead", 0
s_sr4:   .byte "surveillance.serv active   running", 0
s_sr5:   .byte "synergy.target    active   active", 0
svc_row_lo: .byte <s_sr0, <s_sr1, <s_sr2, <s_sr3, <s_sr4, <s_sr5
svc_row_hi: .byte >s_sr0, >s_sr1, >s_sr2, >s_sr3, >s_sr4, >s_sr5
s_rowsynergy: .byte "synergy.target  active   Synergy", 0
s_unithead: .byte "UNIT            ACTIVE   DESCRIPTION", 0
s_activecol: .byte "active   ", 0
s_inactivecol: .byte "inactive ", 0
s_listed: .byte " loaded units listed.", 0
s_listed7: .byte 10, "7 loaded units listed. Pass --type=target", 0, "to see all targets.", 0, 0
n_typetarget: .byte "--type=target", 0
n_target: .byte "target", 0
n_dotservice: .byte ".service", 0
n_dottarget: .byte ".target", 0
n_level: .byte "level", 0
s_stat1: .byte "* ", 0
s_stat2: .byte "    State: degraded", 0, "     Jobs: 412 queued (mostly meetings)", 0, "   Failed: 1 units (printer.service)", 0, 0
s_star:  .byte "* ", 0
s_loaded1: .byte "     Loaded: loaded (/etc/systemd/system/", 0
s_static: .byte "; static)", 0
s_enabled: .byte "; enabled)", 0
s_activehere: .byte "     Active: active since 09:00 (you are here)", 0
s_inactivedead: .byte "     Active: inactive (dead)", 0
s_activec: .byte "     Active: ", 0
s_docs:  .byte "       Docs: man:", 0
s_seven: .byte "(7)", 0
s_unit:  .byte "Unit ", 0
s_notfoundu: .byte " could not be found.", 0
s_toofew: .byte "Too few arguments.", 0
s_failstart: .byte "Failed to start ", 0
s_refused: .byte ": Operation refused, unit may not be isolated.", 0
s_unitnf1: .byte ": Unit ", 0
s_unitnf2: .byte " not found.", 0
s_rumour1: .byte "(This tower has 40 floors. Floor ", 0
s_rumour2: .byte " is a rumour.)", 0
s_already: .byte " is already active. You are standing in it.", 0
s_stopping: .byte "         Stopping ", 0
s_stopped: .byte "[  OK  ] Stopped target ", 0
s_starting: .byte "         Starting ", 0
s_reached: .byte "[  OK  ] Reached target ", 0
s_dots3: .byte "...", 0
s_calling: .byte "Calling the elevator...", 0
s_notondisk: .byte "The elevator stops at floor 2 on this disk.", 0, "The full tower: synergytower.co.uk", 0, 0
s_floorsp: .byte "Floor ", 0
n_coffeesvc: .byte "coffee.service", 0
n_motivsvc: .byte "motivation.service", 0
s_refusecoffee: .byte "Refusing. Stopping coffee.service would bring down the entire company.", 0
s_motivfail: .byte "Job for motivation.service failed because the control process exited with error code.", 0, "See ", 34, "journalctl -u motivation", 34, " for details.", 0, 0
s_floorsno: .byte "Floors cannot be ", 0
s_floorsno2: .byte "ed directly. Use ", 34, "systemctl isolate", 34, ".", 0
s_failto: .byte "Failed to ", 0
s_accessdenied: .byte ": Access denied.", 0, "Interactive authentication required (ask your manager's manager).", 0, 0
s_powerfail: .byte " system: Interactive authentication required.", 0, "Shutdown is scheduled for Friday 17:00, as always.", 0, 0
s_unknownverb: .byte "Unknown command verb ", 0

; other texts
n_title: .byte "Terminal - ", 0
n_newhire: .byte "newhire", 0
n_ws:    .byte "-ws"
n_home:  .byte "/home/", 0
s_banner: .byte "SynergyOS 40 LTS (tty1)", 0, "Last login: today 09:07 from the kitchen", 0
         .byte "This workstation is monitored for quality and training purposes.", 0
         .byte "Type ", 34, "help", 34, " for commands, ", 34, "exit", 34, " or RUN/STOP to close. Pound key: |  F1: complete", 0, 0
s_notfound: .byte ": command not found", 0
s_help1: .byte "SynergyOS bash, corporate edition. Available commands:", 0
s_help2: .byte "Some commands are more interesting than others. RTFM: man <command>.", 0
s_date:  .byte "Today 09:", 0
s_date2: .byte " SYNERGY TIME", 0
s_man0:  .byte "What manual page do you want? (The employee handbook is 900 pages. Pick one.)", 0
s_noman: .byte "No manual entry for ", 0
s_noman2: .byte ". Have you tried asking in #general?", 0
n_sandwich: .byte "make me a sandwich", 0
s_okay:  .byte "Okay.", 0
s_ceo:   .byte "You are the CEO. You do not need sudo. You need a yacht.", 0
s_sudopw: .byte "[sudo] password for ", 0
s_sudopw2: .byte ": ********", 0
s_sudoers: .byte " is not in the sudoers file. This incident will be reported to HR.", 0
s_tower: .byte "Nice try. The tower is load-bearing.", 0
s_missing: .byte ": missing operand", 0
s_cantrm: .byte ": cannot remove '", 0
s_cantrm2: .byte "': Operation not permitted (data retention policy: keep everything forever)", 0
n_localhost: .byte "localhost", 0
s_ping1: .byte "PING ", 0
s_ping2: .byte ": 56 data bytes", 0
s_ping3: .byte "64 bytes from ", 0
s_ping4: .byte ": icmp_seq=", 0
s_ping5: .byte " ttl=64 time=", 0
s_ms:    .byte " ms", 0
s_ping6: .byte "--- ", 0
s_ping7: .byte " ping statistics ---", 0
s_ping8: .byte "3 packets transmitted, 3 received, 0% packet loss, 100% bureaucracy", 0
pingt_lo: .byte <420, <69, <1337
pingt_hi: .byte >420, >69, >1337
s_ssh1:  .byte "ssh: connect to host ", 0
s_nowhere: .byte "nowhere", 0
s_ssh2:  .byte " port 22: Connection refused (submit access request form 27-B/6)", 0
s_gitusage: .byte "usage: git <command>. Popular choices: status, log, blame, push.", 0
n_gstatus: .byte "status", 0
n_gblame: .byte "blame", 0
n_gpush: .byte "push", 0
n_glog:  .byte "log", 0
gs_lo:   .byte <n_gstatus, <n_gblame, <n_gpush, <n_glog
gs_hi:   .byte >n_gstatus, >n_gblame, >n_gpush, >n_glog
s_gt0:   .byte "On branch main", 0, "Your branch is behind ", $27, "origin/main", $27, " by 4812 commits.", 0, "nothing to commit, working tree clean (suspiciously)", 0, 0
s_gt1:   .byte "It was Kevin.", 0, 0
s_gt2:   .byte " ! [rejected]  main -> main (pushing on a Friday is forbidden)", 0, 0
s_gt3:   .byte "commit 1a2b3c4 ", 34, "fix", 34, " ", 0, "commit 5d6e7f8 ", 34, "fix fix", 34, 0, "commit 9a0b1c2 ", 34, "final fix (real)", 34, 0, "commit 3d4e5f6 ", 34, "initial commit (2009)", 34, 0, 0
gt_lo:   .byte <s_gt0, <s_gt1, <s_gt2, <s_gt3
gt_hi:   .byte >s_gt0, >s_gt1, >s_gt2, >s_gt3
n_mesandwich: .byte "me a sandwich", 0
s_makeit: .byte "What? Make it yourself.", 0
s_make1: .byte "make: *** No rule to make target '", 0
s_money: .byte "money", 0
s_make2: .byte "'. Stop.", 0
n_moo:   .byte "Moo-ve fast and break things.", 0
s_cowend: .byte " >", 0
s_cow:   .byte "        \   ^__^", 0, "         \  (oo)\_______", 0, "            (__)\       )\/\", 0
         .byte "                ||----w |", 0, "                ||     ||", 0, 0
s_notfound2: .byte " not found", 0
s_usrbin: .byte "/usr/bin/", 0
n_dasha: .byte "-a", 0
n_dashu: .byte "-u", 0
s_synergyos: .byte "SynergyOS", 0
s_uname1: .byte "SynergyOS ", 0
s_uname2: .byte " 6.6.6-corporate #1 SMP PREEMPT_DYNAMIC Q4 x86_64 GNU/Linux", 0
s_noentries: .byte "-- No entries -- (motivation has not logged anything since Monday)", 0
s_catmiss: .byte ": missing file operand (reading from your mind is not supported yet)", 0
s_colsp: .byte ": ", 0
s_nosuch: .byte "No such file or directory", 0
s_isdir: .byte "Is a directory", 0
s_denied: .byte "Permission denied", 0
s_paren: .byte " (", 0
n_tilde: .byte "~", 0
s_cdnosuch: .byte "cd: no such file or directory: ", 0
s_cdnotdir: .byte "cd: not a directory: ", 0
s_cddenied: .byte "cd: permission denied: ", 0
n_dot:   .byte ".", 0
s_lsnosuch1: .byte "ls: cannot access '", 0
s_lsnosuch2: .byte "': No such file or directory", 0
s_lsdenied1: .byte "ls: cannot open directory '", 0
s_lsdenied2: .byte "': Permission denied", 0
s_total4: .byte "total 4", 0
s_total: .byte "total ", 0
s_dots:  .byte "./  ../  ", 0
n_dotname: .byte ".", 0
n_dotdot: .byte "..", 0
s_perm:  .byte "rw-r--r-- 1 ", 0
s_permlock: .byte "rw------- 1 ", 0
s_root:  .byte "root", 0
s_lsdate: .byte " Oct 10 09:00 ", 0
s_dirperm: .byte "drw-r--r-- 1 ", 0
s_dirsize: .byte "  4096 Oct 10 09:00 ", 0
s_grepusage: .byte "usage: grep PATTERN FILE", 0
s_grepstdin: .byte "grep: reading from stdin is not in the budget. Name a file.", 0
n_lolcat: .byte "lolcat", 0
n_wc:    .byte "wc", 0
s_pipes1: .byte ": pipes to ", 34, 0
s_pipes2: .byte 34, " are not in this quarter", $27, "s budget.", 0
s_dash:  .byte " - ", 0
n_unit0: .byte "level00.target", 0
tslot_lo: .repeat 10, i
         .byte <(TAILB + i * 40)
         .endrep
tslot_hi: .repeat 10, i
         .byte >(TAILB + i * 40)
         .endrep
p10lo:   .byte <10000, <1000, <100, <10, <1
p10hi:   .byte >10000, >1000, >100, >10, >1
; $VARs
n_vUSER: .byte "USER", 0
n_vHOME: .byte "HOME", 0
n_vSHELL: .byte "SHELL", 0
n_vFLOOR: .byte "FLOOR", 0
n_vHOSTNAME: .byte "HOSTNAME", 0
n_vEDITOR: .byte "EDITOR", 0
n_vLANG: .byte "LANG", 0
n_vPATH: .byte "PATH", 0
var_lo:  .byte <n_vUSER, <n_vHOME, <n_vSHELL, <n_vFLOOR, <n_vHOSTNAME, <n_vEDITOR, <n_vLANG, <n_vPATH
var_hi:  .byte >n_vUSER, >n_vHOME, >n_vSHELL, >n_vFLOOR, >n_vHOSTNAME, >n_vEDITOR, >n_vLANG, >n_vPATH
VAR_N = 8
n_bash:  .byte "/bin/bash", 0
n_nano:  .byte "nano", 0
n_lang:  .byte "en_US.SYNERGY-8", 0
n_path:  .byte "/usr/local/bin:/usr/bin:/bin:/opt/synergy/bin", 0
val_lo:  .byte <USER, <HOME, <n_bash, <numbuf, <HOST, <n_nano, <n_lang, <n_path
val_hi:  .byte >USER, >HOME, >n_bash, >numbuf, >HOST, >n_nano, >n_lang, >n_path
; placeholders 1-12 (3, 5, 6, 11, 12 are computed by ph_fill)
ph_lo:   .byte 0, <USER, <HOST, <numbuf, <st_corp, <DECB, <DECB, <dept_name, 0, <cmdname, 0, <UNITB, <UNITB
ph_hi:   .byte 0, >USER, >HOST, >numbuf, >st_corp, >DECB, >DECB, >dept_name, 0, >cmdname, 0, >UNITB, >UNITB
dept_name: .byte "Lobby & Mailroom", 0

.include "gen/term_data.s"

.segment "BSS"
LINE:     .res 64               ; input line (63 chars + 0)
LB:       .res 256              ; output line being built
WORK:     .res 64               ; the line being run (a copy of LINE)
ARGS:     .res 128              ; the words of a command, one after another
RBUF:     .res 64               ; resolve(): an absolute path
PBUF:     .res 64               ; an entry's path (expanded)
CWD:      .res 64               ; current directory
HOME:     .res 32               ; /home/<user>
USER:     .res 16               ; login name
HOST:     .res 16               ; fNN-wsID
PAT:      .res 64               ; grep pattern
TBUF:     .res 128              ; words joined (sudo, make, cowsay)
argv_lo:  .res MAXARG
argv_hi:  .res MAXARG
filt:     .res 5
bad_cmd:  .res 16
cmdname:  .res 16
VNAME:    .res 16
numbuf:   .res 8
UNITB:    .res 16
DECB:     .res 48
UARG:     .res 40
unitp:    .res 2
verb:     .res 2
level:    .res 1
argsave:  .res 2
lsname:   .res 2
pinghost: .res 2
