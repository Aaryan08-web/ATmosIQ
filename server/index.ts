import { config } from './config.js';
import { createApp } from './app.js';

createApp().listen(config.port, () => {
  console.log(`ATmosIQ server on :${config.port} (${config.isProd ? 'production' : 'development'})`);
});
