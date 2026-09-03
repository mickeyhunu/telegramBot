const { InlineKeyboardBuilder } = require('node-telegram-bot-api');

const { DEFAULT_LINKS } = require('../config/telegram');

const BUTTON_STYLES = Object.freeze({
  danger: 'danger',
  primary: 'primary',
  success: 'success',
});

function colorize(keyboard, links = {}) {
  const markup = keyboard.build();
  markup.inline_keyboard.forEach((row) => {
    row.forEach((button) => {
      if (button.callback_data === 'menu_home') {
        button.style = BUTTON_STYLES.danger;
      } else if ((links.website && button.url === links.website)
        || (links.support && button.url === links.support)) {
        button.style = BUTTON_STYLES.success;
      } else {
        button.style = BUTTON_STYLES.primary;
      }
    });
  });
  return markup;
}

function addFixedLinks(keyboard, links) {
  return keyboard
    .row()
    .url('🌐 커뮤니티', links.website)
    .url('💬 문의하기', links.support);
}

function buildPrivateMenu(links = DEFAULT_LINKS) {
  const keyboard = new InlineKeyboardBuilder()
    .text('🔴 실시간 LIVE', 'menu_live')
    .row()
    .url('🧠 RBTI 검사하기', links.rbti)
    .row()
    .url('📚 룸빵 용어사전', links.wiki)
    .row()
    .text('🤝 제휴업체 안내', 'menu_partners');

  return colorize(addFixedLinks(keyboard, links), links);
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

  return colorize(addFixedLinks(keyboard, links), links);
}

function buildPartnersMenu(links = DEFAULT_LINKS) {
  const keyboard = new InlineKeyboardBuilder()
    .text('⬅️ 처음으로', 'menu_home');
  return colorize(addFixedLinks(keyboard, links), links);
}

function buildGroupMenu(botUsername, links = DEFAULT_LINKS) {
  const privateMenuUrl = `https://t.me/${botUsername}?start=menu`;
  return colorize(new InlineKeyboardBuilder()
    .url('🎥 LIVE 바로가기', links.live)
    .row()
    .url('📢 채널 안내', privateMenuUrl)
    .url('🤝 제휴업체', links.partners)
    .row()
    .url('🌐 커뮤니티', links.website)
    .url('💬 문의하기', links.support), links);
}

function buildWelcomeButton(links) {
  return colorize(new InlineKeyboardBuilder()
    .url('🌐 커뮤니티', links.website)
    .url('💬 문의하기', links.support), links);
}

function buildSubscriptionMenu(subscriptionChats) {
  const [announcement, community] = subscriptionChats;
  return colorize(new InlineKeyboardBuilder()
    .url(announcement.name, announcement.url)
    .row()
    .url(community.name, community.url)
    .row()
    .text('구독 완료했어요', 'verify_subscriptions'));
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
