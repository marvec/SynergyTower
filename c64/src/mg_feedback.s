; 360 Feedback (src/minigames/feedback.js + the floor part in src/scenes/floorQuest.js) as a disk-loaded overlay at
; $4000. A floor quest: the resident code (src/quest.s) picks a colleague on the floor and runs the search; this
; overlay picks what they will say (QUEST_SETUP), draws the hallway chat (QUEST_VIEW), and the desk half below is the
; 360 form: answer questions about the colleague from what they told you, 4 options each.
; Difficulty (d = MG_DIFF / 255):           d = 0      d = 1
;   questions         round(2 + 2d)          2          4   (achievement, growth area, job title, years: in order)
;   time for the form 45 - 13d s             45 s       32 s
;   search time       round(80 - 25d) s      80 s       55 s   (Q_LIMIT, for the floor part)
; Score: correct / questions × (0.8 + 0.2 × speed bonus of the search); speed 0.5 without a quest (FB_WHO = 0, the
; colleague is made up as feedbackFacts() does).
; Content: src/data/mg-feedback.js, the department's ROLES and the names in src/data/people.js (gen/mg_feedback_data.s).

.include "api.inc"

REVEAL_T  = 40                  ; 0.8 s on the answer, the form's clock keeps running (as in the JS)
FORM_Y    = 2                   ; the form: rows 2-12 (subject, then the answers so far, 2 rows each)
LOG_Y     = 4
QUEST_Y   = 13                  ; the question
MSG_Y     = 14                  ; "Accurate!" / "That was someone else..."
OPT_Y     = 15                  ; 2 × 2 option boxes of 20 × 4 (2 text lines of OPT_W)
OPT_W     = 16
BOX_W     = 20
BOX_H     = 4
CHAT_W    = 36                  ; the chat page's lines
NO_ROLE   = $ff                 ; role_idx: the colleague's title is not in this department's list
RIGHT_RB  = $ff                 ; opt_v of the right job title (rbuf)
SPEED_DEF = 128                 ; speed bonus 0.5 without a quest
NBUF      = 32                  ; name / job title buffers
LBUF      = 80                  ; text composing buffer
.if .defined(AUTOPLAY)
BOT_T     = 50                  ; the bot answers after 1 s
.endif

.zeropage
diff:     .res 1
nq:       .res 1                ; questions
qi:       .res 1                ; current question
correct:  .res 1
focus:    .res 1
right:    .res 1                ; option index of the right answer
chosen:   .res 1
reveal:   .res 1                ; frames left on the answer, 0 = asking
done:     .res 1
last_key: .res 1                ; number_key of the last frame ($ff = none)
speed:    .res 1
years:    .res 1
ach:      .res 1
grow:     .res 1
role_idx: .res 1
rightv:   .res 1                ; value of the right option (index into its pool, or the years)
ncand:    .res 1
k:        .res 1
lpos:     .res 1                ; lbuf length while composing
stopc:    .res 1                ; cat: stop at this char too (' ': the first name)
wp:       .res 1                ; wrap_print: position, width, column, row, lines left
wid:      .res 1
col:      .res 1
row:      .res 1
maxl:     .res 1
wsave:    .res 1
t0:       .res 1
t1:       .res 1
m_a:      .res 1
m_b:      .res 1
m_lo:     .res 1
sp:       .res 2                ; source string
dp:       .res 2                ; destination
.if .defined(AUTOPLAY)
bot_t:    .res 1
.endif

.segment "CODE"
        jmp init                ; the desk half: A = difficulty, X = department
        jmp frame
        .word s_name, s_help
        jmp quest_setup         ; $400a: the floor half begins
        jmp quest_view          ; $400d: A = 0 first chat, 1 later: the hallway chat page

.include "mgkit.s"

; ---- the floor part ------------------------------------------------------------------------------------------------
; MG_DIFF set: what the colleague will brag about and admit to, the search time. No screen access.
quest_setup:
        lda #N_ACH
        jsr API_RMOD
        sta FB_ACH
        lda #N_GROW
        jsr API_RMOD
        sta FB_GROW
        lda MG_DIFF             ; Q_LIMIT = 80 - round(25 d)
        ldy #25
        jsr mulr
        eor #$ff
        sec
        adc #80
        sta Q_LIMIT
        rts

; A = 0 first chat, 1 later: name and role, then the three things they say (floorQuest.js onTalk).
quest_view:
        sta t1
        jsr facts
        lda #0
        sta COLOR
        jsr API_CLS
        ; title "<name> - <role>", the role on its own row when that is too long
        lda #0
        sta lpos
        sta stopc
        lda #<nbuf
        ldx #>nbuf
        jsr cat
        lda #<s_dash
        ldx #>s_dash
        jsr cat
        lda #<rbuf
        ldx #>rbuf
        jsr cat
        lda #7
        sta COLOR
        lda lpos
        cmp #39
        bcs :+
        lda #<lbuf
        ldx #>lbuf
        ldy #1
        jsr API_CENTER
        jmp @face
:       lda #<nbuf
        ldx #>nbuf
        ldy #1
        jsr API_CENTER
        lda #7
        sta COLOR
        lda #<rbuf
        ldx #>rbuf
        ldy #2
        jsr API_CENTER
@face:  lda #6
        jsr API_RMOD
        tax
        lda hair_tab,x
        ldx #2
        ldy #4
        jsr face
        ; the greeting (their speech bubble in the JS): a random one, or "Like I said..." on later chats
        lda #0
        sta lpos
        lda #'"'
        jsr catc
        lda t1
        beq :+
        lda #<s_said
        ldx #>s_said
        jsr cat
        jmp @gr
:       lda #N_GREET
        jsr API_RMOD
        tax
        lda greet_lo,x
        ldy greet_hi,x
        tax
        tya
        jsr cat_ax
@gr:    lda #'"'
        jsr catc
        lda #3
        sta COLOR
        lda #<lbuf
        sta PTR
        lda #>lbuf
        sta PTR+1
        ldx #5
        ldy #4
        jsr API_PRINT
        ; the box with the three quoted lines
        lda #1
        sta COLOR
        lda #40
        sta FILL_W
        lda #13
        sta FILL_H
        ldx #0
        ldy #7
        jsr API_BOX
        lda #9
        sta row
        ; "<brag line with the achievement>"
        lda #0
        sta lpos
        lda #'"'
        jsr catc
        lda #N_BRAGP
        jsr API_RMOD
        sta t0
        tax
        lda bragp_lo,x
        ldy bragp_hi,x
        tax
        tya
        jsr cat_ax
        ldx ach
        lda ach_lo,x
        ldy ach_hi,x
        tax
        tya
        jsr cat_ax
        ldx t0
        lda brags_lo,x
        ldy brags_hi,x
        tax
        tya
        jsr cat_ax
        jsr chat_line
        ; "<admit line with the growth area>"
        lda #0
        sta lpos
        lda #'"'
        jsr catc
        lda #N_ADMITP
        jsr API_RMOD
        sta t0
        tax
        lda admitp_lo,x
        ldy admitp_hi,x
        tax
        tya
        jsr cat_ax
        ldx grow
        lda grow_lo,x
        ldy grow_hi,x
        tax
        tya
        jsr cat_ax
        ldx t0
        lda admits_lo,x
        ldy admits_hi,x
        tax
        tya
        jsr cat_ax
        jsr chat_line
        ; "Been here N year(s) now. Time flies."
        lda #0
        sta lpos
        lda #'"'
        jsr catc
        lda #<s_been
        ldx #>s_been
        jsr cat
        lda years
        jsr cat_years
        lda #<s_flies
        ldx #>s_flies
        jsr cat
        jsr chat_line
        lda #<s_noted
        ldx #>s_noted
        jmp footer

; lbuf + closing quote: wrapped into the box from `row`, then a blank row.
chat_line:
        lda #'"'
        jsr catc
        lda #1
        sta COLOR
        lda #CHAT_W
        sta wid
        lda #2
        sta col
        lda #3
        sta maxl
        jsr wrap_print
        inc row
        rts

; ---- the colleague's facts -------------------------------------------------------------------------------------------
; nbuf, rbuf, years, ach, grow, speed (and role_idx): from the quest, or made up when FB_WHO = 0.
facts:
        lda FB_WHO
        ora FB_WHO+1
        bne @quest
        lda #<nbuf              ; "First Last"
        sta dp
        lda #>nbuf
        sta dp+1
        lda #N_FIRST
        jsr API_RMOD
        tax
        lda first_lo,x
        sta sp
        lda first_hi,x
        sta sp+1
        jsr copy_str
        lda #' '
        ldy #0
        sta (dp),y
        inc dp
        bne :+
        inc dp+1
:       lda #N_LAST
        jsr API_RMOD
        tax
        lda last_lo,x
        sta sp
        lda last_hi,x
        sta sp+1
        jsr copy_str
        lda #<rbuf
        sta dp
        lda #>rbuf
        sta dp+1
        lda #N_ROLE
        jsr API_RMOD
        tax
        lda role_lo,x
        sta sp
        lda role_hi,x
        sta sp+1
        jsr copy_str
        lda #24                 ; years 1-24
        jsr API_RMOD
        clc
        adc #1
        sta years
        lda #N_ACH
        jsr API_RMOD
        sta ach
        lda #N_GROW
        jsr API_RMOD
        sta grow
        lda #SPEED_DEF
        sta speed
        jmp find_role
@quest: lda FB_WHO              ; the record: name, then role
        sta sp
        lda FB_WHO+1
        sta sp+1
        lda #<nbuf
        sta dp
        lda #>nbuf
        sta dp+1
        jsr copy_str
        ldy #$ff                ; skip the name and its 0
:       iny
        lda (sp),y
        bne :-
        tya
        sec
        adc sp
        sta sp
        bcc :+
        inc sp+1
:       lda #<rbuf
        sta dp
        lda #>rbuf
        sta dp+1
        jsr copy_str
        lda FB_YEARS
        sta years
        lda FB_ACH
        sta ach
        lda FB_GROW
        sta grow
        lda Q_SPEED
        sta speed
        ; fall through

; role_idx = the colleague's title in this department's list (left out of the wrong options), NO_ROLE if absent.
find_role:
        ldx #N_ROLE-1
@r:     stx t0
        lda role_lo,x
        sta sp
        lda role_hi,x
        sta sp+1
        ldy #0
:       lda (sp),y
        cmp rbuf,y
        bne @next
        cmp #0
        beq @found
        iny
        bne :-
@next:  ldx t0
        dex
        bpl @r
        lda #NO_ROLE
        sta role_idx
        rts
@found: lda t0
        sta role_idx
        rts

; (sp) -> (dp), 0-terminated, at most NBUF - 1 chars. Y = length, dp advanced to the 0.
copy_str:
        ldy #0
:       lda (sp),y
        beq :+
        sta (dp),y
        iny
        cpy #NBUF-1
        bne :-
:       lda #0
        sta (dp),y
        tya
        pha
        clc
        adc dp
        sta dp
        bcc :+
        inc dp+1
:       pla
        tay
        rts

; ---- composing text in lbuf ----------------------------------------------------------------------------------------
; A/X = string: appended to lbuf (stopping at stopc too), 0-terminated.
cat:    sta sp
        stx sp+1
        ldy #0
        ldx lpos
:       lda (sp),y
        beq @end
        cmp stopc
        beq @end
        sta lbuf,x
        inx
        iny
        cpx #LBUF-1
        bne :-
@end:   stx lpos
        lda #0
        sta lbuf,x
        rts

; X = low, A = high byte of the string (from a table): cat.
cat_ax: pha
        txa
        sta sp
        pla
        tax
        lda sp
        jmp cat

; A = char appended to lbuf.
catc:   ldx lpos
        sta lbuf,x
        inx
        lda #0
        sta lbuf,x
        stx lpos
        rts

; A = n: "n year" / "n years" appended to lbuf.
cat_years:
        sta t0
        ldx #'0'
        lda t0
:       cmp #10
        bcc :+
        sbc #10
        inx
        bne :-
:       pha
        cpx #'0'
        beq :+
        txa
        jsr catc
:       pla
        ora #'0'
        jsr catc
        lda #<s_year
        ldx #>s_year
        jsr cat
        lda t0
        cmp #1
        beq :+
        lda #'s'
        jsr catc
:       rts

; Print lbuf word-wrapped: wid columns, at col / row (row advances), at most maxl lines, in COLOR.
wrap_print:
        lda #0
        sta wp
@line:  lda maxl
        beq @out
        ldy wp
        ldx #0
@scan:  lda lbuf,y
        beq @fits
        cpx wid
        beq @long
        inx
        iny
        bne @scan
@fits:  jsr @print              ; the rest fits
        inc row
@out:   rts
@long:  ldx wid                 ; Y = wp + wid: back to the last space
@back:  lda lbuf,y
        cmp #' '
        beq @split
        dey
        dex
        bne @back
        lda wp                  ; no space: hard split after wid chars
        clc
        adc wid
        tay
        lda lbuf,y
@split: sta wsave
        lda #0
        sta lbuf,y
        sty t0
        jsr @print
        ldy t0
        lda wsave
        sta lbuf,y
        cmp #' '                ; (a hard split keeps that char for the next line)
        bne :+
        iny
:       sty wp
        inc row
        dec maxl
        jmp @line
@print: lda #<lbuf
        clc
        adc wp
        sta PTR
        lda #>lbuf
        adc #0
        sta PTR+1
        ldx col
        ldy row
        jmp API_PRINT

; ---- the desk half: the 360 form -------------------------------------------------------------------------------------
init:
        sta diff
        lda #$ff
        sta last_key
        lda #0
        sta qi
        sta correct
        sta done
        sta reveal
        jsr facts
        ; questions = 2 + round(2d)
        lda diff
        ldy #2
        jsr mulr
        clc
        adc #2
        sta nq
        ; the form's time: 2250 - 650d frames = 2250 - (D × 163) / 64
        lda diff
        ldy #163
        jsr mul8                ; A:m_lo
        asl m_lo                ; (A:m_lo) >> 6 = (A:m_lo) << 2 >> 8
        rol
        sta t1
        lda #0
        rol
        sta t0
        asl m_lo
        rol t1
        rol t0                  ; t0:t1 = (D × 163) >> 6
        lda #<2250
        sec
        sbc t1
        tay
        lda #>2250
        sbc t0
        tax
        tya
        jsr timer_start
        ; the screen: header, the form with the subject
        text 1, 0, s_name, 7
        lda #1
        sta COLOR
        lda #40
        sta FILL_W
        lda #11
        sta FILL_H
        ldx #0
        ldy #FORM_Y
        jsr API_BOX
        text 2, FORM_Y, s_form, 3
        text 2, FORM_Y+1, s_subject, 1
        lda #<nbuf
        sta PTR
        lda #>nbuf
        sta PTR+1
        ldx #11
        ldy #FORM_Y+1
        jsr API_PRINT
        lda #<s_keys
        ldx #>s_keys
        jsr footer
        jmp ask

; A × Y -> A = round(A × Y / 256)
mulr:   jsr mul8
        ldx m_lo
        cpx #$80
        adc #0
        rts

; A × Y -> A = high byte, m_lo = low byte (X = 0)
mul8:   sta m_a
        sty m_b
        lda #0
        ldx #8
@l:     lsr m_a
        bcc :+
        clc
        adc m_b
:       ror
        ror m_lo
        dex
        bne @l
        rts

; Question qi: its text, its options, the boxes.
ask:
        lda #0
        sta reveal
        sta focus
.if .defined(AUTOPLAY)
        sta bot_t
.endif
        lda #QUEST_Y
        ldx #24 - QUEST_Y
        jsr clear_rows
        jsr draw_counter
        lda qi
        jsr build_q
        lda #1
        sta COLOR
        lda #<lbuf
        ldx #>lbuf
        ldy #QUEST_Y
        jsr API_CENTER
        jsr gen_opts
        jmp draw_options

; A = question: its text in lbuf ("What did <first> achieve this quarter?"...).
build_q:
        tax
        lda #0
        sta lpos
        sta stopc
        lda qpre_lo,x
        ldy qpre_hi,x
        stx t1
        tax
        tya
        jsr cat_ax
        lda #' '
        sta stopc
        lda #<nbuf
        ldx #>nbuf
        jsr cat
        lda #0
        sta stopc
        ldx t1
        lda qsuf_lo,x
        ldy qsuf_hi,x
        tax
        tya
        jmp cat_ax

; The options of question qi: the right answer + 3 random others from its pool (JS options() / yearPool), shuffled.
gen_opts:
        lda #0
        sta ncand
        lda qi
        cmp #3
        beq @yrs
        cmp #2
        beq @role
        tax                     ; 0 achievement, 1 growth area: every other index of the pool
        lda ach,x
        sta rightv
        lda pool_n,x
        sta t1
        ldx #0
:       cpx rightv
        beq :+
        jsr add_x
:       inx
        cpx t1
        bne :--
        jmp @pick
@role:  lda #RIGHT_RB
        sta rightv
        ldx #0
:       cpx role_idx
        beq :+
        jsr add_x
:       inx
        cpx #N_ROLE
        bne :--
        jmp @pick
@yrs:   lda years               ; y+1, y+2, max(1, y-1), max(1, y-3), y+5, without y and repeats
        sta rightv
        clc
        adc #1
        jsr add_year
        lda years
        clc
        adc #2
        jsr add_year
        lda years
        sec
        sbc #1
        jsr add_year1
        lda years
        sec
        sbc #3
        jsr add_year1
        lda years
        clc
        adc #5
        jsr add_year
@pick:  ldx #0                  ; partial Fisher-Yates: cand[0..2] = a random sample
@s:     stx t0
        lda ncand
        sec
        sbc t0
        jsr API_RMOD
        clc
        adc t0
        tay
        ldx t0
        lda cand,x
        pha
        lda cand,y
        sta cand,x
        sta opt_v+1,x
        pla
        sta cand,y
        inx
        cpx #3
        bne @s
        lda rightv
        sta opt_v
        ldx #3                  ; shuffle the four
@sh:    stx t0
        txa
        clc
        adc #1
        jsr API_RMOD
        tay
        ldx t0
        lda opt_v,x
        pha
        lda opt_v,y
        sta opt_v,x
        pla
        sta opt_v,y
        dex
        bne @sh
        ldx #3
:       lda opt_v,x
        cmp rightv
        beq :+
        dex
        bne :-
:       stx right
        ; the option strings
        ldx #3
@str:   stx k
        lda opt_v,x
        tay
        lda qi
        beq @a
        cmp #2
        beq @r
        bcs @y
        lda grow_lo,y           ; growth area
        sta opt_lo,x
        lda grow_hi,y
        sta opt_hi,x
        jmp @nx
@a:     lda ach_lo,y
        sta opt_lo,x
        lda ach_hi,y
        sta opt_hi,x
        jmp @nx
@r:     cpy #RIGHT_RB
        bne :+
        lda #<rbuf
        sta opt_lo,x
        lda #>rbuf
        sta opt_hi,x
        jmp @nx
:       lda role_lo,y
        sta opt_lo,x
        lda role_hi,y
        sta opt_hi,x
        jmp @nx
@y:     lda #0                  ; "n years" into ybuf + 10x
        sta lpos
        tya
        jsr cat_years
        lda k
        asl
        asl
        adc k
        asl
        tay                     ; Y = 10x
        clc
        adc #<ybuf
        ldx k
        sta opt_lo,x
        lda #>ybuf
        adc #0
        sta opt_hi,x
        ldx #0
:       lda lbuf,x
        sta ybuf,y
        iny
        inx
        cmp #0
        bne :-
        ldx k
@nx:    dex
        bpl @str
        rts

; X appended to cand (keeps X).
add_x:  txa
        ldy ncand
        sta cand,y
        inc ncand
        rts

; A = years, at least 1 (add_year1, after a subtraction: C=0 / A=0 -> 1) / as is: appended to cand unless it is
; the right one or already there.
add_year1:
        bcc @one
        bne add_year
@one:   lda #1
add_year:
        cmp years
        beq @no
        ldy ncand
@chk:   dey
        bmi @add
        cmp cand,y
        bne @chk
        rts
@add:   ldy ncand
        sta cand,y
        inc ncand
@no:    rts

; ---- drawing ---------------------------------------------------------------------------------------------------------
; The 2 × 2 option boxes: idle blue, focus yellow; after the answer the right one green, a wrong pick red.
draw_options:
        lda #0
        sta t1
@o:     ldx t1
        lda #6                  ; idle: blue
        cpx focus
        bne :+
        ldy reveal
        bne :+
        lda #7                  ; focus: yellow
:       ldy reveal
        beq @col
        lda #6
        cpx right
        bne :+
        lda #5                  ; the right answer: green
        bne @col
:       cpx chosen
        bne @col
        lda #2                  ; wrong pick: red
@col:   sta COLOR
        lda #BOX_W
        sta FILL_W
        lda #BOX_H
        sta FILL_H
        lda t1                  ; column (k & 1) × 20, row OPT_Y + (k >> 1) × 4
        and #1
        beq :+
        lda #BOX_W
:       sta col
        lda t1
        and #2
        asl
        adc #OPT_Y
        sta row
        ldx col
        ldy row
        jsr API_BOX
        lda t1
        clc
        adc #'1'
        ldx col
        inx
        ldy row
        iny
        jsr API_PUTC
        lda #0                  ; the text: 2 lines of OPT_W
        sta lpos
        sta stopc
        ldx t1
        lda opt_lo,x
        ldy opt_hi,x
        tax
        tya
        jsr cat_ax
        lda #1
        sta COLOR
        lda #OPT_W
        sta wid
        lda #2
        sta maxl
        inc row
        lda col
        clc
        adc #3
        sta col
        jsr wrap_print
        inc t1
        lda t1
        cmp #4
        beq :+
        jmp @o
:       rts

; "Question q/n" top right.
draw_counter:
        text 27, 0, s_question, 1
        ldx #36
        ldy #0
        lda qi
        clc
        adc #1
        jsr API_NUM
        lda #'/'
        ldx #37
        ldy #0
        jsr API_PUTC
        ldx #38
        ldy #0
        lda nq
        jmp API_NUM

; ---- the game loop ---------------------------------------------------------------------------------------------------
; One frame. C=1 when the form is done.
frame:
        lda done
        beq :+
        sec
        rts
:       jsr timer_tick          ; the clock runs for the whole form, answers included
        bcc :+
        jmp finish
:       lda reveal
        beq @ask
        dec reveal
        bne @wait
        inc qi
        lda qi
        cmp nq
        bne :+
        jmp finish
:       jsr ask
@wait:  clc
        rts
@ask:
.if .defined(AUTOPLAY)
        inc bot_t
        lda bot_t
        cmp #BOT_T
        bne :+
        lda right
        jmp answer
:
.endif
        jsr number_key          ; keys 1-4, on the press only
        cmp last_key
        sta last_key
        beq :+
        cmp #4
        bcs :+
        jmp answer
:       lda focus
        sta t0
        lda JOYP
        lsr                     ; up
        bcc :+
        ldx focus
        cpx #2
        bcc :+
        dec focus
        dec focus
:       lsr                     ; down
        bcc :+
        ldx focus
        cpx #2
        bcs :+
        inc focus
        inc focus
:       lsr                     ; left
        bcc :+
        dec focus
:       lsr                     ; right
        bcc :+
        inc focus
:       lsr                     ; fire
        bcc :+
        lda focus
        and #3
        jmp answer
:       lda focus
        and #3
        sta focus
        cmp t0
        beq :+
        lda #SFX_BLIP
        jsr API_SFX
        jsr draw_options
:       clc
        rts

; A = picked option: the verdict, the answer onto the form.
answer:
        and #3
        sta chosen
        cmp right
        bne @wrong
        inc correct
        lda #SFX_GOOD
        jsr API_SFX
        lda #5
        sta COLOR
        lda #<s_good
        ldx #>s_good
        bne @msg
@wrong: lda #SFX_BAD
        jsr API_SFX
        lda #2
        sta COLOR
        lda #<s_bad
        ldx #>s_bad
@msg:   ldy #MSG_Y
        jsr API_CENTER
        ; the form: the question (cyan) and the pick (green / red)
        lda qi
        jsr build_q
        lda #3
        sta COLOR
        lda #<lbuf
        sta PTR
        lda #>lbuf
        sta PTR+1
        lda qi
        asl
        adc #LOG_Y
        sta row
        tay
        ldx #1
        jsr API_PRINT
        ldx chosen
        lda opt_lo,x
        sta PTR
        lda opt_hi,x
        sta PTR+1
        lda #5
        cpx right
        beq :+
        lda #2
:       sta COLOR
        ldy row
        iny
        ldx #3
        jsr API_PRINT
        lda #REVEAL_T
        sta reveal
        jsr draw_options
        clc
        rts

; score = correct / nq × (0.8 + 0.2 × speed)
finish:
        lda correct
        ldy #255
        jsr mul8                ; A:m_lo = correct × 255
        ldx #8                  ; 16 / 8 division, quotient in m_lo
@div:   asl m_lo
        rol
        bcs @sub
        cmp nq
        bcc :+
@sub:   sbc nq
        inc m_lo
:       dex
        bne @div
        lda m_lo
        sta t1
        lda speed               ; factor (0.8 + 0.2 s) × 256 = 205 + 51 s / 256 (<= 255)
        ldy #51
        jsr mul8
        clc
        adc #205
        ldy t1
        jsr mul8
        sta MG_SCORE
        lda #1
        sta done
        sec
        rts

.rodata
s_name:     .byte "360 Feedback", 0
s_help:     .byte "Fill in the 360 form from what your colleague told you.", 0
s_keys:     .byte "Joystick + FIRE, or keys 1-4", 0
s_question: .byte "Question", 0
s_form:     .byte " 360 FEEDBACK FORM ", 0
s_subject:  .byte "Subject:", 0
s_good:     .byte "Accurate!", 0
s_bad:      .byte "That was someone else...", 0
s_dash:     .byte " - ", 0
s_said:     .byte "Like I said...", 0
s_been:     .byte "Been here ", 0
s_year:     .byte " year", 0
s_flies:    .byte " now. Time flies.", 0
s_noted:    .byte "FIRE: Noted", 0
qp0:        .byte "What did ", 0
qp1:        .byte "What should ", 0
qp3:        .byte "How long has ", 0
qs0:        .byte " achieve this quarter?", 0
qs1:        .byte " work on?", 0
qs2:        .byte "'s job title (for the form)?", 0
qs3:        .byte " been with us?", 0
qpre_lo:    .byte <qp0, <qp1, <s_empty, <qp3
qpre_hi:    .byte >qp0, >qp1, >s_empty, >qp3
qsuf_lo:    .byte <qs0, <qs1, <qs2, <qs3
qsuf_hi:    .byte >qs0, >qs1, >qs2, >qs3
s_empty:    .byte 0
pool_n:     .byte N_ACH, N_GROW
hair_tab:   .byte 2, 7, 1, 4, 3, 5

.include "gen/mg_feedback_data.s"

.bss
nbuf:       .res NBUF           ; the colleague's name
rbuf:       .res NBUF           ; their job title
lbuf:       .res LBUF           ; text being composed / printed
ybuf:       .res 4 * 10         ; the years options
cand:       .res 16             ; the wrong options' candidates
opt_v:      .res 4
opt_lo:     .res 4
opt_hi:     .res 4
