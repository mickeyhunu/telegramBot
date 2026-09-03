const { InlineKeyboardBuilder } = require('node-telegram-bot-api');

const { DEFAULT_LINKS } = require('../config/telegram');

function buildPrivateMenu(links = DEFAULT_LINKS) {
  return new InlineKeyboardBuilder()
    .url('📢 채널 안내', links.channel)
    .row()
    .url('🎥 미드나잇맨즈 LIVE', links.live)
    .row()
    .url('🤝 제휴업체 안내', links.partners)
    .row()
    .url('💬 문의하기', links.support)
    .build();
}

function buildGroupMenu(botUsername, links = DEFAULT_LINKS) {
  const privateMenuUrl = `https://t.me/${botUsername}?start=menu`;
  return new InlineKeyboardBuilder()
    .url('🎥 LIVE 바로가기', links.live)
    .row()
    .url('📢 채널 안내', privateMenuUrl)
    .url('🤝 제휴업체', links.partners)
    .row()
    .url('💬 문의하기', links.support)
    .build();
}

function buildWelcomeButton(links) {
  return new InlineKeyboardBuilder().url('미드나잇맨즈 바로가기', links.website).build();
}

function buildSubscriptionMenu(subscriptionChats) {
  const [announcement, community] = subscriptionChats;
  return new InlineKeyboardBuilder()
    .url(announcement.name, announcement.url)
    .row()
    .url(community.name, community.url)
    .row()
    .text('구독 완료했어요', 'verify_subscriptions')
    .build();
}

// Backward-compatible name used by the previous entry point.
const buildStartMenu = (links = DEFAULT_LINKS) => buildPrivateMenu(links);

module.exports = {
  buildGroupMenu,
  buildPrivateMenu,
  buildStartMenu,
  buildSubscriptionMenu,
  buildWelcomeButton,
};
