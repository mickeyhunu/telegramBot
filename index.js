require('dotenv').config();

const { run } = require('node-telegram-bot-api/node');
const { createBot } = require('./src/bot');

if (require.main === module) run(createBot(process.env.BOT_TOKEN));

// Keep the public exports in one place so existing integrations can migrate to
// the new src/ layout without a breaking change.
module.exports = {
  ...require('./src/bot'),
  ...require('./src/config/telegram'),
  ...require('./src/ui/keyboards'),
};
