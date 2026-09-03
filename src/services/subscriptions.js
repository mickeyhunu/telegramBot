const SUBSCRIBED_STATUSES = new Set(['creator', 'administrator', 'member']);

function isSubscribed(member) {
  return SUBSCRIBED_STATUSES.has(member?.status)
    || (member?.status === 'restricted' && member.is_member === true);
}

async function checkSubscriptions(api, subscriptionChats, userId) {
  const results = await Promise.allSettled(subscriptionChats.map(({ chatId }) => (
    api.getChatMember({ chat_id: chatId, user_id: userId })
  )));

  return results.reduce((summary, result, index) => {
    const chat = subscriptionChats[index];
    if (result.status === 'rejected') {
      summary.failed.push({ chat, error: result.reason });
    } else if (!isSubscribed(result.value)) {
      summary.missing.push(chat);
    }
    return summary;
  }, { failed: [], missing: [] });
}

function logSubscriptionFailures(failed, logger = console) {
  logger.error('Telegram 구독 조회 실패:', failed.map(({ chat, error }) => ({
    chat: chat.name,
    chatId: chat.chatId,
    error: error instanceof Error ? error.message : String(error),
  })));
}

async function hasActiveSubscriptions(ctx, config, logger = console) {
  const userId = ctx.from?.id;
  if (!userId || config.subscriptionChats.some(({ chatId }) => !chatId)) return false;

  const result = await checkSubscriptions(ctx.api, config.subscriptionChats, userId);
  if (result.failed.length) logSubscriptionFailures(result.failed, logger);
  return result.failed.length === 0 && result.missing.length === 0;
}

function createSubscriptionGuard({ config, onRejected, logger = console }) {
  if (!config) throw new Error('Telegram 설정이 필요합니다.');
  if (!onRejected) throw new Error('구독 실패 안내 함수가 필요합니다.');

  return async function requireSubscriptions(ctx, next) {
    let subscribed = false;
    try {
      subscribed = await hasActiveSubscriptions(ctx, config, logger);
    } catch (error) {
      logger.error('구독 여부 확인 처리 실패:', error);
    }

    if (!subscribed) {
      await onRejected(ctx, config);
      return undefined;
    }
    return next();
  };
}

module.exports = {
  checkSubscriptions,
  createSubscriptionGuard,
  hasActiveSubscriptions,
  isSubscribed,
  logSubscriptionFailures,
};
