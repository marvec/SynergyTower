// Buzzword pools for Meeting Buzzword Bingo. Department words are mixed with the shared pool.
export const BUZZ_COMMON = [
  'Synergy', 'Circle back', 'Deep dive', 'Bandwidth', 'Low-hanging fruit', 'Move the needle',
  'Touch base', 'Paradigm shift', 'Leverage', 'Win-win', 'Game changer', 'Take it offline',
  'Align', 'Deliverables', 'Holistic', 'Best practice', 'Pivot', 'Action items',
  'Going forward', 'Value add', 'Ping me', 'Quick win', 'North star', 'Boil the ocean',
];

export const BUZZ_DEPT = {
  lobby: ['Sign in', 'Visitor badge', 'Parcel', 'Lost & found', 'Front desk', 'Lanyard', 'Footfall', 'Lobby flow', 'Signage', 'Turnstile'],
  support: ['Escalate', 'SLA', 'Ticket', 'Root cause', 'Workaround', 'NPS', 'Backlog', 'Churn', 'First response', 'Knowledge base'],
  sales: ['Pipeline', 'Quota', 'Close rate', 'Upsell', 'Warm lead', 'Funnel', 'ARR', 'Discovery call', 'Champion', 'Land & expand'],
  marketing: ['Brand voice', 'Viral', 'Engagement', 'Omnichannel', 'Storytelling', 'Influencer', 'CTR', 'Thought leader', 'Funnel top', 'Rebrand'],
  it: ['Cloud native', 'Microservices', 'Tech debt', 'Agile', 'Sprint', 'Kubernetes', 'Blockchain', 'AI-powered', 'Scalable', 'Refactor'],
  finance: ['EBITDA', 'Run rate', 'Burn rate', 'Forecast', 'Headwinds', 'OPEX', 'CAPEX', 'Margin', 'Accrual', 'Cost center'],
  legalhr: ['Compliance', 'Culture fit', 'Onboarding', 'Wellness', 'Headcount', 'Due diligence', 'Liability', 'Talent', 'Policy', 'Offboarding'],
  exec: ['Vision', 'Disrupt', 'Shareholder value', 'Moonshot', 'Transformation', 'Restructure', 'Big picture', 'Ecosystem', 'Right-size', 'Stakeholders'],
};

// Meeting attendee names shown around the table.
export const BINGO_SPEAKERS = ['Boss', 'VP', 'Consultant', 'Intern', 'Director', 'Coach'];
