require('dotenv').config();

const { run } = require('node-telegram-bot-api/node');
const { createBot } = require('./src/bot');

if (require.main === module) {
  run(createBot(process.env.BOT_TOKEN), {
    // Telegram remembers allowed_updates from an earlier getUpdates call when
    // this is omitted. Declare every update type used by this bot explicitly,
    // including membership updates needed for welcome diagnostics.
    allowedUpdates: ['message', 'callback_query', 'chat_member', 'my_chat_member'],
    onError: (error) => console.error('[polling] getUpdates failed; retrying:', error),
  }).catch((error) => {
    console.error('[polling] bot stopped unexpectedly:', error);
    process.exitCode = 1;
  });
}

// Keep the public exports in one place so existing integrations can migrate to
// the new src/ layout without a breaking change.
module.exports = {
  ...require('./src/bot'),
  ...require('./src/config/telegram'),
  ...require('./src/ui/keyboards'),
};
