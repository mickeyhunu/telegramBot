require('dotenv').config();

const { Bot, InlineKeyboardBuilder } = require('node-telegram-bot-api');
const { run } = require('node-telegram-bot-api/node');

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', async (ctx) => {
  const startMenu = new InlineKeyboardBuilder()
    .url('LIVE 현황 보기', 'https://nightmens.com/play')
    .row()
    .url('제휴업체 보기', 'https://nightmens.com/business-info')
    .build();

  await ctx.reply('원하시는 메뉴를 선택해 주세요.', {
    reply_markup: startMenu,
  });
});

run(bot);
