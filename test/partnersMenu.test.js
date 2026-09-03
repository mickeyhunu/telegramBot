const test = require('node:test');
const assert = require('node:assert/strict');

const { partnersGuideMessage } = require('../src/ui/messages');
const { buildPartnersMenu } = require('../src/ui/keyboards');

const links = {
  website: 'https://example.com',
  partners: 'https://example.com/business-info',
  support: 'https://t.me/example',
};

test('제휴업체를 메시지 본문의 HTML 링크로 표시한다', () => {
  const message = partnersGuideMessage([
    { id: 17, title: '업체 <A&B>' },
    { id: 18, title: '업체 B', url: 'https://partner.example/path?a=1&b=2' },
  ], links);

  assert.match(message, /<a href="https:\/\/example\.com\/business-info\/17">업체 &lt;A&amp;B&gt;<\/a>/);
  assert.match(message, /<a href="https:\/\/partner\.example\/path\?a=1&amp;b=2">업체 B<\/a>/);
});

test('제휴업체가 없으면 전체보기 링크를 본문에 표시한다', () => {
  const message = partnersGuideMessage([], links);

  assert.match(message, /<a href="https:\/\/example\.com\/business-info">제휴업체 전체보기<\/a>/);
});

test('제휴업체 키보드에는 업체 버튼을 넣지 않는다', () => {
  const keyboard = buildPartnersMenu(links);
  const buttons = keyboard.inline_keyboard.flat();

  assert.deepEqual(buttons.map(({ text }) => text), ['⬅️ 처음으로', '🌐 홈페이지', '💬 문의하기']);
  assert.equal(buttons.some(({ url }) => url === links.partners), false);
});
