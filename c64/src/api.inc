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

; ---- context for overlays that need it (HR review: the personal question)
MG_FLOORNO = $02a7   ; floor of the review
MG_STARS   = $02a8   ; KPI stars earned on it
MG_WS      = $02a9   ; terminal: the workstation's number (its host name)

; ---- floor quests (Lost Password): the overlay's two extra entries and the block it shares with the floor
QUEST_SETUP = $400a  ; jmp: start the floor part: fill the block below, place the boards, copy their sprites
QUEST_VIEW  = $400d  ; jmp: A = board: draw its close-up (the whole screen)
QB_N       = $02aa   ; boards (up to 6)
QB_MINE    = $02ab   ; the board with your pet
QB_X       = $02ac   ; 6 × tile x
QB_Y       = $02b2   ; 6 × tile y
Q_SEEN     = $02b8   ; you have seen your pet's photo
Q_SPEED    = $02b9   ; speed bonus 0-255, for the desk part
Q_LIMIT    = $02ba   ; seconds for the search
Q_SPEC     = $02bb   ; word: the pet's species ("cat", "goldfish"...), for the objective
Q_PX       = $02bd   ; tiles to keep the boards away from: the player, the station
Q_PY       = $02be
Q_SX       = $02bf
Q_SY       = $02c0
; 360 Feedback (the quest block's board bytes)
FB_ACH     = QB_X       ; achievement index (the overlay's QUEST_SETUP picks it)
FB_GROW    = QB_X + 1   ; growth-area index (QUEST_SETUP)
FB_YEARS   = QB_X + 2   ; the colleague's years with the company
FB_WHO     = QB_X + 3   ; word: the colleague's record in the floor header ("Name\0Role\0years\0n\0"), 0 = no quest
FL_INFO_ADDR = $88c0 ; the floor's walk / interact grid (40 × 28: 0 blocked, 1 walkable, 2+ interactable)
QB_SPRITE  = 140     ; sprite pointer of a board (the overlay copies its frame to $e300); 141 = checked

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
API_KEY    = $0837   ; A = next key from the keyboard buffer (PETSCII), 0 = none
API_SONG   = $083a   ; X = song (0 floor, 1 mini-game, 2 title), if music is on
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
CH_CLOCK   = 22
CH_UP      = 23
CH_CHECK   = 24
CH_SO      = 25
CH_HR      = 26
CH_PIP     = 27
CH_PIPOFF  = 28
CH_LOCK    = 29
CH_ARROW   = 30
CH_CURSOR  = 31
