const { getChoiceMessage } = require('./choiceMessages');

async function getChojoongMessages(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    `SELECT chojoongMsg
     FROM LIVE_CHOJOONG_HISTORY
     WHERE storeNo = ?
     ORDER BY chojoongNo DESC
     LIMIT 5`,
    [storeNo],
  );

  return rows
    .map(({ chojoongMsg }) => String(chojoongMsg || '').trim())
    .filter(Boolean);
}

async function getLiveInformation(databasePool, action, store) {
  if (action === 'choice') return getChoiceMessage(databasePool, store.storeNo);
  if (action === 'search') return getChojoongMessages(databasePool, store.storeNo);
  if (action === 'waiting') return { roomInfo: store.roomInfo, waitInfo: store.waitInfo };
  throw new Error(`지원하지 않는 LIVE 정보입니다: ${action}`);
}

module.exports = { getChojoongMessages, getLiveInformation };
