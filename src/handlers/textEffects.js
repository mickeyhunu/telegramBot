const CUSTOM_EMOJI_ID = '5368324170671202286';

function textEffectsMessage(userId) {
  const mention = userId
    ? `<a href="tg://user?id=${userId}">텍스트 멘션</a>`
    : '텍스트 멘션 (사용자 정보 없음)';

  return [
    '<b>Telegram 텍스트 효과 모음</b>',
    '',
    '일반 텍스트',
    '<b>굵게 (Bold)</b>',
    '<i>기울임 (Italic)</i>',
    '<u>밑줄 (Underline)</u>',
    '<s>취소선 (Strikethrough)</s>',
    '<tg-spoiler>스포일러 — 눌러서 확인</tg-spoiler>',
    '<b><i><u><s>굵게 + 기울임 + 밑줄 + 취소선</s></u></i></b>',
    '',
    '<code>인라인 고정폭 코드</code>',
    '<pre>여러 줄 고정폭 코드\n두 번째 줄</pre>',
    '<pre><code class="language-javascript">const effect = "syntax highlighting";</code></pre>',
    '',
    '<blockquote>일반 인용문\n인용문의 두 번째 줄</blockquote>',
    '<blockquote expandable>접을 수 있는 긴 인용문\n두 번째 줄\n세 번째 줄\n네 번째 줄</blockquote>',
    '',
    '<a href="https://telegram.org/">텍스트 링크</a>',
    mention,
    `<tg-emoji emoji-id="${CUSTOM_EMOJI_ID}">👍</tg-emoji> 커스텀 이모지`,
  ].join('\n');
}

function registerTextEffectsHandler(bot) {
  bot.command('testt', (ctx) => ctx.reply(textEffectsMessage(ctx.from?.id), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }));
}

module.exports = { registerTextEffectsHandler, textEffectsMessage };
