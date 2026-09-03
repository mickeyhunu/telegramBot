const { Api } = require('node-telegram-bot-api');

const { readTelegramConfig } = require('../config/telegram');

const ADMIN_STATUSES = new Set(['creator', 'administrator']);

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function inspectSubscriptionChat(api, chat, botId) {
  if (!chat.chatId) {
    return { ...chat, ok: false, problem: '채팅 ID 환경 변수가 비어 있습니다.' };
  }

  try {
    const [chatInfo, member] = await Promise.all([
      api.getChat({ chat_id: chat.chatId }),
      api.getChatMember({ chat_id: chat.chatId, user_id: botId }),
    ]);
    const isAdmin = ADMIN_STATUSES.has(member.status);

    return {
      ...chat,
      actualTitle: chatInfo.title || chatInfo.username || '(이름 없음)',
      chatType: chatInfo.type,
      memberStatus: member.status,
      ok: isAdmin,
      problem: isAdmin ? '' : '봇이 관리자가 아닙니다.',
    };
  } catch (error) {
    return { ...chat, ok: false, problem: `Telegram API 오류: ${formatError(error)}` };
  }
}

async function checkTelegramStatus({ api, env = process.env }) {
  const config = readTelegramConfig(env);
  const bot = await api.getMe();
  const chats = await Promise.all(config.subscriptionChats.map((chat) => (
    inspectSubscriptionChat(api, chat, bot.id)
  )));

  return { bot, chats, ok: chats.every((chat) => chat.ok) };
}

function printTelegramStatus(result, logger = console) {
  logger.log(`\nTelegram 봇: @${result.bot.username || '(username 없음)'} (ID: ${result.bot.id})`);
  logger.log(`그룹 일반 메시지 수신: ${result.bot.can_read_all_group_messages ? '가능' : '제한됨 (BotFather Privacy Mode 확인)'}`);

  result.chats.forEach((chat) => {
    logger.log(`\n[${chat.ok ? '정상' : '문제'}] ${chat.name}`);
    logger.log(`- 설정된 채팅 ID: ${chat.chatId || '(미설정)'}`);
    if (chat.actualTitle) logger.log(`- Telegram 채팅: ${chat.actualTitle} (${chat.chatType})`);
    if (chat.memberStatus) logger.log(`- 봇 권한 상태: ${chat.memberStatus}`);
    if (chat.problem) logger.log(`- 조치 필요: ${chat.problem}`);
  });

  logger.log(result.ok
    ? '\n결과: 모든 구독 채팅에서 봇의 관리자 상태를 확인했습니다.'
    : '\n결과: 설정 또는 관리자 권한에 문제가 있습니다. 위 항목을 수정한 뒤 다시 실행하세요.');
}

async function main(env = process.env) {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN 환경 변수가 필요합니다.');
  const result = await checkTelegramStatus({ api: new Api(env.BOT_TOKEN), env });
  printTelegramStatus(result);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  require('dotenv').config();
  main().catch((error) => {
    console.error(`Telegram 상태 확인 실패: ${formatError(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  checkTelegramStatus,
  inspectSubscriptionChat,
  printTelegramStatus,
};
