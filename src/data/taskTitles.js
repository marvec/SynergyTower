// Task titles per mini-game, themed by department. `default` is used when a department has no entry.
export const TASK_TITLES = {
  inbox: {
    default: ['Inbox Zero', 'Triage the Inbox'],
    lobby: ['Sort the Mail', 'Deliver the Parcels'],
    support: ['Ticket Triage', 'Queue Cleanup'],
    sales: ['Lead Triage', 'Sort the RFPs'],
    marketing: ['Newsletter Replies', 'Triage the DMs'],
    it: ['Alert Triage', 'Sort the Bug Reports'],
    finance: ['Invoice Triage', 'Sort the Receipts'],
    legalhr: ['Shred or Keep', 'Sort the Complaints'],
    exec: ['Board Mail Triage', 'Investor Inbox'],
  },
  compose: {
    default: ['Write the Email', 'Polite Reply'],
    lobby: ['Visitor Welcome Note', 'Lost & Found Notice'],
    support: ['Apology Template', 'Calm the Customer'],
    sales: ['Follow-up Email', 'Cold Outreach'],
    marketing: ['Press Release', 'Campaign Copy'],
    it: ['Outage Notice', 'Change Request'],
    finance: ['Budget Memo', 'Overdue Reminder'],
    legalhr: ['Policy Update', 'Offer Letter'],
    exec: ['All-Hands Memo', 'Shareholder Letter'],
  },
  typing: {
    default: ['Rapid Reply', 'Speed Typing'],
    support: ['Live Chat Sprint'],
    it: ['Hotfix Commit Message'],
    exec: ['Dictation Duty'],
  },
  spreadsheet: {
    default: ['Fix the Spreadsheet', 'Totals Audit'],
    finance: ['Reconcile the Ledger', 'Quarter-End Close'],
    sales: ['Forecast Cleanup'],
    marketing: ['Campaign ROI Sheet'],
    legalhr: ['Headcount Sheet'],
  },
  bingo: {
    default: ['Attend the Meeting', 'Buzzword Bingo'],
    exec: ['Board Meeting', 'Strategy Offsite'],
    marketing: ['Brainstorm Session'],
    it: ['Stand-up Meeting'],
    sales: ['Pipeline Review'],
  },
  calendar: {
    default: ['Schedule the Meeting', 'Find a Slot'],
    exec: ['Align the C-Suite Calendars'],
    legalhr: ['Interview Scheduling'],
    sales: ['Book the Client Demo'],
  },
  timing: {
    default: ['Unjam the Printer', 'Perfect Timing'],
    sales: ['Close the Deal', 'Ring the Gong'],
    it: ['Deploy Window', 'Reboot the Router'],
    finance: ['Market Open Bell'],
    marketing: ['Perfect Product Shot'],
    exec: ['Signature Flourish'],
  },
  memory: {
    default: ['Name Badge Memory', 'Remember the Faces'],
    lobby: ['Visitor Badges', 'Parcel Matching'],
    legalhr: ['File Matching', 'Org Chart Memory'],
    marketing: ['Logo Matching'],
  },
  simon: {
    default: ['Server Rack Sequence', 'Blinkenlights'],
    it: ['Reboot Sequence', 'RAID Rebuild'],
  },
  math: {
    default: ['Expense Report', 'Add It Up'],
    finance: ['Audit the Receipts', 'Tax Estimate'],
    sales: ['Commission Calculator'],
  },
  quiz: {
    default: ['Water Cooler Small Talk', 'Corporate Trivia'],
    lobby: ['Visitor Questions'],
    support: ['Customer FAQ'],
    it: ['Tech Support Quiz'],
    finance: ['Finance Jargon Quiz'],
    legalhr: ['Compliance Training', 'HR Policy Quiz'],
    exec: ['Performance Review', 'Investor Q&A'],
  },
  order: {
    default: ['Slide Deck Order', 'Fix the Process'],
    marketing: ['Storyboard the Campaign'],
    it: ['Release Checklist'],
    exec: ['Five-Year Plan'],
  },
  whack: {
    default: ['Whack-a-Notification', 'Popup Blocker'],
    it: ['Whack-a-Bug', 'Squash the Bugs'],
    marketing: ['Moderate the Comments'],
  },
  stealth: {
    default: ['Boss Alert', 'Look Busy'],
    exec: ['Dodge the Board'],
  },
  stocks: {
    default: ['Quarterly Ticker', 'Buy Low, Sell High'],
    finance: ['Treasury Trading'],
    exec: ['Manage Shareholder Value'],
  },
  jargon: {
    default: ['Jargon Decoder', 'Decode the Boss'],
    lobby: ['Decode the Memo'],
    support: ['Decode the Escalation'],
    sales: ['Decode the Client', 'Pipeline Speak'],
    marketing: ['Brand-Speak Decoder'],
    it: ['Decode the Architect'],
    finance: ['Decode the CFO'],
    legalhr: ['Decode the Policy', 'HR Speak 101'],
    exec: ['Board-Speak Translation', 'Decode the Shareholder Letter'],
  },
  coffee: {
    default: ['Coffee Run', 'Barista Duty'],
    exec: ['Executive Espresso'],
  },
};

export function taskTitle(game, deptId, variant = 0) {
  const t = TASK_TITLES[game];
  const list = t[deptId] || t.default;
  return list[variant % list.length];
}
