/**
 * ============================================
 * Модуль: toast
 * Ответственность: Всплывающие сообщения об ошибках и результатах
 * Зависимости: dom
 * ============================================
 */

import { el, qs } from '../utils/dom.js';

let timer = null;

/** Показать сообщение. Тип: 'error' | 'ok' | 'info' */
function show(text, type = 'info', ms = 3500) {
  const box = qs('#toast');
  if (!box) return;
  box.textContent = text;
  box.className = 'app__toast app__toast--' + type;
  box.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { box.hidden = true; }, ms);
}

export default { show, error: t => show(t, 'error'), ok: t => show(t, 'ok') };
