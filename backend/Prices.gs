/**
 * ============================================
 * Модуль: Prices
 * Ответственность: Справочник работ: чтение для калькулятора и перезаливка из нового PDF
 * Зависимости: Config, Sheets
 * ============================================
 */

const Prices = (() => {

  /** Весь прайс, сгруппированный по разделам. */
  function all() {
    const rows = Sheets.table(Sheets.requireSheet(CONFIG.SHEETS.PRICES));
    const sections = {};
    rows.forEach(r => {
      const section = String(r['Раздел'] || 'Без раздела');
      if (!sections[section]) sections[section] = [];
      sections[section].push({
        n: Number(r['Номер']) || 0,
        name: String(r['Позиция'] || ''),
        unit: String(r['Единица'] || ''),
        price: Number(r['Цена']) || 0,
        from: String(r['От'] || '') === 'да',
        source: String(r['Источник'] || ''),
      });
    });
    return { sections };
  }

  /**
   * Перезаливка прайса из нового PDF (присылает руководитель — я обновляю seed).
   * Старые цены не удаляются: меняется поле «Активен», история сохраняется в «Источник».
   * @param {Array} items — [{section, n, name, unit, price, from}]
   */
  function replace(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('Список позиций пуст');
    const sheet = Sheets.requireSheet(CONFIG.SHEETS.PRICES);
    const h = Sheets.headers(sheet);
    const now = new Date().toISOString();
    items.forEach(item => {
      sheet.appendRow([
        item.section, item.n, item.name, item.unit,
        item.price, item.from ? 'да' : '', 'загружено ' + now.slice(0, 10),
      ]);
    });
    SpreadsheetApp.flush();
    return { ok: true, count: items.length };
  }

  return { all, replace };
})();
