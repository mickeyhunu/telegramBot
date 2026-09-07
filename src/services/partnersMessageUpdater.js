const { webcrypto } = require('node:crypto');

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  globalThis.crypto = webcrypto;
}

const { fromPath } = require('node-telegram-bot-api/node');
const { getActiveBusinessAds } = require('./businessAds');
const { partnersGuideMessage } = require('../ui/messages');

const TELEGRAM_CAPTION_LIMIT = 1024;

const { createTelegramMessageUrl } = require('../config/telegram');

function formatPartnersChannelMessage(businesses, links) {
  let visibleCount = businesses.length;
  let text = partnersGuideMessage(businesses, links);

  while (text.length > TELEGRAM_CAPTION_LIMIT && visibleCount > 0) {
    visibleCount -= 1;
    const omitted = businesses.length - visibleCount;
    const notice = `\n\n📋 나머지 ${omitted}개 업체는 <a href="${links.partners}">전체 목록</a>에서 확인해 주세요.`;
    text = `${partnersGuideMessage(businesses.slice(0, visibleCount), links)}${notice}`;
  }

  return text;
}

function startPartnersMessageUpdater(api, databasePool, config, { logger = console } = {}) {
  const chatId = config.partnersChannelId;
  const messageId = config.partnersMessageId;
  const photoPath = config.partnersPhotoPath;
  const intervalMs = config.partnersUpdateIntervalMs;

  if (!messageId) {
    logger.info('[partners-message] TELEGRAM_PARTNERS_MESSAGE_ID가 없어 자동 수정을 사용하지 않습니다.');
    return { stop() {}, enabled: false };
  }
  if (!databasePool) {
    logger.error('[partners-message] MNMS DB 풀이 없어 자동 수정을 사용하지 않습니다.');
    return { stop() {}, enabled: false };
  }

  let timer;
  let stopped = false;
  const update = async () => {
    try {
      const businesses = await getActiveBusinessAds(databasePool);
      const text = formatPartnersChannelMessage(businesses, config.links);
      await api.editMessageMedia({
        chat_id: chatId,
        message_id: messageId,
        media: {
          type: 'photo',
          media: await fromPath(photoPath),
          caption: text,
          parse_mode: 'HTML',
        },
      });
      logger.info(`[partners-message] 수정 완료: ${chatId}/${messageId}, 업체 ${businesses.length}개`);
    } catch (error) {
      if (String(error.message).includes('message is not modified')) {
        logger.info('[partners-message] 내용 변경 없음');
      } else {
        logger.error(`[partners-message] 수정 실패: ${error.message}`);
      }
    } finally {
      if (!stopped) {
        timer = setTimeout(update, intervalMs);
        timer.unref?.();
      }
    }
  };

  logger.info(`[partners-message] 자동 수정 시작: ${createTelegramMessageUrl(chatId, messageId)}`);
  void update();

  return {
    enabled: true,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

module.exports = {
  createTelegramMessageUrl,
  formatPartnersChannelMessage,
  startPartnersMessageUpdater,
};
