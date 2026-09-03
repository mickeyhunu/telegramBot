const BUSINESS_ADS_ORDER = `
  CASE plan_type
    WHEN 'PREMIUM' THEN 1
    WHEN 'PLUS' THEN 2
    ELSE 3
  END ASC,
  COALESCE(jumped_at, '1970-01-01 00:00:00') DESC,
  id DESC
`;

async function getActiveBusinessAds(databasePool) {
  if (!databasePool) throw new Error('MNMS 데이터베이스 연결 풀이 필요합니다.');

  const [rows] = await databasePool.execute(`
    SELECT id, district, business_name, manager_name, telegram_id, manager_contact
    FROM business_ads
    WHERE is_active = 1
    ORDER BY ${BUSINESS_ADS_ORDER}
  `);

  return rows;
}

module.exports = { BUSINESS_ADS_ORDER, getActiveBusinessAds };
