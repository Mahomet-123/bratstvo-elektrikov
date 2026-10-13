/**
 * ============================================
 * Модуль: LeaderPanel
 * Ответственность: Панель руководителя: кто заходил, кто что записал за дату, очередь машин,
 *                   «дней без записи» по объектам, выдача логинов и кодов мастерам
 * Зависимости: dataManager, sheetsClient, dom, format
 * ============================================
 */

import data from '../../db/dataManager.js';
import sheets from '../../db/sheetsClient.js';
import { el, qs, today } from '../../utils/dom.js';
import './styles/LeaderPanel.css';

export async function render(root) {
  const isLeader = data.state.user && data.state.user.role === 'руководитель';
  if (!isLeader) {
    root.innerHTML = '<p class="leader__denied">Панель доступна только руководителю</p>';
    return;
  }

  root.innerHTML = `
    <div class="leader">
      <h1 class="leader__title">Панель руководителя</h1>
      <label class="leader__date-label">Дата
        <input class="leader__date" type="date" value="${today()}">
      </label>
      <section class="leader__block">
        <h2>Записи за выбранную дату</h2>
        <div class="leader__summary"></div>
      </section>
      <section class="leader__block">
        <h2>Объекты: дней без записи</h2>
        <div class="leader__objects"></div>
      </section>
      <section class="leader__block">
        <h2>Посещения и очереди отправки</h2>
        <div class="leader__visits"></div>
      </section>
      <section class="leader__block">
        <h2>Мастера: выдать логин и код</h2>
        <div class="leader__users"></div>
      </section>
    </div>`;

  const dateInput = qs('.leader__date', root);
  dateInput.addEventListener('change', () => loadDay(dateInput.value));

  await loadDay(dateInput.value);
  await loadVisits();
  await loadUsers();
}

async function loadDay(date) {
  const root = document.getElementById('app-root');
  const box = qs('.leader__summary', root);
  box.innerHTML = '<p>Загружаю…</p>';
  try {
    const [summary, objects] = await Promise.all([
      sheets.daySummary(data.state.token, date),
      data.objects(),
    ]);
    const dates = data.state.lastRecordDates;
    renderSummary(box, summary.summary);
    const objBox = qs('.leader__objects', root);
    objBox.innerHTML = '';
    objects.forEach(obj => {
      const last = dates[obj.id];
      const days = last ? Math.round((Date.now() - new Date(last)) / 86400000) : 'нет записей';
      objBox.appendChild(el(`
        <div class="leader__object">
          <span>${obj.number} ${obj.name}</span>
          <b>${days === 'нет записей' ? days : days + ' дн.'}</b>
        </div>`));
    });
  } catch (e) {
    box.innerHTML = `<p class="leader__error">${e.message}</p>`;
  }
}

function renderSummary(box, summary) {
  box.innerHTML = '';
  if (!summary.length) {
    box.appendChild(el('<p>Нет объектов в работе</p>'));
    return;
  }
  summary.forEach(obj => {
    const users = obj.perUser.length
      ? obj.perUser.map(u => `${u.user}: ${u.records} зап., ${u.hours} ч`).join(' · ')
      : 'записей нет';
    box.appendChild(el(`
      <div class="leader__row">
        <span class="leader__row-name">${obj.name}</span>
        <span class="leader__row-users">${users}</span>
      </div>`));
  });
}

async function loadVisits() {
  const root = document.getElementById('app-root');
  const box = qs('.leader__visits', root);
  try {
    const [summary, statuses] = await Promise.all([
      sheets.daySummary(data.state.token, today()),
      fetchQueueStatuses(),
    ]);
    const lastVisit = {};
    summary.visits.forEach(v => {
      if (!lastVisit[v['Логин']]) lastVisit[v['Логин']] = v;
    });
    box.innerHTML = '';
    const logins = Object.keys(lastVisit);
    if (!logins.length) {
      box.appendChild(el('<p>Посещений пока нет</p>'));
      return;
    }
    logins.forEach(login => {
      const visit = lastVisit[login];
      const pending = statuses[login] ? statuses[login].pending : 0;
      box.appendChild(el(`
        <div class="leader__visit">
          <b>${login}</b>
          <span>вход: ${new Date(visit['Дата']).toLocaleString('ru-RU')}</span>
          <span class="leader__pending">${pending ? 'не отправлено: ' + pending : 'очередь пуста'}</span>
        </div>`));
    });
  } catch (e) {
    box.innerHTML = `<p class="leader__error">${e.message}</p>`;
  }
}

async function fetchQueueStatuses() {
  try {
    const result = await sheets.queueStatuses(data.state.token);
    return (result.ok && result.statuses) || {};
  } catch (e) {
    return {};
  }
}

async function loadUsers() {
  const root = document.getElementById('app-root');
  const box = qs('.leader__users', root);
  try {
    const result = await sheets.users(data.state.token);
    const users = (result.ok && result.users) || [];
    box.innerHTML = '';
    const form = el(`
      <form class="leader__user-form">
        <select name="login" required>
          ${users.filter(u => u.role !== 'руководитель').map(u =>
            `<option value="${u.login}"${u.active ? ' disabled' : ''}>${u.login}${u.active ? ' — активен' : ''}</option>`).join('')}
        </select>
        <input name="name" placeholder="Имя мастера" maxlength="60">
        <input name="code" placeholder="Код доступа" minlength="4" required>
        <button type="submit">Выдать доступ</button>
      </form>`);
    box.appendChild(form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await sheets.usersSave(data.state.token, {
          login: form.login.value,
          name: form.name.value || form.login.value,
          code: form.code.value,
          role: 'мастер',
          active: true,
        });
        await loadUsers();
      } catch (e) {
        alert(e.message);
      }
    });
    const list = el('<div class="leader__user-list"></div>');
    users.forEach(u => {
      list.appendChild(el(`
        <div class="leader__user">
          <b>${u.name}</b>
          <span>${u.login} · ${u.role} · ${u.active ? 'активен' : 'ожидает'}</span>
        </div>`));
    });
    box.appendChild(list);
  } catch (e) {
    box.innerHTML = `<p class="leader__error">${e.message}</p>`;
  }
}

export default { render };
