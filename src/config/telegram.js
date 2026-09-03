const GROUP_NAME = '미드나잇맨즈 소통방';
const WEBSITE_URL = 'https://nightmens.com/';

const DEFAULT_LINKS = Object.freeze({
  website: WEBSITE_URL,
  live: 'https://nightmens.com/play',
  partners: 'https://nightmens.com/business-info',
  channel: 'https://t.me/nightmens',
});

function readTelegramConfig(env = process.env) {
  return {
    groupName: env.TELEGRAM_GROUP_NAME || GROUP_NAME,
    groupIds: new Set((env.TELEGRAM_GROUP_IDS || env.TELEGRAM_GROUP_ID || '')
      .split(',').map((id) => id.trim()).filter(Boolean)),
    guideImage: env.TELEGRAM_GUIDE_IMAGE || '',
    links: {
      website: env.WEBSITE_URL || DEFAULT_LINKS.website,
      live: env.LIVE_URL || DEFAULT_LINKS.live,
      partners: env.PARTNERS_URL || DEFAULT_LINKS.partners,
      channel: env.CHANNEL_URL || DEFAULT_LINKS.channel,
      support: env.SUPPORT_URL || env.CHANNEL_URL || DEFAULT_LINKS.channel,
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
