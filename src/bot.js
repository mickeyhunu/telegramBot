const { Bot } = require('node-telegram-bot-api');
const { readTelegramConfig, createTargetGroupChecker } = require('./config/telegram');
const { registerMenuHandlers, sendSubscriptionGate } = require('./handlers/menu');
const { registerSystemHandlers } = require('./handlers/system');
const { registerWelcomeHandler } = require('./handlers/welcome');
const { createChoiceMessageHandler } = require('./services/choiceMessages');
const { createSubscriptionGuard } = require('./services/subscriptions');
const { createDatabasePools } = require('./services/database');

function createBot(token, { databasePools, env = process.env } = {}) {
  if (!token) throw new Error('BOT_TOKEN 환경 변수가 필요합니다.');
  const pools = databasePools || createDatabasePools(env);
  const config = readTelegramConfig(env);
  const isTargetGroup = createTargetGroupChecker(config);
  const bot = new Bot(token);
  const requireSubscriptions = createSubscriptionGuard({
    config,
    onRejected: (ctx) => sendSubscriptionGate(ctx, config),
  });

  bot.on('message', createChoiceMessageHandler({
    databasePool: pools.chatbot,
    isAllowedChat: isTargetGroup,
    requireSubscriptions,
  }));
  registerMenuHandlers(bot, {
    config,
    isTargetGroup,
    requireSubscriptions,
    businessAdsPool: pools.mnms,
    chatbotPool: pools.chatbot,
  });
  registerSystemHandlers(bot, pools);
  registerWelcomeHandler(bot, { config, isTargetGroup });
  bot.catch((error) => console.error('Telegram bot handler failed:', error));
  return bot;
}

module.exports = { createBot };
