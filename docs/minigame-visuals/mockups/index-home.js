// Mockup entry for the home office chores (in-between style): window.__mockShot_home(name).
import { install, mid } from './harness.js';
import { vacuumMock } from './home/vacuum.js';
import { laundryMock } from './home/laundry.js';
import { ironingMock } from './home/ironing.js';
import { bathMock } from './home/bath.js';
import { brewMock } from './home/brew.js';

install('_home', {
  'mid-vacuum': mid(vacuumMock),
  'mid-laundry': mid(laundryMock),
  'mid-ironing': mid(ironingMock),
  'mid-bath': mid(bathMock),
  'mid-brew': mid(brewMock),
});
