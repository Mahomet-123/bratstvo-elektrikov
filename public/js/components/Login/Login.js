/**
 * ============================================
 * Модуль: Login
 * Ответственность: Экран входа: выбор профиля и код доступа, выдача сессии
 * Зависимости: sheetsClient, dataManager, storageAdapter, dom, toast
 * ============================================
 */

import sheets from '../../db/sheetsClient.js';
import data from '../../db/dataManager.js';
import storage from '../../cache/storageAdapter.js';
import { el, qs, loadCss } from '../../utils/dom.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/Login/styles/Login.css');

let options = [];

export async function render(root, onDone) {
  let html = `
    <form class="login" novalidate>
      <h1 class="login__title">Вход в учёт объектов</h1>
      <label class="login__field">
        <span class="login__label">Профиль</span>
        <select class="login__input" id="login-select">
          <option value="">— выберите —</option>
        </select>
      </label>
      <label class="login__field">
        <span class="login__label">Код доступа</span>
        <input class="login__input" id="login-code" type="password" inputmode="numeric"
               autocomplete="current-password" placeholder="Код от руководителя">
      </label>
      <button class="login__submit" type="submit">Войти</button>
      <p class="login__hint">Логин и код выдаёт Руководитель</p>
    </form>`;
  root.innerHTML = html;
  const form = qs('.login', root);

  // Список профилей — с сервера, при офлайне — последний использованный логин
  try {
    const result = await sheets.loginOptions();
    options = (result.ok && result.users) || [];
  } catch (e) {
    const last = storage.local.get('lastLogin', '');
    options = last ? [{ login: last, name: last, role: '' }] : [];
  }
  options.forEach(u => {
    const option = document.createElement('option');
    option.value = u.login;
    option.textContent = u.name + (u.role === 'руководитель' ? ' (руководитель)' : '');
    form.querySelector('#login-select').append(option);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const login = qs('#login-select', form).value || qs('#login-select', form).textContent;
    const code = qs('#login-code', form).value;
    if (!login) { toast.error('Выберите профиль'); return; }
    try {
      const result = await sheets.login(login, code);
      if (!result.ok) { toast.error(result.error || 'Не удалось войти'); return; }
      storage.local.set('lastLogin', login);
      data.setSession(result.token, result.user);
      const boot = await data.prices();
      if (!boot) throw new Error('Не удалось загрузить прайс');
      await data.objects();
      onDone();
    } catch (e) {
      toast.error(e.message || 'Ошибка входа');
    }
  });
}

export default { render };
