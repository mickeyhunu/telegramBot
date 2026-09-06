const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  globalThis.crypto = webcrypto;
}

const { fromPath } = require('node-telegram-bot-api/node');

const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

function readAdsConfig(configPath) {
  if (!fs.existsSync(configPath)) return { ads: [] };

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.ads)) {
    throw new Error('광고 설정의 ads는 배열이어야 합니다.');
  }
  return parsed;
}

function normalizeAd(ad, index, configDirectory) {
  const label = `ads[${index}]`;
  if (!ad || typeof ad !== 'object') throw new Error(`${label} 항목이 올바르지 않습니다.`);
  if (!Array.isArray(ad.groups) || ad.groups.length === 0) {
    throw new Error(`${label}.groups에 한 개 이상의 그룹 ID가 필요합니다.`);
  }
  if (typeof ad.message !== 'string' || !ad.message.trim()) {
    throw new Error(`${label}.message가 필요합니다.`);
  }

  const startAt = new Date(ad.startTime).getTime();
  if (!Number.isFinite(startAt)) throw new Error(`${label}.startTime은 ISO 8601 날짜여야 합니다.`);

  const repeatMinutes = Number(ad.repeatMinutes);
  if (!Number.isFinite(repeatMinutes) || repeatMinutes <= 0) {
    throw new Error(`${label}.repeatMinutes는 0보다 큰 숫자여야 합니다.`);
  }

  const photo = typeof ad.photo === 'string' && ad.photo.trim()
    ? path.resolve(configDirectory, ad.photo)
    : null;
  if (photo && !fs.existsSync(photo)) throw new Error(`${label}.photo 파일을 찾을 수 없습니다: ${photo}`);

  return {
    name: ad.name || `광고 ${index + 1}`,
    enabled: ad.enabled !== false,
    groups: [...new Set(ad.groups.map(String))],
    message: ad.message,
    photo,
    parseMode: ad.parseMode || undefined,
    disableNotification: ad.disableNotification === true,
    startAt,
    intervalMs: repeatMinutes * 60_000,
  };
}

function nextRunAt(startAt, intervalMs, now = Date.now()) {
  if (now <= startAt) return startAt;
  return startAt + (Math.ceil((now - startAt) / intervalMs) * intervalMs);
}

async function sendAd(api, ad, logger = console) {
  for (const chatId of ad.groups) {
    try {
      const common = {
        chat_id: chatId,
        parse_mode: ad.parseMode,
        disable_notification: ad.disableNotification,
      };
      if (ad.photo) {
        await api.sendPhoto({ ...common, photo: await fromPath(ad.photo), caption: ad.message });
      } else {
        await api.sendMessage({ ...common, text: ad.message });
      }
      logger.info(`[ads] 전송 완료: ${ad.name} -> ${chatId}`);
    } catch (error) {
      logger.error(`[ads] 전송 실패: ${ad.name} -> ${chatId}: ${error.message}`);
    }
  }
}

function scheduleAd(api, ad, { logger = console, now = Date.now } = {}) {
  let timer;
  let stopped = false;
  let target = nextRunAt(ad.startAt, ad.intervalMs, now());

  const arm = () => {
    if (stopped) return;
    const delay = Math.max(0, target - now());
    timer = setTimeout(async () => {
      if (stopped) return;
      // Node timers cannot wait longer than roughly 24.8 days. For a distant
      // start date, wake up in chunks without sending early.
      if (now() < target) {
        arm();
        return;
      }
      await sendAd(api, ad, logger);
      target += ad.intervalMs;
      if (target <= now()) {
        target += Math.ceil((now() - target + 1) / ad.intervalMs) * ad.intervalMs;
      }
      arm();
    }, Math.min(delay, MAX_TIMER_DELAY_MS));
    timer.unref?.();
  };

  arm();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

function startAdScheduler(api, configPath, { logger = console, now } = {}) {
  let config;
  try {
    config = readAdsConfig(configPath);
  } catch (error) {
    logger.error(`[ads] 설정을 읽지 못했습니다 (${configPath}): ${error.message}`);
    return { stop() {}, count: 0 };
  }

  const stops = [];
  for (const [index, rawAd] of config.ads.entries()) {
    try {
      const ad = normalizeAd(rawAd, index, path.dirname(configPath));
      if (!ad.enabled) continue;
      stops.push(scheduleAd(api, ad, { logger, now }));
      logger.info(`[ads] 예약 등록: ${ad.name}, 그룹 ${ad.groups.length}개`);
    } catch (error) {
      logger.error(`[ads] 예약 제외: ${error.message}`);
    }
  }

  return { stop: () => stops.forEach((stop) => stop()), count: stops.length };
}

module.exports = {
  nextRunAt,
  normalizeAd,
  readAdsConfig,
  sendAd,
  startAdScheduler,
};
