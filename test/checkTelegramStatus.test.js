const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkTelegramStatus,
  inspectSubscriptionChat,
  printTelegramStatus,
} = require('../src/scripts/checkTelegramStatus');

const env = {
  TELEGRAM_ANNOUNCEMENT_CHAT_ID: '-1001',
  TELEGRAM_COMMUNITY_CHAT_ID: '-1002',
};

test('두 채팅의 실제 정보와 봇 관리자 상태를 확인한다', async () => {
  const api = {
    getMe: async () => ({ id: 77, username: 'night_bot', can_read_all_group_messages: true }),
    getChat: async ({ chat_id: id }) => ({ title: id === '-1001' ? '공지방' : '소통방', type: 'supergroup' }),
    getChatMember: async ({ user_id: userId }) => {
      assert.equal(userId, 77);
      return { status: 'administrator' };
    },
  };

  const result = await checkTelegramStatus({ api, env });

  assert.equal(result.ok, true);
  assert.deepEqual(result.chats.map(({ actualTitle }) => actualTitle), ['공지방', '소통방']);
});

test('봇이 일반 멤버이면 문제와 권한 상태를 표시한다', async () => {
  const result = await inspectSubscriptionChat({
    getChat: async () => ({ title: '공지방', type: 'channel' }),
    getChatMember: async () => ({ status: 'member' }),
  }, { name: '공지방', chatId: '-1001' }, 77);

  assert.equal(result.ok, false);
  assert.equal(result.memberStatus, 'member');
  assert.match(result.problem, /관리자가 아닙니다/);
});

test('채팅 ID 누락과 Telegram API 오류를 진단한다', async () => {
  const missing = await inspectSubscriptionChat({}, { name: '공지방', chatId: '' }, 77);
  const rejected = await inspectSubscriptionChat({
    getChat: async () => { throw new Error('Bad Request: chat not found'); },
    getChatMember: async () => ({ status: 'administrator' }),
  }, { name: '소통방', chatId: '-1002' }, 77);

  assert.match(missing.problem, /비어 있습니다/);
  assert.match(rejected.problem, /chat not found/);
});

test('콘솔 결과에 채팅 ID, 실제 채팅 이름, 봇 상태를 출력한다', () => {
  const lines = [];
  printTelegramStatus({
    bot: { id: 77, username: 'night_bot', can_read_all_group_messages: false },
    ok: false,
    chats: [{
      name: '공지방', chatId: '-1001', actualTitle: '실제 공지방', chatType: 'channel',
      memberStatus: 'member', ok: false, problem: '봇이 관리자가 아닙니다.',
    }],
  }, { log: (line) => lines.push(line) });

  const output = lines.join('\n');
  assert.match(output, /-1001/);
  assert.match(output, /실제 공지방 \(channel\)/);
  assert.match(output, /member/);
  assert.match(output, /Privacy Mode/);
});
