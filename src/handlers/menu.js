const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { fromPath } = require('node-telegram-bot-api/node');
const { buildGroupMenu, buildPrivateMenu, buildSubscriptionMenu } = require('../ui/keyboards');
const {
  groupGuideCaption,
  privateGuideMessage,
  privateWelcomeCaption,
  subscriptionMessage,
} = require('../ui/messages');

async function resolveBotUsername(ctx, cache) {
  if (!cache.username) cache.username = (await ctx.api.getMe()).username;
  return cache.username;
}

async function sendPrivateMenu(ctx, config) {
  await ctx.reply(privateGuideMessage(), { reply_markup: buildPrivateMenu(config.links) });
}

async function sendSubscriptionGate(ctx, config) {
  const imagePath = resolve(config.privateGuideImage);
  if (existsSync(imagePath)) {
    await ctx.api.sendPhoto({
      chat_id: ctx.chatId,
      photo: await fromPath(imagePath),
      caption: privateWelcomeCaption(),
    });
  } else {
    await ctx.reply(privateWelcomeCaption());
  }

  await ctx.reply(subscriptionMessage(), {
    parse_mode: 'Markdown',
    reply_markup: buildSubscriptionMenu(config.subscriptionChats),
  });
}

function isSubscribed(member) {
  return ['creator', 'administrator', 'member'].includes(member?.status)
    || (member?.status === 'restricted' && member.is_member);
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

  try {
    const memberships = await Promise.all(config.subscriptionChats.map(({ chatId }) => (
      ctx.api.getChatMember({ chat_id: chatId, user_id: userId })
    )));
    const missing = memberships
      .map((member, index) => (isSubscribed(member) ? null : config.subscriptionChats[index].name))
      .filter(Boolean);
    if (missing.length) {
      await ctx.answerCallbackQuery({
        text: `${missing.join(', ')} 구독을 확인해 주세요.`,
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: '구독이 확인되었습니다.' });
    await sendPrivateMenu(ctx, config);
  } catch (error) {
    console.error('구독 여부 확인 실패:', error);
    await ctx.answerCallbackQuery({
      text: '구독 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      show_alert: true,
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

function registerMenuHandlers(bot, { config, isTargetGroup }) {
  const cache = {};

  bot.command('start', (ctx) => {
    if (ctx.chat?.type !== 'private') return undefined;
    return sendSubscriptionGate(ctx, config);
  });
  bot.on('callback_query', (ctx, next) => {
    if (ctx.callbackQuery?.data !== 'verify_subscriptions' || ctx.chat?.type !== 'private') return next();
    return verifySubscriptions(ctx, config);
  });
  bot.hears(/^\/(?:채널안내|메뉴)(?:@\w+)?\s*$/, async (ctx) => {
    if (ctx.chat?.type === 'private') return sendPrivateMenu(ctx, config);
    if (!isTargetGroup(ctx.chat)) return undefined;
    const username = await resolveBotUsername(ctx, cache);
    return sendGroupMenu(ctx, config, username);
  });
}

module.exports = {
  isSubscribed,
  registerMenuHandlers,
  resolveBotUsername,
  sendGroupMenu,
  sendPrivateMenu,
  sendSubscriptionGate,
  verifySubscriptions,
};
