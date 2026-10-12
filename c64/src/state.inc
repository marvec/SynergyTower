; The career state block at a fixed address, shared by the resident program and the overlays that need it
; (title/setup, HR review, terminal). It is the save game: one disk block (src/state.s).
ST_BASE = $9400
CORP_LEN = 22
NAME_LEN = 16
STATIONS_MAX = 14

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
        sp      .word           ; paperclips
        xp      .word
        level   .byte
        so      .word           ; Stock Options
        coffee  .byte
        lobby   .byte
        stars   .res 2          ; KPI stars on floors 1, 2
        reviews .byte           ; bit f-1: HR review passed on floor f
        best    .res 2 * ::STATIONS_MAX ; best stars per station, $ff = not attempted
        cd      .res 2 * ::STATIONS_MAX * 3 ; station cooldown deadlines
        revcd   .res 2 * 3      ; HR review retry deadlines
        machcd  .res 2 * 3      ; coffee machine deadlines
        cupdl   .res 3          ; next cup of coffee
        clock   .res 3          ; CLOCK when saved
        played  .res 3          ; bit per game index: played at least once
        perks   .res 6
        tasks   .word           ; stats
        perfect .word
        sobought .word
        promos  .byte
        warps   .byte
        nreviews .byte
        music   .byte
        sfx     .byte
        intro   .byte           ; exterior intro seen
        welcome .byte           ; floor-1 welcome shown
.endstruct
.assert .sizeof(ST) <= 254, error, "save state is more than one block"

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
st_best     = ST_BASE + ST::best
st_cd       = ST_BASE + ST::cd
st_revcd    = ST_BASE + ST::revcd
st_machcd   = ST_BASE + ST::machcd
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
ST_START    = ST_BASE
ST_END      = ST_BASE + .sizeof(ST)

LOBBY_CHECKIN = 0
LOBBY_GATE    = 1
LOBBY_DONE    = 2
