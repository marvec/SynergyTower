; The career state: two pages at a fixed address, shared by the resident program and the overlays that need it
; (title/setup, HR review, terminal). They are the save game: two disk blocks (src/save.s).
;   $9400 ST:  the career (names, looks, money, stars and reviews of all 40 floors, colleagues fired...)
;   $94fe ST2: cooldown deadlines (stations, coffee machines, HR review retries) of any floor, as a list
;   $bf00 ST3: best stars of every station of the tower, a nibble each ($f = not attempted); the third save block
ST_BASE = $9400
ST2_BASE = ST_BASE + 254         ; (the file's second block lands right after the first)
CORP_LEN = 22
NAME_LEN = 16
STATIONS_MAX = 14
FLOORS_MAX = 40
CD_N = 50                       ; cooldown entries (the ones that end first make room)
CD_MACHINE = STATIONS_MAX       ; cooldown keys after the stations
CD_REVIEW = STATIONS_MAX + 1
ST3_BASE = $bf00
NPC_BITS = 2                    ; bytes of "fired" bits per floor (up to 16 colleagues)

.struct ST
        magic   .res 2          ; "ST"
        ver     .byte
        corp    .res ::CORP_LEN + 1
        name    .res ::NAME_LEN + 1
        color   .byte           ; corp colour 0-11
        skin    .byte
        hair    .byte
        hstyle  .byte
        floor   .byte
        max     .byte           ; highest floor reached
        sp      .res 3          ; paperclips
        xp      .res 3
        level   .byte
        so      .word           ; Stock Options
        coffee  .byte
        lobby   .byte
        reviews .res 5          ; bit f-1: HR review passed on floor f
        cupdl   .res 3          ; next cup of coffee
        clock   .res 3          ; CLOCK when saved
        played  .res 5          ; bit per game index: played at least once
        perks   .res 6
        tasks   .word           ; stats
        perfect .word
        sobought .word
        promos  .byte
        warps   .byte
        nreviews .byte
        nfired  .byte
        music   .byte
        sfx     .byte
        intro   .byte           ; exterior intro seen
        welcome .byte           ; floor-1 welcome shown
        ceo     .byte           ; the floor-40 quota reached: CEO
        savecnt .word           ; saves so far (the newest save wins across disk sides)
        career  .word           ; random id of this career (saves of another career on other sides don't count)
        stars   .res ::FLOORS_MAX ; KPI stars per floor
        fired   .res ::FLOORS_MAX * ::NPC_BITS ; per floor: bit n = colleague n fired
.endstruct
.assert .sizeof(ST) <= 254, error, "save state page 1 is more than one block"

.struct ST2
        cfloor  .res ::CD_N     ; the entry's floor, 0 = free
        ckey    .res ::CD_N     ; station 0-13, CD_MACHINE, CD_REVIEW
        cdl     .res ::CD_N * 3 ; deadline (CLOCK seconds)
.endstruct
.assert .sizeof(ST2) <= 254, error, "save state page 2 is more than one block"

st_magic    = ST_BASE + ST::magic
st_ver      = ST_BASE + ST::ver
st_corp     = ST_BASE + ST::corp
st_name     = ST_BASE + ST::name
st_color    = ST_BASE + ST::color
st_skin     = ST_BASE + ST::skin
st_hair     = ST_BASE + ST::hair
st_hstyle   = ST_BASE + ST::hstyle
st_floor    = ST_BASE + ST::floor
st_max      = ST_BASE + ST::max
st_sp       = ST_BASE + ST::sp
st_xp       = ST_BASE + ST::xp
st_level    = ST_BASE + ST::level
st_so       = ST_BASE + ST::so
st_coffee   = ST_BASE + ST::coffee
st_lobby    = ST_BASE + ST::lobby
st_stars    = ST_BASE + ST::stars
st_reviews  = ST_BASE + ST::reviews
st_cfloor   = ST2_BASE + ST2::cfloor
st_ckey     = ST2_BASE + ST2::ckey
st_cdl      = ST2_BASE + ST2::cdl
st_machcd   = CD_MACHINE        ; (floor_dl_ptr keys: lda #<st_machcd)
st_revcd    = CD_REVIEW
st_bestn    = ST3_BASE
st_cupdl    = ST_BASE + ST::cupdl
st_clock    = ST_BASE + ST::clock
st_played   = ST_BASE + ST::played
st_perks    = ST_BASE + ST::perks
st_tasks    = ST_BASE + ST::tasks
st_perfect  = ST_BASE + ST::perfect
st_sobought = ST_BASE + ST::sobought
st_promos   = ST_BASE + ST::promos
st_warps    = ST_BASE + ST::warps
st_nreviews = ST_BASE + ST::nreviews
st_music    = ST_BASE + ST::music
st_sfx      = ST_BASE + ST::sfx
st_intro    = ST_BASE + ST::intro
st_welcome  = ST_BASE + ST::welcome
st_nfired   = ST_BASE + ST::nfired
st_ceo      = ST_BASE + ST::ceo
st_savecnt  = ST_BASE + ST::savecnt
st_career   = ST_BASE + ST::career
st_fired    = ST_BASE + ST::fired
ST_START    = ST_BASE
ST_END      = ST_BASE + .sizeof(ST)
ST2_END     = ST2_BASE + .sizeof(ST2)

LOBBY_CHECKIN = 0
LOBBY_GATE    = 1
LOBBY_DONE    = 2
