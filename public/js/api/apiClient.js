/**
 * ============================================
 * Модуль: apiClient
 * Ответственность: Запросы к Apps Script как к REST. Обход предзапроса CORS через text/plain
 * Зависимости: config
 * ============================================
 */

import config from '../config.js';

const api = {
  /** GET-действие: ?action=...&token=... */
  async get(action, params = {}) {
    const url = new URL(config.API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, { redirect: 'follow' });
    return response.json();
  },

  /** POST-действие: JSON в теле. Content-Type text/plain — иначе браузер шлёт предзапрос,
   *  на который Apps Script не отвечает корректно. */
  async post(action, payload = {}) {
    const response = await fetch(config.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
    });
    return response.json();
  },
};

export default api;
