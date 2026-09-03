async function getStores(databasePool) {
  if (!databasePool) throw new Error('CHATBOT 데이터베이스 연결 풀이 필요합니다.');

  const [rows] = await databasePool.execute(`
    SELECT storeNo, storeName, storeEmoji, storeAddress
    FROM INFO_STORE
    ORDER BY storeNo ASC
  `);

  return rows.filter(({ storeNo, storeName }) => storeNo != null && String(storeName || '').trim());
}

async function getStore(databasePool, storeNo) {
  if (!databasePool) throw new Error('CHATBOT 데이터베이스 연결 풀이 필요합니다.');

  const [rows] = await databasePool.execute(
    `SELECT store.storeNo, store.storeName, store.storeEmoji, store.storeAddress,
            room.roomInfo, room.waitInfo
     FROM INFO_STORE AS store
     LEFT JOIN INFO_ROOM AS room ON room.storeNo = store.storeNo
     WHERE store.storeNo = ?
     LIMIT 1`,
    [storeNo],
  );
  return rows[0] || null;
}

module.exports = { getStore, getStores };
