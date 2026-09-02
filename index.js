require('dotenv').config();

const { Bot, InlineKeyboardBuilder } = require('node-telegram-bot-api');
const { run } = require('node-telegram-bot-api/node');
const { createDatabasePools, getDatabaseStatuses } = require('./database');
const { createChoiceMessageHandler } = require('./choiceMessages');

const GROUP_NAME = '미드나잇맨즈 소통방';
const WEBSITE_URL = 'https://nightmens.com/';

function buildStartMenu() {
  return new InlineKeyboardBuilder()
    .url('미드나잇맨즈 LIVE', `${WEBSITE_URL}play`)
    .row()
    .url('미드나잇맨즈 제휴업체', `${WEBSITE_URL}business-info`)
    .build();
}

function buildGroupMenu(botUsername) {
  const botUrl = `https://t.me/${botUsername}?start=menu`;
  return new InlineKeyboardBuilder()
    .url('미드나잇맨즈 LIVE', botUrl)
    .row()
    .url('미드나잇맨즈 제휴업체', botUrl)
    .build();
}

function readTargetGroupIds(env = process.env) {
  return new Set((env.TELEGRAM_GROUP_IDS || env.TELEGRAM_GROUP_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean));
}

function normalizeGroupTitle(title = '') {
  return title
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTargetGroup(chat, env = process.env) {
  if (!['group', 'supergroup'].includes(chat?.type)) return false;

  const targetGroupIds = readTargetGroupIds(env);
  if (targetGroupIds.size) return targetGroupIds.has(String(chat.id));

  // Telegram group titles are editable. Keep the bot working when an emoji,
  // decoration, or accidental extra whitespace is added around the known name.
  return normalizeGroupTitle(chat.title).includes(GROUP_NAME);
}

function createBot(token, { databasePools } = {}) {
  if (!token) throw new Error('BOT_TOKEN 환경 변수가 필요합니다.');
  const pools = databasePools || createDatabasePools();

  const bot = new Bot(token);
  let botUsername;

  bot.on('message', createChoiceMessageHandler({
    databasePool: pools.chatbot,
    isAllowedChat: isTargetGroup,
  }));

  bot.command('start', async (ctx) => {
    await ctx.reply([
      '미드나잇맨즈 봇에 오신 것을 환영합니다.',
      '',
      '사용 가능한 명령어',
      '• /start - 봇 안내와 메뉴 보기',
      `• /메뉴 - ${GROUP_NAME}에서 봇 메뉴 열기`,
      '• /chatid - 현재 채팅 ID 확인',
      '• /dbinfo - 연결된 데이터베이스 정보 보기',
      '',
      '원하시는 메뉴를 선택해 주세요.',
    ].join('\n'), { reply_markup: buildStartMenu() });
  });

  bot.command('chatid', async (ctx) => {
    await ctx.reply(`현재 채팅 ID: ${ctx.chatId}`);
  });

  bot.command('dbinfo', async (ctx) => {
    const statuses = await getDatabaseStatuses(pools);
    const message = statuses.map(({ key, databaseName, serverTime }) => [
      `[${key.toUpperCase()}]`,
      `데이터베이스: ${databaseName}`,
      `서버 시간: ${new Date(serverTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    ].join('\n')).join('\n\n');
    await ctx.reply(message);
  });

  bot.hears(/^\/메뉴(?:@\w+)?\s*$/, async (ctx) => {
    if (!isTargetGroup(ctx.chat)) return;

    if (!botUsername) {
      const me = await ctx.api.getMe();
      botUsername = me.username;
    }

    await ctx.reply('봇 채팅방에서 확인할 메뉴를 선택해 주세요.', {
      reply_markup: buildGroupMenu(botUsername),
    });
  });

  bot.on('message', async (ctx, next) => {
    const newMembers = ctx.message?.new_chat_members;
    if (!isTargetGroup(ctx.chat) || !newMembers?.length) return next();

    const caption = `${GROUP_NAME}에 오신것을 환영합니다`;
    const replyMarkup = new InlineKeyboardBuilder()
      .url('미드나잇맨즈 바로가기', WEBSITE_URL)
      .build();

    const group = await ctx.api.getChat({ chat_id: ctx.chatId });
    if (group.photo?.big_file_id) {
      await ctx.api.sendPhoto({
        chat_id: ctx.chatId,
        photo: group.photo.big_file_id,
        caption,
        reply_markup: replyMarkup,
      });
    } else {
      await ctx.reply(caption, { reply_markup: replyMarkup });
    }
  });

  bot.catch((error) => console.error('Telegram bot handler failed:', error));
  return bot;
}

if (require.main === module) run(createBot(process.env.BOT_TOKEN));

module.exports = {
  GROUP_NAME,
  WEBSITE_URL,
  buildGroupMenu,
  buildStartMenu,
  createBot,
  isTargetGroup,
  normalizeGroupTitle,
  readTargetGroupIds,
};
