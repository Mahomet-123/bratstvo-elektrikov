/**
 * ============================================
 * Модуль: app (точка входа)
 * Ответственность: Запуск PWA: сервис-воркер, проверка сессии, хэш-роутинг, шапка
 * Зависимости: Login, ObjectsList, ObjectCard, LeaderPanel, SyncIndicator, dataManager
 * ============================================
 */

import data from './db/dataManager.js';
import sheets from './db/sheetsClient.js';
import config from './config.js';
import Login from './components/Login/Login.js';
import ObjectsList from './components/ObjectsList/ObjectsList.js';
import ObjectCard from './components/ObjectCard/ObjectCard.js';
import LeaderPanel from './components/LeaderPanel/LeaderPanel.js';
import SyncIndicator from './components/SyncIndicator/SyncIndicator.js';
import { qs } from './utils/dom.js';
import toast from './utils/toast.js';

const root = qs('#app-root');
const headerRight = qs('#header-right');

function navigate(hash) {
  location.hash = hash;
}

async function route() {
  const hash = location.hash || '#/objects';
  if (!data.state.token) {
    SyncIndicator.mount(headerRight);
    await Login.render(root, () => route());
    return;
  }
  SyncIndicator.mount(headerRight);

  if (hash.startsWith('#/object/')) {
    const id = hash.replace('#/object/', '');
    try {
      await ObjectCard.render(root, id, { navigate });
    } catch (e) {
      root.innerHTML = `<p class="app__error">${e.message}</p>`;
    }
    return;
  }
  if (hash === '#/leader') {
    await LeaderPanel.render(root);
    return;
  }
  await ObjectsList.render(root, { navigate });
}

window.addEventListener('hashchange', route);

// Сервис-воркер — кэш оболочки для офлайн-запуска
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Проверка сессии при старте: токен живёт 30 дней
(async () => {
  if (data.state.token && data.state.user) {
    try {
      const result = await sheets.bootstrap(data.state.token);
      if (!result.ok) throw new Error(result.error || 'Сессия истекла');
      data.setSession(data.state.token, data.state.user);
    } catch (e) {
      data.clearSession();
    }
  }
  if (config.API_URL.includes('PLACEHOLDER')) {
    toast.error('Укажите адрес веб-приложения Apps Script в public/js/config.js');
  }
  route();
})();
