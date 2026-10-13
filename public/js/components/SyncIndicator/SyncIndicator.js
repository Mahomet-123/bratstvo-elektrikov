/**
 * ============================================
 * Модуль: SyncIndicator
 * Ответственность: Индикатор очереди: «всё отправлено / N в очереди / ошибка».
 *                   Тап — ручная отправка. Периодически докладывает состояние руководителю
 * Зависимости: queue, sheetsClient, dataManager
 * ============================================
 */

import queue from '../../cache/queue.js';
import sheets from '../../db/sheetsClient.js';
import data from '../../db/dataManager.js';
import { el, loadCss } from '../../utils/dom.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/SyncIndicator/styles/SyncIndicator.css');

const STATUS = {
  ok: { cls: 'sync--ok', text: 'Всё отправлено' },
  pending: { cls: 'sync--pending', text: 'В очереди' },
  error: { cls: 'sync--error', text: 'Ошибка' },
};

/** Смонтировать индикатор в правой части шапки. */
export function mount(container) {
  container.innerHTML = '';
  const chip = el(`
    <button class="sync sync--ok" type="button" title="Отправить сейчас">
      <span class="sync__dot"></span>
      <span class="sync__text">Всё отправлено</span>
    </button>`);
  container.appendChild(chip);

  window.addEventListener('queue:changed', () => paint(chip));
  window.addEventListener('online', () => paint(chip));

  chip.addEventListener('click', async () => {
    chip.disabled = true;
    try {
      await queue.flushNow();
    } finally {
      chip.disabled = false;
      paint(chip);
    }
  });

  paint(chip);
  setInterval(() => paint(chip), 15000);
  setInterval(reportToLeader, 120000);
}

async function paint(chip) {
  const items = await queue.all();
  // После двух неудачных попыток индикатор красный — отправка требует внимания
  const hasError = items.some(i => i.attempts >= 2);
  let status = STATUS.ok;
  if (items.length) status = hasError ? STATUS.error : STATUS.pending;
  chip.className = 'sync ' + status.cls;
  chip.querySelector('.sync__text').textContent =
    items.length ? `${status.text}: ${items.length}` : status.text;
  reportToLeader();
}

/** Снимок состояния очереди — в таблицу «Статусы» для панели руководителя. */
async function reportToLeader() {
  if (!data.state.token) return;
  const items = await queue.all();
  try {
    await sheets.statusReport(data.state.token, items.length, navigator.onLine ? 'online' : 'offline');
  } catch (e) { /* офлайн — доложить не сможем, не страшно */ }
}

export default { mount };
