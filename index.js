require('dotenv').config();

const { Bot } = require('node-telegram-bot-api');
const { run } = require('node-telegram-bot-api/node');

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', async (ctx) => {
  await ctx.reply('안녕하세요. 텔레그램 봇입니다.');
});

run(bot);