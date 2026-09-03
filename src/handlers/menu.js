const { buildGroupMenu, buildPrivateMenu } = require('../ui/keyboards');
const { groupGuideCaption, privateGuideMessage } = require('../ui/messages');

async function resolveBotUsername(ctx, cache) {
  if (!cache.username) cache.username = (await ctx.api.getMe()).username;
  return cache.username;
}

async function sendPrivateMenu(ctx, config) {
  await ctx.reply(privateGuideMessage(), { reply_markup: buildPrivateMenu(config.links) });
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
    return sendPrivateMenu(ctx, config);
  });
  bot.hears(/^\/(?:채널안내|메뉴)(?:@\w+)?\s*$/, async (ctx) => {
    if (ctx.chat?.type === 'private') return sendPrivateMenu(ctx, config);
    if (!isTargetGroup(ctx.chat)) return undefined;
    const username = await resolveBotUsername(ctx, cache);
    return sendGroupMenu(ctx, config, username);
  });
}

module.exports = { registerMenuHandlers, resolveBotUsername, sendGroupMenu, sendPrivateMenu };
