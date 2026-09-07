const { webcrypto } = require('node:crypto');

// Node.js 18 does not consistently expose Web Crypto as a global in script
// execution. The Telegram client's multipart encoder expects it when uploading
// files, so install Node's built-in implementation before loading the client.
if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  globalThis.crypto = webcrypto;
}

const { fromPath } = require('node-telegram-bot-api/node');

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const WELCOME_DEDUPLICATION_MS = 30_000;
const NEW_MEMBER_LINK_RESTRICTION_MS = 10 * 60 * 1000;
const LINK_ENTITY_TYPES = new Set(['url', 'text_link']);

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
  }).format(joinedAt)
    .replace(/^AM\s/, '오전 ')
    .replace(/^PM\s/, '오후 ');

  return {
    date: `${part('year')}. ${part('month')}. ${part('day')}.`,
    time,
  };
}

function welcomeCaption(member, unixTimestamp, links = {}) {
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
    '<b>❎ 불법촬영물(몰카) 절때금지</b>',
    '<b>❎ 금액공유 절때금지</b>',
    '<b>❎ 무단홍보 절때금지</b>',
    '<b>❎ 금전거래 절때금지</b>',
    '<b>❎ 도배 및 음란물 절때금지</b>',
    '',
    '<b>규정위반시 그룹/채널</b>',
    '<b>영구제제입니다</b>',
    '',
    '<a href="https://t.me/mnmens_bot"><b>[ 미드나잇맨즈봇 사용하기 ]</b></a>',
    `<a href="${escapeHtml(links.website)}"><b>[ 미드나잇맨즈 바로가기 ]</b></a>`,
  ].join('\n');
}

function isCurrentMember(chatMember) {
  if (!chatMember) return false;
  if (chatMember.status === 'restricted') return chatMember.is_member === true;
  return ['creator', 'administrator', 'member'].includes(chatMember.status);
}

function isJoinTransition(event) {
  return !isCurrentMember(event.old_chat_member) && isCurrentMember(event.new_chat_member);
}

function messageContainsLink(message) {
  return [...(message?.entities || []), ...(message?.caption_entities || [])]
    .some(({ type }) => LINK_ENTITY_TYPES.has(type));
}

function registerGroupWelcomeHandler(bot, {
  chatId,
  photoPath,
  memberStore,
  links,
  logger = console,
}) {
  const recentlyWelcomed = new Map();

  async function saveJoin(currentChatId, member, joinedAt, status = 'member') {
    const restrictedUntil = (joinedAt * 1000) + NEW_MEMBER_LINK_RESTRICTION_MS;
    await memberStore.recordJoin(currentChatId, member, joinedAt, restrictedUntil, status);
  }

  async function isLinkRestricted(currentChatId, userId) {
    const member = await memberStore.getMember(currentChatId, userId);
    const restrictedUntil = member?.moderation?.linkPostingRestrictedUntil;
    return restrictedUntil ? Date.now() < new Date(restrictedUntil).getTime() : false;
  }

  async function sendWelcome(ctx, member, unixTimestamp) {
    const deduplicationKey = `${ctx.chatId}:${member.id}`;
    const now = Date.now();
    const lastSentAt = recentlyWelcomed.get(deduplicationKey);

    if (lastSentAt && now - lastSentAt < WELCOME_DEDUPLICATION_MS) {
      return;
    }

    // Reserve the key before awaiting the API so message and chat_member
    // updates arriving together cannot both send a welcome.
    recentlyWelcomed.set(deduplicationKey, now);
    const expiration = setTimeout(() => {
      if (recentlyWelcomed.get(deduplicationKey) === now) {
        recentlyWelcomed.delete(deduplicationKey);
      }
    }, WELCOME_DEDUPLICATION_MS);
    expiration.unref?.();
    const caption = welcomeCaption(member, unixTimestamp, links);

    try {
      await ctx.api.sendPhoto({
        chat_id: ctx.chatId,
        photo: await fromPath(photoPath),
        caption,
        parse_mode: 'HTML',
      });
    } catch {
      try {
        await ctx.api.sendMessage({
          chat_id: ctx.chatId,
          text: caption,
          parse_mode: 'HTML',
        });
      } catch {
        recentlyWelcomed.delete(deduplicationKey);
      }
    }
  }

  bot.on('message', async (ctx, next) => {
    const members = ctx.message?.new_chat_members || [];
    const isWelcomeChat = chatId && String(ctx.chatId) === String(chatId);
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);

    if (!isWelcomeChat || !isGroup) {
      return next();
    }

    if (!members.length) {
      if (!ctx.from?.id || !messageContainsLink(ctx.message)) {
        return next();
      }

      let restricted;
      try {
        restricted = await isLinkRestricted(ctx.chatId, ctx.from.id);
      } catch (error) {
        logger.error(`그룹 회원 정보 조회 실패 (${ctx.chatId}:${ctx.from.id}): ${error.message}`);
        return next();
      }
      if (!restricted) return next();

      try {
        await ctx.api.deleteMessage({
          chat_id: ctx.chatId,
          message_id: ctx.message.message_id,
        });
      } catch (error) {
        logger.warn(`신규 회원 링크 메시지 삭제 실패 (${ctx.chatId}:${ctx.from.id}): ${error.message}`);
      }
      return undefined;
    }

    for (const member of members) {
      try {
        await saveJoin(ctx.chatId, member, ctx.message.date);
      } catch (error) {
        logger.error(`신규 회원 정보 저장 실패 (${ctx.chatId}:${member.id}): ${error.message}`);
      }
      await sendWelcome(ctx, member, ctx.message.date);
    }

    return undefined;
  });

  // Telegram can emit this admin-only update even when the corresponding
  // new_chat_members service message is unavailable.
  bot.on('chat_member', async (ctx, next) => {
    const event = ctx.update.chat_member;
    const isWelcomeChat = chatId && String(ctx.chatId) === String(chatId);
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);
    const joined = isJoinTransition(event);

    if (isWelcomeChat && isGroup) {
      const member = event.new_chat_member.user;
      try {
        if (joined) {
          await saveJoin(ctx.chatId, member, event.date, event.new_chat_member.status);
        } else {
          await memberStore.recordMembershipStatus(
            ctx.chatId,
            member,
            event.new_chat_member.status,
            event.date,
          );
        }
      } catch (error) {
        logger.error(`그룹 회원 상태 저장 실패 (${ctx.chatId}:${member.id}): ${error.message}`);
      }
      if (joined) await sendWelcome(ctx, member, event.date);
    }

    return next();
  });
}

module.exports = {
  joinedAtParts,
  registerGroupWelcomeHandler,
  welcomeCaption,
};
