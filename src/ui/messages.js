function privateGuideMessage() {
  return [
    '🌙 미드나잇맨즈 공식 안내',
    '',
    '원하시는 메뉴를 아래 버튼에서 선택해 주세요.',
    '최신 소식은 「채널 안내」에서 확인할 수 있습니다.',
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

module.exports = { groupGuideCaption, privateGuideMessage };
