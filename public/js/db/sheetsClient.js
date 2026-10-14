/**
 * ============================================
 * Модуль: sheetsClient
 * Ответственность: Вызовы Apps Script по смыслу действий (логин, объекты, записи, фото)
 * Зависимости: apiClient
 * ============================================
 */

import api from '../api/apiClient.js';

// Краткая мемоизация bootstrap: при входе прайс и объекты запрашиваются
// подряд — отвечаем одним запросом, а не двумя (каждый ответ ~2–4 с)
let bootMemo = null;
let bootAt = 0;
const BOOT_TTL_MS = 10000;

const sheets = {
  /** Вход: логин + код доступа → токен сессии. */
  login(login, code) {
    bootMemo = null; // новый пользователь — прежний ответ bootstrap не годится
    return api.post('login', { login, code, device: navigator.userAgent });
  },

  /** Полная загрузка при входе: пользователь, прайс, объекты. */
  bootstrap(token) {
    const now = Date.now();
    if (bootMemo && now - bootAt < BOOT_TTL_MS) return bootMemo;
    bootMemo = api.get('bootstrap', { token }).then(result => {
      if (!result || !result.ok) { bootMemo = null; }
      return result;
    }).catch(e => { bootMemo = null; throw e; });
    bootAt = now;
    return bootMemo;
  },

  loginOptions() {
    return api.get('login-options');
  },

  /** Лист объекта с записями. */
  object(token, id) {
    return api.get('object', { token, id });
  },

  /** Панель руководителя: кто что записал за дату, посещения, очередь. */
  daySummary(token, date) {
    return api.get('day-summary', { token, date });
  },

  users(token) {
    return api.get('users', { token });
  },

  /** Управление объектами — только руководитель. */
  objectsCreate(token, dataPayload) {
    return api.post('objects:create', { token, data: dataPayload });
  },

  objectsClose(token, id) {
    return api.post('objects:close', { token, id });
  },

  objectsResume(token, id) {
    return api.post('objects:resume', { token, id });
  },

  /** Управление профилями мастеров — только руководитель. */
  usersSave(token, dataPayload) {
    return api.post('users:save', { token, data: dataPayload });
  },

  /** Смена собственного кода доступа. */
  changeOwnCode(token, oldCode, newCode) {
    return api.post('users:change-own-code', { token, oldCode, newCode });
  },

  /** Записи (РАСЧЁТ / ДЕНЬ / ЗАКУПКА) пачкой — из очереди или напрямую. */
  appendRecords(token, objectId, items) {
    return api.post('records:append', { token, objectId, items });
  },

  /** Загрузка фото накладной. */
  uploadPhoto(token, objectId, base64, mime) {
    return api.post('photos:upload', { token, objectId, base64, mime });
  },

  statusReport(token, pending, comment) {
    return api.post('status:report', { token, pending, comment });
  },

  /** Кабинет клиента по одноразовой ссылке — без токена (публичный маршрут). */
  cabinetData(objectId, key) {
    return api.get('cabinet', { object: objectId, key });
  },

  /** Последние снимки очереди по мастерам (панель руководителя). */
  queueStatuses(token) {
    return api.post('status:queue-depth', { token });
  },
};

export default sheets;
