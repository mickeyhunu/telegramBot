const { getDatabaseStatuses } = require('../services/database');

function registerSystemHandlers(bot, pools) {
  bot.command('chatid', (ctx) => ctx.reply(`현재 채팅 ID: ${ctx.chatId}`));
  bot.command('dbinfo', async (ctx) => {
    const statuses = await getDatabaseStatuses(pools);
    const message = statuses.map(({ key, databaseName, serverTime }) => [
      `[${key.toUpperCase()}]`,
      `데이터베이스: ${databaseName}`,
      `서버 시간: ${new Date(serverTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    ].join('\n')).join('\n\n');
    await ctx.reply(message);
  });
}

module.exports = { registerSystemHandlers };
