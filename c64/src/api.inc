; Interface between the resident program and disk-loaded mini-game overlays.
; The overlay is linked on its own, so everything it may touch lives at fixed addresses.

; ---- zero page shared with overlays ($02-$1f)
JOY        = $02   ; held input: bit0 up, 1 down, 2 left, 3 right, 4 fire (joystick port 2 + keyboard)
JOYP       = $03   ; pressed this frame (edges)
PTR        = $04   ; word: string / data pointer for API calls
COLOR      = $06   ; text colour for API_PRINT / API_FILL
FILL_W     = $07
FILL_H     = $08
MG_SCORE   = $09   ; overlay result 0..255 (stars: <89 0, <153 1, <217 2, else 3)
MG_DIFF    = $0a   ; difficulty 0..255 handed to MG_INIT
FRAME      = $0b   ; incremented by the raster IRQ every frame
TMP        = $0c   ; 4 bytes scratch, clobbered by API calls
SCR        = $10   ; word: screen pointer (API internal)
CLR        = $12   ; word: colour RAM pointer (API internal)
; overlays may use $40-$7f freely

; ---- input bits
J_UP    = $01
J_DOWN  = $02
J_LEFT  = $04
J_RIGHT = $08
J_FIRE  = $10

; ---- resident API jump table
API_WAIT   = $0810   ; wait for the next frame
API_INPUT  = $0813   ; refresh JOY / JOYP
API_CLS    = $0816   ; clear the whole screen to spaces, colour COLOR
API_PRINT  = $0819   ; X = column, Y = row, PTR = 0-terminated string, COLOR
API_SFX    = $081c   ; A = effect (SFX_*)
API_RAND   = $081f   ; A = random byte
API_FILL   = $0822   ; X, Y = top left, FILL_W × FILL_H cells of char A in COLOR
API_NUM    = $0825   ; X, Y = position, A = number 0..255 printed in decimal, COLOR
API_PUTC   = $0828   ; X, Y = position, A = char code, COLOR
API_CENTER = $082b   ; A/X = 0-terminated string, Y = row: printed centred in COLOR
API_BOX    = $082e   ; X, Y = top left, FILL_W × FILL_H outer size: frame of line chars in COLOR
API_BAR    = $0831   ; A = 0..38: timer bar on row 1 (solid blocks in COLOR, rest cleared)
API_RMOD   = $0834   ; A = n -> A = random 0..n-1
; All API calls may change A, X, Y and TMP.

SFX_BLIP = 6
SFX_GOOD = 7
SFX_BAD  = 8

; ---- overlay header at $4000
OVERLAY    = $4000
MG_INIT    = $4000   ; jmp: A = difficulty, X = department index
MG_FRAME   = $4003   ; jmp: one frame of logic + drawing; return C=1 when finished (MG_SCORE set)
MG_NAME    = $4006   ; word: pointer to the game's name
MG_HELP    = $4008   ; word: pointer to a one-line help text

SCREEN     = $c000
COLRAM     = $d800

; ---- shared chars (see tools/art.js UI)
CH_BLOCK   = 1
CH_HALF    = 21
CH_CLIP    = 3
CH_COFFEE  = 4
CH_STAR    = 5
CH_STAROFF = 6
CH_TL      = 7
CH_T       = 8
CH_TR      = 9
CH_L       = 10
CH_R       = 11
CH_BL      = 12
CH_B       = 13
CH_BR      = 14
CH_CHECKER = 15
CH_HAIRL   = 16
CH_HAIRR   = 17
CH_FACEL   = 18
CH_FACER   = 19
CH_MARKER  = 20
