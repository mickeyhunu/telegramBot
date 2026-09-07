function commandMessage(ctx) {
  return ctx.message || ctx.channelPost;
}

function registerIdentifierHandlers(bot) {
  bot.command('msgidd', (ctx) => {
    const repliedMessage = commandMessage(ctx)?.reply_to_message;
    if (!repliedMessage) {
      return ctx.reply('아이디를 확인할 메시지에 답장한 다음 /msgidd를 입력해 주세요.');
    }

    return ctx.reply(`메시지 ID: ${repliedMessage.message_id}`);
  });

  bot.command('chatidd', (ctx) => ctx.reply(`채팅 ID: ${ctx.chat.id}`));
}

module.exports = { commandMessage, registerIdentifierHandlers };
