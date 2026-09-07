const {
  buildLiveMenu,
  buildPartnersMenu,
  buildPrivateMenu,
  buildStoreSelectionMenu,
  buildSubscriptionMenu,
} = require('../ui/keyboards');
const {
  liveGuideMessage,
  liveInformationMessage,
  partnershipListMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
  storeSelectionMessage,
} = require('../ui/messages');
const {
  checkSubscriptions,
  logSubscriptionFailures,
} = require('../services/subscriptions');
const { getActiveBusinessAds } = require('../services/businessAds');
const { getStore, getStores } = require('../services/stores');
const { getLiveInformation } = require('../services/liveInformation');

const TELEGRAM_DELETE_BATCH_SIZE = 100;
const UNDELETABLE_MESSAGE_ERROR = /message (?:can(?:not|'t) be deleted(?: for everyone)?|to delete not found)/i;
const MESSAGE_NOT_MODIFIED_ERROR = /message is not modified/i;

function isUndeletableMessageError(error) {
  return UNDELETABLE_MESSAGE_ERROR.test(error?.description || error?.message || String(error));
}

function isMessageNotModifiedError(error) {
  return error?.errorCode === 400
    && MESSAGE_NOT_MODIFIED_ERROR.test(error?.description || error?.message || String(error));
}

async function deleteMessagesBestEffort(ctx, messageIds, logger) {
  try {
    await ctx.api.deleteMessages({ chat_id: ctx.chatId, message_ids: messageIds });
  } catch (error) {
    if (!isUndeletableMessageError(error)) {
      logger.warn(`개인 채팅 메시지 정리 실패 (${ctx.chatId}): ${error.message || error}`);
      return;
    }

    // deleteMessages fails the whole request when just one ID cannot be removed.
    // Split the batch to retain all deletable messages while silently skipping
    // old, already removed, or otherwise protected messages.
    if (messageIds.length <= 1) return;
    const middle = Math.ceil(messageIds.length / 2);
    await deleteMessagesBestEffort(ctx, messageIds.slice(0, middle), logger);
    await deleteMessagesBestEffort(ctx, messageIds.slice(middle), logger);
  }
}

async function clearRecentPrivateMessages(ctx, logger = console) {
  const latestMessageId = ctx.message?.message_id;
  if (ctx.chat?.type !== 'private' || !latestMessageId) return;

  // Telegram accepts at most 100 IDs in one deleteMessages call. Walk all the
  // way back through the private chat in batches, newest first, while keeping
  // the /start command that triggered this cleanup.
  for (let lastMessageId = latestMessageId - 1; lastMessageId >= 1;) {
    const firstMessageId = Math.max(1, lastMessageId - TELEGRAM_DELETE_BATCH_SIZE + 1);
    const messageIds = Array.from(
      { length: lastMessageId - firstMessageId + 1 },
      (_, index) => firstMessageId + index,
    );

    await deleteMessagesBestEffort(ctx, messageIds, logger);
    lastMessageId = firstMessageId - 1;
  }
}

async function sendPrivateMenu(ctx, config) {
  await ctx.reply(privateGuideMessage(), { reply_markup: buildPrivateMenu(config.links) });
}

async function editPrivateMenu(ctx, text, replyMarkup, options = {}) {
  await ctx.answerCallbackQuery();
  try {
    await ctx.api.editMessageText({
      chat_id: ctx.chatId,
      message_id: ctx.callbackQuery.message.message_id,
      text,
      reply_markup: replyMarkup,
      ...options,
    });
  } catch (error) {
    // Repeated button presses can race and attempt to apply the same menu twice.
    // Telegram treats that harmless no-op as a 400 response, so do not let it
    // fail the callback handler or trigger a second callback-query response.
    if (!isMessageNotModifiedError(error)) throw error;
  }
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

function registerMenuHandlers(bot, {
  config,
  usageStore,
  requireSubscriptions = (_ctx, next) => next(),
  businessAdsPool,
  loadActiveBusinessAds = getActiveBusinessAds,
  chatbotPool,
  loadStore = getStore,
  loadStores = getStores,
  loadLiveInformation = getLiveInformation,
}) {
  bot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return undefined;
    try {
      await usageStore?.recordStart(ctx.from, ctx.message.date);
    } catch (error) {
      console.error(`개인 채팅 /start 사용자 정보 저장 실패 (${ctx.from?.id}): ${error.message}`);
    }
    await clearRecentPrivateMessages(ctx);
    return startSubscriptionFlow(ctx, config);
  });
  bot.command('제휴', (ctx) => ctx.reply(partnershipListMessage(config.links), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }));
  bot.on('callback_query', (ctx, next) => {
    if (ctx.chat?.type !== 'private') return next();
    const match = /^live_(choice|search|waiting|entry|workers):(\d+)$/.exec(ctx.callbackQuery?.data || '');
    if (!match) return next();

    return requireSubscriptions(ctx, async () => {
      const [, action, storeNo] = match;
      try {
        const store = await loadStore(chatbotPool, storeNo);
        if (!store) {
          return ctx.answerCallbackQuery({
            text: '선택한 가게정보를 찾을 수 없습니다.',
            show_alert: true,
          });
        }
        const information = await loadLiveInformation(chatbotPool, action, store);
        return editPrivateMenu(
          ctx,
          liveInformationMessage(store, action, information, config.links),
          buildLiveMenu(store.storeNo, config.links),
          action === 'workers'
            ? { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
            : undefined,
        );
      } catch (error) {
        console.error(`LIVE 정보 조회 실패 (${action}:${storeNo}): ${error.message}`);
        return ctx.answerCallbackQuery({
          text: 'LIVE 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          show_alert: true,
        });
      }
    });
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
}

module.exports = {
  clearRecentPrivateMessages,
  registerMenuHandlers,
  sendPrivateMenu,
  sendSubscriptionGate,
  startSubscriptionFlow,
  verifySubscriptions,
};
