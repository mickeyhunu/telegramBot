const path = require('node:path');

const DEFAULT_PARTNERS_CHANNEL_ID = '-1004488893219';

const DEFAULT_LINKS = Object.freeze({
  website: '',
  rbti: '',
  wiki: '',
  partners: '',
  support: '',
  partnersMessage: '',
});

function appendUrlPath(baseUrl, path) {
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${path}` : '';
}

function createTelegramMessageUrl(chatId, messageId) {
  if (!chatId || !messageId) return '';
  const internalChatId = String(chatId).replace(/^-100/, '');
  return `https://t.me/c/${internalChatId}/${messageId}`;
}

function readTelegramConfig(env = process.env) {
  const partnersMessageId = Number.parseInt(env.TELEGRAM_PARTNERS_MESSAGE_ID, 10);
  const partnersUpdateMinutes = Number(env.TELEGRAM_PARTNERS_UPDATE_MINUTES || 5);
  const website = env.WEBSITE_URL?.trim() || '';
  const partnersChannelId = env.TELEGRAM_PARTNERS_CHANNEL_ID?.trim()
    || DEFAULT_PARTNERS_CHANNEL_ID;
  const validPartnersMessageId = Number.isSafeInteger(partnersMessageId) && partnersMessageId > 0
    ? partnersMessageId
    : null;

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
    partnersChannelId,
    partnersMessageId: validPartnersMessageId,
    partnersPhotoPath: env.TELEGRAM_PARTNERS_PHOTO_PATH
      || path.resolve(__dirname, '../../assets/group-welcome.png'),
    partnersUpdateIntervalMs: Number.isFinite(partnersUpdateMinutes) && partnersUpdateMinutes > 0
      ? partnersUpdateMinutes * 60_000
      : 5 * 60_000,
    subscriptionChats: [
      { name: '📢 미드나잇맨즈 공지방', chatId: env.TELEGRAM_ANNOUNCEMENT_CHAT_ID || '', url: env.ANNOUNCEMENT_URL?.trim() || '' },
      { name: '💬 미드나잇맨즈 소통방', chatId: env.TELEGRAM_COMMUNITY_CHAT_ID || '', url: env.COMMUNITY_URL?.trim() || '' },
    ],
    links: {
      website,
      rbti: env.RBTI_URL?.trim() || appendUrlPath(website, 'play/rbti'),
      wiki: env.WIKI_URL?.trim() || appendUrlPath(website, 'play/wiki'),
      partners: env.PARTNERS_URL?.trim() || appendUrlPath(website, 'business-info'),
      support: env.SUPPORT_URL?.trim() || '',
      partnersMessage: createTelegramMessageUrl(partnersChannelId, validPartnersMessageId),
    },
  };
}

module.exports = {
  DEFAULT_PARTNERS_CHANNEL_ID,
  DEFAULT_LINKS,
  createTelegramMessageUrl,
  readTelegramConfig,
};
