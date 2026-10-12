; ---- long texts, in the RAM under the KERNAL (read with far_str / far_text) -------------------------------
; Wording from the browser game; controls described for joystick and keyboard. 10 = line break.

f_sponsor:
        .byte "This premium hallway spot is seen by every new hire climbing all 40 floors of the tower.", 10
        .byte "Want your brand on it? Send a sponsorship enquiry and the author will get back to you.", 0
f_reviewblurb:
        .byte "Your numbers look good. Before the elevator takes you up, HR needs a quick chat about your "
        .byte "growth mindset. Answer like a future leader.", 0
f_welcome:
        .byte "Complete tasks marked with ! to earn paperclips, XP and KPI stars. Hit the star quota, level up, "
        .byte "save up for the keycard fee and pass your HR performance review - then the elevator takes you up.", 10
        .byte "40 floors. One corner office. Good luck!", 0
f_howto:
        .byte "Move: joystick in port 2, or WASD / cursor keys.", 10
        .byte "Interact: FIRE, SPACE or RETURN next to a desk, a colleague, the elevator...", 10
        .byte "Each task is a mini-game that costs coffee and earns paperclips (the office currency), XP and "
        .byte "0-3 KPI stars.", 10
        .byte "Collect enough stars on a floor, reach the seniority level and the keycard fee, then pass the HR "
        .byte "performance review. Only then does the elevator take you up (going down is always fine).", 10
        .byte "Coffee refills over time. Tasks have cooldowns. Stock Options skip the waiting.", 10
        .byte "RUN/STOP: menu/back  M: music  B: shop  P: perks  T: training  S: stats", 0
f_feedback:
        .byte "Ideas for a new task, a bug, a sponsorship or anything else? The contact form is one click away "
        .byte "in any browser:", 0
f_tip:
        .byte "Enjoying the climb? You can buy the author a coffee in any browser:", 0
f_stclips:
        .byte "The office currency. Every task pays some, more for more stars and on higher floors. Spend them on "
        .byte "the keycard fee for your next promotion, on Perks and on Training.", 0
f_stcoffee:
        .byte "Tasks cost 1-3 coffee: quick games 1, bigger ones 2, the most complex 3. Quick ones take longer to "
        .byte "be ready again. Coffee refills by itself over time, and the coffee machine on every floor pours "
        .byte "3 free cups now and then.", 0
f_stoptions:
        .byte "The rare currency. You get one for every Seniority level-up and, with luck, for a perfect 3-star "
        .byte "task. The Shop sells more (demo payments only, nothing is charged).", 0
f_stkpi:
        .byte "Each task earns 0-3 stars on this floor. Hit the quota, then meet the rest of the promotion "
        .byte "checklist:", 0
f_stkpilow:
        .byte "Each task earns 0-3 stars. Promotions only count on your highest floor; stars here just add up.", 0
f_stlevel:
        .byte "Experience from every task (and from Training) raises your Seniority. Each promotion needs a "
        .byte "minimum level, and every level-up pays a Stock Option.", 0
f_stgames:
        .byte "How many different kinds of mini-games you have tried with this character, out of all of them "
        .byte "on this disk.", 0
f_shop:
        .byte "Stock Options are the premium currency: skip task cooldowns, refill coffee and buy executive "
        .byte "perks.", 0
f_train:
        .byte "Turn paperclips into experience. 4 paperclips buy 1 XP. Level up to qualify for promotions.", 0
f_reallyerase:
        .byte "Really erase everything? Your whole career on this disk is gone for good.", 0
