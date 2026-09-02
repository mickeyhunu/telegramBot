const mysql = require('mysql2/promise');

const DATABASE_PREFIXES = ['MNMS', 'CHATBOT'];

function readDatabaseConfig(prefix, env = process.env) {
  const config = {
    host: env[`${prefix}_MYSQL_HOST`],
    port: Number(env[`${prefix}_MYSQL_PORT`] || 3306),
    user: env[`${prefix}_MYSQL_USER`],
    password: env[`${prefix}_MYSQL_PASSWORD`],
    database: env[`${prefix}_MYSQL_DATABASE`],
  };

  const missing = ['host', 'user', 'password', 'database'].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`${prefix} MySQL 설정이 누락되었습니다: ${missing.join(', ')}`);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`${prefix}_MYSQL_PORT가 올바르지 않습니다.`);
  }

  return config;
}

function createDatabasePools(env = process.env) {
  return Object.fromEntries(DATABASE_PREFIXES.map((prefix) => {
    const pool = mysql.createPool({
      ...readDatabaseConfig(prefix, env),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
    return [prefix.toLowerCase(), pool];
  }));
}

async function getDatabaseStatuses(pools) {
  return Promise.all(DATABASE_PREFIXES.map(async (prefix) => {
    const key = prefix.toLowerCase();
    const [rows] = await pools[key].execute(
      'SELECT DATABASE() AS databaseName, NOW() AS serverTime',
    );
    return { key, ...rows[0] };
  }));
}

async function closeDatabasePools(pools) {
  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}

module.exports = { closeDatabasePools, createDatabasePools, getDatabaseStatuses, readDatabaseConfig };
