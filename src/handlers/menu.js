const {
  buildGroupMenu,
  buildLiveMenu,
  buildPartnersMenu,
  buildPrivateMenu,
  buildStoreSelectionMenu,
  buildSubscriptionMenu,
} = require('../ui/keyboards');
const {
  groupGuideCaption,
  liveGuideMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
  storeSelectionMessage,
} = require('../ui/messages');
const {
  checkSubscriptions,
  createSubscriptionGuard,
  isSubscribed,
  logSubscriptionFailures,
} = require('../services/subscriptions');
const { getActiveBusinessAds } = require('../services/businessAds');
const { getStore, getStores } = require('../services/stores');

const TELEGRAM_DELETE_BATCH_SIZE = 100;

async function clearRecentPrivateMessages(ctx, logger = console) {
  const latestMessageId = ctx.message?.message_id;
  if (ctx.chat?.type !== 'private' || !latestMessageId) return;

  // Keep the /start command itself and clean up only the messages before it.
  const firstMessageId = Math.max(1, latestMessageId - TELEGRAM_DELETE_BATCH_SIZE);
  const messageIds = Array.from(
    { length: latestMessageId - firstMessageId },
    (_, index) => firstMessageId + index,
  );

  if (!messageIds.length) return;

  try {
    await ctx.api.deleteMessages({ chat_id: ctx.chatId, message_ids: messageIds });
  } catch (error) {
    // Telegram does not allow every message to be deleted (for example, messages
    // that are too old). A cleanup failure must not prevent /start from working.
    logger.warn(`개인 채팅 메시지 정리 실패 (${ctx.chatId}): ${error.message}`);
  }
}

async function resolveBotUsername(ctx, cache) {
  if (!cache.username) cache.username = (await ctx.api.getMe()).username;
  return cache.username;
}

async function sendPrivateMenu(ctx, config) {
  await ctx.reply(privateGuideMessage(), { reply_markup: buildPrivateMenu(config.links) });
}

async function editPrivateMenu(ctx, text, replyMarkup, options = {}) {
  await ctx.answerCallbackQuery();
  await ctx.api.editMessageText({
    chat_id: ctx.chatId,
    message_id: ctx.callbackQuery.message.message_id,
    text,
    reply_markup: replyMarkup,
    ...options,
  });
}

async function sendSubscriptionGate(ctx, config) {
  await ctx.reply(subscriptionMessage(), {
    parse_mode: 'Markdown',
    reply_markup: buildSubscriptionMenu(config.subscriptionChats),
  });
}

function subscriptionStatusMessage(subscriptionChats, missingChats) {
  const missing = new Set(missingChats);
  const statusLines = subscriptionChats.map((chat, index) => {
    const status = missing.has(chat) ? '🔘 구독 확인 안됨' : '🟢 구독중';
    return `${chat.name} : ${status}`;
  });

  return [...statusLines, '', '구독을 확인해 주세요.'].join('\n');
}

async function startSubscriptionFlow(ctx, config) {
  const userId = ctx.from?.id;
  if (!userId || config.subscriptionChats.some(({ chatId }) => !chatId)) {
    return sendSubscriptionGate(ctx, config);
  }

  const result = await checkSubscriptions(ctx.api, config.subscriptionChats, userId);
  if (result.failed.length) {
    logSubscriptionFailures(result.failed);
    return sendSubscriptionGate(ctx, config);
  }

  if (result.missing.length) return sendSubscriptionGate(ctx, config);
  return sendPrivateMenu(ctx, config);
}

async function verifySubscriptions(ctx, config) {
  const userId = ctx.from?.id;
  if (!userId || config.subscriptionChats.some(({ chatId }) => !chatId)) {
    await ctx.answerCallbackQuery({
      text: '구독 확인 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
      show_alert: true,
    });
    return;
  }

  let result;
  try {
    result = await checkSubscriptions(ctx.api, config.subscriptionChats, userId);
  } catch (error) {
    // This is only a safeguard for an unexpected local error. Telegram request
    // failures are returned per chat by checkSubscriptions.
    console.error('구독 여부 확인 처리 실패:', error);
    await ctx.answerCallbackQuery({
      text: '구독 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      show_alert: true,
    });
    return;
  }

  if (result.failed.length) {
    logSubscriptionFailures(result.failed);
    await ctx.answerCallbackQuery({
      text: `${result.failed.map(({ chat }) => chat.name).join(', ')} 확인 권한이 없습니다. 봇을 해당 방의 관리자로 추가하고 채팅 ID 설정을 확인해 주세요.`,
      show_alert: true,
    });
    return;
  }

  if (result.missing.length) {
    await ctx.answerCallbackQuery({
      text: subscriptionStatusMessage(config.subscriptionChats, result.missing),
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: '구독이 확인되었습니다.' });
  const gateMessage = ctx.callbackQuery?.message;
  if (gateMessage?.message_id) {
    await ctx.api.editMessageText({
      chat_id: gateMessage.chat?.id || ctx.chatId,
      message_id: gateMessage.message_id,
      text: privateGuideMessage(),
      reply_markup: buildPrivateMenu(config.links),
    });
  }
}

async function sendGroupMenu(ctx, config, botUsername) {
  const options = { reply_markup: buildGroupMenu(botUsername, config.links) };
  if (config.guideImage) {
    await ctx.api.sendPhoto({ chat_id: ctx.chatId, photo: config.guideImage, caption: groupGuideCaption(), ...options });
    return;
  }

  const group = await ctx.api.getChat({ chat_id: ctx.chatId });
  if (group.photo?.big_file_id) {
    await ctx.api.sendPhoto({ chat_id: ctx.chatId, photo: group.photo.big_file_id, caption: groupGuideCaption(), ...options });
    return;
  }
  await ctx.reply(groupGuideCaption(), options);
}

function registerMenuHandlers(bot, {
  config,
  isTargetGroup,
  requireSubscriptions = (_ctx, next) => next(),
  businessAdsPool,
  loadActiveBusinessAds = getActiveBusinessAds,
  chatbotPool,
  loadStore = getStore,
  loadStores = getStores,
}) {
  const cache = {};

  bot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return undefined;
    await clearRecentPrivateMessages(ctx);
    return startSubscriptionFlow(ctx, config);
  });
  bot.on('callback_query', (ctx, next) => {
    if (ctx.callbackQuery?.data !== 'verify_subscriptions' || ctx.chat?.type !== 'private') return next();
    return verifySubscriptions(ctx, config);
  });
  bot.on('callback_query', (ctx, next) => {
    if (ctx.chat?.type !== 'private') return next();
    const data = ctx.callbackQuery?.data;
    if (!['menu_home', 'menu_live', 'menu_partners'].includes(data)) return next();

    return requireSubscriptions(ctx, async () => {
      if (data === 'menu_live') {
        try {
          const stores = await loadStores(chatbotPool);
          if (!stores.length) {
            return ctx.answerCallbackQuery({
              text: '등록된 가게가 없습니다.',
              show_alert: true,
            });
          }
          return editPrivateMenu(
            ctx,
            storeSelectionMessage(),
            buildStoreSelectionMenu(stores, config.links),
          );
        } catch (error) {
          console.error(`가게정보 조회 실패: ${error.message}`);
          return ctx.answerCallbackQuery({
            text: '가게정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            show_alert: true,
          });
        }
      }
      if (data === 'menu_partners') {
        try {
          const businesses = await loadActiveBusinessAds(businessAdsPool);
          return editPrivateMenu(
            ctx,
            partnersGuideMessage(businesses, config.links),
            buildPartnersMenu(config.links),
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
          );
        } catch (error) {
          console.error(`제휴업체 조회 실패: ${error.message}`);
          return ctx.answerCallbackQuery({
            text: '제휴업체 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            show_alert: true,
          });
        }
      }
      return editPrivateMenu(ctx, privateGuideMessage(), buildPrivateMenu(config.links));
    });
  });
  bot.on('callback_query', (ctx, next) => {
    if (ctx.chat?.type !== 'private') return next();
    const match = /^live_store:(\d+)$/.exec(ctx.callbackQuery?.data || '');
    if (!match) return next();

    return requireSubscriptions(ctx, async () => {
      try {
        const store = await loadStore(chatbotPool, match[1]);
        if (!store) {
          return ctx.answerCallbackQuery({
            text: '선택한 가게정보를 찾을 수 없습니다.',
            show_alert: true,
          });
        }
        return editPrivateMenu(
          ctx,
          liveGuideMessage(store),
          buildLiveMenu(store.storeNo, config.links),
        );
      } catch (error) {
        console.error(`가게정보 조회 실패 (${match[1]}): ${error.message}`);
        return ctx.answerCallbackQuery({
          text: '가게정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          show_alert: true,
        });
      }
    });
  });
  bot.on('callback_query', (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith('live_') || ctx.chat?.type !== 'private') return next();
    return requireSubscriptions(ctx, () => ctx.answerCallbackQuery({
      text: '해당 LIVE 서비스는 준비 중입니다.',
      show_alert: true,
    }));
  });
  bot.hears(/^\/(?:채널안내|메뉴)(?:@\w+)?\s*$/, async (ctx) => {
    if (ctx.chat?.type === 'private') {
      return requireSubscriptions(ctx, () => sendPrivateMenu(ctx, config));
    }
    if (!isTargetGroup(ctx.chat)) return undefined;
    return requireSubscriptions(ctx, async () => {
      const username = await resolveBotUsername(ctx, cache);
      return sendGroupMenu(ctx, config, username);
    });
  });
}

module.exports = {
  clearRecentPrivateMessages,
  checkSubscriptions,
  createSubscriptionGuard,
  isSubscribed,
  registerMenuHandlers,
  resolveBotUsername,
  sendGroupMenu,
  sendPrivateMenu,
  sendSubscriptionGate,
  startSubscriptionFlow,
  verifySubscriptions,
};
