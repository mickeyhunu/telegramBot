const GROUP_NAME = '미드나잇맨즈 소통방';
const WEBSITE_URL = 'https://nightmens.com/';
const ANNOUNCEMENT_URL = 'https://t.me/+1hcSUQN8lNswZTM1';
const COMMUNITY_URL = 'https://t.me/+_mzPGLwIEBIyMjll';

const DEFAULT_LINKS = Object.freeze({
  website: WEBSITE_URL,
  live: 'https://nightmens.com/play/live',
  rbti: 'https://nightmens.com/play/rbti',
  wiki: 'https://nightmens.com/play/wiki',
  partners: 'https://nightmens.com/business-info',
  support: 'https://t.me/mnmens_offical',
});

function readTelegramConfig(env = process.env) {
  return {
    groupName: env.TELEGRAM_GROUP_NAME || GROUP_NAME,
    groupIds: new Set((env.TELEGRAM_GROUP_IDS || env.TELEGRAM_GROUP_ID || '')
      .split(',').map((id) => id.trim()).filter(Boolean)),
    guideImage: env.TELEGRAM_GUIDE_IMAGE || '',
    subscriptionChats: [
      { name: '📢 미드나잇맨즈 공지방', chatId: env.TELEGRAM_ANNOUNCEMENT_CHAT_ID || '', url: ANNOUNCEMENT_URL },
      { name: '💬 미드나잇맨즈 소통방', chatId: env.TELEGRAM_COMMUNITY_CHAT_ID || '', url: COMMUNITY_URL },
    ],
    links: {
      website: env.WEBSITE_URL || DEFAULT_LINKS.website,
      live: env.LIVE_URL || DEFAULT_LINKS.live,
      rbti: env.RBTI_URL || DEFAULT_LINKS.rbti,
      wiki: env.WIKI_URL || DEFAULT_LINKS.wiki,
      partners: env.PARTNERS_URL || DEFAULT_LINKS.partners,
      support: env.SUPPORT_URL || DEFAULT_LINKS.support,
    },
  };
}

function normalizeGroupTitle(title = '') {
  return title.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function createTargetGroupChecker(config) {
  return (chat) => {
    if (!['group', 'supergroup'].includes(chat?.type)) return false;
    if (config.groupIds.size) return config.groupIds.has(String(chat.id));
    return normalizeGroupTitle(chat.title).includes(config.groupName);
  };
}

function readTargetGroupIds(env = process.env) {
  return readTelegramConfig(env).groupIds;
}

function isTargetGroup(chat, env = process.env) {
  return createTargetGroupChecker(readTelegramConfig(env))(chat);
}

module.exports = {
  DEFAULT_LINKS,
  GROUP_NAME,
  WEBSITE_URL,
  createTargetGroupChecker,
  isTargetGroup,
  normalizeGroupTitle,
  readTargetGroupIds,
  readTelegramConfig,
};
