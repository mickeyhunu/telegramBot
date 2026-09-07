const path = require('node:path');

const WEBSITE_URL = 'https://nightmens.com/';
const ANNOUNCEMENT_URL = 'https://t.me/+FQkKfTav5YFlYjc1';
const COMMUNITY_URL = 'https://t.me/+op8TPEZI9txhZDZl';
const DEFAULT_PARTNERS_CHANNEL_ID = '-1004488893219';

const DEFAULT_LINKS = Object.freeze({
  website: WEBSITE_URL,
  rbti: 'https://nightmens.com/play/rbti',
  wiki: 'https://nightmens.com/play/wiki',
  partners: 'https://nightmens.com/business-info',
  support: 'https://t.me/mnmens_official',
});

function readTelegramConfig(env = process.env) {
  const partnersMessageId = Number.parseInt(env.TELEGRAM_PARTNERS_MESSAGE_ID, 10);
  const partnersUpdateMinutes = Number(env.TELEGRAM_PARTNERS_UPDATE_MINUTES || 5);

  return {
    welcomeChatId: env.TELEGRAM_COMMUNITY_CHAT_ID?.trim() || '',
    welcomePhotoPath: env.TELEGRAM_WELCOME_PHOTO_PATH
      || path.resolve(__dirname, '../../assets/group-welcome.png'),
    groupMemberStorePath: env.TELEGRAM_MEMBER_STORE_PATH
      || path.resolve(__dirname, '../../data/group-members.json'),
    botUsageStorePath: env.TELEGRAM_BOT_USAGE_STORE_PATH
      || path.resolve(__dirname, '../../data/bot-usage.json'),
    adsConfigPath: env.TELEGRAM_ADS_CONFIG_PATH
      || path.resolve(__dirname, '../../data/ads.json'),
    partnersChannelId: env.TELEGRAM_PARTNERS_CHANNEL_ID?.trim()
      || DEFAULT_PARTNERS_CHANNEL_ID,
    partnersMessageId: Number.isSafeInteger(partnersMessageId) && partnersMessageId > 0
      ? partnersMessageId
      : null,
    partnersPhotoPath: env.TELEGRAM_PARTNERS_PHOTO_PATH
      || path.resolve(__dirname, '../../assets/group-welcome.png'),
    partnersUpdateIntervalMs: Number.isFinite(partnersUpdateMinutes) && partnersUpdateMinutes > 0
      ? partnersUpdateMinutes * 60_000
      : 5 * 60_000,
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
  DEFAULT_PARTNERS_CHANNEL_ID,
  DEFAULT_LINKS,
  WEBSITE_URL,
  readTelegramConfig,
};
