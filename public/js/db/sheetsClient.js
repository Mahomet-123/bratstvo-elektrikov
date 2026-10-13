/**
 * ============================================
 * Модуль: sheetsClient
 * Ответственность: Вызовы Apps Script по смыслу действий (логин, объекты, записи, фото)
 * Зависимости: apiClient
 * ============================================
 */

import api from '../api/apiClient.js';

const sheets = {
  /** Вход: логин + код доступа → токен сессии. */
  login(login, code) {
    return api.post('login', { login, code, device: navigator.userAgent });
  },

  /** Полная загрузка при входе: пользователь, прайс, объекты. */
  bootstrap(token) {
    return api.get('bootstrap', { token });
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

  /** Последние снимки очереди по мастерам (панель руководителя). */
  queueStatuses(token) {
    return api.post('status:queue-depth', { token });
  },
};

export default sheets;
