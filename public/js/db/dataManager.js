/**
 * ============================================
 * Модуль: dataManager
 * Ответственность: Кэш-первый доступ к данным: мгновенный рендер из кэша, фоном — сеть
 * Зависимости: storageAdapter, sheetsClient, apiClient
 * ============================================
 */

import storage from '../cache/storageAdapter.js';
import sheets from './sheetsClient.js';

const TTL_MS = 5 * 60 * 1000; // обновление раз в 5 минут

const state = {
  token: storage.local.get('token', null),
  user: storage.local.get('user', null),
  prices: storage.local.get('prices', null),
  pricesAt: 0,
  objects: storage.local.get('objects', []),
  objectsAt: 0,
  lastRecordDates: storage.local.get('lastRecordDates', {}),
  /** Ленивая загрузка: содержимое объекта тянется только при открытии. */
  objectCache: new Map(),
};

function isFresh(at) {
  return Date.now() - at < TTL_MS;
}

/** Сохранить сессию после входа. */
function setSession(token, user) {
  state.token = token;
  state.user = user;
  storage.local.set('token', token);
  storage.local.set('user', user);
}

function clearSession() {
  state.token = null;
  state.user = null;
  storage.local.remove('token');
  storage.local.remove('user');
}

/** Прайс: сначала кэш, затем фоновая проверка. */
async function prices() {
  if (!state.prices || !isFresh(state.pricesAt)) {
    state.prices = storage.local.get('prices', null);
  }
  if (state.prices) {
    refreshPricesInBackground();
    return state.prices;
  }
  const result = await sheets.bootstrap(state.token);
  if (result && result.ok && result.prices) {
    state.prices = result.prices;
    state.pricesAt = Date.now();
    storage.local.set('prices', result.prices);
  }
  return state.prices;
}

async function refreshPricesInBackground() {
  try {
    const result = await sheets.bootstrap(state.token);
    if (result && result.ok && result.prices) {
      state.prices = result.prices;
      state.pricesAt = Date.now();
      storage.local.set('prices', result.prices);
    }
  } catch (e) { /* офлайн — работаем на кэше */ }
}

/** Список объектов: кэш сразу, фоном — сеть. */
async function objects() {
  const cached = storage.local.get('objects', null);
  if (cached) {
    state.objects = cached;
    refreshObjectsInBackground();
    return cached;
  }
  const result = await sheets.bootstrap(state.token);
  if (result && result.ok) {
    saveObjects(result.objects, result.lastRecordDates);
    return result.objects;
  }
  return [];
}

async function refreshObjectsInBackground() {
  try {
    const result = await sheets.bootstrap(state.token);
    if (result && result.ok) {
      saveObjects(result.objects, result.lastRecordDates);
      window.dispatchEvent(new CustomEvent('objects:changed'));
    }
  } catch (e) { /* офлайн */ }
}

function saveObjects(objects, lastRecordDates) {
  state.objects = objects;
  state.objectsAt = Date.now();
  state.lastRecordDates = lastRecordDates || {};
  storage.local.set('objects', objects);
  storage.local.set('lastRecordDates', state.lastRecordDates);
}

/** Принудительное обновление списка объектов из сети. */
async function refreshObjects() {
  storage.local.remove('objects');
  state.objects = [];
  const result = await sheets.bootstrap(state.token);
  if (result && result.ok) {
    saveObjects(result.objects, result.lastRecordDates);
    window.dispatchEvent(new CustomEvent('objects:changed'));
  }
  return state.objects;
}

/** Записи объекта — лениво, с кэшем в памяти (обновление по требованию). */
async function objectRecords(id, { force = false } = {}) {
  if (!force && state.objectCache.has(id)) return state.objectCache.get(id);
  const result = await sheets.object(state.token, id);
  if (!result.ok) throw new Error(result.error || 'Не удалось загрузить объект');
  const data = { object: result.object, records: result.records };
  state.objectCache.set(id, data);
  return data;
}

function dropObjectCache(id) {
  state.objectCache.delete(id);
}

export default {
  state, setSession, clearSession,
  prices, objects, refreshObjects, objectRecords, dropObjectCache, saveObjects,
};
