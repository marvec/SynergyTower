; ---- short texts (the long ones are in fartext.s / gen/far.s) ------------------------------------------------
; Wording from the browser game (src/scenes/*.js), with keys instead of clicks.

s_ok:          .byte "OK", 0
s_yes:         .byte "Yes", 0
s_no:          .byte "No", 0
s_back:        .byte "Back", 0
s_close:       .byte "Close", 0
s_continue:    .byte "Continue", 0
s_cancel:      .byte "Cancel", 0
s_empty:       .byte 0
s_dash:        .byte " - ", 0
s_slash:       .byte " / ", 0
s_plus:        .byte "  +", 0
s_at:          .byte " @ ", 0
s_url_feedback: .byte "synergytower.co.uk/feedback", 0
s_url_coffee:  .byte "buymeacoffee.com/marvec", 0
s_url_site:    .byte "synergytower.co.uk", 0
s_diskerr:     .byte "Disk error. Is the disk in drive 8?", 0
s_loading:     .byte "Loading from disk...", 0
s_insert:      .byte "Please insert disk ", 0
s_fate:        .byte "Personnel Decision", 0
s_deptfloor:   .byte " department - floor ", 0
s_withco:      .byte "With the company: ", 0
s_years:       .byte " years", 0
s_year:        .byte " year", 0
s_file:        .byte "File: ", 0
s_firebtn:     .byte "Fire", 0
s_keep:        .byte "Keep", 0
s_later:       .byte "Later", 0
s_isout:       .byte " is out. Desk stash: +", 0
s_clipsword2:  .byte " paperclips", 0
s_ceoview:     .byte "You run this place now. Enjoy the view, CEO.", 0
s_topquota:    .byte "Top floor. Hit the KPI quota to become CEO!", 0
s_hrceo:       .byte "HR reports to you now, CEO.", 0
s_hrtop:       .byte "There is nobody left to review you. Hit the KPI quota on this floor to become CEO.", 0
s_board:       .byte "The board is calling...", 0
s_gridhelp:    .byte "Pick a floor: joystick, FIRE", 0
s_colon:       .byte ": ", 0
s_youarehere2: .byte "You are here.", 0
s_firerides:   .byte "FIRE: ride there", 0
s_notyet:      .byte "Not unlocked yet.", 0
s_ridefloor:   .byte "Ride to another floor", 0
s_sidelbl:     .byte ", side ", 0
s_thenfire:    .byte "then press FIRE", 0

; HUD + prompts
s_fire:        .byte "FIRE:", 0
s_keys:        .byte "B shop P perks T train S stats STOP menu", 0
s_promoready:  .byte "PROMOTION READY - take the elevator", 0
s_seehr:       .byte "SEE HR FOR REVIEW", 0
s_talk:        .byte "Talk  ", 0
s_busy:        .byte "busy ", 0
s_checkinfree: .byte "check-in, free", 0
s_coffee:      .byte " coffee", 0
s_elevator:    .byte "Elevator", 0
s_hroffice:    .byte "HR office", 0
s_retry:       .byte "retry ", 0
s_workstation: .byte "Workstation  open terminal", 0
s_coffeemachine: .byte "Coffee machine", 0
s_turnstiles:  .byte "Turnstiles", 0
s_checkinfirst: .byte "check in first", 0
s_minus1coffee: .byte "-1 coffee", 0
s_adspace:     .byte "Ad space  sponsor this wall", 0
s_advert:      .byte "advertisement", 0
s_perfreview:  .byte "performance review", 0
s_revpassedsub: .byte "review passed", 0
s_notready:    .byte "not promotion-ready yet", 0
rs_sub_lo:     .byte <s_perfreview, <s_perfreview, <s_empty, <s_revpassedsub, <s_notready, <s_empty
rs_sub_hi:     .byte >s_perfreview, >s_perfreview, >s_empty, >s_revpassedsub, >s_notready, >s_empty
s_musicon_t:   .byte "Music on", 0
s_musicoff_t:  .byte "Music off", 0

; floor events
s_brewing:     .byte "The machine is brewing... ready in ", 0
s_freshbrew:   .byte "Fresh brew! +3 coffee", 0
s_nobadge:     .byte "No badge yet: check in at the front desk.", 0
s_gatecoffee:  .byte "The turnstile wants 1 coffee. Next cup in ", 0
s_havegreat:   .byte "Have a synergistic day!", 0
s_beep:        .byte "Beep! -1 coffee. Welcome to ", 0
s_notsofast:   .byte "Not so fast! Check in at the front desk first.", 0
s_welcomeaboard: .byte "Welcome aboard! The turnstiles behind me take one cup.", 0
s_cardloaded:  .byte "Coffee card loaded: ", 0
s_cardloaded2: .byte " cups. It refills by itself from now on.", 0
s_welcome_r:   .byte "Welcome, ", 0
s_welcome_r2:  .byte "! Please check in at the front desk.", 0
s_floorcap:    .byte "FLOOR ", 0
s_department:  .byte " department", 0
s_quicktest:   .byte "Reception: Quick test before your badge: spot the buzzwords!", 0
nudge1:        .byte "Over here! New starters check in at the front desk.", 0
nudge2:        .byte "Front desk, please. I only bite on Mondays.", 0
nudge3:        .byte "Your badge will not print itself, you know.", 0
nudge4:        .byte "Check in with me and I will load your coffee card.", 0
nudge_lo:      .byte <nudge1, <nudge2, <nudge3, <nudge4
nudge_hi:      .byte >nudge1, >nudge2, >nudge3, >nudge4
s_reviewpassed_t: .byte "Review passed! Take the elevator up.", 0
s_qbusy:       .byte "Busy with ", 34, 0
s_qbusy2:      .byte 34, ". Finish it or give up (G).", 0
s_qfind:       .byte "Find ", 0
s_qyours:      .byte " (yours!)", 0
s_qback:       .byte "Back to your desk to log in", 0
s_fbchat:      .byte " and have a chat", 0
s_fbback:      .byte "Back to your desk to write it up", 0
s_fbsaw:       .byte "? Saw them ", 0
s_fbleft:      .byte "off to the left.", 0
s_fbright:     .byte "off to the right.", 0
s_fbup:        .byte "up towards the elevators.", 0
s_fbdown:      .byte "down the south side.", 0
s_fbfirst:     .byte "Talk to ", 0
s_fbfirst2:    .byte " first. Hallway chats from before don't count.", 0
s_fbhome:      .byte " went home for the day. Review deadline missed.", 0
s_qtimeup:     .byte "IT locked your account for ", 34, "suspicious inactivity", 34, ".", 0
s_qtimeup_t:   .byte "Time's up", 0
s_qgaveup:     .byte "You gave up. Coffee is not refunded.", 0
s_qgaveup_t:   .byte "Task abandoned", 0
s_nokpi:       .byte "No KPI stars this time.", 0
s_whiteboard:  .byte "Whiteboard  ", 0
s_qtake:       .byte "take a look", 0
s_qagain:      .byte "look again", 0
s_qfinish:     .byte "finish your task first", 0
s_qtry:        .byte "try to log in anyway", 0
s_qlogin:      .byte "log in", 0

; posters
s_adhere:      .byte "Advertise here", 0
s_madeup:      .byte "(A made-up sponsor. This wall could carry your brand instead.)", 0
s_advertise:   .byte "Advertise here: send a sponsorship enquiry from a browser at", 0

; task card
s_notattempted: .byte "not attempted", 0
s_best:        .byte "Best", 0
s_free:        .byte "free", 0
s_cups:        .byte " cups", 0
s_coffeecost:  .byte "Coffee", 0
s_rewards:     .byte "Rewards", 0
s_clipsword:   .byte " clips", 0
s_xpkpi:       .byte " XP, 0-3 KPI", 0
s_checkinline: .byte "Check-in: any result loads your coffee card", 0
s_cooldownafter: .byte "Cooldown after play", 0
s_busycap:     .byte "Busy ", 0
s_need:        .byte "Need ", 0
s_start:       .byte "Start  (", 0
s_freep:       .byte "free)", 0
s_coffeep:     .byte " coffee)", 0
s_skip:        .byte "Skip  (1 Stock Option)", 0
s_refill:      .byte "Refill coffee  (3 Stock Options)", 0
s_notondisk:   .byte "Not on this disk yet", 0

; HR
s_reviewtitle: .byte "HR Office - Performance Review", 0
s_haveaseat:   .byte "HR: Have a seat. Let us talk about your growth.", 0
s_promoto:     .byte "Promotion to floor ", 0
s_passmark:    .byte "Pass mark: 60%, retry wait if you fail: ", 0
s_onequestion: .byte "One question is about your own track record.", 0
s_retryin:     .byte "Retry in ", 0
s_need2:       .byte "Need 2 coffee", 0
s_startreview: .byte "Start review  (-2 coffee)", 0
s_hroffice2:   .byte "HR Office", 0
s_congrats:    .byte "HR: Congratulations again!", 0
s_aced:        .byte "You already aced your performance review. The elevator is waiting for you!", 0
s_wrongfloor:  .byte "Performance reviews happen on your highest floor (F", 0
s_wrongfloor2: .byte "). Take the elevator up when you are ready.", 0
s_appointment: .byte "HR: Do you have an appointment?", 0
s_byappt:      .byte "Reviews are by appointment only. Come back when you are promotion-ready:", 0
s_mstars:      .byte "- KPI stars on this floor: ", 0
s_mlevel:      .byte "- Seniority level: Lv", 0
s_mfee:        .byte "- Keycard fee: ", 0
s_mfee2:       .byte " paperclips", 0
s_understood:  .byte "Understood", 0
s_revpassed:   .byte "REVIEW PASSED", 0
s_revfailed:   .byte "REVIEW FAILED", 0
s_approved:    .byte "* APPROVED *", 0
s_needsimpr:   .byte "* NEEDS IMPROVEMENT *", 0
s_approvedline: .byte "HR: Approved! The elevator is all yours.", 0
s_revisit:     .byte "HR: We will revisit this. Reflect on it.", 0
s_retryin2:    .byte "You can retry in ", 0
s_soskip:      .byte "(Stock Options can skip the wait.)", 0
s_pctneed:     .byte "%  (60% passes)", 0

; elevator
s_diskend:     .byte "This is the top floor on the C64 disk. The rest of the tower, floors 3-40, is in the browser game:", 0
s_next:        .byte "Next: F", 0
s_promohighest: .byte "(Promotions happen from your highest floor, F", 0
s_promohighest2: .byte ".)", 0
s_getpromoted: .byte "Get promoted to floor ", 0
s_passfirst:   .byte "Pass your HR review first", 0
s_promolocked: .byte "Promotion to floor ", 0
s_locked:      .byte " locked", 0
s_floor:       .byte "Floor ", 0
s_youarehere:  .byte "  (you are here)", 0
s_rideto:      .byte "Ride to floor ", 0
s_ckstars:     .byte "KPI stars", 0
s_cklevel:     .byte "Seniority level", 0
s_ckfee:       .byte "Keycard fee", 0
s_ckreview:    .byte "Performance review", 0
s_passedcap:   .byte "PASSED", 0
s_pending:     .byte "pending", 0
s_promoted:    .byte "PROMOTED!", 0
s_targetreached: .byte "TARGET REACHED", 0
s_newquota:    .byte "New KPI quota: ", 0
s_starsdot:    .byte " stars", 0
s_nowpay:      .byte "Tasks now pay ", 0
s_at2:         .byte " paperclips at 2 stars", 0
s_maxcoffee:   .byte "Max coffee ", 0
s_cost13:      .byte ", tasks cost 1-3", 0
s_signing:     .byte "+1 Stock Option signing bonus", 0
s_nokeycard:   .byte "No keycard, no HR review. systemd said so.", 0
s_cooldowns:   .byte "Task cooldowns: ", 0
s_min:         .byte " min", 0
s_judging:     .byte "Your new colleagues are already judging you.", 0
s_newdesk:     .byte "To my new desk!", 0

; welcome, how to, links
s_welcometo:   .byte "Welcome to ", 0
s_congrats2:   .byte "Congratulations, ", 0
s_newest:      .byte "! You are our newest ", 0
s_firststop:   .byte "First stop: the front desk, for your badge and your coffee card.", 0
s_synergize:   .byte "Let's synergize", 0
s_howto:       .byte "How to play", 0
s_sendfeedback: .byte "Send feedback", 0
s_buycoffee:   .byte "Buy author a coffee", 0
s_context:     .byte "Mention where you are: floor ", 0
s_ctxlevel:    .byte ", level ", 0

; host
s_startgame:   .byte "Start", 0
s_freecheckin: .byte "Free: this is your check-in.", 0
s_costs:       .byte "Costs ", 0
s_go:          .byte "GO!", 0
s_paused:      .byte "Paused", 0
s_giveup_q:    .byte "Give up? Coffee is not refunded.", 0
s_keepgoing:   .byte "Keep going", 0
s_giveup:      .byte "Give up", 0
s_score:       .byte "Score", 0
s_paperclips:  .byte "Paperclips", 0
s_experience:  .byte "Experience", 0
s_kpistars:    .byte "KPI stars", 0
s_stockoptions: .byte "Stock Options", 0
s_levelup:     .byte "LEVEL UP! Seniority Lv", 0
s_newbest:     .byte "New personal best!", 0
s_kpi:         .byte "KPI ", 0
s_quotahr:     .byte "Quota met! Visit the HR office.", 0
s_quotalift:   .byte "Quota met! Head to the elevator.", 0
s_rt0:         .byte "Needs improvement", 0
s_rt1:         .byte "Meets expectations", 0
s_rt2:         .byte "Exceeds expectations", 0
s_rt3:         .byte "Outstanding!", 0
rtitle_lo:     .byte <s_rt0, <s_rt1, <s_rt2, <s_rt3
rtitle_hi:     .byte >s_rt0, >s_rt1, >s_rt2, >s_rt3

; stats
s_yournumbers: .byte "Your numbers", 0
s_tclips:      .byte "Clips", 0
s_tcoffee:     .byte "Coffee", 0
s_toptions:    .byte "Options", 0
s_tkpi:        .byte "KPI", 0
s_tlevel:      .byte "Level", 0
s_tgames:      .byte "Games", 0
stat_name_lo:  .byte <s_tclips, <s_tcoffee, <s_toptions, <s_tkpi, <s_tlevel, <s_tgames
stat_name_hi:  .byte >s_tclips, >s_tcoffee, >s_toptions, >s_tkpi, >s_tlevel, >s_tgames
s_keycardfor:  .byte "Keycard fee", 0
s_covered:     .byte " - covered", 0
s_togo:        .byte " to go", 0
s_nextcup:     .byte "Next cup", 0
s_checkinfd:   .byte "check in at the front desk", 0
s_mugfull:     .byte "mug is full", 0
s_in:          .byte "in ", 0
s_oneevery:    .byte " (one every ", 0
s_readyplus3:  .byte "ready: +3", 0
s_brewingc:    .byte "brewing, ", 0
s_skipcd:      .byte "Skip a station cooldown", 0
s_1option:     .byte "1 option", 0
s_refillall:   .byte "Refill all coffee", 0
s_3options:    .byte "3 options", 0
s_tolv:        .byte " to Lv", 0
s_neededfor:   .byte "Needed for floor ", 0
s_gamesplayed: .byte "Games played", 0
s_alltried:    .byte "This floor: all tried", 0
s_nottried:    .byte "Not tried yet on this floor:", 0

; menu
s_menu:        .byte "Menu", 0
s_resume:      .byte "Resume", 0
s_musicon:     .byte "Music: ON", 0
s_musicoff:    .byte "Music: OFF", 0
s_sfxon:       .byte "Sound effects: ON", 0
s_sfxoff:      .byte "Sound effects: OFF", 0
s_mstats:      .byte "Your numbers  (S)", 0
s_mshop:       .byte "Shop  (B)", 0
s_mperks:      .byte "Perks  (P)", 0
s_mtrain:      .byte "Training  (T)", 0
s_savequit:    .byte "Save & quit to title", 0
s_reset:       .byte "Reset career", 0

; shop
s_shoptitle:   .byte "Stock Option Shop", 0
s_demomode:    .byte "DEMO MODE - payments are simulated, no real money is charged.", 0
s_youhave:     .byte "You have ", 0
s_sodot:       .byte " Stock Options.", 0
s_refillcoffee: .byte "Refill coffee  (3 options)", 0
s_pk0:         .byte "Handful: 10 options        EUR 0.99", 0
s_pk1:         .byte "Vesting Plan: 60 options   EUR 4.99", 0
s_pk2:         .byte "Handshake: 140 (Popular)   EUR 9.99", 0
s_pk3:         .byte "Parachute: 400 (Best)     EUR 24.99", 0
pack_lbl_lo:   .byte <s_pk0, <s_pk1, <s_pk2, <s_pk3
pack_lbl_hi:   .byte >s_pk0, >s_pk1, >s_pk2, >s_pk3
s_pn0:         .byte "Handful: 10 Stock Options", 0
s_pn1:         .byte "Vesting Plan: 60 Stock Options", 0
s_pn2:         .byte "Handshake: 140 Stock Options", 0
s_pn3:         .byte "Parachute: 400 Stock Options", 0
pack_name_lo:  .byte <s_pn0, <s_pn1, <s_pn2, <s_pn3
pack_name_hi:  .byte >s_pn0, >s_pn1, >s_pn2, >s_pn3
s_pp0:         .byte "Pay EUR 0.99", 0
s_pp1:         .byte "Pay EUR 4.99", 0
s_pp2:         .byte "Pay EUR 9.99", 0
s_pp3:         .byte "Pay EUR 24.99", 0
pack_pay_lo:   .byte <s_pp0, <s_pp1, <s_pp2, <s_pp3
pack_pay_hi:   .byte >s_pp0, >s_pp1, >s_pp2, >s_pp3
pack_so_lo:    .byte <10, <60, <140, <400
pack_so_hi:    .byte >10, >60, >140, >400
s_checkout:    .byte "Secure Checkout (DEMO)", 0
s_card:        .byte "Card: 4242 4242 4242 4242", 0
s_nameoncard:  .byte "Name on card: ", 0
s_nothingcharged: .byte "Nothing is charged. This is a demo.", 0
s_processing:  .byte "Processing payment...", 0
s_plusso:      .byte " Stock Options!", 0
s_pretend:     .byte "Thank you for your (pretend) money.", 0
s_great:       .byte "Great!", 0

; perks + training
s_perkstitle:  .byte "Office Perks", 0
s_max:         .byte "MAX", 0
s_options:     .byte " options", 0
s_pkmug:       .byte "Bigger Mug", 0
s_pkesp:       .byte "Espresso Machine", 0
s_pkchair:     .byte "Ergonomic Chair", 0
s_pkmon:       .byte "Second Monitor", 0
s_pkstap:      .byte "Golden Stapler", 0
s_pkplant:     .byte "Corner Office Plant", 0
perk_name_lo:  .byte <s_pkmug, <s_pkesp, <s_pkchair, <s_pkmon, <s_pkstap, <s_pkplant
perk_name_hi:  .byte >s_pkmug, >s_pkesp, >s_pkchair, >s_pkmon, >s_pkstap, >s_pkplant
s_traintitle:  .byte "Training Center", 0
s_xp:          .byte " XP", 0
s_xpfor:       .byte " XP for ", 0
s_tr0:         .byte "Webinar", 0
s_tr1:         .byte "Workshop", 0
s_tr2:         .byte "Certification", 0
train_name_lo: .byte <s_tr0, <s_tr1, <s_tr2
train_name_hi: .byte >s_tr0, >s_tr1, >s_tr2
