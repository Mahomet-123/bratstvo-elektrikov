/**
 * ============================================
 * Модуль: dom
 * Ответственность: Помощники для DOM: создание элементов из шаблонных строк, подписи на события
 * Зависимости: нет
 * ============================================
 */

/** Создать элемент из HTML-строки (без innerHTML на всём документе). */
function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Динамическая подключение CSS компонента (изолиция стилей по папкам). */
function loadCss(href) {
  if (document.querySelector(`link[data-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.css = href;
  document.head.appendChild(link);
}

/** Форматирование даты в русский вид: 12.10.2026. */
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export { el, qs, qsa, loadCss, fmtDate, today };
