const { Bot } = require('node-telegram-bot-api');
const { readTelegramConfig } = require('./config/telegram');
const { registerMenuHandlers, sendSubscriptionGate } = require('./handlers/menu');
const { registerGroupWelcomeHandler } = require('./handlers/groupWelcome');
const { registerGroupModerationHandler } = require('./handlers/groupModeration');
const { registerGroupSpamHandler } = require('./handlers/groupSpam');
const { registerTextEffectsHandler } = require('./handlers/textEffects');
const { registerIdentifierHandlers } = require('./handlers/identifiers');
const { registerChatEntryLogger } = require('./handlers/chatEntryLogger');
const { createSubscriptionGuard } = require('./services/subscriptions');
const { createDatabasePools } = require('./services/database');
const { createGroupMemberStore } = require('./services/groupMembers');
const { createBotUsageStore } = require('./services/botUsage');
const { startAdScheduler } = require('./services/adScheduler');
const { startPartnersMessageUpdater } = require('./services/partnersMessageUpdater');

function createBot(token, { databasePools, env = process.env } = {}) {
  if (!token) throw new Error('BOT_TOKEN 환경 변수가 필요합니다.');
  const pools = databasePools || createDatabasePools(env);
  const config = readTelegramConfig(env);
  const bot = new Bot(token);
  const groupMemberStore = createGroupMemberStore(config.groupMemberStorePath);
  const usageStore = createBotUsageStore(config.botUsageStorePath);
  const requireSubscriptions = createSubscriptionGuard({
    config,
    onRejected: (ctx) => sendSubscriptionGate(ctx, config),
  });

  registerChatEntryLogger(bot, { usageStore });

  registerMenuHandlers(bot, {
    config,
    usageStore,
    requireSubscriptions,
    businessAdsPool: pools.mnms,
    chatbotPool: pools.chatbot,
  });
  registerGroupWelcomeHandler(bot, {
    chatId: config.welcomeChatId,
    photoPath: config.welcomePhotoPath,
    memberStore: groupMemberStore,
    links: config.links,
  });
  registerGroupModerationHandler(bot, {
    chatId: config.welcomeChatId,
    memberStore: groupMemberStore,
  });
  registerGroupSpamHandler(bot, {
    chatId: config.welcomeChatId,
    memberStore: groupMemberStore,
  });
  registerTextEffectsHandler(bot);
  registerIdentifierHandlers(bot);
  bot.adScheduler = startAdScheduler(bot.api, config.adsConfigPath, {
    businessAdsPool: pools.mnms,
    partnersMessageUrl: config.links.partnersMessage,
  });
  bot.partnersMessageUpdater = startPartnersMessageUpdater(bot.api, pools.mnms, config);
  bot.catch((error) => console.error('Telegram bot handler failed:', error));
  return bot;
}

module.exports = { createBot };
