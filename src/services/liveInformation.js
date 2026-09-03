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

async function getTodayEntries(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    `SELECT workerName, mentionCount, insertCount, createdAt
     FROM ENTRY_TODAY
     WHERE storeNo = ?
     ORDER BY createdAt ASC`,
    [storeNo],
  );

  return rows.map(({
    workerName, mentionCount, insertCount, createdAt,
  }) => ({
    workerName: String(workerName || '').trim(),
    score: (Number(mentionCount) || 0) * 5 + (Number(insertCount) || 0),
    createdAt,
  })).filter(({ workerName }) => Boolean(workerName));
}

async function getAllDayEntryCount(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    `SELECT COUNT(*) AS entryCount
     FROM ENTRY_ALLDAY
     WHERE storeNo = ?`,
    [storeNo],
  );

  return Number(rows[0]?.entryCount) || 0;
}

async function getLiveInformation(databasePool, action, store) {
  if (action === 'choice') return getChoiceMessage(databasePool, store.storeNo);
  if (action === 'search') return getChojoongMessages(databasePool, store.storeNo);
  if (action === 'entry') return getTodayEntries(databasePool, store.storeNo);
  if (action === 'workers') return getAllDayEntryCount(databasePool, store.storeNo);
  if (action === 'waiting') {
    return { roomInfo: store.roomInfo, waitInfo: store.waitInfo, updatedAt: store.updatedAt };
  }
  throw new Error(`지원하지 않는 LIVE 정보입니다: ${action}`);
}

module.exports = {
  getAllDayEntryCount,
  getChojoongMessages,
  getLiveInformation,
  getTodayEntries,
};
