const { MUTED_PERMISSIONS } = require('./groupModeration');

const FLOOD_WINDOW_SECONDS = 15;
const FLOOD_MESSAGE_LIMIT = 10;
const REPEATED_MESSAGE_LIMIT = 3;
const WARNING_MUTE_MINUTES = 10;

function normalizeMessage(text) {
  return String(text || '').normalize('NFKC').toLowerCase()
    .replace(/https?:\/\/\S+/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 500);
}

function bigrams(value) {
  if (value.length < 2) return new Set([value]);
  return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
}

function isSimilarMessage(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 4) return false;
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  let intersection = 0;
  leftBigrams.forEach((item) => {
    if (rightBigrams.has(item)) intersection += 1;
  });
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size) >= 0.8;
}

function createSpamTracker() {
  const activity = new Map();
  return {
    inspect(chatId, userId, text, timestamp) {
      const key = `${chatId}:${userId}`;
      const normalized = normalizeMessage(text);
      const previous = activity.get(key) || { timestamps: [], lastMessage: '', repeated: 0 };
      const timestamps = previous.timestamps.filter((item) => timestamp - item < FLOOD_WINDOW_SECONDS);
      timestamps.push(timestamp);
      const repeated = normalized && isSimilarMessage(previous.lastMessage, normalized)
        ? previous.repeated + 1 : 1;
      const result = { timestamps, lastMessage: normalized, repeated };
      let reason = null;
      if (timestamps.length >= FLOOD_MESSAGE_LIMIT) reason = '15초 동안 메시지 10개 이상 전송';
      else if (repeated >= REPEATED_MESSAGE_LIMIT) reason = '동일하거나 유사한 문구 반복 전송';

      if (reason) {
        result.timestamps = [];
        result.repeated = 0;
        result.lastMessage = '';
      }
      activity.set(key, result);
      return reason;
    },
  };
}

function displayName(user) {
  return user.username ? `@${user.username}`
    : [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.id);
}

async function applyWarning(ctx, memberStore, user, reason, issuedBy = null) {
  const member = await memberStore.recordWarning(
    ctx.chatId, user, reason, ctx.message.date, issuedBy,
  );
  const warningCount = member.moderation.warningCount;
  const name = displayName(user);

  if (warningCount >= 3) {
    await ctx.api.banChatMember({ chat_id: ctx.chatId, user_id: user.id });
    await memberStore.recordModeration(ctx.chatId, user, 'ban', ctx.message.date);
    await ctx.reply(`🚫 ${name}님 경고 ${warningCount}회 누적으로 밴 처리했습니다.\n사유: ${reason}`);
    return { warningCount, action: 'ban' };
  }
  if (warningCount === 2) {
    const mutedUntil = ctx.message.date + (WARNING_MUTE_MINUTES * 60);
    await ctx.api.restrictChatMember({
      chat_id: ctx.chatId,
      user_id: user.id,
      permissions: MUTED_PERMISSIONS,
      until_date: mutedUntil,
    });
    await memberStore.recordModeration(ctx.chatId, user, 'mute', ctx.message.date, { mutedUntil });
    await ctx.reply(`🔇 ${name}님 경고 2회 누적으로 ${WARNING_MUTE_MINUTES}분간 채팅을 제한합니다.\n사유: ${reason}`);
    return { warningCount, action: 'mute' };
  }

  await ctx.reply(`⚠️ ${name}님에게 경고했습니다. (1/3)\n사유: ${reason}`);
  return { warningCount, action: 'warning' };
}

function registerGroupSpamHandler(bot, { chatId, memberStore, logger = console, tracker = createSpamTracker() }) {
  bot.on('message', async (ctx, next) => {
    const message = ctx.message;
    const text = message?.text || message?.caption;
    const isConfiguredGroup = chatId && String(ctx.chatId) === String(chatId)
      && ['group', 'supergroup'].includes(ctx.chat?.type);
    if (!isConfiguredGroup || !ctx.from?.id || ctx.from.is_bot || !text || text.startsWith('/')) return next();

    const reason = tracker.inspect(ctx.chatId, ctx.from.id, text, message.date);
    if (!reason) return next();
    try {
      const membership = await ctx.api.getChatMember({ chat_id: ctx.chatId, user_id: ctx.from.id });
      if (['creator', 'administrator'].includes(membership.status)) return next();
      await applyWarning(ctx, memberStore, ctx.from, reason);
    } catch (error) {
      logger.error(`자동 도배 관리 실패 (${ctx.chatId}:${ctx.from.id}): ${error.message}`);
    }
    return undefined;
  });
}

module.exports = {
  FLOOD_MESSAGE_LIMIT,
  FLOOD_WINDOW_SECONDS,
  REPEATED_MESSAGE_LIMIT,
  WARNING_MUTE_MINUTES,
  applyWarning,
  createSpamTracker,
  isSimilarMessage,
  normalizeMessage,
  registerGroupSpamHandler,
};
