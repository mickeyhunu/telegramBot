const MODERATION_COMMAND = /^\/(경고초기화|경고|뮤트해제|뮤트|강퇴|밴)(?:@[A-Za-z0-9_]+)?(?:\s+(@?[A-Za-z0-9_]+))?(?:\s+(\S+))?\s*$/u;

const MUTED_PERMISSIONS = Object.freeze({
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
});

const UNMUTED_PERMISSIONS = Object.freeze({
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
});

const MAX_MUTE_MINUTES = 365 * 24 * 60;

function displayName(user) {
  if (user.username) return `@${user.username}`;
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.id);
}

function storedUser(member) {
  return member && {
    id: member.userId,
    username: member.username,
    first_name: member.firstName,
    last_name: member.lastName,
    is_bot: member.isBot,
    language_code: member.languageCode,
  };
}

function isAnonymousGroupAdministrator(ctx) {
  const senderChat = ctx.message?.sender_chat;
  return senderChat
    && ['group', 'supergroup'].includes(senderChat.type)
    && String(senderChat.id) === String(ctx.chatId);
}

async function isAdministrator(ctx) {
  // Telegram replaces `from` with the GroupAnonymousBot account when an
  // administrator sends as the group. In that case sender_chat identifies the
  // current group and is sufficient proof that Telegram accepted the sender as
  // an anonymous administrator. Do not run getChatMember for the placeholder
  // account, because its status is not administrator and every command would be
  // silently ignored.
  if (isAnonymousGroupAdministrator(ctx)) return true;
  if (!ctx.from?.id) return false;

  const actor = await ctx.api.getChatMember({ chat_id: ctx.chatId, user_id: ctx.from.id });
  return ['creator', 'administrator'].includes(actor.status);
}

async function resolveTarget(ctx, memberStore, targetText) {
  const repliedUser = ctx.message?.reply_to_message?.from;
  if (repliedUser) return repliedUser;
  if (!targetText) return null;

  if (/^\d+$/.test(targetText)) {
    const userId = Number(targetText);
    return storedUser(await memberStore.getMember(ctx.chatId, userId)) || { id: userId };
  }

  return storedUser(await memberStore.findMemberByUsername(ctx.chatId, targetText));
}

function registerGroupModerationHandler(bot, { chatId, memberStore, logger = console }) {
  bot.on('message', async (ctx, next) => {
    const match = MODERATION_COMMAND.exec(ctx.message?.text || '');
    if (!match) return next();

    const isConfiguredGroup = chatId
      && String(ctx.chatId) === String(chatId)
      && ['group', 'supergroup'].includes(ctx.chat?.type);
    if (!isConfiguredGroup) return next();

    try {
      if (!await isAdministrator(ctx)) {
        return undefined;
      }

      const [, command, targetText, durationText] = match;
      const durationMinutes = durationText === undefined ? null : Number(durationText);
      if (command === '뮤트' && durationText !== undefined
        && (!/^\d+$/.test(durationText)
          || !Number.isSafeInteger(durationMinutes)
          || durationMinutes < 1
          || durationMinutes > MAX_MUTE_MINUTES)) {
        await ctx.reply(`뮤트 시간은 1~${MAX_MUTE_MINUTES} 사이의 숫자(분)로 입력해 주세요. 예: /뮤트 @아이디 30`);
        return undefined;
      }
      if (command !== '뮤트' && durationText !== undefined) {
        return undefined;
      }
      const target = await resolveTarget(ctx, memberStore, targetText);
      if (!target) {
        await ctx.reply('대상을 찾을 수 없습니다. 명령어 뒤에 @아이디를 입력하거나 대상 메시지에 답장해 주세요.');
        return undefined;
      }
      if (target.id === ctx.from.id) {
        await ctx.reply('본인에게는 이 명령어를 사용할 수 없습니다.');
        return undefined;
      }

      const membership = await ctx.api.getChatMember({ chat_id: ctx.chatId, user_id: target.id });
      if (['creator', 'administrator'].includes(membership.status)) {
        await ctx.reply('다른 관리자에게는 이 명령어를 사용할 수 없습니다.');
        return undefined;
      }

      if (command === '경고') {
        // Load lazily to keep the shared warning escalation code independent
        // while groupSpam imports this module's Telegram permission constants.
        const { applyWarning } = require('./groupSpam');
        await applyWarning(ctx, memberStore, target, '관리자 수동 경고', ctx.from?.id || null);
        return undefined;
      }
      if (command === '경고초기화') {
        await memberStore.resetWarnings(ctx.chatId, target);
        await ctx.reply(`✅ ${displayName(target)}님의 누적 경고를 0회로 초기화했습니다.`);
        return undefined;
      }

      let action;
      let result;
      let moderationDetails;
      if (command === '뮤트' || command === '뮤트해제') {
        const muted = command === '뮤트';
        action = muted ? 'mute' : 'unmute';
        const mutedUntil = muted && durationMinutes
          ? ctx.message.date + (durationMinutes * 60)
          : null;
        moderationDetails = mutedUntil ? { mutedUntil } : undefined;
        result = muted
          ? `🔊 ${durationMinutes ? `${durationMinutes}분간 ` : ''}뮤트 처리했습니다. 채팅이 제한됩니다.`
          : '🔊 뮤트를 해제했습니다.';
        await ctx.api.restrictChatMember({
          chat_id: ctx.chatId,
          user_id: target.id,
          permissions: muted ? MUTED_PERMISSIONS : UNMUTED_PERMISSIONS,
          ...(mutedUntil ? { until_date: mutedUntil } : {}),
        });
      } else if (command === '강퇴') {
        action = 'kick';
        result = '👢 강퇴했습니다.';
        await ctx.api.banChatMember({ chat_id: ctx.chatId, user_id: target.id });
        await ctx.api.unbanChatMember({ chat_id: ctx.chatId, user_id: target.id, only_if_banned: true });
      } else {
        action = 'ban';
        result = '🚫 밴 처리했습니다.';
        await ctx.api.banChatMember({ chat_id: ctx.chatId, user_id: target.id });
      }

      await memberStore.recordModeration(
        ctx.chatId,
        target,
        action,
        ctx.message.date,
        moderationDetails,
      );
      await ctx.reply(`${displayName(target)}님을 ${result}`);
    } catch (error) {
      logger.error(`그룹 관리 명령 처리 실패 (${ctx.chatId}:${ctx.from?.id}): ${error.message}`);
      await ctx.reply('명령을 처리하지 못했습니다. 봇의 관리자 권한을 확인해 주세요.');
    }
    return undefined;
  });
}

module.exports = {
  MODERATION_COMMAND,
  MAX_MUTE_MINUTES,
  MUTED_PERMISSIONS,
  UNMUTED_PERMISSIONS,
  registerGroupModerationHandler,
  resolveTarget,
};
