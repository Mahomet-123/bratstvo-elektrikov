/**
 * ============================================
 * Модуль: DaysJournal
 * Ответственность: Журнал работ по дням: дата, что сделано, часы. Пометка возможного дубля
 * Зависимости: dataManager, queue, dom, format, toast
 * ============================================
 */

import data from '../../db/dataManager.js';
import queue from '../../cache/queue.js';
import { el, qs, today, fmtDate, loadCss } from '../../utils/dom.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/DaysJournal/styles/DaysJournal.css');

/** Рендер журнала: форма + список дней по убыванию даты. */
export function render(root, { objectId, records, onChange }) {
  const days = records
    .filter(r => r.type === 'ДЕНЬ')
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const myHours = days
    .filter(r => r.user === data.state.user.login)
    .reduce((s, r) => s + r.qty, 0);

  root.innerHTML = `
    <div class="days">
      <form class="days__form">
        <div class="days__row">
          <label class="days__label">Дата
            <input class="days__date" type="date" value="${today()}" required>
          </label>
          <label class="days__label">Часы
            <input class="days__hours" type="number" min="0" step="0.5" value="8" required>
          </label>
        </div>
        <input class="days__text" maxlength="200" placeholder="Что сделано: тяну кабель на кухне, штробы…" required>
        <button class="days__submit" type="submit">Записать день</button>
      </form>
      <p class="days__mine">Мои часы на объекте: <b>${myHours}</b></p>
      <div class="days__list"></div>
    </div>`;

  const list = qs('.days__list', root);
  if (!days.length) list.appendChild(el('<p class="days__empty">Дней пока нет</p>'));
  days.forEach(day => list.appendChild(dayRow(day)));

  qs('.days__form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const item = {
      id: crypto.randomUUID(),
      type: 'ДЕНЬ',
      date: new Date(form.date.value + 'T12:00:00').toISOString(),
      user: data.state.user.login,
      name: form.text.value.trim().slice(0, 200),
      unit: 'ч',
      qty: Number(form.hours.value) || 0,
      coef: 1,
      price: 0,
      sum: 0,
    };
    if (!item.name) { toast.error('Опишите, что сделано'); return; }
    await queue.enqueue('records:append', { objectId, items: [item] });
    toast.ok('День записан' + (navigator.onLine ? '' : ' (уйдёт при связи)'));
    form.reset();
    form.date.value = today();
    onChange();
  });
}

function dayRow(day) {
  const node = el(`
    <article class="days__item${day.flags.includes('возможный дубль') ? ' days__item--dup' : ''}">
      <div class="days__item-head">
        <b>${fmtDate(day.date)}</b>
        <span class="days__item-user">${day.user} · ${day.qty} ч</span>
      </div>
      <p class="days__item-text">${day.name}</p>
      ${day.flags.includes('возможный дубль')
        ? '<p class="days__item-flag">Возможный дубль: тот же день с другого устройства — проверь</p>'
        : ''}
    </article>`);
  return node;
}

export default { render };
