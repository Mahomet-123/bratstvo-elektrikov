/**
 * ============================================
 * Модуль: ReportView
 * Ответственность: Итог по объекту для клиента: работы, материалы, ход работ, итоги.
 *                   Печать в PDF и временная ссылка кабинета клиента (сокращение через clck.ru)
 * Зависимости: dataManager, dom, format
 * ============================================
 */

import { el, qs, fmtDate, loadCss } from '../../utils/dom.js';
import { money } from '../../utils/format.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/ReportView/styles/ReportView.css');

export function render(root, { objectId, object, records }) {
  const works = records.filter(r => r.type === 'РАСЧЁТ' && !r.flags.includes('удалено'));
  const days = records.filter(r => r.type === 'ДЕНЬ').sort((a, b) => a.date.localeCompare(b.date));
  const purchases = records.filter(r => r.type === 'ЗАКУПКА' && !r.flags.includes('удалено'));

  const worksSum = works.reduce((s, r) => s + r.sum, 0);
  const purchasesSum = purchases.reduce((s, r) => s + r.sum, 0);
  // Правило прайса №203: снабжение материалом — 10% от стоимости материалов, минимум 1500 ₽
  const supply = purchasesSum > 0 ? Math.max(purchasesSum * 0.1, 1500) : 0;
  const total = worksSum + purchasesSum + supply;

  root.innerHTML = `
    <div class="report">
      <section class="report__head">
        <h2 class="report__title">${object.name}</h2>
        <p class="report__meta">Заказчик: ${object.client || '—'} · ${object.address || ''}</p>
        <p class="report__meta">Отчёт на ${fmtDate(new Date().toISOString())} · статус: ${object.status}</p>
      </section>
      <section class="report__block">
        <h3>Работы</h3>
        <table class="report__table">
          <thead><tr><th>Наименование</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${works.map(r => `
            <tr><td>${r.name}</td><td>${r.qty} ${r.unit}${r.coef !== 1 ? ` ×${String(r.coef).replace('.', ',')}` : ''}</td><td>${money(r.sum)}</td></tr>`).join('') || '<tr><td colspan="3">Пока нет</td></tr>'}</tbody>
        </table>
      </section>
      <section class="report__block">
        <h3>Материалы</h3>
        <table class="report__table">
          <thead><tr><th>Наименование</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${purchases.map(r => `
            <tr><td>${r.name}${r.comment ? ` <i>(${r.comment})</i>` : ''}</td><td>${r.qty}</td><td>${money(r.sum)}</td></tr>`).join('') || '<tr><td colspan="3">Пока нет</td></tr>'}</tbody>
        </table>
      </section>
      <section class="report__block">
        <h3>Ход работ по дням</h3>
        <ul class="report__days">${days.map(r =>
          `<li><b>${fmtDate(r.date)}</b> — ${r.name} <i>(${r.user}, ${r.qty} ч)</i></li>`).join('') || '<li>Записей нет</li>'}</ul>
      </section>
      <section class="report__total">
        <div>Работы: ${money(worksSum)}</div>
        <div>Материалы: ${money(purchasesSum)}</div>
        <div>Снабжение материалом (10%, мин. 1500 ₽): ${money(supply)}</div>
        <div class="report__total-main">Итого: ${money(total)}</div>
      </section>
      <div class="report__actions">
        <button class="report__print" type="button">Печать / сохранить PDF</button>
        <button class="report__link" type="button">Ссылка для клиента</button>
      </div>
      <p class="report__link-out" hidden></p>
    </div>`;

  qs('.report__print', root).addEventListener('click', () => window.print());

  qs('.report__link', root).addEventListener('click', async () => {
    const out = qs('.report__link-out', root);
    const long = apiUrlCabinet(objectId, object.token);
    out.hidden = false;
    out.textContent = 'Сокращаю…';
    try {
      const short = await shorten(long);
      out.innerHTML = '';
      // Обёртка нужна из-за el(): помощник возвращает только первый элемент
      // шаблона — без неё ссылка и кнопка «Копировать» потерялись бы.
      out.appendChild(el(`
        <div class="report__link-row">
          <span>Ссылка для клиента (живёт до закрытия объекта):</span>
          <a class="report__url" href="${short}" target="_blank" rel="noopener">${short}</a>
          <button class="report__copy" type="button">Копировать</button>
        </div>`));
      qs('.report__copy', root).addEventListener('click', async () => {
        await navigator.clipboard.writeText(short);
        out.appendChild(el('<span class="report__copied">скопировано</span>'));
      });
    } catch (e) {
      out.innerHTML = '';
      out.appendChild(el(`
        <div class="report__link-row">
          <span>Не удалось сократить, вот полная ссылка:</span>
          <a class="report__url" href="${long}" target="_blank" rel="noopener">${long}</a>
        </div>`));
    }
  });
}

/**
 * Ссылка на кабинет клиента внутри нашего PWA — без промежуточной страницы Google.
 * Маршрут #/cabinet/:id/:token работает без входа (проверка по токену объекта).
 */
function apiUrlCabinet(objectId, token) {
  return location.origin + location.pathname + '#/cabinet/' + encodeURIComponent(objectId) + '/' + encodeURIComponent(token);
}

/** Сокращение ссылки через бесплатный сервис clck.ru (отдаёт короткий адрес текстом).
 *  Таймаут 10 с: если сервис подвиснет — покажем полную ссылку, а не «Сокращаю…» навсегда. */
async function shorten(long) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://clck.ru/--?url=' + encodeURIComponent(long), { signal: controller.signal });
    if (!response.ok) throw new Error('clck.ru недоступен');
    return (await response.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

export default { render };
