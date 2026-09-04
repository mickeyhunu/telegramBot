const WEBSITE_URL = 'https://nightmens.com/';
const ANNOUNCEMENT_URL = 'https://t.me/+1hcSUQN8lNswZTM1';
const COMMUNITY_URL = 'https://t.me/+_mzPGLwIEBIyMjll';

const DEFAULT_LINKS = Object.freeze({
  website: WEBSITE_URL,
  rbti: 'https://nightmens.com/play/rbti',
  wiki: 'https://nightmens.com/play/wiki',
  partners: 'https://nightmens.com/business-info',
  support: 'https://t.me/mnmens_offical',
});

function readTelegramConfig(env = process.env) {
  return {
    subscriptionChats: [
      { name: '📢 미드나잇맨즈 공지방', chatId: env.TELEGRAM_ANNOUNCEMENT_CHAT_ID || '', url: ANNOUNCEMENT_URL },
      { name: '💬 미드나잇맨즈 소통방', chatId: env.TELEGRAM_COMMUNITY_CHAT_ID || '', url: COMMUNITY_URL },
    ],
    links: {
      website: env.WEBSITE_URL || DEFAULT_LINKS.website,
      rbti: env.RBTI_URL || DEFAULT_LINKS.rbti,
      wiki: env.WIKI_URL || DEFAULT_LINKS.wiki,
      partners: env.PARTNERS_URL || DEFAULT_LINKS.partners,
      support: env.SUPPORT_URL || DEFAULT_LINKS.support,
    },
  };
}

module.exports = {
  DEFAULT_LINKS,
  WEBSITE_URL,
  readTelegramConfig,
};
