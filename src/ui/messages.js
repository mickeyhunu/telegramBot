function privateGuideMessage() {
  return [
    '🌙 미드나잇맨즈 공식 안내',
    '',
    '원하시는 메뉴를 아래 버튼에서 선택해 주세요.',
    '실시간 LIVE와 제휴업체 안내를 이용할 수 있습니다.',
  ].join('\n');
}

function storeSelectionMessage() {
  return '🔴 미드나잇맨즈 실시간 LIVE\n\n실시간 정보를 확인할 가게를 선택해주세요.';
}

function formatStoreName({ storeName, storeEmoji }) {
  return [String(storeEmoji || '').trim(), String(storeName || '').trim()]
    .filter(Boolean)
    .join(' ');
}

function liveGuideMessage(store) {
  return [
    '🔴 미드나잇맨즈 실시간 LIVE',
    '',
    formatStoreName(store),
    `📍 ${String(store.storeAddress || '주소 정보 없음').trim()}`,
    '',
    '원하시는 서비스를 선택해 주세요.',
  ].join('\n');
}

function formatLiveValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '준비중입니다...';
  return String(value).trim();
}

function formatChojoongCreatedAt(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getMonth() + 1}월 ${value.getDate()}일 ${value.getHours()}시 ${value.getMinutes()}분`;
  }

  const match = String(value).trim().match(
    /^\d{4}-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})/,
  );
  if (!match) return String(value).trim();

  const [, month, day, hour, minute] = match;
  return `${Number(month)}월 ${Number(day)}일 ${Number(hour)}시 ${Number(minute)}분`;
}

const LIVE_SECTION_DIVIDER = '➖➖➖➖➖➖➖➖➖➖➖➖➖➖';

function formatElapsedTime(value, now = new Date()) {
  if (!value) return '';

  const createdAt = value instanceof Date
    ? value
    : new Date(String(value).trim().replace(' ', 'T'));
  const currentTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(currentTime.getTime())) return '';

  const elapsedMinutes = Math.max(0, Math.floor((currentTime - createdAt) / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}분전`;

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `${hours}시간${minutes ? `${minutes}분` : ''}전`;
}

function formatChojoongInformation({ message, createdAt }, now = new Date()) {
  const timestamp = formatChojoongCreatedAt(createdAt);
  if (!timestamp) return message;

  const elapsedTime = formatElapsedTime(createdAt, now);
  return [
    message,
    '',
    `🕒 ${timestamp}${elapsedTime ? ` [${elapsedTime}]` : ''}`,
    LIVE_SECTION_DIVIDER,
  ].join('\n');
}

function appendTimestamp(message, value) {
  const timestamp = formatChojoongCreatedAt(value);
  return [
    message,
    timestamp && LIVE_SECTION_DIVIDER,
    timestamp && `🕒 ${timestamp} 기준`,
  ].filter(Boolean).join('\n');
}

function formatEntryDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getMonth() + 1}월 ${value.getDate()}일`;
  }

  const match = String(value).trim().match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
  if (!match) return '';

  const [, month, day] = match;
  return `${Number(month)}월 ${Number(day)}일`;
}

function entryInformationMessage(store, entries) {
  const namesPerLine = 5;
  const workerLines = [];
  for (let index = 0; index < entries.length; index += namesPerLine) {
    workerLines.push(entries.slice(index, index + namesPerLine)
      .map(({ workerName }) => workerName)
      .join(' '));
  }

  const popularMembers = entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, 5)
    .map(({ workerName, score }, index) => `${index + 1}. ${workerName} 합계 ${score}`);

  const entryDate = formatEntryDate(entries[0]?.createdAt);

  return [
    '🔴 미드나잇맨즈 실시간 LIVE',
    '',
    formatStoreName(store),
    `📍 ${String(store.storeAddress || '주소 정보 없음').trim()}`,
    '',
    '📝 엔트리',
    LIVE_SECTION_DIVIDER,
    ...(entryDate ? [`🗓 ${entryDate}`] : []),
    '',
    `총 출근인원 ${entries.length}명`,
    '',
    '엔트리 목록',
    workerLines.length ? workerLines.join('\n') : '등록된 멤버가 없습니다.',
    '',
    '오늘의 인기 멤버 TOP 5',
    popularMembers.length ? popularMembers.join('\n') : '등록된 멤버가 없습니다.',
    LIVE_SECTION_DIVIDER,
  ].join('\n');
}

function liveInformationMessage(store, action, information) {
  const headers = {
    choice: '💬 초이스톡',
    search: '🔎 초중',
    waiting: '🚪 룸/웨이팅',
    workers: '👥 출근자정보',
  };
  let details;

  if (action === 'entry') return entryInformationMessage(store, information);

  if (action === 'workers') {
    details = [
      `[총 ${Number(information) || 0}명의 정보가 있습니다]`,
      '',
      '출근자 정보 프리미엄 기능은 미드나잇 맨즈 회원에게만 제공됩니다.',
      '',
      '<a href="https://nightmens.com/login">[미드나잇맨즈 바로가기]</a>',
    ].join('\n');
  } else if (action === 'search') {
    details = information.length
      ? information.map((item) => formatChojoongInformation(item)).join('\n')
      : '준비중입니다...';
  } else if (action === 'waiting') {
    const roomInfo = String(information.roomInfo) === '999' ? '여유' : formatLiveValue(information.roomInfo);
    details = appendTimestamp(
      `🚪  룸 : ${roomInfo}\n⏳ 웨이팅 : ${formatLiveValue(information.waitInfo)}`,
      information.updatedAt,
    );
  } else {
    details = information && typeof information === 'object'
      ? appendTimestamp(formatLiveValue(information.message), information.createdAt)
      : formatLiveValue(information);
  }

  return [
    '🔴 미드나잇맨즈 실시간 LIVE',
    '',
    action === 'workers' ? escapeHtml(formatStoreName(store)) : formatStoreName(store),
    `📍 ${action === 'workers'
      ? escapeHtml(String(store.storeAddress || '주소 정보 없음').trim())
      : String(store.storeAddress || '주소 정보 없음').trim()}`,
    '',
    headers[action],
    LIVE_SECTION_DIVIDER,
    details,
  ].join('\n');
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
  entryInformationMessage,
  formatChojoongCreatedAt,
  formatChojoongInformation,
  formatElapsedTime,
  formatEntryDate,
  formatStoreName,
  formatPartnerBusinessName,
  groupGuideCaption,
  liveGuideMessage,
  liveInformationMessage,
  partnersGuideMessage,
  privateGuideMessage,
  subscriptionMessage,
  storeSelectionMessage,
};
