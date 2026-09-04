async function getChoiceMessage(databasePool, storeNo) {
  const [rows] = await databasePool.execute(
    'SELECT choiceMsg, createdAt FROM INFO_CHOICE WHERE storeNo = ? LIMIT 1',
    [storeNo],
  );
  if (!rows[0]?.choiceMsg) return null;
  return { message: rows[0].choiceMsg, createdAt: rows[0].createdAt };
}

module.exports = { getChoiceMessage };
