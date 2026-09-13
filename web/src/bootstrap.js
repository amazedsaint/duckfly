import {startStartup, failStartup} from './startup.js';

try {
  startStartup();
  import('./main.js').catch(failStartup);
} catch (error) {
  failStartup(error);
}
