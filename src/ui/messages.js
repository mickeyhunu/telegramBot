function privateGuideMessage() {
  return [
    '🌙 미드나잇맨즈 공식 안내',
    '',
    '원하시는 메뉴를 아래 버튼에서 선택해 주세요.',
    '실시간 LIVE와 제휴업체 안내를 이용할 수 있습니다.',
  ].join('\n');
}

function storeSelectionMessage() {
  return '🔴 실시간 LIVE\n\n실시간 정보를 확인할 가게를 선택해주세요.';
}

function formatStoreName({ storeName, storeEmoji }) {
  return [String(storeEmoji || '').trim(), String(storeName || '').trim()]
    .filter(Boolean)
    .join(' ');
}

function liveGuideMessage(store) {
  return `🔴 실시간 LIVE\n\n${formatStoreName(store)}\n원하시는 서비스를 선택해 주세요.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatPartnerBusinessName({ district, business_name: businessName }) {
  const shortDistrict = String(district || '').trim().replace(/구$/, '');
  const bracketContents = [shortDistrict, businessName].filter(Boolean).join(' ');
  return bracketContents ? `[${bracketContents}]` : '';
}

function partnersGuideMessage(partnerBusinesses = [], links) {
  const baseUrl = links.partners.replace(/\/$/, '');
  const businesses = partnerBusinesses.length
    ? partnerBusinesses.map(({
      id,
      manager_name: managerName,
      telegram_id: telegramId,
      manager_contact: managerContact,
      url,
      ...business
    }) => ({
      label: formatPartnerBusinessName(business),
      managerName: String(managerName || '').trim(),
      telegramId: String(telegramId || '').trim().replace(/^@+/, ''),
      managerContact: String(managerContact || '').trim(),
      url: url || `${baseUrl}/${encodeURIComponent(id)}`,
    }))
    : [{ label: '제휴업체 전체보기', url: links.partners }];
  const businessLinks = businesses.map(({
    label, managerName, telegramId, managerContact, url,
  }) => [
    `💎 <a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`,
    (managerName || telegramId || managerContact)
      ? `👤 담당 : ${[
        managerName && escapeHtml(managerName),
        telegramId ? `@${escapeHtml(telegramId)}` : managerContact && escapeHtml(managerContact),
      ].filter(Boolean).join(' ')}`
      : '',
  ].filter(Boolean).join('\n'));

  return [
    '🤝 미드나잇맨즈 제휴 안내',
    '',
    '💡 방문 전 담당자에게 「미드나잇맨즈 보고 연락드렸어요」',
    '라고 말씀해주시면 더욱 빠른 안내가 가능합니다.',
    '',
    businessLinks.join('\n➖➖➖➖➖➖➖➖➖➖➖➖➖➖\n'),
    '',
    '🔎 업체명을 누르면 상세정보 및 최신 안내를 확인할 수 있습니다.',
  ].join('\n');
}

function subscriptionMessage() {
  return [
    '📢 **구독자 전용 서비스입니다.**',
    '',
    '미드나잇맨즈 공지방/소통방 을 구독한 뒤 아래 확인 버튼을 눌러주세요.',
  ].join('\n');
}

function groupGuideCaption() {
  return [
    '🌙 미드나잇맨즈 안내',
    '',
    '실시간 LIVE와 제휴업체 정보를 빠르게 확인하세요.',
    '개인 메시지에서는 채널 안내와 문의 메뉴도 이용할 수 있습니다.',
    '',
    '👇 아래 버튼을 눌러 이동해 주세요.',
  ].join('\n');
}

module.exports = {
  formatStoreName,
  formatPartnerBusinessName,
  groupGuideCaption,
  liveGuideMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
  storeSelectionMessage,
};
