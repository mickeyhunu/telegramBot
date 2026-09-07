const SUPPORTED_CHAT_TYPES = new Set(['group', 'supergroup', 'channel']);

function isActiveMembership(chatMember) {
  if (!chatMember) return false;
  if (chatMember.status === 'restricted') return chatMember.is_member === true;
  return ['creator', 'administrator', 'member'].includes(chatMember.status);
}

function isBotEntry(event) {
  return Boolean(event)
    && !isActiveMembership(event.old_chat_member)
    && isActiveMembership(event.new_chat_member);
}

function chatEntryDetails(event) {
  const chat = event.chat;
  const actor = event.from;

  return {
    id: chat.id,
    type: chat.type,
    title: chat.title || null,
    username: chat.username ? `@${chat.username}` : null,
    description: chat.description || null,
    inviteLink: chat.invite_link || null,
    memberStatus: event.new_chat_member.status,
    addedAt: new Date(event.date * 1000).toISOString(),
    addedBy: actor ? {
      id: actor.id,
      username: actor.username ? `@${actor.username}` : null,
      name: [actor.first_name, actor.last_name].filter(Boolean).join(' ') || null,
    } : null,
  };
}

function registerChatEntryLogger(bot, { usageStore, logger = console } = {}) {
  bot.on('my_chat_member', async (ctx, next) => {
    const event = ctx.update.my_chat_member;

    if (SUPPORTED_CHAT_TYPES.has(event.chat.type) && isBotEntry(event)) {
      const details = chatEntryDetails(event);
      logger.log('[chat-entry] 봇이 채팅에 추가되었습니다:', details);
      try {
        await usageStore?.recordChat(details);
      } catch (error) {
        logger.error(`[chat-entry] 채팅 정보 저장 실패 (${event.chat.id}): ${error.message}`);
      }
    }

    return next();
  });
}

module.exports = {
  chatEntryDetails,
  isBotEntry,
  registerChatEntryLogger,
};
