; The workstation terminal (src/core/terminal.js, src/scenes/terminal.js) as a system overlay in the normal slot:
; a tiny fake Linux with the JS shell's commands and replies, a small virtual file system and the secret:
; `systemctl isolate levelNN.target` returns A = NN (the floor to ride to), else A = 0.
; Simpler than the JS shell to fit 8 KB: no pipes or && chains, ls without -l, fewer files. The texts are in
; gen/term_data.s (tools/termdata.js). F1 completes a command, cursor up/down: history, RUN/STOP: exit.
; C64 keys for the missing ASCII: up arrow types "~", back arrow "_".

.include "api.inc"
.include "state.inc"
.include "gen/floor.inc"

HIST    = $c400                 ; 6 commands × 40 (the second screen is free while the terminal runs)
HISTN   = 6
LINELEN = 40
COLS    = 40
ROWS    = 25
GREEN   = 5
MAXARG  = 6
K_RETURN = 13
K_DEL   = 20
K_UP    = 145
K_DOWN  = 17
K_STOP  = 3
K_F1    = 133

; zero page ($40-$7f)
tp      = $40                   ; 2: text pointer (expand)
sp_     = $42                   ; 2: screen pointer
cp_     = $44                   ; 2: colour pointer
p0      = $46                   ; 2: general pointers
p1      = $48                   ; 2
p2      = $4a                   ; 2
cx      = $4c                   ; cursor column / row
cy      = $4d
argp    = $4e                   ; 2: what placeholder 8 prints
skipdef = $50                   ; 1: skip placeholder 8's default text
redir   = $51                   ; output into tbuf instead of the screen
tlen    = $52
warp    = $53
t0      = $54
t1      = $55
t2      = $56
t3      = $57
llen    = $58                   ; input length
hn      = $59                   ; commands in the history
hp      = $5a                   ; history browsing position
argc    = $5b
blink   = $5c
quit    = $5d
dg0     = $5e                   ; two_digits: the tens and ones chars
dg1     = $5f
restp   = $60                   ; 2: the line from the second word on
jmpv    = $62                   ; 2: placeholder routine
fl      = $64                   ; a floor being listed
cw      = $65                   ; 2: walking the commands

.segment "CODE"
        jmp term

term:
        lda #0
        sta $d020
        sta $d021
        sta warp
        sta quit
        sta hn
        sta redir
        sta skipdef
        jsr cls_
        jsr setup               ; login name, host, home, cwd
        ldx #MSG_MOTD
        jsr out_text
        jsr newline
@cmd:   jsr prompt
        jsr read_line
        jsr newline
        lda quit
        bne @bye
        lda llen
        beq @cmd
        jsr hist_add
        jsr run_line
        lda cx                  ; (the prompt on a line of its own)
        beq :+
        jsr newline
:       lda quit
        bne @bye
        lda warp
        beq @cmd
        ldx #75                 ; a moment to read "Calling the elevator..."
:       jsr API_WAIT
        dex
        bne :-
@bye:   lda warp
        rts

; ---- login name (lowercase letters and digits of your name, max 12), host "fNN-wsW", home "/home/<login>" ---------
setup:
        ldx #0
        ldy #0
@n:     lda st_name,x
        beq @nd
        cmp #'A'
        bcc @dig
        cmp #'Z' + 1
        bcs :+
        ora #$20                ; upper -> lower
        bne @put
:       cmp #'a'
        bcc @skip
        cmp #'z' + 1
        bcs @skip
        bcc @put
@dig:   cmp #'0'
        bcc @skip
        cmp #'9' + 1
        bcs @skip
@put:   sta login,y
        iny
        cpy #12
        beq @nd
@skip:  inx
        bne @n
@nd:    cpy #0
        bne :+
        ldx #6                  ; (no letters at all)
@new:   lda s_newhire,x
        sta login,x
        dex
        bpl @new
        ldy #7
:       lda #0
        sta login,y
        lda #<host              ; host: f + floor in 2 digits + -ws + workstation
        sta p0
        lda #>host
        sta p0+1
        ldy #0
        lda #'f'
        sta (p0),y
        lda st_floor
        jsr two_digits
        lda dg0
        ldy #1
        sta (p0),y
        lda dg1
        iny
        sta (p0),y
        ldx #0
:       lda s_ws,x
        iny
        sta (p0),y
        inx
        cpx #3
        bne :-
        iny
        sty t3
        lda MG_WS
        jsr num_str             ; -> numbuf
        ldy t3
        ldx #0
:       lda numbuf,x
        sta (p0),y
        beq :+
        iny
        inx
        bne :-
:       ldx #0                  ; home = /home/<login>
:       lda s_homedir,x
        sta home,x
        beq :+
        inx
        bne :-
:       ldy #0
:       lda login,y
        sta home,x
        beq :+
        inx
        iny
        bne :-
:       ldx #0                  ; cwd = home
:       lda home,x
        sta cwd,x
        beq :+
        inx
        bne :-
:       rts

; A = 0-99 -> dg0/dg1 = its two digit chars
two_digits:
        ldx #'0'
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       stx dg0
        ora #'0'
        sta dg1
        rts

; A = 0-255 -> numbuf = its decimal digits, 0-terminated
num_str:
        ldx #0
        ldy #100
        jsr @digit
        ldy #10
        jsr @digit
        ora #'0'                ; the ones always
        sta numbuf,x
        inx
        lda #0
        sta numbuf,x
        rts
@digit: sty t2                  ; A mod Y, the digit appended unless it is a leading 0
        ldy #'0'
:       cmp t2
        bcc :+
        sbc t2
        iny
        bne :-
:       pha
        tya
        cpy #'0'
        bne :+
        cpx #0
        beq :++
:       sta numbuf,x
        inx
:       pla
        rts

; ---- the prompt: login@host:path$ (the home directory as ~)
prompt:
        lda #<login
        ldx #>login
        jsr out_str
        lda #'@'
        jsr out_char
        lda #<host
        ldx #>host
        jsr out_str
        lda #':'
        jsr out_char
        jsr print_cwd
        lda #'$'
        jsr out_char
        lda #' '
        jmp out_char

; cwd, with the home directory shortened to ~
print_cwd:
        ldx #0
:       lda home,x
        beq @home
        cmp cwd,x
        bne @full
        inx
        bne :-
@home:  lda cwd,x               ; cwd starts with home: home itself or home/...
        beq :+
        cmp #'/'
        bne @full
:       stx t3
        lda #'~'
        jsr out_char
        ldx t3
:       lda cwd,x
        beq @done
        jsr out_char_x
        inx
        bne :-
@full:  lda #<cwd
        ldx #>cwd
        jmp out_str
@done:  rts

; ---- reading a line: typing, DEL, history, F1 completion, RUN/STOP
read_line:
        lda #0
        sta llen
        lda hn
        sta hp
@key:   jsr API_WAIT
        inc blink               ; the cursor
        lda blink
        and #16
        beq :+
        lda #'_'
        .byte $2c
:       lda #' '
        jsr put_cursor
        jsr API_KEY
        beq @key
        pha
        lda #' '
        jsr put_cursor
        pla
        cmp #K_RETURN
        bne :+
        ldx llen
        lda #0
        sta line,x
        rts
:       cmp #K_STOP
        bne :+
        lda #1                  ; RUN/STOP: as "exit"
        sta quit
        lda #0
        sta llen
        rts
:       cmp #K_DEL
        bne :+
        jsr del_char
        jmp @key
:       cmp #K_UP
        bne :+
        jsr hist_prev
        jmp @key
:       cmp #K_DOWN
        bne :+
        jsr hist_next
        jmp @key
:       cmp #K_F1
        bne :+
        jsr complete
        jmp @key
:       jsr petscii_ascii
        cmp #0
        beq @key
        jsr type_char
        jmp @key

; A = char typed at the end of the line.
type_char:
        ldx llen
        cpx #LINELEN - 1
        bcs :+
        sta line,x
        inc llen
        jmp out_char
:       rts

del_char:
        lda llen
        beq :++
        dec llen
        dec cx                  ; back one cell (to the end of the row above)
        bpl :+
        lda #COLS - 1
        sta cx
        dec cy
:       lda #' '
        jsr screen_put
:       rts

; A = PETSCII -> ASCII (Z=1: no glyph)
petscii_ascii:
        cmp #'A'
        bcc @sym
        cmp #'Z' + 1
        bcs :+
        ora #$20                ; unshifted letters: lower case
        rts
:       cmp #193
        bcc :+
        cmp #219
        bcs @none
        and #$7f                ; shifted letters: upper case
        rts
:       cmp #94
        bne :+
        lda #'~'
        rts
:       cmp #95
        beq @ok                 ; "_"
        cmp #91
        beq @ok
        cmp #93
        beq @ok
@none:  lda #0
        rts
@sym:   cmp #' '
        bcc @none
@ok:    rts

; A = the cursor char at the input end
put_cursor:
        jmp screen_put

; ---- history (HIST: HISTN lines of LINELEN)
hist_add:
        lda hn                  ; full: drop the oldest
        cmp #HISTN
        bcc @put
        ldx #0
:       lda HIST + LINELEN,x
        sta HIST,x
        inx
        cpx #LINELEN * (HISTN - 1) ; (200: fits X)
        bne :-
        dec hn
@put:   lda hn
        jsr hist_ptr
        ldy #0
:       lda line,y
        sta (p0),y
        iny
        cpy #LINELEN
        bne :-
        inc hn
        rts

; A = entry -> p0
hist_ptr:
        tax
        lda #<HIST
        sta p0
        lda #>HIST
        sta p0+1
@n:     cpx #0
        beq @done
        lda p0
        clc
        adc #LINELEN
        sta p0
        bcc :+
        inc p0+1
:       dex
        jmp @n
@done:  rts

hist_prev:
        lda hp
        beq :+
        dec hp
        jmp hist_show
:       rts
hist_next:
        lda hp
        cmp hn
        bcs :+
        inc hp
        lda hp
        cmp hn
        bne hist_show
        jmp clear_input         ; past the newest: an empty line
:       rts
hist_show:
        jsr clear_input
        lda hp
        jsr hist_ptr
        ldy #0
:       lda (p0),y
        beq :+
        sty t3
        jsr type_char
        ldy t3
        iny
        bne :-
:       rts
clear_input:
        lda llen
        beq :+
        jsr del_char
        jmp clear_input
:       rts

; F1: complete the first word to the commands' common prefix
complete:
        ldx #0                  ; (only the first word)
:       cpx llen
        beq :+
        lda line,x
        cmp #' '
        beq @no
        inx
        bne :-
:       lda #0
        sta t2                  ; matches
        sta t3                  ; common length
        jsr cmd_first
@c:     ldy #0
:       cpy llen
        beq @hit
        lda (p0),y
        cmp line,y
        bne @next
        iny
        bne :-
@hit:   lda t2
        bne :+
        lda p0                  ; the first: the common part is all of it
        sta p1
        lda p0+1
        sta p1+1
        jsr strlen1
        sta t3
        inc t2
        bne @next
:       inc t2                  ; more: shorten to what they share
        ldy #0
:       cpy t3
        beq :+
        lda (p0),y
        cmp (p1),y
        bne :+
        iny
        bne :-
:       sty t3
@next:  jsr cmd_next
        bne @c
        lda t2
        beq @no
        ldy llen                ; type the rest
:       cpy t3
        beq :+
        lda (p1),y
        sty t1
        jsr type_char
        ldy t1
        iny
        bne :-
:       lda t2
        cmp #1
        bne @no
        lda #' '                ; (the only one: a space after it)
        jmp type_char
@no:    rts

; p1 -> A = its length
strlen1:
        ldy #0
:       lda (p1),y
        beq :+
        iny
        bne :-
:       tya
        rts

; p0 = the first command's name / the next one's (Z=1: no more). The record: name, 0, handler, argument.
cmd_first:
        lda #<cmds
        sta cw
        lda #>cmds
        sta cw+1
        jmp cmd_p0
cmd_next:
        ldy #0
:       lda (cw),y
        iny
        cmp #0
        bne :-
        iny                     ; (handler, argument)
        iny
        tya
        clc
        adc cw
        sta cw
        bcc cmd_p0
        inc cw+1
cmd_p0: lda cw                  ; p0 = it too
        sta p0
        lda cw+1
        sta p0+1
        ldy #0
        lda (cw),y
        rts

; ---- running a line: words, the command, its handler
run_line:
        ldx #0                  ; words: zero-terminated in words[], argv offsets
        stx argc
        ldy #0
@skip:  lda line,x
        beq @end
        cmp #' '
        bne @word
        inx
        bne @skip
@word:  lda argc
        cmp #MAXARG
        bcs @end
        sty t0
        ldy argc
        lda t0
        sta argv,y
        cpy #1                  ; the rest of the line from the second word on
        bne :+
        stx restx
:       inc argc
        ldy t0
@ch:    lda line,x
        beq @wend
        cmp #' '
        beq @wend
        cmp #'"'                ; (quotes are dropped)
        beq :+
        sta words,y
        iny
:       inx
        bne @ch
@wend:  lda #0
        sta words,y
        iny
        jmp @skip
@end:   lda argc
        bne :+
        rts
:       cmp #2
        bcs :+
        lda #<empty             ; no arguments
        sta restp
        lda #>empty
        sta restp+1
        jmp :++
:       lda restx
        clc
        adc #<line
        sta restp
        lda #>line
        adc #0
        sta restp+1
:       ldx #1                  ; placeholder 8 = the first argument
        jsr argv_p
        lda p0
        sta argp
        lda p0+1
        sta argp+1
        jsr cmd_first           ; find the command
@find:  lda #<words
        sta p1
        lda #>words
        sta p1+1
        jsr streq
        beq @found
        jsr cmd_next
        bne @find
        ldx #0                  ; "<cmd>: command not found"
        jsr argv_p
        lda p0
        sta argp
        lda p0+1
        sta argp+1
        ldx #MSG_NOTFOUND
        jmp out_text
@found: ldy #0                  ; past the name: handler, argument
:       lda (cw),y
        iny
        cmp #0
        bne :-
        lda (cw),y
        pha
        iny
        lda (cw),y
        sta t2
        pla
        asl
        tax
        lda handlers+1,x
        pha
        lda handlers,x
        pha
        ldx t2
        rts

handlers:
        .word h_text - 1, h_help - 1, h_ls - 1, h_cd - 1, h_pwd - 1, h_cat - 1, h_echo - 1, h_clear - 1
        .word h_history - 1, h_exit - 1, h_man - 1, h_sudo - 1, h_systemctl - 1, h_switch - 1, h_which - 1
        .word h_fortune - 1, h_cowsay - 1

; X = word number -> p0 = it ("" if there is none)
argv_p:
        cpx argc
        bcc :+
        lda #<empty
        sta p0
        lda #>empty
        sta p0+1
        rts
:       lda argv,x
        clc
        adc #<words
        sta p0
        lda #>words
        adc #0
        sta p0+1
        rts

; p0, p1 -> Z=1 if the strings are equal
streq:
        ldy #0
:       lda (p0),y
        cmp (p1),y
        bne :+
        cmp #0
        beq :+
        iny
        bne :-
:       rts

; p0 = pattern, p1 = string -> Z=1 if the string starts with the pattern
prefix:
        ldy #0
:       lda (p0),y
        beq :+
        cmp (p1),y
        bne :++
        iny
        bne :-
:       lda #0                  ; (Z=1)
:       rts

; ---- the handlers (X = the command's argument)
h_text:
        jmp out_text

; A table of (pattern, text): the first pattern the arguments start with ("" = any).
h_switch:
        lda sw_lo,x
        sta p2
        lda sw_hi,x
        sta p2+1
        ldy #0
        lda (p2),y
        sta t3                  ; cases
        inc p2
        bne @case
        inc p2+1
@case:  lda p2
        sta p0
        lda p2+1
        sta p0+1
        lda restp
        sta p1
        lda restp+1
        sta p1+1
        jsr prefix
        php
        ldy #0                  ; past the pattern
:       lda (p2),y
        iny
        cmp #0
        bne :-
        lda (p2),y              ; its text
        tax
        iny
        tya
        clc
        adc p2
        sta p2
        bcc :+
        inc p2+1
:       plp
        bne :+
        jmp out_text
:       dec t3
        bne @case
        rts

h_help:
        ldx #MSG_HELPHEAD
        jsr out_text
        jsr newline
        lda #' '
        jsr out_char
        jsr cmd_first
@n:     lda p0
        sta p1
        lda p0+1
        sta p1+1
        jsr strlen1
        clc
        adc cx
        cmp #COLS - 1
        bcc :+
        jsr newline
        lda #' '
        jsr out_char
:       lda #' '
        jsr out_char
        lda p1
        ldx p1+1
        jsr out_str
        jsr cmd_next
        bne @n
        jsr newline
        ldx #MSG_HELPTAIL
        jmp out_text

h_pwd:
        lda #<cwd
        ldx #>cwd
        jmp out_str

h_clear:
        jmp cls_

h_exit:
        ldx #MSG_LOGOUT
        jsr out_text
        lda #1
        sta quit
        rts

h_history:
        lda #0
        sta t1
@h:     lda t1
        cmp hn
        bcs @done
        clc
        adc #1
        jsr num_str
        jsr two_spaces
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        jsr two_spaces
        lda t1
        jsr hist_ptr
        lda p0
        ldx p0+1
        jsr out_str
        jsr newline
        inc t1
        bne @h
@done:  rts

h_echo:
        ldy #0
@c:     lda (restp),y
        beq @done
        cmp #'$'
        beq @var
        cmp #'"'
        beq :+
        jsr out_char_y
:       iny
        bne @c
@done:  rts
@var:   iny                     ; $NAME: its letters into tbuf
        ldx #0
:       lda (restp),y
        cmp #'A'
        bcc :+
        cmp #'Z' + 1
        bcs :+
        sta tbuf,x
        inx
        iny
        cpx #COLS - 1
        bcc :-
:       lda #0
        sta tbuf,x
        sty t3
        lda #<var_tab           ; one of a few variables (placeholder, name)
        sta p2
        lda #>var_tab
        sta p2+1
@v:     ldy #0
        lda (p2),y
        beq @next               ; (unknown: nothing)
        sta t2
        inc p2
        bne :+
        inc p2+1
:       lda p2
        sta p0
        lda p2+1
        sta p0+1
        lda #<tbuf
        sta p1
        lda #>tbuf
        sta p1+1
        jsr streq
        php
        ldy #0                  ; p2 past the name
:       lda (p2),y
        iny
        cmp #0
        bne :-
        tya
        clc
        adc p2
        sta p2
        bcc :+
        inc p2+1
:       plp
        bne @v
        lda t2
        jsr emit_plain
@next:  ldy t3
        jmp @c

var_tab: .byte 1, "USER", 0, 7, "HOME", 0, 2, "HOSTNAME", 0, 3, "FLOOR", 0, 0

h_man:
        lda argc
        cmp #2
        bcs :+
        ldx #MSG_MANNOARG
        jmp out_text
:       lda #<man_tab
        sta p2
        lda #>man_tab
        sta p2+1
@m:     ldy #0
        lda (p2),y
        beq @none
        lda p2
        sta p0
        lda p2+1
        sta p0+1
        lda argp
        sta p1
        lda argp+1
        sta p1+1
        jsr streq
        php
        ldy #0
:       lda (p2),y
        iny
        cmp #0
        bne :-
        lda (p2),y
        tax
        iny
        tya
        clc
        adc p2
        sta p2
        bcc :+
        inc p2+1
:       plp
        bne @m
        jmp out_text
@none:  ldx #MSG_MANNONE
        jmp out_text

h_sudo:
        lda #<s_sandwich
        sta p0
        lda #>s_sandwich
        sta p0+1
        lda restp
        sta p1
        lda restp+1
        sta p1+1
        jsr streq
        bne :+
        ldx #MSG_SUDOSANDWICH
        jmp out_text
:       ldx #MSG_SUDOCEO
        lda st_max
        cmp #FLOORS_TOP
        bcs :+
        ldx #MSG_SUDONO
:       jmp out_text

h_which:
        lda argc
        cmp #2
        bcc @done
        jsr cmd_first
@w:     lda argp
        sta p1
        lda argp+1
        sta p1+1
        jsr streq
        beq @yes
        jsr cmd_next
        bne @w
        ldx #MSG_WHICHNO
        jmp out_text
@yes:   lda #<s_usrbin
        ldx #>s_usrbin
        jsr out_str
        lda argp
        ldx argp+1
        jmp out_str
@done:  rts

h_fortune:
        lda #N_FORTUNES
        jsr API_RMOD
        clc
        adc #FORTUNE0
        tax
        jmp out_text

h_cowsay:
        lda #1                  ; the message, measured in tbuf
        sta redir
        lda #0
        sta tlen
        lda argc
        cmp #2
        bcc :+
        lda restp
        ldx restp+1
        jsr out_str
        jmp :++
:       ldx #MSG_COWDEFAULT
        jsr out_text
:       lda #0
        sta redir
        lda tlen
        cmp #COLS - 5
        bcc :+
        lda #COLS - 5
        sta tlen
:       jsr cow_bar
        lda #'<'
        jsr out_char
        lda #' '
        jsr out_char
        ldx #0
:       lda tbuf,x
        jsr out_char_x
        inx
        cpx tlen
        bne :-
        lda #' '
        jsr out_char
        lda #'>'
        jsr out_char
        jsr newline
        jsr cow_bar
        ldx #MSG_COW
        jmp out_text
cow_bar:
        lda #' '
        jsr out_char
        ldx tlen
        inx
        inx
:       lda #'-'
        jsr out_char_x
        dex
        bne :-
        jmp newline

; ---- files: ls, cd, cat
h_ls:
        ldx #1                  ; the first argument that isn't a flag; -a / ll show the dot files
        lda #0
        sta t2
        ldx #0
        jsr argv_p
        ldy #1
        lda (p0),y              ; "ll"
        cmp #'l'
        bne :+
        inc t2
:       ldx #1
@a:     cpx argc
        bcs @dot
        stx t1
        jsr argv_p
        ldy #0
        lda (p0),y
        cmp #'-'
        bne @path
        iny                     ; flags: an "a" anywhere
:       lda (p0),y
        beq :+
        cmp #'a'
        bne @fl
        inc t2
@fl:    iny
        bne :-
:       ldx t1
        inx
        bne @a
@dot:   lda #<s_dot
        sta p0
        lda #>s_dot
        sta p0+1
@path:  lda p0
        sta argp
        lda p0+1
        sta argp+1
        jsr resolve             ; -> path
        jsr find_entry
        bcs @nofile
        lda fflags
        and #2
        bne @denied
        lda fflags
        and #1
        bne @dir
        lda argp                ; a file: its name
        ldx argp+1
        jmp out_str
@denied:
        ldx #MSG_DENIED
        jmp out_text
@nofile:
        ldx #MSG_NOFILE
        jmp out_text
@dir:   lda #<fs_tab            ; the entries right below it
        sta p2
        lda #>fs_tab
        sta p2+1
@e:     ldy #0
        lda (p2),y
        bne :+
        jmp newline
:       jsr entry_path          ; -> epath, p2 to the next entry
        jsr child_name          ; C=1 if a child: p1 = its name
        bcc @e
        ldy #0
        lda (p1),y
        cmp #'.'
        bne :+
        lda t2
        beq @e                  ; (hidden)
:       jsr strlen1             ; the row full?
        sec
        adc cx
        cmp #COLS - 1
        bcc :+
        jsr newline
:       lda p1
        ldx p1+1
        jsr out_str
        lda eflags
        and #1
        beq :+
        lda #'/'
        jsr out_char
:       jsr two_spaces
        jmp @e

h_cd:
        lda argc
        cmp #2
        bcs @arg
        ldx #0                  ; cd alone: home
@home:  lda home,x
        sta cwd,x
        beq @done
        inx
        bne @home
@arg:   jsr resolve
        jsr find_entry
        bcc :+
        ldx #MSG_NOFILE
        jmp out_text
:       lda fflags
        and #1
        bne :+
        ldx #MSG_NOTDIR
        jmp out_text
:       lda fflags
        and #2
        beq :+
        ldx #MSG_DENIED
        jmp out_text
:       ldx #0
@copy:  lda path,x
        sta cwd,x
        beq @done
        inx
        bne @copy
@done:  rts

h_cat:
        lda argc
        cmp #2
        bcs :+
        ldx #MSG_CATNOARG
        jmp out_text
:       jsr resolve
        jsr find_entry
        bcc :+
        ldx #MSG_NOFILE
        jmp out_text
:       lda fflags
        and #1
        beq :+
        ldx #MSG_ISDIR
        jmp out_text
:       lda fflags
        and #2
        beq @show
        ldx #MSG_DENIED         ; "Permission denied" (and why)
        jsr out_text
        ldx ftext
        cpx #255
        beq @done
        lda #' '
        jsr out_char
        lda #'('
        jsr out_char
        ldx ftext
        jsr out_text
        lda #')'
        jmp out_char
@show:  ldx ftext
        jmp out_text
@done:  rts

; argp (a path) -> path: absolute, with ~, . and .. resolved against cwd
resolve:
        ldy #0
        lda (argp),y
        cmp #'/'
        beq @abs
        cmp #'~'
        bne @rel
        ldx #0                  ; ~ = home
:       lda home,x
        sta path,x
        beq :+
        inx
        bne :-
:       iny
        bne @segs
@rel:   ldx #0
:       lda cwd,x
        sta path,x
        beq @segs
        inx
        bne :-
@abs:   ldx #0
        stx path
@segs:  stx t0                  ; path length so far (no trailing /)
@seg:   lda (argp),y            ; next segment
        beq @end
        cmp #'/'
        bne :+
        iny
        bne @seg
:       cmp #'.'                ; "." / ".."
        bne @name
        iny
        lda (argp),y
        beq @end
        cmp #'/'
        beq @seg
        cmp #'.'
        bne @dotname
        iny
        lda (argp),y
        beq :+
        cmp #'/'
        bne @dotdot2
:       ldx t0                  ; up one
:       dex
        bmi :+
        lda path,x
        cmp #'/'
        bne :-
        stx t0
        jmp @seg
:       lda #0
        sta t0
        jmp @seg
@dotdot2:
        dey
@dotname:
        dey
@name:  ldx t0
        lda #'/'
        sta path,x
        inx
:       lda (argp),y
        beq :+
        cmp #'/'
        beq :+
        sta path,x
        inx
        iny
        cpx #62
        bcc :-
:       stx t0
        jmp @seg
@end:   ldx t0
        bne :+
        lda #'/'                ; the root
        sta path
        inx
:       lda #0
        sta path,x
        rts

; path -> its entry: C=0 found (fflags, ftext), C=1 not
find_entry:
        lda #<fs_tab
        sta p2
        lda #>fs_tab
        sta p2+1
@e:     ldy #0
        lda (p2),y
        beq @no
        jsr entry_path
        lda #<epath
        sta p0
        lda #>epath
        sta p0+1
        lda #<path
        sta p1
        lda #>path
        sta p1+1
        jsr streq
        bne @e
        lda eflags
        sta fflags
        lda etext
        sta ftext
        clc
        rts
@no:    sec
        rts

; p2 = an entry: epath = its path (~ = home), eflags, etext; p2 moves to the next
entry_path:
        ldy #0
        lda (p2),y
        sta eflags
        iny
        lda (p2),y
        sta etext
        iny
        ldx #0
        lda (p2),y
        cmp #'~'
        bne @c
:       lda home,x
        beq :+
        sta epath,x
        inx
        bne :-
:       iny
@c:     lda (p2),y
        sta epath,x
        beq :+
        inx
        iny
        bne @c
:       iny
        tya
        clc
        adc p2
        sta p2
        bcc :+
        inc p2+1
:       rts

; epath below path? C=1 and p1 = the name if it is right inside it
child_name:
        ldx #0
:       lda path,x
        beq :+
        cmp epath,x
        bne @no
        inx
        bne :-
:       cpx #1                  ; (the root: "/" itself ends the prefix)
        bne :+
        lda path
        cmp #'/'
        bne :+
        dex
:       lda epath,x
        cmp #'/'
        bne @no
        inx
        txa
        clc
        adc #<epath
        sta p1
        lda #>epath
        adc #0
        sta p1+1
        ldy #0                  ; no further /
:       lda (p1),y
        beq @yes
        cmp #'/'
        beq @no
        iny
        bne :-
@yes:   sec
        rts
@no:    clc
        rts

; ---- systemctl
h_systemctl:
        ldx #1                  ; the verb (default list-units)
        jsr argv_p
        lda #<v_isolate
        ldx #>v_isolate
        jsr verb_is
        bne :+
        jmp sc_isolate
:       lda #<v_status
        ldx #>v_status
        jsr verb_is
        bne :+
        jmp sc_status
:       lda #<v_list
        ldx #>v_list
        jsr verb_is
        beq sc_list
        ldy #0
        lda (p0),y
        beq sc_list             ; (no verb)
        lda #<v_start           ; start/stop/restart/enable/disable/...: no
        ldx #>v_start
        jsr verb_is
        beq @no
        lda #<v_stop
        ldx #>v_stop
        jsr verb_is
        beq @no
        lda #<v_restart
        ldx #>v_restart
        jsr verb_is
        beq @no
        ldx #MSG_SCVERB
        jmp out_text
@no:    ldx #MSG_SCDENIED
        jmp out_text

; A/X = verb, p0 = the word -> Z=1 when it starts with the verb
verb_is:
        sta p1
        stx p1+1
        ldy #0
:       lda (p1),y
        beq :+
        cmp (p0),y
        bne :++
        iny
        bne :-
:       lda #0
:       rts

sc_list:                        ; "target" anywhere in the line: all the floors
        ldy #0
@t:     sty t0
        ldx #0
:       lda (restp),y
        cmp s_target,x
        bne @n
        iny
        inx
        cpx #6
        bne :-
        jmp sc_targets
@n:     ldy t0
        lda (restp),y
        beq @units
        iny
        bne @t
@units: ldx #MSG_SCUNITS
        jmp out_text
sc_targets:
        lda #1
        sta fl
@f:     jsr level_name          ; "levelNN.target Floor N - name"
        lda #' '
        jsr out_char
        jsr floor_desc
        jsr newline
        inc fl
        lda fl
        cmp #FLOORS_TOP + 1
        bne @f
        rts

; fl = floor: "levelNN.target"
level_name:
        lda #<s_level
        ldx #>s_level
        jsr out_str
        lda fl
        jsr two_digits
        lda dg0
        jsr out_char
        lda dg1
        jsr out_char
        lda #<s_dottarget
        ldx #>s_dottarget
        jmp out_str

; fl = floor: "Floor N - name"
floor_desc:
        lda #<s_floor
        ldx #>s_floor
        jsr out_str
        lda fl
        jsr num_str
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        lda fl                  ; the name: only this floor's is known (its header)
        cmp st_floor
        bne :+
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        lda #<(FL_HDR + HDR_NAME)
        ldx #>(FL_HDR + HDR_NAME)
        jmp out_str
:       rts

; the unit (word 2) -> fl = its level 1-99, C=0; C=1 if it isn't levelNN[.target]
unit_level:
        ldx #2
        jsr argv_p
        ldy #0
:       lda s_level,y
        beq :+
        cmp (p0),y
        bne @no
        iny
        bne :-
:       lda #0
        sta fl
        ldx #0
@d:     lda (p0),y
        cmp #'0'
        bcc @end
        cmp #'9' + 1
        bcs @end
        and #$0f
        sta t2
        lda fl                  ; × 10 + digit
        asl
        asl
        adc fl
        asl
        adc t2
        sta fl
        iny
        inx
        cpx #3
        bcc @d
@end:   cpx #0
        beq @no
        cpx #3
        bcs @no
        lda (p0),y              ; then nothing or ".target"
        beq @ok
        ldx #0
:       lda s_dottarget,x
        beq :+
        cmp (p0),y
        bne @no
        inx
        iny
        bne :-
:       lda (p0),y
        bne @no
@ok:    clc
        rts
@no:    sec
        rts

sc_status:
        lda argc
        cmp #3
        bcs :+
        ldx #MSG_SCHOST
        jmp out_text
:       jsr unit_level
        bcs @none
        lda fl
        beq @none
        cmp #FLOORS_TOP + 1
        bcs @none
        lda #'*'                ; "* levelNN.target - Floor N - name" / "Active: ..."
        jsr out_char
        lda #' '
        jsr out_char
        jsr level_name
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        jsr floor_desc
        jsr newline
        lda #<s_active
        ldx #>s_active
        ldy fl
        cpy st_floor
        beq :+
        lda #<s_inactive
        ldx #>s_inactive
:       jmp out_str
@none:  ldx #2
        jsr argv_p
        lda p0
        sta argp
        lda p0+1
        sta argp+1
        ldx #MSG_SCNOUNIT
        jmp out_text

sc_isolate:
        lda argc
        cmp #3
        bcs :+
        ldx #MSG_SCFEW
        jmp out_text
:       ldx #2
        jsr argv_p
        lda p0
        sta argp
        lda p0+1
        sta argp+1
        jsr unit_level
        bcc :+
        ldx #MSG_SCNOUNIT
        jmp out_text
:       lda fl
        beq @rumour
        cmp #FLOORS_TOP + 1
        bcs @rumour
        cmp st_floor
        bne :+
        ldx #MSG_SCHERE
        jmp out_text
:       ldx #MSG_SCSTOP
        jsr out_text
        jsr newline
        ldx #MSG_SCSTART
        jsr out_text
        jsr level_name
        lda #<s_dash
        ldx #>s_dash
        jsr out_str
        jsr floor_desc
        jsr newline
        ldx #MSG_SCCALL
        jsr out_text
        lda fl
        sta warp
        rts
@rumour:
        ldx #MSG_SCRUMOUR
        jmp out_text

; ---- output ---------------------------------------------------------------------------------------------------
; X = text: printed (byte pairs expanded, placeholders filled), then a line break
out_text:
        lda #<texts             ; text X: past X zero bytes
        sta tp
        lda #>texts
        sta tp+1
        ldy #0
@find:  cpx #0
        beq @go
:       lda (tp),y
        inc tp
        bne :+
        inc tp+1
:       cmp #0
        bne :--
        dex
        jmp @find
@go:    lda #0
        sta skipdef
        ldy #0
:       lda (tp),y
        beq :+
        sty t3
        jsr emit
        ldy t3
        iny
        bne :-
:       rts

; A = a byte of encoded text
emit:
        bpl emit_plain
        tax                     ; a pair: both halves
        lda tbpe_b-128,x
        pha
        lda tbpe_a-128,x
        jsr emit
        pla
        jmp emit

; A = a char or a placeholder
emit_plain:
        cmp #12                 ; the end of placeholder 8's default text
        bne :+
        lda #0
        sta skipdef
        rts
:       ldx skipdef
        beq :+
        rts
:       cmp #10
        bne :+
        jmp newline
:       cmp #14
        bcc :+
        jmp out_char
:       asl                     ; a placeholder (1-13): its routine
        tax
        lda ph_jump-2,x
        sta jmpv
        lda ph_jump-1,x
        sta jmpv+1
        jmp (jmpv)

ph_jump:                        ; (placeholder n at ph_jump + 2n - 2)
        .word ph_login, ph_host, ph_floor, ph_fname, ph_title, ph_corp, ph_home
        .word ph_arg, ph_none, ph_none, ph_floor2, ph_none, ph_below

ph_login:
        lda #<login
        ldx #>login
        jsr out_str
        rts
ph_host:
        lda #<host
        ldx #>host
        jsr out_str
        rts
ph_floor:
        lda st_floor
        jsr num_str
        lda #<numbuf
        ldx #>numbuf
        jsr out_str
        rts
ph_fname:
        lda #<(FL_HDR + HDR_NAME)
        ldx #>(FL_HDR + HDR_NAME)
        jsr out_str
        rts
ph_title:
        lda #<(FL_HDR + HDR_TITLE)
        ldx #>(FL_HDR + HDR_TITLE)
        jsr out_str
        rts
ph_corp:
        lda #<st_corp
        ldx #>st_corp
        jsr out_str
        rts
ph_home:
        lda #<home
        ldx #>home
        jsr out_str
        rts
ph_arg:
        ldy #0
        lda (argp),y
        beq :+
        lda argp                ; the argument, and its default text is skipped
        ldx argp+1
        jsr out_str
        lda #1
        sta skipdef
:       rts
ph_floor2:
        lda st_floor
        jmp :+
ph_below:
        lda st_floor
        cmp #2
        bcc :+
        sbc #1
:       jsr two_digits
        lda dg0
        jsr out_char
        lda dg1
        jsr out_char
        rts
ph_none:
        rts

two_spaces:
        lda #' '
        jsr out_char
        lda #' '
        jmp out_char

; A/X = plain string: printed
out_str:
        sta p0
        stx p0+1
        ldy #0
:       lda (p0),y
        beq :+
        jsr out_char_y
        iny
        bne :-
:       rts

out_char_x:
        stx t0
        jsr out_char
        ldx t0
        rts
out_char_y:
        sty tlen_y
        jsr out_char
        ldy tlen_y
        rts

; A = char: at the cursor (or into tbuf), wrapping and scrolling
out_char:
        ldx redir
        beq :+
        ldx tlen
        cpx #COLS
        bcs @r
        sta tbuf,x
        inc tlen
@r:     rts
:       jsr screen_put
        inc cx
        lda cx
        cmp #COLS
        bcc :+
newline:
        lda #0
        sta cx
        inc cy
        lda cy
        cmp #ROWS
        bcc :+
        dec cy
        jmp scroll
:       rts

; A = char at cx/cy (green)
screen_put:
        pha
        ldy cy
        lda row_lo,y
        clc
        adc cx
        sta sp_
        sta cp_
        lda row_hi,y
        adc #0
        sta sp_+1
        and #$03
        ora #$d8
        sta cp_+1
        ldy #0
        pla
        sta (sp_),y
        lda #GREEN
        sta (cp_),y
        rts

; everything up one row (in order: the bands overlap)
scroll:
        ldx #0
:       lda $c000 + 40,x
        sta $c000,x
        inx
        cpx #240
        bne :-
        ldx #0
:       lda $c000 + 280,x
        sta $c000 + 240,x
        inx
        cpx #240
        bne :-
        ldx #0
:       lda $c000 + 520,x
        sta $c000 + 480,x
        inx
        cpx #240
        bne :-
        ldx #0
:       lda $c000 + 760,x
        sta $c000 + 720,x
        inx
        cpx #240
        bne :-
        ldx #39                 ; the last row cleared
        lda #' '
:       sta $c000 + 960,x
        dex
        bpl :-
        rts

cls_:
        lda #GREEN
        sta COLOR
        jsr API_CLS
        lda #0
        sta cx
        sta cy
        rts

row_lo: .repeat ROWS, i
        .byte <($c000 + i * 40)
        .endrep
row_hi: .repeat ROWS, i
        .byte >($c000 + i * 40)
        .endrep

s_newhire:  .byte "newhire", 0
s_ws:       .byte "-ws"
s_homedir:  .byte "/home/", 0
s_dot:      .byte ".", 0
s_usrbin:   .byte "/usr/bin/", 0
s_sandwich: .byte "make me a sandwich", 0
s_level:    .byte "level", 0
s_dottarget: .byte ".target", 0
s_target:   .byte "target"
s_floor:    .byte "Floor ", 0
s_dash:     .byte " - ", 0
s_active:   .byte "   Active: active since 09:00 (you are here)", 0
s_inactive: .byte "   Active: inactive (dead)", 0
v_isolate:  .byte "isolate", 0
v_status:   .byte "status", 0
v_list:     .byte "list", 0
v_start:    .byte "start", 0
v_stop:     .byte "stop", 0
v_restart:  .byte "restart", 0
empty:      .byte 0

.include "gen/term_data.s"

; buffers: on the second screen after the history
BUF     = HIST + HISTN * LINELEN
login   = BUF                   ; 13
host    = login + 13            ; 12
home    = host + 12             ; 20
cwd     = home + 20             ; 64
path    = cwd + 64              ; 64
epath   = path + 64             ; 64
line    = epath + 64            ; LINELEN
words   = line + LINELEN        ; LINELEN + MAXARG
argv    = words + LINELEN + MAXARG ; MAXARG
restx   = argv + MAXARG
numbuf  = restx + 1             ; 4
tbuf    = numbuf + 4            ; COLS
eflags  = tbuf + COLS
etext   = eflags + 1
fflags  = etext + 1
ftext   = fflags + 1
tlen_y  = ftext + 1
.assert tlen_y < $c7e8, error, "terminal buffers past the second screen"
