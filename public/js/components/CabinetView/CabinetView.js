/**
 * ============================================
 * Модуль: CabinetView
 * Ответственность: Кабинет клиента по одноразовой ссылке (наш домен, без входа):
 *                   работы, материалы, ход работ по дням, фото накладных, итоги, печать.
 *                   Заменяет HTML-страницу Apps Script с промежуточным экраном Google.
 * Зависимости: sheetsClient, dom, format, photo
 * ============================================
 */

import sheets from '../../db/sheetsClient.js';
import { el, qs, fmtDate, loadCss } from '../../utils/dom.js';
import { money } from '../../utils/format.js';
import { driveUrl, mountPhotos } from '../../utils/photo.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/CabinetView/styles/CabinetView.css');

/**
 * Показать кабинет клиента.
 * @param {HTMLElement} root
 * @param {string} objectId — id объекта
 * @param {string} key — токен из одноразовой ссылки
 */
export async function render(root, objectId, key) {
  root.innerHTML = `<div class="cabinet cabinet__loading">Загрузка кабинета…</div>`;

  let result;
  try {
    result = await sheets.cabinetData(objectId, key);
  } catch (e) {
    // Сеть недоступна или сервер не ответил — предлагаем повторить
    root.innerHTML = `
      <div class="cabinet cabinet__error">
        <h1 class="cabinet__error-title">Не получилось загрузить</h1>
        <p class="cabinet__error-text">${esc(e.message || 'Проверьте связь и попробуйте снова.')}</p>
        <button class="cabinet__retry" type="button">Повторить</button>
      </div>`;
    qs('.cabinet__retry', root).addEventListener('click', () => render(root, objectId, key));
    return;
  }

  if (!result || !result.ok) {
    const text = (result && result.error) || 'Ссылка недействительна. Попросите мастера прислать новую.';
    root.innerHTML = `
      <div class="cabinet cabinet__error">
        <h1 class="cabinet__error-title">Кабинет недоступен</h1>
        <p class="cabinet__error-text">${esc(text)}</p>
      </div>`;
    return;
  }

  const { object, records, totals } = result;
  const { works, days, purchases } = records;
  const photos = purchases
    .flatMap(p => String(p.photoIds || '').split(','))
    .map(id => id.trim())
    .filter(Boolean);

  root.innerHTML = `
    <div class="cabinet">
      <header class="cabinet__head">
        <h1 class="cabinet__title">${esc(object.name)}</h1>
        <p class="cabinet__meta">Заказчик: ${esc(object.client || '—')}${object.address ? ' · ' + esc(object.address) : ''}</p>
        <p class="cabinet__meta">Статус: ${esc(object.status)}</p>
      </header>

      <section class="cabinet__block">
        <h2 class="cabinet__block-title">Выполненные работы</h2>
        <table class="cabinet__table">
          <thead><tr><th>Работа</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${works.map(r => `
            <tr><td>${esc(r.name)}</td><td>${r.qty} ${esc(r.unit || '')}</td><td>${money(r.sum)}</td></tr>`).join('')
            || '<tr><td colspan="3">Пока нет</td></tr>'}</tbody>
        </table>
      </section>

      <section class="cabinet__block">
        <h2 class="cabinet__block-title">Материалы и закупки</h2>
        <table class="cabinet__table">
          <thead><tr><th>Материал</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${purchases.map(r => `
            <tr><td>${esc(r.name)}${r.comment ? ` <i>(${esc(r.comment)})</i>` : ''}</td><td>${r.qty}</td><td>${money(r.sum)}</td></tr>`).join('')
            || '<tr><td colspan="3">Пока нет</td></tr>'}</tbody>
        </table>
      </section>

      <section class="cabinet__block">
        <h2 class="cabinet__block-title">Ход работ по дням</h2>
        <ul class="cabinet__days">${days.map(r =>
          `<li><b>${esc(fmtDate(r.date))}</b> — ${esc(r.name)} <i>(${esc(r.user || '')}, ${r.qty} ч)</i></li>`).join('')
          || '<li>Записей пока нет</li>'}</ul>
      </section>

      ${photos.length ? `
        <section class="cabinet__block">
          <h2 class="cabinet__block-title">Фото накладных</h2>
          <div class="cabinet__photos">${photos.map(id => `
            <a class="cabinet__photo" href="${driveUrl(id)}" target="_blank" rel="noopener">
              <img data-photo="${id}" alt="Фото накладной" loading="lazy">
            </a>`).join('')}</div>
        </section>` : ''}

      <footer class="cabinet__total">
        <div>Работы: ${money(totals.works)}</div>
        <div>Материалы: ${money(totals.purchases)}</div>
        <div>Снабжение материалом (10%, мин. 1500 ₽): ${money(totals.supply)}</div>
        <div class="cabinet__total-main">Итого: ${money(totals.total)}</div>
      </footer>

      <div class="cabinet__actions">
        <button class="cabinet__print" type="button">Печать / сохранить PDF</button>
        <button class="cabinet__refresh" type="button">Обновить</button>
      </div>
      <p class="cabinet__hint">Ссылка работает, пока объект не закрыт. После закрытия попросите мастера прислать итоговый отчёт.</p>
    </div>`;

  qs('.cabinet__print', root).addEventListener('click', () => window.print());
  qs('.cabinet__refresh', root).addEventListener('click', () => render(root, objectId, key));

  // Фото накладных: содержимое приходит через наше API (прямые ссылки Drive браузер блокирует)
  mountPhotos(root).catch(() => {});
}

/** Экранирование текста: данные объекта приходят из таблицы, в них может быть разметка. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default { render };
