const test = require('node:test');
const assert = require('node:assert/strict');

const { subscriptionStatusMessage } = require('../src/handlers/menu');

const chats = [
  { name: '미드나잇맨즈 공지방' },
  { name: '미드나잇맨즈 소통방' },
];

test('두 방 모두 미구독이면 각 방의 미확인 상태를 안내한다', () => {
  assert.equal(subscriptionStatusMessage(chats, chats), [
    '📢 미드나잇맨즈 공지방 : 🔘 구독 확인 안됨',
    '💬 미드나잇맨즈 소통방 : 🔘 구독 확인 안됨',
    '',
    '구독을 확인해 주세요.',
  ].join('\n'));
});

test('공지방만 미구독이면 소통방은 구독중으로 안내한다', () => {
  assert.equal(subscriptionStatusMessage(chats, [chats[0]]), [
    '📢 미드나잇맨즈 공지방 : 🔘 구독 확인 안됨',
    '💬 미드나잇맨즈 소통방 : 🟢 구독중',
    '',
    '구독을 확인해 주세요.',
  ].join('\n'));
});

test('소통방만 미구독이면 공지방은 구독중으로 안내한다', () => {
  assert.equal(subscriptionStatusMessage(chats, [chats[1]]), [
    '📢 미드나잇맨즈 공지방 : 🟢 구독중',
    '💬 미드나잇맨즈 소통방 : 🔘 구독 확인 안됨',
    '',
    '구독을 확인해 주세요.',
  ].join('\n'));
});
