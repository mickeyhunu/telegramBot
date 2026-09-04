const { fromPath } = require('node-telegram-bot-api/node');

const SEOUL_TIME_ZONE = 'Asia/Seoul';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function memberName(member) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ') || '이름 없음';
}

function joinedAtParts(unixTimestamp) {
  const joinedAt = new Date(unixTimestamp * 1000);
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(joinedAt);
  const part = (type) => dateParts.find((item) => item.type === type)?.value;
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(joinedAt);

  return {
    date: `${part('year')}. ${part('month')}. ${part('day')}.`,
    time,
  };
}

function welcomeCaption(member, unixTimestamp) {
  const { date, time } = joinedAtParts(unixTimestamp);
  const username = member.username ? `@${escapeHtml(member.username)}` : '없음';

  return [
    '<b>미드나잇맨즈 소통방에 오신것을 환영합니다.</b>',
    '',
    `• <b>사용자명</b> : ${escapeHtml(memberName(member))}`,
    `• <b>사용자 ID</b> : ${username}`,
    `• <b>고유번호</b> : <code>${member.id}</code>`,
    '',
    `• <b>입장일시</b> : <code>${date}</code>`,
    `• <b>입장시간</b> : <code>${escapeHtml(time)}</code>`,
    '',
    '<b>무단홍보❎</b>',
    '<b>금전거래 ❎</b>',
    '<b>도배 및 음란물❎</b>',
    '',
    '<b>규정위반시 그룹/채널</b>',
    '<b>영구제제입니다</b>',
  ].join('\n');
}

function registerGroupWelcomeHandler(bot, { chatId, photoPath, logger = console }) {
  bot.on('message', async (ctx, next) => {
    const members = ctx.message?.new_chat_members || [];
    const isWelcomeChat = chatId && String(ctx.chatId) === String(chatId);
    if (!isWelcomeChat || !['group', 'supergroup'].includes(ctx.chat?.type) || !members.length) {
      return next();
    }

    for (const member of members) {
      const caption = welcomeCaption(member, ctx.message.date);

      try {
        await ctx.api.sendPhoto({
          chat_id: ctx.chatId,
          photo: await fromPath(photoPath),
          caption,
          parse_mode: 'HTML',
        });
      } catch (error) {
        logger.warn(`환영 이미지 전송 실패, 텍스트로 재시도합니다 (${member.id}): ${error.message}`);

        try {
          await ctx.api.sendMessage({
            chat_id: ctx.chatId,
            text: caption,
            parse_mode: 'HTML',
          });
        } catch (fallbackError) {
          logger.error(`신규 멤버 환영 메시지 전송 실패 (${member.id}): ${fallbackError.message}`);
        }
      }
    }

    return undefined;
  });
}

module.exports = {
  joinedAtParts,
  registerGroupWelcomeHandler,
  welcomeCaption,
};
