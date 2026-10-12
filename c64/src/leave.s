; ---- a fired colleague walks out (src/scenes/floorWorld.js leave) ----------------------------------------------
; After their parting line they walk to the elevator and are gone. exit_map fills a distance map of the walkable
; cells from the elevator (breadth first) in the top of the overlay slot; walk_step follows it downhill from cell
; centre to cell centre. A floor quest's overlay stays (build.js makes sure it ends below the map); any other
; overlay there is given up. Anything that loads into the slot (a mini-game, a floor, the title) ends the walk
; first (leave_abort).

.segment "CODE2"
DIST     = OVERLAY + $1a00      ; 40 × 28 bytes: steps to the elevator, $ff = not reachable
LQUEUE   = DIST + FL_W * FL_H   ; cell offsets (words) waiting to be expanded, a ring up to the slot's end
LQ_END   = OVERLAY + $2000
FL_W     = 40
FL_H     = 28
LQ_H     = $40                  ; word: queue head (overlay zero page, free while on the floor)
LQ_T     = $42                  ; word: queue tail
LO       = $44                  ; word: the cell being expanded
LN       = $46                  ; word: its neighbour
LD       = $48                  ; their distance

; FIRED_A has just been fired: LEAVE = timeout if there is a way to the elevator (they stand still meanwhile:
; astill), else 0; FIRED_T = their talk pause (then the walk, or gone at once).
exit_map:
        lda #200                ; no walk: gone after 4 s, as before
        sta FIRED_T
        lda #0
        sta LEAVE
        ldx QACT                ; a mini-game in the slot may reach up there: it goes (a quest's overlay doesn't)
        bne :+
        sta LOADED              ; (A = 0)
        sta LOADED+1
:       tax
        lda #$ff
:       sta DIST,x
        sta DIST+$100,x
        sta DIST+$200,x
        sta DIST+$300,x
        sta DIST+$400,x
        inx
        bne :-
        lda FL_HDR + HDR_SPAWN  ; the source: the elevator's cell
        sta T0
        lda FL_HDR + HDR_SPAWN + 1
        sta T1
        lda FL_HDR + HDR_SPAWN + 2
        jsr cell_of
        lda LO
        sta LQUEUE
        lda LO+1
        sta LQUEUE+1
        jsr lo_dist
        lda #0
        tay
        sta (PT),y
        lda #<LQUEUE
        sta LQ_H
        lda #>LQUEUE
        sta LQ_H+1
        lda #<(LQUEUE + 2)
        sta LQ_T
        lda #>(LQUEUE + 2)
        sta LQ_T+1
@cell:  lda LQ_H                ; queue empty: done
        cmp LQ_T
        bne :+
        lda LQ_H+1
        cmp LQ_T+1
        beq @done
:       ldy #0
        lda (LQ_H),y
        sta LO
        iny
        lda (LQ_H),y
        sta LO+1
        ldx #LQ_H
        jsr q_next
        jsr lo_dist
        ldy #0
        lda (PT),y
        clc
        adc #1
        sta LD
        ldx #3
@nb:    jsr neighbour           ; walkable (no range checks: floor.js makes sure the border is blocked)?
        lda LN
        clc
        adc #<FL_INFO_ADDR
        sta PT
        lda LN+1
        adc #>FL_INFO_ADDR
        sta PT+1
        ldy #0
        lda (PT),y
        cmp #1
        bne @skip
        jsr ln_dist             ; not seen yet?
        lda (PT),y
        cmp #$ff
        bne @skip
        lda LD
        sta (PT),y
        lda LN
        sta (LQ_T),y
        iny
        lda LN+1
        sta (LQ_T),y
        txa
        pha
        ldx #LQ_T
        jsr q_next
        pla
        tax
        lda LQ_T                ; the ring is full (it never is on these floors): no walk
        cmp LQ_H
        bne @skip
        lda LQ_T+1
        cmp LQ_H+1
        bne @skip
        rts
@skip:  dex
        bpl @nb
        jmp @cell
@done:  ldx FIRED_A             ; where they stand
        lda ax_lo,x
        sta T0
        lda ax_hi,x
        sta T1
        lda ay,x
        jsr cell_of
        jsr lo_dist
        ldy #0
        lda (PT),y
        cmp #$ff
        beq @none               ; (no way out: gone after their line)
        lda LO
        sta LCELL
        lda LO+1
        sta LCELL+1
        jsr cell_centre
        ldx FIRED_A
        lda #1
        sta astill,x
        lda #80                 ; 1.6 s of goodbye, then off they go
        sta FIRED_T
        lda #255                ; at most 255 × 16 frames on the way
        sta LEAVE
        ldx nact                ; they carry a box of desk things (one more actor, if there is room)
        cpx #MAX_ACT
        bcs @none
        stx BOX_A
        inc nact
        lda #ACTOR_BOX
        sta akind,x
        lda #1
        sta astill,x
        lda #0
        sta aanim,x
        sta adir,x
        sta apause,x
        lda #BOX_SPR
        sta abase,x
        lda #9                  ; brown
        sta acol,x
        ldy #62
:       lda box_sprite,y
        sta BOX_SPR * 64 + $c000,y
        dey
        bpl :-
        jmp box_sync
@none:  rts

; The box in their hands: in front of them, behind when they face up.
box_sync:
        ldy BOX_A
        beq @done
        ldx FIRED_A
        lda ax_lo,x
        sta ax_lo,y
        lda ax_hi,x
        sta ax_hi,y
        lda adir,x
        cmp #1
        beq @up
        lda ay,x                ; one line below them: in front
        clc
        adc #1
        bcc @put
@up:    lda ay,x                ; facing up: one line above, behind them
        sec
        sbc #1
@put:   sta ay,y
@done:  rts

; Multicolour, 12 × 8 px at hand height: black edges, brown sides, a stapler and something in the shared colour.
box_sprite:
        .byte $00, $00, $00, $00, $00, $00, $00, $00, $00, $00, $00, $00
        .byte $00, $00, $00, $00, $00, $00, $00, $00, $00, $00, $c1, $00
        .byte $00, $c1, $00, $01, $55, $40, $01, $aa, $40, $01, $aa, $40
        .byte $01, $96, $40, $01, $aa, $40, $01, $aa, $40, $01, $aa, $40
        .byte $01, $55, $40, $00, $00, $00, $00, $00, $00, $00, $00, $00
        .byte $00, $00, $00

; X = LQ_H / LQ_T: the next word of the ring.
q_next:
        lda 0,x
        clc
        adc #2
        sta 0,x
        bcc :+
        inc 1,x
:       lda 1,x
        cmp #>LQ_END
        bne :+
        lda #<LQUEUE
        sta 0,x
        lda #>LQUEUE
        sta 1,x
:       rts

; T0/T1 = x pixel, A = feet y -> LO = offset of that cell (row (y - 2) / 8, the middle of the feet box).
cell_of:
        sec
        sbc #2
        lsr
        lsr
        lsr
        tay
        lda T1
        lsr
        lda T0
        ror
        lsr
        lsr
        clc
        adc irow_lo,y
        sta LO
        lda irow_hi,y
        adc #0
        sta LO+1
        lda LO
        sec
        sbc #<FL_INFO_ADDR
        sta LO
        lda LO+1
        sbc #>FL_INFO_ADDR
        sta LO+1
        rts

; X = 0-3: LN = LO + the neighbour's offset.
neighbour:
        lda LO
        clc
        adc nb_lo,x
        sta LN
        lda LO+1
        adc nb_hi,x
        sta LN+1
        rts
nb_lo:  .byte <-FL_W, <FL_W, <-1, 1
nb_hi:  .byte >-FL_W, >FL_W, >-1, 0

; PT = DIST + LO / LN, Y = 0.
.assert <DIST = 0, error, "DIST must start a page"
lo_dist:
        lda LO
        sta PT
        lda LO+1
        clc
        adc #>DIST
        sta PT+1
        ldy #0
        rts
ln_dist:
        lda LN
        sta PT
        lda LN+1
        clc
        adc #>DIST
        sta PT+1
        ldy #0
        rts

; LCELL -> LTX/LTY = the centre of that cell (feet at x 8c + 4, y 8r + 5: the feet box inside the cell).
cell_centre:
        lda LCELL
        sta T0
        lda LCELL+1
        sta T1
        ldy #0                  ; row = offset / 40
@row:   lda T0
        sec
        sbc #FL_W
        tax
        lda T1
        sbc #0
        bcc @col
        sta T1
        stx T0
        iny
        bne @row
@col:   tya
        asl
        asl
        asl
        adc #5
        sta LTY
        lda #0
        sta LTX+1
        lda T0                  ; column × 8 + 4
        asl
        asl
        asl
        rol LTX+1
        ora #4
        sta LTX
        rts

; One frame of the walk (the floor loop, while LEAVE and their talk is over). C=1: arrived (or stuck): gone.
walk_step:
        jsr box_sync
        lda FRAME
        and #15
        bne :+
        dec LEAVE
        beq @gone               ; taking too long
:       lda FRAME
        and #1
        bne @stay               ; the colleagues' speed
        ldx FIRED_A
        lda ax_lo,x
        cmp LTX
        bne @mx
        lda ax_hi,x
        cmp LTX+1
        bne @mx
        lda ay,x
        cmp LTY
        bne @my
        lda LCELL               ; at a cell's centre: on to the neighbour one step nearer
        sta LO
        lda LCELL+1
        sta LO+1
        jsr lo_dist
        lda (PT),y
        beq @gone               ; the elevator
        sta LD
        ldx #3
@nb:    jsr neighbour
        jsr ln_dist
        lda (PT),y
        cmp LD
        bcc @next
        dex
        bpl @nb
@gone:  sec
        rts
@next:  lda LN
        sta LCELL
        lda LN+1
        sta LCELL+1
        jsr cell_centre
@stay:  clc
        rts
@mx:    lda ax_lo,x             ; left or right
        cmp LTX
        lda ax_hi,x
        sbc LTX+1
        bcc @right
        lda ax_lo,x
        bne :+
        dec ax_hi,x
:       dec ax_lo,x
        lda #2
        bne @face
@right: inc ax_lo,x
        bne :+
        inc ax_hi,x
:       lda #3
        bne @face
@my:    bcc @down               ; (C from cmp LTY)
        dec ay,x
        lda #1
        bne @face
@down:  inc ay,x
        lda #0
@face:  sta adir,x
        inc aanim,x
        bne :+
        inc aanim,x
:       clc
        rts

; Something is about to load into the overlay slot: a walk (or a talk before it) ends now, with the report.
leave_abort:
        lda FIRED_T
        ora LEAVE
        bne :+
        rts
:       lda #0
        sta FIRED_T
        sta LEAVE
        jmp fired_out

.segment "BSS2"
LEAVE:  .res 1                  ; nonzero: FIRED_A is walking out (frames / 16 left)
LCELL:  .res 2                  ; the cell they are heading for
LTX:    .res 2                  ; its centre
LTY:    .res 1
BOX_A:  .res 1                  ; their box's actor, 0 = none
.segment "CODE"
