const { fromPath } = require('node-telegram-bot-api/node');
const { existsSync } = require('node:fs');

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
  logger.info('[welcome] handler registered', {
    configuredChatId: chatId || '(not configured)',
    photoPath,
    photoExists: Boolean(photoPath && existsSync(photoPath)),
  });

  bot.on('message', async (ctx, next) => {
    const members = ctx.message?.new_chat_members || [];
    const isWelcomeChat = chatId && String(ctx.chatId) === String(chatId);
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);

    if (!members.length) {
      return next();
    }

    logger.info('[welcome] new_chat_members update received', {
      updateId: ctx.update.update_id,
      chatId: ctx.chatId,
      chatType: ctx.chat?.type,
      configuredChatId: chatId || '(not configured)',
      memberIds: members.map(({ id }) => id),
    });

    if (!isWelcomeChat || !isGroup) {
      logger.warn('[welcome] update ignored', {
        reason: !chatId
          ? 'TELEGRAM_COMMUNITY_CHAT_ID is not configured'
          : (!isWelcomeChat ? 'chat ID does not match' : 'update is not from a group'),
        receivedChatId: ctx.chatId,
        configuredChatId: chatId || '(not configured)',
      });
      return next();
    }

    for (const member of members) {
      const caption = welcomeCaption(member, ctx.message.date);

      try {
        logger.info('[welcome] sending welcome photo', { chatId: ctx.chatId, memberId: member.id });
        await ctx.api.sendPhoto({
          chat_id: ctx.chatId,
          photo: await fromPath(photoPath),
          caption,
          parse_mode: 'HTML',
        });
        logger.info('[welcome] welcome photo sent', { chatId: ctx.chatId, memberId: member.id });
      } catch (error) {
        logger.warn('[welcome] photo failed; retrying with text', {
          chatId: ctx.chatId,
          memberId: member.id,
          error: error.message,
        });

        try {
          await ctx.api.sendMessage({
            chat_id: ctx.chatId,
            text: caption,
            parse_mode: 'HTML',
          });
          logger.info('[welcome] fallback text sent', { chatId: ctx.chatId, memberId: member.id });
        } catch (fallbackError) {
          logger.error('[welcome] fallback text failed', {
            chatId: ctx.chatId,
            memberId: member.id,
            error: fallbackError.message,
          });
        }
      }
    }

    return undefined;
  });

  // Telegram can emit this admin-only update even when the corresponding
  // new_chat_members service message is unavailable. Keep it diagnostic-only
  // to avoid sending duplicate welcome messages.
  bot.on('chat_member', (ctx, next) => {
    const event = ctx.update.chat_member;
    logger.info('[welcome] chat_member status update received', {
      updateId: ctx.update.update_id,
      chatId: ctx.chatId,
      configuredChatId: chatId || '(not configured)',
      userId: event.new_chat_member?.user?.id,
      oldStatus: event.old_chat_member?.status,
      newStatus: event.new_chat_member?.status,
      chatMatches: Boolean(chatId && String(ctx.chatId) === String(chatId)),
    });
    return next();
  });
}

module.exports = {
  joinedAtParts,
  registerGroupWelcomeHandler,
  welcomeCaption,
};
