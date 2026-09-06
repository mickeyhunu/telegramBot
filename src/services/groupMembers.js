const fs = require('node:fs/promises');
const path = require('node:path');

const STORE_VERSION = 1;
const JOIN_EVENT_DEDUPLICATION_MS = 30_000;

function emptyStore() {
  return { version: STORE_VERSION, members: {} };
}

function memberKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function userDetails(user) {
  return {
    userId: user.id,
    username: user.username || null,
    firstName: user.first_name || null,
    lastName: user.last_name || null,
    isBot: user.is_bot === true,
    languageCode: user.language_code || null,
  };
}

function initialModeration() {
  return {
    warningCount: 0,
    warnings: [],
    mutedUntil: null,
    bannedAt: null,
    kickedAt: null,
    linkPostingRestrictedUntil: null,
  };
}

class GroupMemberStore {
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
    let contents;
    try {
      contents = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return emptyStore();
      throw error;
    }

    const store = JSON.parse(contents);
    if (store.version !== STORE_VERSION || !store.members || Array.isArray(store.members)) {
      throw new Error(`지원하지 않는 그룹 회원 저장 파일 형식입니다: ${this.filePath}`);
    }
    return store;
  }

  async writeStore(store) {
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, this.filePath);
  }

  async updateMember(chatId, user, update) {
    if (!user?.id) return null;

    return this.runExclusive(async () => {
      const store = await this.readStore();
      const key = memberKey(chatId, user.id);
      const existing = store.members[key] || {
        chatId: String(chatId),
        ...userDetails(user),
        membership: {
          status: null,
          joinedAt: null,
          firstJoinedAt: null,
          lastJoinedAt: null,
          lastUpdatedAt: null,
          joinCount: 0,
          joinHistory: [],
        },
        moderation: initialModeration(),
      };
      const member = update({
        ...existing,
        ...userDetails(user),
        membership: {
          joinHistory: [],
          ...existing.membership,
        },
        moderation: { ...initialModeration(), ...existing.moderation },
      });
      store.members[key] = member;
      await this.writeStore(store);
      return member;
    });
  }

  recordJoin(chatId, user, joinedAt, linkRestrictedUntil, status = 'member') {
    const joinedAtIso = new Date(joinedAt * 1000).toISOString();
    const restrictedUntilIso = new Date(linkRestrictedUntil).toISOString();
    return this.updateMember(chatId, user, (member) => {
      const previousJoinedAt = member.membership.lastJoinedAt || member.membership.joinedAt;
      const previousJoin = Date.parse(previousJoinedAt);
      const isSameJoin = isCurrentStatus(member.membership.status)
        && Number.isFinite(previousJoin)
        && Math.abs(previousJoin - (joinedAt * 1000)) < JOIN_EVENT_DEDUPLICATION_MS;
      const firstJoinedAt = member.membership.firstJoinedAt
        || member.membership.joinHistory[0]?.joinedAt
        || previousJoinedAt
        || joinedAtIso;
      let existingJoinHistory = member.membership.joinHistory;
      if (!existingJoinHistory.length && previousJoinedAt) {
        existingJoinHistory = [{
          joinedAt: previousJoinedAt,
          status: member.membership.status,
        }];
      }
      const joinHistory = isSameJoin
        ? existingJoinHistory
        : [...existingJoinHistory, { joinedAt: joinedAtIso, status }];
      member.membership = {
        ...member.membership,
        status,
        // Keep joinedAt as a last-join alias for files created by the initial
        // member-store implementation.
        joinedAt: joinedAtIso,
        firstJoinedAt,
        lastJoinedAt: joinedAtIso,
        lastUpdatedAt: joinedAtIso,
        joinCount: member.membership.joinCount + (isSameJoin ? 0 : 1),
        joinHistory,
      };
      member.moderation.linkPostingRestrictedUntil = user.is_bot ? null : restrictedUntilIso;
      return member;
    });
  }

  recordMembershipStatus(chatId, user, status, updatedAt) {
    const updatedAtIso = new Date(updatedAt * 1000).toISOString();
    return this.updateMember(chatId, user, (member) => {
      member.membership.status = status;
      member.membership.lastUpdatedAt = updatedAtIso;
      return member;
    });
  }

  async getMember(chatId, userId) {
    await this.pendingOperation;
    const store = await this.readStore();
    return store.members[memberKey(chatId, userId)] || null;
  }
}

function isCurrentStatus(status) {
  return ['creator', 'administrator', 'member', 'restricted'].includes(status);
}

function createGroupMemberStore(filePath) {
  return new GroupMemberStore(filePath);
}

module.exports = { createGroupMemberStore };
