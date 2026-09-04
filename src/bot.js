const { Bot } = require('node-telegram-bot-api');
const { readTelegramConfig } = require('./config/telegram');
const { registerMenuHandlers, sendSubscriptionGate } = require('./handlers/menu');
const { registerGroupWelcomeHandler } = require('./handlers/groupWelcome');
const { createSubscriptionGuard } = require('./services/subscriptions');
const { createDatabasePools } = require('./services/database');

function createBot(token, { databasePools, env = process.env } = {}) {
  if (!token) throw new Error('BOT_TOKEN 환경 변수가 필요합니다.');
  const pools = databasePools || createDatabasePools(env);
  const config = readTelegramConfig(env);
  const bot = new Bot(token);
  const requireSubscriptions = createSubscriptionGuard({
    config,
    onRejected: (ctx) => sendSubscriptionGate(ctx, config),
  });

  registerMenuHandlers(bot, {
    config,
    requireSubscriptions,
    businessAdsPool: pools.mnms,
    chatbotPool: pools.chatbot,
  });
  registerGroupWelcomeHandler(bot, {
    chatId: config.welcomeChatId,
    photoPath: config.welcomePhotoPath,
  });
  bot.catch((error) => console.error('Telegram bot handler failed:', error));
  return bot;
}

module.exports = { createBot };
