// Conduct text (core/conduct.js): the coffee break chat, the colleague's answers to "a drink?", the office gossip and
// the compliance training quiz. Pure data, ASCII only (bitmap font).

/** What the player says when asking: the first time, and again after the no. */
export const ASK_LINES = [
  'Fancy a drink after work?',
  'Drinks after work? My treat!',
  'Happy hour downstairs, you and me?',
  'So... a drink tonight, maybe?',
];
export const ASK_AGAIN_LINES = [
  'How about Friday, then?',
  'Just one tiny drink?',
  'What if we call it team building?',
  'Maybe next week?',
  'I found a bar with free nachos...',
  'One drink. For networking.',
  'What about a coffee? Coffee is not a drink. Is it?',
  'Have you reconsidered? It has been ten minutes.',
];

/** The first answer: polite, final, no strike. Asking once is a fair question. */
export const FIRST_NO = [
  "That's sweet, but no thanks. Let's keep it to work.",
  "I'm flattered. Also: no. Also: did you see the Q3 deck?",
  'No, but thank you for asking like a grown-up.',
  "I don't mix drinks and colleagues. Or drinks and spreadsheets.",
  "Kind of you, but I'll pass. My evenings belong to my cat.",
  'Nope. But I respect the confidence. Mostly.',
  "Thanks, no. Let's keep it strictly KPIs between us.",
  'I will have to decline. Politely. Firmly. Like a calendar invite.',
  'No thanks. I have a strict no-colleagues policy. I wrote it myself.',
  'Ha! No. But that was brave. Now, about that ticket...',
  "I'd rather not. Let's stay the kind of colleagues who share a printer.",
  "I'm going to say no, and we can both pretend this was about the budget.",
  'Thank you, but no. I have plans. With my sofa. Every night.',
  'Hard pass, friendly version. Coffee machine chat is my limit.',
  'Aw. No. But you get points for not doing it by email.',
  'No, thanks. My calendar and my heart are both fully booked.',
];

/** Asking again after the no: by strike (1-5), colder and more official every time. */
export const REPEAT_NO = [
  [
    'I already said no. That answer has not been updated.',
    'Same answer as before. No patch notes.',
    "Still no. It's not a negotiation, it's a decision.",
    'We covered this. The minutes say no.',
    'No means no. Even on a Friday.',
    'My answer has not changed. It is not going to, either.',
  ],
  [
    "We've talked about this. Twice now.",
    'Please stop asking. I mean it.',
    'Asking again will not change the result. I am not a vending machine.',
    "You're turning a coffee break into a case study.",
    "I've said no. Now I'm saying stop.",
    'This is where you take the hint. Any minute now.',
  ],
  [
    "I'm writing this down. Date, time, floor.",
    "I've started a document. It has headings.",
    'Noted. In a very specific folder.',
    "Okay. I'm keeping a log now, and you're in it.",
    "That's three. I'm counting, and so is my notepad.",
    'I just made a spreadsheet about you. It is not a compliment.',
  ],
  [
    "That's it. Next time, I'm talking to HR.",
    'I have HR on speed dial. My thumb is ready.',
    'One more and this goes to People & Culture.',
    "The email to HR is in my drafts. It's very well written.",
    'Final warning. HR has a form for this, and I have it open.',
    'Ask once more and you will meet HR. Not socially.',
  ],
  [
    'Right. HR. Now.',
    "I've filed a report. Enjoy your training.",
    'Done. HR will be in touch. Very soon. Like, now.',
    "That's five. HR has entered the chat.",
  ],
];

/** Small talk with the colleague who said no, once they have had enough (after strike 3, and for good after the hold). */
export const FROSTY_LINES = [
  'Morning. Work topics only, please.',
  "I'll be at my desk. Far from yours.",
  "Let's keep this to email. CC my manager.",
  'Mhm.',
  'Fine, thanks. Busy. Very busy.',
  'Please raise it as a ticket.',
  'I only talk about deadlines now.',
  '*stares at their screen very hard*',
];

/** Colleagues nearby, once the strikes reach 3. */
export const GOSSIP_LINES = [
  'Did you hear? Somebody keeps asking you-know-who out.',
  'Ugh, not again. Somebody tell them no means no.',
  "I'd be updating my CV if I were them.",
  'HR is going to have a field day.',
  'Is that the one from the rumours?',
  'Awkward... *sips coffee loudly*',
  "I'm not saying anything. *says everything with eyebrows*",
  "That's going in the newsletter. The bad section.",
  "Bold strategy. Let's see if it pays off. (It won't.)",
];

/** The HR rep while the career is on compliance hold. */
export const HR_CALL_LINES = [
  'Please come and see me. Bring a pen.',
  'We need to talk. Compliance training. Today.',
  'My door is open. You need to come through it.',
  'Your training slot is now. It was always now.',
];

/** The HR rep, after the training. */
export const HR_PASSED_LINES = ['Certificate issued. Let us never meet like this again.', 'Well done. I am framing your certificate. For evidence.'];
export const HR_FAILED_LINES = ['I am afraid this has consequences.', 'We will be revisiting your career path. Downwards.'];

export const HOLD_INTRO =
  'A colleague has reported repeated unwanted invitations. Until you complete the Compliance & Ethics training, ' +
  'your tasks, the elevator and the workstations are on hold.\n' +
  'The training is free. Pass and the record is cleared. Fail and you are demoted one floor, and HR will want to ' +
  'review your promotion again.';

/** The compliance & ethics training: { q, a (right), w: [3 wrong] }. Short options: they fit one line. */
export const COMPLIANCE = [
  { q: 'A colleague said no to a drink. You:', a: 'Accept it and move on', w: ['Ask again on Friday', 'Send flowers to change their mind', 'Get a friend to ask for you'] },
  { q: "When does 'no' turn into 'yes'?", a: 'It does not', w: ['After the fifth ask', 'After a cocktail', 'When the KPI turns green'] },
  { q: "A colleague's 'no' was quiet and polite. It means:", a: 'No', w: ['Maybe', 'Try harder', 'Yes, but shy'] },
  { q: 'Persistence is a virtue when:', a: 'Fixing a bug', w: ['Asking someone out', 'Asking someone out again', 'Asking someone out by fax'] },
  { q: 'A colleague keeps their distance from you now. You:', a: 'Respect it', w: ['Follow them to the printer', 'Wait by their car', 'Pull a chair up to their desk'] },
  { q: 'Which one is a professional compliment?', a: 'Great presentation today', w: ['Smile more, it suits you', 'Who are you dressing up for?', 'You look good for your age'] },
  { q: 'A colleague asked you not to message after hours. You:', a: 'Stop messaging after hours', w: ['Switch to voice notes', 'Message at 6 am instead', "Send memes. They're not messages"] },
  { q: 'Who decides whether a joke was offensive?', a: 'The person who heard it', w: ['Whoever laughed loudest', 'The person who told it', 'A show of hands'] },
  { q: "Gossip about a colleague's private life is:", a: 'None of your business', w: ['A team-building exercise', 'Fine if it is true', 'Fine if it is juicy'] },
  { q: 'You see a colleague being pestered. You:', a: 'Speak up or tell HR', w: ['Grab popcorn', 'Start a betting pool', 'Join in, for team spirit'] },
  { q: "HR's door is always open. That means:", a: 'You can raise concerns safely', w: ['Free sweets', 'It is draughty in there', 'They are hiring'] },
  { q: "Someone's lunch in the fridge says 'GARY'. You:", a: 'Leave it for Gary', w: ['Eat it, Gary will cope', 'Eat half, it is only fair', 'Relabel it with your name'] },
  { q: 'A supplier offers you a free yacht weekend. You:', a: 'Decline and tell Compliance', w: ['Pack sunscreen', 'Ask for two yachts', 'Accept, it is networking'] },
  { q: 'Your password is best kept:', a: 'In a password manager', w: ['On a sticky note on the monitor', 'As your desktop wallpaper', 'In the team chat, pinned'] },
  { q: "An email from the 'CEO' asks for gift cards. You:", a: 'Report it as phishing', w: ['Buy 50 gift cards', 'Reply with your PIN', 'Forward it to everyone'] },
  { q: 'Reply-all is right when:', a: 'Everyone truly needs the reply', w: ["You want to say 'thanks!'", "You want to say 'unsubscribe'", 'Always, for visibility'] },
  { q: "You find the boss's laptop unlocked. You:", a: 'Lock it and walk away', w: ['Read only the subject lines', "Email 'I quit' as a prank", 'Order pizza on their card'] },
  { q: 'Confidential printouts belong:', a: 'In the shredder', w: ['On the printer, for a day or two', 'Under your coffee, as a coaster', 'In your holiday luggage'] },
  { q: "A colleague's personnel file is:", a: 'Off limits', w: ['Bedtime reading', 'Fair game if the drawer is open', 'A great icebreaker'] },
  { q: 'The company card is for:', a: 'Approved business expenses', w: ["A 'business' jet ski", 'Team drinks every night', "Your cat's birthday"] },
  { q: 'The office party ends at 10. At 11 you:', a: 'Go home', w: ['Hug the CFO', 'Do karaoke on the boardroom table', 'Photocopy your face'] },
  { q: 'A colleague is upset in a meeting. You:', a: 'Check in with them privately', w: ['Live-post it', 'Add it to the minutes', 'Ask what is wrong, very loudly'] },
];
