const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  globalThis.crypto = webcrypto;
}

const { fromPath } = require('node-telegram-bot-api/node');

const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function normalizeTelegramId(value) {
  return String(value ?? '').trim().replace(/^@+/, '');
}

function normalizeInlineKeyboard(value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}.inlineKeyboard는 한 개 이상의 버튼 행이 필요합니다.`);
  }

  return value.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0) {
      throw new Error(`${label}.inlineKeyboard[${rowIndex}]는 한 개 이상의 버튼이 필요합니다.`);
    }
    return row.map((button, buttonIndex) => {
      const buttonLabel = `${label}.inlineKeyboard[${rowIndex}][${buttonIndex}]`;
      if (!button || typeof button.text !== 'string' || !button.text.trim()) {
        throw new Error(`${buttonLabel}.text가 필요합니다.`);
      }
      if (typeof button.url !== 'string' || !/^(?:https?:\/\/|tg:\/\/)/i.test(button.url)) {
        throw new Error(`${buttonLabel}.url은 http(s) 또는 tg 링크여야 합니다.`);
      }
      return { text: button.text.trim(), url: button.url.trim() };
    });
  });
}

function formatBusinessAd(row) {
  const lines = [
    `<b>⭐️ ${escapeHtml(row.title)} ⭐️</b>`,
    '',
    `<b>💎 연락처 : ${escapeHtml(row.manager_contact)}</b>`,
  ];
  const kakaoTalkId = String(row.kakao_talk_id ?? '').trim();
  if (kakaoTalkId) lines.push(`<b>💎 카카오톡 : ${escapeHtml(kakaoTalkId)}</b>`);

  const telegramId = normalizeTelegramId(row.telegram_id);
  if (telegramId) {
    const escapedId = escapeHtml(telegramId);
    lines.push(`<b>💎 텔레그램 :</b> <a href="https://t.me/${encodeURIComponent(telegramId)}"><b>@${escapedId}</b></a>`);
  }
  return lines.join('\n');
}

async function readActiveBusinessAds(pool) {
  const [rows] = await pool.execute(
    `SELECT id, title, image_url, manager_contact, kakao_talk_id, telegram_id
       FROM business_ads
      WHERE registration_status = 'REGISTERED'
        AND plan_type IN ('PREMIUM', 'PLUS')
        AND (
          (activated_until IS NOT NULL AND activated_until > UTC_TIMESTAMP())
          OR
          (piece_activated_until IS NOT NULL AND piece_activated_until > UTC_TIMESTAMP())
        )
      ORDER BY id ASC`,
  );
  return rows;
}

function createBusinessAdsSender(api, pool, groups, options = {}) {
  const logger = options.logger || console;
  let lastAdId = null;

  return async () => {
    let rows;
    try {
      rows = await readActiveBusinessAds(pool);
    } catch (error) {
      logger.error(`[ads] business_ads 조회 실패: ${error.message}`);
      return;
    }
    if (rows.length === 0) {
      logger.info('[ads] 전송할 활성 business_ads가 없습니다.');
      return;
    }

    const row = lastAdId === null
      ? rows[0]
      : rows.find((candidate) => BigInt(candidate.id) > BigInt(lastAdId)) || rows[0];
    const ad = {
      name: `business_ads #${row.id}`,
      groups,
      message: formatBusinessAd(row),
      photo: String(row.image_url || '').trim() || null,
      parseMode: 'HTML',
      disableNotification: options.disableNotification === true,
      inlineKeyboard: options.inlineKeyboard,
    };
    await sendAd(api, ad, logger);
    lastAdId = row.id;
  };
}

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
  const source = ad.source === 'business_ads' ? 'business_ads' : 'static';
  if (source === 'static' && (typeof ad.message !== 'string' || !ad.message.trim())) {
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
    inlineKeyboard: normalizeInlineKeyboard(ad.inlineKeyboard, label),
    source,
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
        reply_markup: ad.inlineKeyboard
          ? { inline_keyboard: ad.inlineKeyboard }
          : undefined,
      };
      if (ad.photo) {
        const photo = /^https?:\/\//i.test(ad.photo) ? ad.photo : await fromPath(ad.photo);
        await api.sendPhoto({ ...common, photo, caption: ad.message });
      } else {
        await api.sendMessage({ ...common, text: ad.message });
      }
      logger.info(`[ads] 전송 완료: ${ad.name} -> ${chatId}`);
    } catch (error) {
      logger.error(`[ads] 전송 실패: ${ad.name} -> ${chatId}: ${error.message}`);
    }
  }
}

function scheduleAd(api, ad, { logger = console, now = Date.now, send = () => sendAd(api, ad, logger) } = {}) {
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
      await send();
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

function startAdScheduler(api, configPath, { logger = console, now, businessAdsPool } = {}) {
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
      if (ad.source === 'business_ads' && !businessAdsPool) {
        throw new Error(`ads[${index}].source가 business_ads이지만 MNMS DB 풀이 없습니다.`);
      }
      const send = ad.source === 'business_ads'
        ? createBusinessAdsSender(api, businessAdsPool, ad.groups, {
          logger,
          disableNotification: ad.disableNotification,
          inlineKeyboard: ad.inlineKeyboard,
        })
        : undefined;
      stops.push(scheduleAd(api, ad, { logger, now, send }));
      logger.info(`[ads] 예약 등록: ${ad.name}, 그룹 ${ad.groups.length}개`);
    } catch (error) {
      logger.error(`[ads] 예약 제외: ${error.message}`);
    }
  }

  return { stop: () => stops.forEach((stop) => stop()), count: stops.length };
}

module.exports = {
  createBusinessAdsSender,
  escapeHtml,
  formatBusinessAd,
  nextRunAt,
  normalizeAd,
  readAdsConfig,
  readActiveBusinessAds,
  sendAd,
  startAdScheduler,
};
