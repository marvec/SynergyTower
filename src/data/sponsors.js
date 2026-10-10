// Hallway posters: a "Your logo here" sponsorship spot and a fake ad on every floor. Pure data.
// The ads are invented brands; a sponsorship contact form will replace the placeholder pitch later.
export const POSTER_TEXT = 'YOUR LOGO HERE';

export const SPONSOR_PITCH = {
  title: 'Advertise here',
  text:
    'This premium hallway spot is seen by every new hire climbing all 40 floors of the tower.\n' +
    'Want your brand on it? Sponsorship enquiries open soon - a contact form is on its way.',
  button: 'Got it',
};

/** mark: logo shape drawn left of the name (diamond, circle, square, bolt). */
export const FAKE_ADS = [
  { name: 'ACME Systems Inc.', bg: '#c8402e', fg: '#ffffff', mark: 'diamond', tagline: 'Systems. Incorporated. Since forever.' },
  { name: 'PaperPal Clips', bg: '#f2c14e', fg: '#22242e', mark: 'circle', tagline: 'Holding it all together since 1899.' },
  { name: 'Stapleton & Sons', bg: '#2a5a9a', fg: '#ffffff', mark: 'square', tagline: 'Staplers that stay put.' },
  { name: 'BrewTech Coffee', bg: '#5a3a22', fg: '#f2d8a0', mark: 'circle', tagline: 'Productivity, dark roasted.' },
  { name: 'NapPod Pro', bg: '#3a3f55', fg: '#9fd8ff', mark: 'circle', tagline: 'Power naps, enterprise grade.' },
  { name: 'Ergo-Max Chairs', bg: '#22242e', fg: '#f29c38', mark: 'square', tagline: 'Sit like you mean it.' },
  { name: 'CloudNine Hosting', bg: '#e9eef5', fg: '#2a4a9a', mark: 'circle', tagline: 'Your data, somewhere up there.' },
  { name: 'ZapMail', bg: '#2f7f6f', fg: '#ffffff', mark: 'bolt', tagline: 'Reply-all at the speed of light.' },
  { name: 'MegaByte Storage', bg: '#7a3bb6', fg: '#ffffff', mark: 'square', tagline: 'Never delete anything. Ever.' },
  { name: 'Kwik-Print Toner', bg: '#111318', fg: '#5fd068', mark: 'bolt', tagline: 'PC LOAD LETTER? Not anymore.' },
];

export const adPitch = (ad) => ({
  title: ad.name,
  text: `"${ad.tagline}"\n(A made-up sponsor. This wall could carry your brand instead: sponsorship enquiries open soon.)`,
  button: 'Nice',
});
