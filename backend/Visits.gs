/**
 * ============================================
 * Модуль: Visits
 * Ответственность: Журнал посещений и снимки очереди отправки — для панели руководителя
 * Зависимости: Config, Sheets
 * ============================================
 */

const Visits = (() => {

  /** Записать событие (вход/выход/открытие приложения). */
  function log(login, action, device) {
    Sheets.appendRow(CONFIG.SHEETS.VISITS, {
      'Дата': new Date().toISOString(),
      'Логин': login,
      'Действие': action,
      'Устройство': shorten(device),
    });
  }

  /** Снимок состояния очереди с устройства мастера. */
  function reportStatus(login, pending, comment) {
    Sheets.appendRow(CONFIG.SHEETS.STATUSES, {
      'Дата': new Date().toISOString(),
      'Логин': login,
      'Не отправлено': Number(pending) || 0,
      'Комментарий': comment || '',
    });
  }

  /** Последние события посещений (для панели руководителя). */
  function recent(limit) {
    const rows = Sheets.table(Sheets.requireSheet(CONFIG.SHEETS.VISITS));
    return rows.slice(-Math.min(limit || 100, 500)).reverse();
  }

  /** Последний снимок очереди по каждому мастеру — для панели руководителя. */
  function latestStatuses() {
    const rows = Sheets.table(Sheets.requireSheet(CONFIG.SHEETS.STATUSES));
    const byUser = {};
    rows.forEach(r => {
      byUser[String(r['Логин'] || '')] = {
        date: String(r['Дата'] || ''),
        pending: Number(r['Не отправлено']) || 0,
      };
    });
    return byUser;
  }

  function shorten(text) {
    const s = String(text || '');
    return s.length > 80 ? s.slice(0, 80) : s;
  }

  return { log, reportStatus, recent, latestStatuses };
})();
