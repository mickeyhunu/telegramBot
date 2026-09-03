const { InlineKeyboardBuilder } = require('node-telegram-bot-api');

const { DEFAULT_LINKS } = require('../config/telegram');

function addFixedLinks(keyboard, links) {
  return keyboard
    .row()
    .url('🌐 홈페이지', links.website)
    .url('💬 문의하기', links.support);
}

function buildPrivateMenu(links = DEFAULT_LINKS) {
  const keyboard = new InlineKeyboardBuilder()
    .text('🔴 실시간 LIVE', 'menu_live')
    .row()
    .text('🤝 제휴업체 안내', 'menu_partners');

  return addFixedLinks(keyboard, links).build();
}

function buildLiveMenu(links = DEFAULT_LINKS) {
  const keyboard = new InlineKeyboardBuilder()
    .text('💬 초이스톡', 'live_choice')
    .text('🔎 초중', 'live_search')
    .row()
    .text('🚪 룸/웨이팅', 'live_waiting')
    .text('📝 엔트리', 'live_entry')
    .row()
    .text('👥 출근자정보', 'live_workers')
    .row()
    .text('⬅️ 처음으로', 'menu_home');

  return addFixedLinks(keyboard, links).build();
}

function buildPartnersMenu(partnerBusinesses = [], links = DEFAULT_LINKS) {
  const keyboard = new InlineKeyboardBuilder();
  const businesses = partnerBusinesses.length
    ? partnerBusinesses
    : [{ name: '제휴업체 전체보기', url: links.partners }];

  businesses.forEach(({ name, url }) => keyboard.url(`🤝 ${name}`, url).row());
  keyboard.text('⬅️ 처음으로', 'menu_home');
  return addFixedLinks(keyboard, links).build();
}

function buildGroupMenu(botUsername, links = DEFAULT_LINKS) {
  const privateMenuUrl = `https://t.me/${botUsername}?start=menu`;
  return new InlineKeyboardBuilder()
    .url('🎥 LIVE 바로가기', links.live)
    .row()
    .url('📢 채널 안내', privateMenuUrl)
    .url('🤝 제휴업체', links.partners)
    .row()
    .url('🌐 홈페이지', links.website)
    .url('💬 문의하기', links.support)
    .build();
}

function buildWelcomeButton(links) {
  return new InlineKeyboardBuilder()
    .url('🌐 홈페이지', links.website)
    .url('💬 문의하기', links.support)
    .build();
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

const buildStartMenu = (links = DEFAULT_LINKS) => buildPrivateMenu(links);

module.exports = {
  buildGroupMenu,
  buildLiveMenu,
  buildPartnersMenu,
  buildPrivateMenu,
  buildStartMenu,
  buildSubscriptionMenu,
  buildWelcomeButton,
};
