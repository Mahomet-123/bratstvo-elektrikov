/**
 * ============================================
 * Модуль: Cabinet
 * Ответственность: Временная страница кабинета клиента по токену объекта (до закрытия)
 * Зависимости: Objects, Records, Photos
 * ============================================
 */

const Cabinet = (() => {

  /**
   * HTML-страница кабинета клиента. Работает, пока объект не закрыт.
   * @param {object} params — {object, key}
   */
  function page(params) {
    const obj = Objects.byId(params.object);
    if (!obj || obj.token !== String(params.key || '')) {
      return html('<h1>Ссылка недействительна</h1><p>Попросите мастера прислать новую.</p>');
    }
    if (obj.status === 'закрыт') {
      return html('<h1>Объект закрыт</h1><p>Работы завершены. Спасибо за сотрудничество!</p>');
    }
    const records = Records.list(obj.id);
    const works = records.filter(r => r.type === 'РАСЧЁТ' && !r.flags.includes('удалено'));
    const days = records.filter(r => r.type === 'ДЕНЬ');
    const purchases = records.filter(r => r.type === 'ЗАКУПКА' && !r.flags.includes('удалено'));

    const fmt = v => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
    const worksSum = works.reduce((s, r) => s + r.sum, 0);
    const purchasesSum = purchases.reduce((s, r) => s + r.sum, 0);
    // Правило прайса №203: снабжение материалом — 10% от стоимости материалов, минимум 1500 ₽
    const supply = purchasesSum > 0 ? Math.max(purchasesSum * 0.1, 1500) : 0;
    const total = worksSum + purchasesSum + supply;

    const photos = purchases
      .flatMap(p => p.photoIds.split(',').filter(Boolean).map(id => Photos.url(id.trim())))
      .map(url => `<a class="cabinet__photo" href="${url}" target="_blank" rel="noopener">
        <img src="${url}" alt="Накладная" loading="lazy">
      </a>`).join('');

    return html(`
      <header class="cabinet__head">
        <h1>${esc(obj.name)}</h1>
        <p class="cabinet__meta">Заказчик: ${esc(obj.client || '—')} · Статус: ${esc(obj.status)}</p>
      </header>
      <section class="cabinet__block">
        <h2>Выполненные работы</h2>
        <table class="cabinet__table">
          <thead><tr><th>Работа</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${works.map(r => `<tr><td>${esc(r.name)}</td><td>${r.qty} ${esc(r.unit)}</td><td>${fmt(r.sum)}</td></tr>`).join('')}</tbody>
        </table>
      </section>
      <section class="cabinet__block">
        <h2>Материалы и закупки</h2>
        <table class="cabinet__table">
          <thead><tr><th>Материал</th><th>Кол-во</th><th>Сумма</th></tr></thead>
          <tbody>${purchases.map(r => `<tr><td>${esc(r.name)}</td><td>${r.qty}</td><td>${fmt(r.sum)}</td></tr>`).join('') || '<tr><td colspan="3">Пока нет</td></tr>'}</tbody>
        </table>
      </section>
      <section class="cabinet__block">
        <h2>Ход работ по дням</h2>
        <ul class="cabinet__days">${days.map(r =>
          `<li><b>${esc(r.date.slice(0, 10))}</b> — ${esc(r.name)} <i>${esc(r.user)}, ${r.qty} ч</i></li>`).join('') || '<li>Записей пока нет</li>'}</ul>
      </section>
      ${photos ? `<section class="cabinet__block"><h2>Фото накладных</h2><div class="cabinet__photos">${photos}</div></section>` : ''}
      <footer class="cabinet__total">
        <div>Работы: ${fmt(worksSum)}</div>
        <div>Материалы: ${fmt(purchasesSum)}</div>
        <div>Снабжение материалом (10%, мин. 1500 ₽): ${fmt(supply)}</div>
        <div class="cabinet__total-main">Итого: ${fmt(total)}</div>
      </footer>
    `);
  }

  function html(body) {
    return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Кабинет клиента — Братство Электриков</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1e293b; }
  .cabinet__head { background: #0f3d2e; color: #fff; padding: 24px 16px; }
  .cabinet__head h1 { margin: 0 0 4px; font-size: 20px; }
  .cabinet__meta { margin: 0; opacity: .85; font-size: 14px; }
  .cabinet__block { background: #fff; margin: 12px; padding: 16px; border-radius: 12px; }
  .cabinet__block h2 { margin: 0 0 12px; font-size: 16px; }
  .cabinet__table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .cabinet__table th, .cabinet__table td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #e2e8f0; }
  .cabinet__days { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.7; }
  .cabinet__photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cabinet__photo img { width: 100%; border-radius: 8px; display: block; }
  .cabinet__total { margin: 12px; padding: 16px; font-size: 15px; line-height: 1.8; }
  .cabinet__total-main { font-weight: 700; font-size: 18px; }
</style></head><body>${body}</body></html>`);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  return { page };
})();
