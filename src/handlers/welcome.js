const { buildWelcomeButton } = require('../ui/keyboards');

function registerWelcomeHandler(bot, { config, isTargetGroup }) {
  bot.on('message', async (ctx, next) => {
    const newMembers = ctx.message?.new_chat_members;
    if (!isTargetGroup(ctx.chat) || !newMembers?.length) return next();

    const options = {
      caption: `${config.groupName}에 오신 것을 환영합니다.`,
      reply_markup: buildWelcomeButton(config.links),
    };
    const group = await ctx.api.getChat({ chat_id: ctx.chatId });
    if (group.photo?.big_file_id) {
      await ctx.api.sendPhoto({ chat_id: ctx.chatId, photo: group.photo.big_file_id, ...options });
    } else {
      await ctx.reply(options.caption, { reply_markup: options.reply_markup });
    }
    return next();
  });
}

module.exports = { registerWelcomeHandler };
