const STORE_NUMBERS = Object.freeze({
  달: 1,
  엘: 2,
  디: 3,
  유: 4,
  도: 5,
  제: 6,
  갤: 21,
});

async function getChoiceMessage(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    'SELECT choiceMsg FROM INFO_CHOICE WHERE storeNo = ? LIMIT 1',
    [storeNo],
  );
  return rows[0]?.choiceMsg || null;
}

function createChoiceMessageHandler({ databasePool, isAllowedChat, logger = console }) {
  if (!databasePool) throw new Error('CHATBOT 데이터베이스 연결 풀이 필요합니다.');
  if (!isAllowedChat) throw new Error('초이스톡 허용 채팅 확인 함수가 필요합니다.');

  return async function handleChoiceMessage(ctx, next = () => {}) {
    if (!isAllowedChat(ctx.chat)) return next();

    const storeNo = STORE_NUMBERS[ctx.message?.text?.trim()];
    if (!storeNo) return next();

    try {
      const choiceMessage = await getChoiceMessage(databasePool, storeNo);
      await ctx.reply(choiceMessage || '준비중입니다...');
    } catch (error) {
      logger.error(`초이스톡 조회 실패 (${storeNo}): ${error.message}`);
      await ctx.reply('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    return next();
  };
}

module.exports = { STORE_NUMBERS, createChoiceMessageHandler, getChoiceMessage };
