/**
 * ============================================
 * Модуль: Calculator
 * Ответственность: Калькулятор по прайсу: подбор позиций, количество, коэффициенты, автоитог
 * Зависимости: dataManager, queue, dom, format, toast
 * ============================================
 */

import data from '../../db/dataManager.js';
import queue from '../../cache/queue.js';
import { el, qs, qsa, loadCss } from '../../utils/dom.js';
import { money, unitLabel } from '../../utils/format.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/Calculator/styles/Calculator.css');

/** Состояние черновика расчёта. */
let draft = [];
let globalCoefs = [];

export function render(root, { objectId, onChange }) {
  draft = [];
  globalCoefs = [];
  const priceData = data.state.prices || { sections: {} };
  const coefItems = Object.values(priceData.sections)
    .flat()
    .filter(item => item.unit === 'коэф.' && item.price > 1);

  root.innerHTML = `
    <div class="calc">
      <input class="calc__search" type="search" placeholder="Поиск по прайсу: розетка, гофра, щит…">
      <div class="calc__coefs">
        <span class="calc__coefs-title">Общие коэффициенты (прайс, разд. ⑦):</span>
        ${coefItems.map(c => `
          <label class="calc__coef">
            <input type="checkbox" value="${c.price}">
            <span>${c.name} ×${String(c.price).replace('.', ',')}</span>
          </label>`).join('') || '<span class="calc__coefs-empty">не загружены</span>'}
      </div>
      <div class="calc__sections"></div>
      <div class="calc__draft">
        <h3 class="calc__draft-title">Расчёт по объекту</h3>
        <div class="calc__lines"></div>
        <div class="calc__total">Итого работы: <b class="calc__total-sum">0 ₽</b></div>
        <p class="calc__rule">Правило 203: снабжение материалом +10% от материалов, минимум 1500 ₽ — считается автоматически в отчёте.</p>
        <button class="calc__save" type="button" disabled>Сохранить расчёт</button>
      </div>
    </div>`;

  const sectionsBox = qs('.calc__sections', root);
  Object.entries(priceData.sections).forEach(([section, items]) => {
    if (!items.some(i => i.price > 0)) return; // разделы-примечания не показываем
    const block = el(`
      <details class="calc__section">
        <summary class="calc__section-title">${section}</summary>
        <div class="calc__items"></div>
      </details>`);
    const itemsBox = qs('.calc__items', block);
    items.filter(i => i.price > 0).forEach(item => itemsBox.appendChild(itemRow(item, root)));
    sectionsBox.appendChild(block);
  });

  qs('.calc__search', root).addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    qsa('.calc__section', root).forEach(section => {
      const items = qsa('.calc__item', section);
      const visible = items.filter(item =>
        !query || item.dataset.name.includes(query));
      items.forEach(item => { item.hidden = !visible.includes(item); });
      section.open = !!query && visible.length > 0;
      section.hidden = visible.length === 0;
    });
  });

  qsa('.calc__coef input', root).forEach(box => {
    box.addEventListener('change', () => {
      globalCoefs = qsa('.calc__coef input:checked', root).map(i => Number(i.value));
      repaintDraft(root);
    });
  });

  qs('.calc__save', root).addEventListener('click', () => save(root, objectId, onChange));
}

function itemRow(item, root) {
  const node = el(`
    <div class="calc__item" data-name="${item.name.toLowerCase()}">
      <div class="calc__item-info">
        <div class="calc__item-name">${item.name}</div>
        <div class="calc__item-meta">${unitLabel(item.unit)} · ${money(item.price)}${item.from ? ' (от)' : ''}</div>
      </div>
      <button class="calc__item-add" type="button">+</button>
    </div>`);
  qs('.calc__item-add', node).addEventListener('click', () => {
    draft.push({
      id: crypto.randomUUID(),
      name: item.name, unit: item.unit, price: item.price,
      qty: 1, ownCoef: 1,
    });
    repaintDraft(root);
  });
  return node;
}

function lineCoef(line) {
  return line.ownCoef * globalCoefs.reduce((s, c) => s * c, 1);
}

function lineSum(line) {
  return Math.round(line.price * line.qty * lineCoef(line));
}

function repaintDraft(root) {
  const box = qs('.calc__lines', root);
  box.innerHTML = '';
  draft.forEach(line => {
    const row = el(`
      <div class="calc__line" data-id="${line.id}">
        <input class="calc__line-name" value="${line.name}">
        <input class="calc__line-qty" type="number" min="0" step="any" value="${line.qty}">
        <span class="calc__line-unit">${unitLabel(line.unit)}</span>
        <select class="calc__line-coef">
          <option value="1"${line.ownCoef === 1 ? ' selected' : ''}>×1</option>
          <option value="1.5"${line.ownCoef === 1.5 ? ' selected' : ''}>×1,5</option>
          <option value="2"${line.ownCoef === 2 ? ' selected' : ''}>×2</option>
        </select>
        <span class="calc__line-sum">${money(lineSum(line))}</span>
        <button class="calc__line-remove" type="button">×</button>
      </div>`);
    qs('.calc__line-name', row).addEventListener('input', e => { line.name = e.target.value; });
    qs('.calc__line-qty', row).addEventListener('input', e => {
      line.qty = Number(e.target.value) || 0;
      qs('.calc__line-sum', row).textContent = money(lineSum(line));
      repaintTotal(root);
    });
    qs('.calc__line-coef', row).addEventListener('change', e => {
      line.ownCoef = Number(e.target.value);
      qs('.calc__line-sum', row).textContent = money(lineSum(line));
      repaintTotal(root);
    });
    qs('.calc__line-remove', row).addEventListener('click', () => {
      draft = draft.filter(l => l.id !== line.id);
      repaintDraft(root);
    });
    box.appendChild(row);
  });
  repaintTotal(root);
}

function repaintTotal(root) {
  const total = draft.reduce((s, l) => s + lineSum(l), 0);
  qs('.calc__total-sum', root).textContent = money(total);
  qs('.calc__save', root).disabled = draft.length === 0;
}

async function save(root, objectId, onChange) {
  const items = draft.map(line => ({
    id: line.id,
    type: 'РАСЧЁТ',
    date: new Date().toISOString(),
    user: data.state.user.login,
    name: line.name,
    unit: line.unit,
    qty: line.qty,
    coef: lineCoef(line),
    price: line.price,
    sum: lineSum(line),
  }));
  // Расчёт всегда через очередь: работает и без связи, уйдёт при подключении
  await queue.enqueue('records:append', { objectId, items });
  // Локально в кэш сразу — сервер подтвердит при следующей сверке
  items.forEach(item => data.applyLocalRecord(objectId, item));
  toast.ok('Расчёт сохранён' + (navigator.onLine ? '' : ' (уйдёт при связи)'));
  draft = [];
  repaintDraft(root);
  onChange();
}

export default { render };
