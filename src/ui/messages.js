function privateGuideMessage() {
  return [
    '🌙 미드나잇맨즈 공식 안내',
    '',
    '원하시는 메뉴를 아래 버튼에서 선택해 주세요.',
    '실시간 LIVE와 제휴업체 안내를 이용할 수 있습니다.',
  ].join('\n');
}

function liveGuideMessage() {
  return '🔴 실시간 LIVE\n\n원하시는 서비스를 선택해 주세요.';
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
    ? partnerBusinesses.map(({ id, title, name, telegram_id: telegramId, url, ...business }) => ({
      label: formatPartnerBusinessName(business),
      title: title || name || '',
      telegramId: String(telegramId || '').trim().replace(/^@+/, ''),
      url: url || `${baseUrl}/${encodeURIComponent(id)}`,
    }))
    : [{ title: '제휴업체 전체보기', url: links.partners }];
  const businessLinks = businesses.map(({ label, title, telegramId, url }) => {
    const linkText = [label, title].filter(Boolean).join(' ');
    const mention = telegramId ? `... @${escapeHtml(telegramId)}` : '';
    return `<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>${mention}`;
  });

  return [
    '🤝 제휴업체 안내',
    '',
    ...businessLinks,
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
  formatPartnerBusinessName,
  groupGuideCaption,
  liveGuideMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
};
