// Calendar Defender content: meeting invites that march toward your Focus Time. Labels wrap into two lines
// inside the invite block, so keep words short (checked by a scratch script when tuning).
export const INVITES = {
  short: ['Quick sync', 'Touch base', 'Stand-up', 'Check-in', 'Ping?', '1:1 (moved)', 'Quick Q', 'Huddle', 'FYI call', 'Sync re: sync', 'Got 5 min?', 'Pre-call'],
  std: [
    'Sync about the sync', 'Alignment', 'Status update', 'Weekly kickoff', 'Roadmap chat', 'Synergy session',
    'Process review', 'Strategy jam', 'Retro of retro', 'Mandatory fun', 'Pre-meeting meeting', 'Feedback loop',
    'Team bonding', 'Calendar review', 'OKR check',
  ],
  long: [
    'Quick catch-up (90 min)', 'Brainstorm: brainstorms', 'All-day workshop', 'Vision offsite', 'Deep dive (deeper)',
    'Lunch & learn & learn', 'Town hall rehearsal', 'Slide review v14',
  ],
  recur: ['Weekly sync (forever)', 'Daily stand-up', 'Recurring alignment', 'Bi-weekly weekly', 'Monthly monthly'],
  mini: ['Sync', 'Ping', 'Recap', '+1', 'Fwd:', 'Re:'],
  boss: ['CEO All-Hands'],
};

export const INVITES_DEPT = {
  lobby: ['Fire drill brief', 'Badge policy'],
  support: ['Escalation sync', 'Ticket triage'],
  sales: ['Pipeline review', 'Forecast call'],
  marketing: ['Brand vibes check', 'Hashtag huddle'],
  it: ['Incident retro', 'Change board'],
  finance: ['Budget re-recut', 'Q3 variance'],
  legalhr: ['Policy refresh', 'Culture survey'],
  exec: ['Board prep prep', 'Synergy summit'],
};

/** Floaters when an invite is destroyed / leaks into your focus time. */
export const KILL_LINES = ['Declined!', 'Nope.', 'Tentative... no.', 'Busy!', 'Cancelled', 'Unsubscribed', 'Ghosted', 'Moved to never'];
export const LEAK_LINES = ['Meeting accepted :(', 'Focus lost!', 'Ugh, a meeting', 'Calendar hijacked', 'There goes Friday'];
