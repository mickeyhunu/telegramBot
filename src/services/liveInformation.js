const { getChoiceMessage } = require('./choiceMessages');

async function getChojoongMessages(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    `SELECT chojoongMsg, createdAt
     FROM LIVE_CHOJOONG_HISTORY
     WHERE storeNo = ?
     ORDER BY createdAt DESC
     LIMIT 5`,
    [storeNo],
  );

  return rows
    .map(({ chojoongMsg, createdAt }) => ({
      message: String(chojoongMsg || '').trim(),
      createdAt,
    }))
    .filter(({ message }) => Boolean(message));
}

async function getLiveInformation(databasePool, action, store) {
  if (action === 'choice') return getChoiceMessage(databasePool, store.storeNo);
  if (action === 'search') return getChojoongMessages(databasePool, store.storeNo);
  if (action === 'waiting') return { roomInfo: store.roomInfo, waitInfo: store.waitInfo };
  throw new Error(`지원하지 않는 LIVE 정보입니다: ${action}`);
}

module.exports = { getChojoongMessages, getLiveInformation };
