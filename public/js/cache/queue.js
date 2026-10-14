/**
 * ============================================
 * Модуль: queue
 * Ответственность: Офлайн-очередь записей в IndexedDB: накопление, автоотправка, ручная отправка
 * Зависимости: config, apiClient, dataManager
 * ============================================
 */

import config from '../config.js';
import api from '../api/apiClient.js';
import data from '../db/dataManager.js';

const DB_NAME = 'bratstvo-queue';
const STORE = 'outbox';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(mode) {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Положить действие в очередь (токен сессии подставляется автоматически). */
async function enqueue(action, payload) {
  const item = {
    id: crypto.randomUUID(),
    action,
    payload: { token: data.state.token, ...payload },
    attempts: 0,
    nextTryAt: 0,
    createdAt: Date.now(),
  };
  const store = await tx('readwrite');
  store.put(item);
  notify();
  flushSoon();
  return item.id;
}

async function all() {
  const store = await tx('readonly');
  return new Promise(resolve => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function remove(id) {
  const store = await tx('readwrite');
  store.delete(id);
  notify();
}

async function update(item) {
  const store = await tx('readwrite');
  store.put(item);
  notify();
}

/**
 * Отправка очереди. Каждый элемент уходит отдельным POST;
 * при ошибке — повторы по расписанию (1, 5, 15 минут).
 * @returns {{sent: number, failed: number, pending: number}}
 */
async function flush() {
  const items = await all();
  if (!items.length) return { sent: 0, failed: 0, pending: 0 };
  let sent = 0;
  let failed = 0;
  const now = Date.now();
  for (const item of items) {
    if (item.nextTryAt > now) { failed++; continue; }
    try {
      const run = handlers[item.action] || (payload => api.post(item.action, payload));
      const result = await run(item.payload);
      if (result && result.ok) {
        await remove(item.id);
        sent++;
      } else {
        await backoff(item);
        failed++;
      }
    } catch (e) {
      await backoff(item);
      failed++;
    }
  }
  notify();
  return { sent, failed, pending: (await all()).length };
}

/** Отложить повтор по нарастающему расписанию. */
async function backoff(item) {
  const delays = config.QUEUE.BACKOFF_MS;
  const delay = delays[Math.min(item.attempts, delays.length - 1)];
  item.attempts += 1;
  item.nextTryAt = Date.now() + delay;
  await update(item);
}

/** Ручная отправка по тапу на индикатор. */
async function flushNow() {
  const items = await all();
  for (const item of items) {
    item.nextTryAt = 0;
    item.attempts = 0;
    await update(item);
  }
  return flush();
}

/**
 * Обработчики составных действий очереди.
 * «Запись с фото»: сначала грузим все фото накладных, потом саму запись со ссылками.
 */
const handlers = {
  'record-with-photos': async payload => {
    const ids = [];
    for (const photo of payload.photos || []) {
      const result = await api.post('photos:upload', {
        token: payload.token,
        objectId: payload.objectId,
        base64: photo.base64,
        mime: photo.mime,
      });
      if (!result.ok) throw new Error(result.error || 'Фото не загрузилось');
      ids.push(result.fileId);
    }
    return api.post('records:append', {
      token: payload.token,
      objectId: payload.objectId,
      items: [{ ...payload.record, photoIds: ids.join(',') }],
    });
  },
};

let debounce = null;
let pollTimer = null;

/** Отложенная отправка сразу после появления новой записи. */
function flushSoon() {
  if (debounce) return;
  debounce = setTimeout(async () => {
    debounce = null;
    await flush();
    ensurePolling();
  }, 1000);
}

/** Единый опрос очереди, пока она не опустеет. */
function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    await flush();
    if (!(await all()).length) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }, config.QUEUE.INTERVAL_MS);
}

/** Подписка на изменения очереди — рисует индикатор. */
function notify() {
  window.dispatchEvent(new CustomEvent('queue:changed'));
}

/** Автоотправка при появлении сети. */
/** Автоотправка при появлении сети: сбрасываем отсрочку повторов и шлём сразу. */
window.addEventListener('online', async () => {
  const items = await all();
  for (const item of items) {
    item.nextTryAt = 0;
    item.attempts = 0;
    await update(item);
  }
  await flush();
});

export default { enqueue, all, flush, flushNow, notify };
