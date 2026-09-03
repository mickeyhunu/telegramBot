const {
  buildGroupMenu,
  buildLiveMenu,
  buildPartnersMenu,
  buildPrivateMenu,
  buildSubscriptionMenu,
} = require('../ui/keyboards');
const {
  groupGuideCaption,
  liveGuideMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
} = require('../ui/messages');
const {
  checkSubscriptions,
  createSubscriptionGuard,
  isSubscribed,
  logSubscriptionFailures,
} = require('../services/subscriptions');

async function resolveBotUsername(ctx, cache) {
  if (!cache.username) cache.username = (await ctx.api.getMe()).username;
  return cache.username;
}

async function sendPrivateMenu(ctx, config) {
  await ctx.reply(privateGuideMessage(), { reply_markup: buildPrivateMenu(config.links) });
}

async function editPrivateMenu(ctx, text, replyMarkup) {
  await ctx.answerCallbackQuery();
  await ctx.api.editMessageText({
    chat_id: ctx.chatId,
    message_id: ctx.callbackQuery.message.message_id,
    text,
    reply_markup: replyMarkup,
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
    try {
      await ctx.api.deleteMessage({
        chat_id: gateMessage.chat?.id || ctx.chatId,
        message_id: gateMessage.message_id,
      });
    } catch (error) {
      console.error('기존 구독 확인 메시지 삭제 실패:', error);
    }
  }
  await sendPrivateMenu(ctx, config);
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
}) {
  const cache = {};

  bot.command('start', (ctx) => {
    if (ctx.chat?.type !== 'private') return undefined;
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

    return requireSubscriptions(ctx, () => {
      if (data === 'menu_live') {
        return editPrivateMenu(ctx, liveGuideMessage(), buildLiveMenu(config.links));
      }
      if (data === 'menu_partners') {
        return editPrivateMenu(
          ctx,
          partnersGuideMessage(config.partnerBusinesses.length > 0),
          buildPartnersMenu(config.partnerBusinesses, config.links),
        );
      }
      return editPrivateMenu(ctx, privateGuideMessage(), buildPrivateMenu(config.links));
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
