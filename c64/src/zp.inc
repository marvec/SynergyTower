; Resident zero page, shared by the boot file and the main program (overlays get $40-$7f, see api.inc).

; $14-$3f
SRC      = $14   ; word, lz_unpack source
DST      = $16   ; word, lz_unpack destination
MP       = $18   ; word, lz_unpack match pointer
PT       = $1a   ; word, general pointer
CAMPY    = $1c   ; camera: map pixel row at the top of the playfield (0..40)
T0       = $1d
T1       = $1e
T2       = $1f
T3       = $20
CX       = $21   ; word, candidate x (try_pos)
CY       = $23   ; candidate y
MDX      = $24
MDY      = $25
MOVED    = $26
SAVEX    = $27
RNG      = $28   ; word
NEAR     = $2a   ; interactable next to the player, $ff = none
MSG_T    = $2b   ; frames left on the HUD message
IA       = $2c   ; word, pointer to the current interactable entry
LOADED   = $2e   ; word, file name pointer of the overlay in memory
AUTOPTR  = $30   ; word (AUTOPLAY builds)
AUTOCNT  = $32
AUTOBITS = $33
; music (IRQ only)
MUS_SONG = $34   ; word
MUS_PTR  = $36   ; word, next step
MUS_DATA = $38   ; word, first step
MUS_STEP = $3a
MUS_TICK = $3b
MUS_ON   = $3c
MUS_LEN  = $3d
DT0      = $3e
SFX_LOCK = $3f

; $80-$8f (BASIC's, unused with the BASIC ROM out)
ATNOFF   = $80   ; $dd00 values during a transfer: VIC bank bits kept, ATN released / asserted
ATNON    = $81
CROW     = $82   ; map row drawn at screen row 2 of the front screen
FRONT    = $83   ; 0: screen $c000 shows the playfield, 1: $c400
PEND     = $84   ; 1: the back screen holds rows PEND_C.. for camera PEND_Y, swap next frame
PEND_C   = $85
PEND_Y   = $86
NEXT_S   = $87   ; fine scroll (YSCROLL) for the playfield, set by the split IRQ
NEXT_D018 = $88  ; screen for the playfield, set by the split IRQ
