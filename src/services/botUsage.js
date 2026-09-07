const fs = require('node:fs/promises');
const path = require('node:path');

const STORE_VERSION = 1;

function emptyStore() {
  return { version: STORE_VERSION, chats: {}, users: {} };
}

class BotUsageStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.pendingOperation = Promise.resolve();
  }

  runExclusive(operation) {
    const result = this.pendingOperation.then(operation, operation);
    this.pendingOperation = result.catch(() => {});
    return result;
  }

  async readStore() {
    try {
      const contents = await fs.readFile(this.filePath, 'utf8');
      const store = JSON.parse(contents);
      if (store.version !== STORE_VERSION || !store.chats || !store.users) {
        throw new Error(`지원하지 않는 봇 이용 기록 파일 형식입니다: ${this.filePath}`);
      }
      return store;
    } catch (error) {
      if (error.code === 'ENOENT') return emptyStore();
      throw error;
    }
  }

  async writeStore(store) {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    // Keep the complete JSON document on one line while retaining keyed
    // entries, which prevents duplicate chat and user records.
    await fs.writeFile(temporaryPath, `${JSON.stringify(store)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, this.filePath);
  }

  recordChat(details) {
    return this.runExclusive(async () => {
      const store = await this.readStore();
      const key = String(details.id);
      const existing = store.chats[key];
      store.chats[key] = {
        ...existing,
        ...details,
        firstAddedAt: existing?.firstAddedAt || details.addedAt,
        lastAddedAt: details.addedAt,
      };
      await this.writeStore(store);
      return store.chats[key];
    });
  }

  recordStart(user, startedAt) {
    if (!user?.id) return Promise.resolve(null);

    return this.runExclusive(async () => {
      const store = await this.readStore();
      const key = String(user.id);
      const existing = store.users[key];
      const startedAtIso = new Date(startedAt * 1000).toISOString();
      store.users[key] = {
        userId: user.id,
        username: user.username ? `@${user.username}` : null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        languageCode: user.language_code || null,
        isPremium: user.is_premium === true,
        firstStartedAt: existing?.firstStartedAt || startedAtIso,
        lastStartedAt: startedAtIso,
      };
      await this.writeStore(store);
      return store.users[key];
    });
  }
}

function createBotUsageStore(filePath) {
  return new BotUsageStore(filePath);
}

module.exports = { createBotUsageStore };
