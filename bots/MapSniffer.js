
const { createBot } = require('./genericBot');

// Create bot with specific configuration
createBot({
  botName: 'MapSniffer',
  role: 'explorer',
  version: '1.20.6',
  host: '127.0.0.1', // Use your server IP
  port: 25565
});
