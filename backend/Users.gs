/**
 * ============================================
 * Модуль: Users
 * Ответственность: Вход по логину и коду, выдача и отзыв кодов, роли, журнал посещений
 * Зависимости: Config, Sheets
 * ============================================
 */

const Users = (() => {

  /** Читает лист «Пользователи» как массив объектов. */
  function all() {
    const sheet = Sheets.service(CONFIG.SHEETS.USERS);
    if (!sheet.getLastRow()) return [];
    const rows = Sheets.table(sheet);
    return rows.map(r => ({
      login: String(r['Логин'] || ''),
      name: String(r['Имя'] || ''),
      code: String(r['Код доступа'] || ''),
      role: String(r['Роль'] || ''),           // «руководитель» или «мастер»
      active: String(r['Статус'] || '') === 'активен',
      created: String(r['Создан'] || ''),
      lastVisit: String(r['Последний вход'] || ''),
      token: String(r['Токен сессии'] || ''),
      tokenUntil: String(r['Токен до'] || ''),
    })).filter(u => u.login);
  }

  function byLogin(login) {
    const key = String(login || '').trim().toLowerCase();
    return all().find(u => u.login.toLowerCase() === key) || null;
  }

  /**
   * Вход по логину и коду. При успехе: выдаётся токен сессии, пишется запись в «Посещения».
   * @param {string} login
   * @param {string} code
   * @param {string} device — краткое описание устройства из User-Agent
   * @returns {{ok: boolean, error?: string, user?: object, token?: string}}
   */
  function login(login, code, device) {
    const user = byLogin(login);
    if (!user) return { ok: false, error: 'Такого логина нет' };
    if (!user.active) return { ok: false, error: 'Профиль не активирован руководителем' };
    if (user.code !== String(code || '')) return { ok: false, error: 'Неверный код доступа' };

    const token = Utilities.getUuid();
    const until = new Date(Date.now() + CONFIG.SESSION_DAYS * 86400000);
    updateRow(user.login, {
      'Токен сессии': token,
      'Токен до': until.toISOString(),
      'Последний вход': new Date().toISOString(),
    });
    Visits.log(login, 'вход', device);
    return { ok: true, user: publicUser(user), token };
  }

  /** Проверка токена сессии. Возвращает пользователя или null. */
  function byToken(token) {
    if (!token) return null;
    const user = all().find(u => u.token && u.token === token);
    if (!user) return null;
    if (!user.tokenUntil || new Date(user.tokenUntil) < new Date()) return null;
    return user;
  }

  /** Список активных логинов для экрана входа. */
  function loginOptions() {
    return all()
      .filter(u => u.active)
      .map(u => ({ login: u.login, name: u.name, role: u.role }));
  }

  /**
   * Создать или обновить профиль (только руководитель).
   * Активация слота «мастер N» — Руководитель задаёт имя и код доступа.
   */
  function save(actor, data) {
    requireRole(actor, 'руководитель');
    const login = String(data.login || '').trim();
    if (!login) throw new Error('Логин обязателен');
    const patch = {
      'Имя': String(data.name || login),
      'Код доступа': String(data.code || ''),
      'Роль': String(data.role || 'мастер'),
      'Статус': data.active ? 'активен' : 'ожидает',
    };
    const existing = byLogin(login);
    if (existing) {
      updateRow(login, patch);
    } else {
      patch['Логин'] = login;
      patch['Создан'] = new Date().toISOString();
      Sheets.appendRow(CONFIG.SHEETS.USERS, patch);
    }
    return { ok: true };
  }

  /** Сменить собственный код доступа. */
  function changeOwnCode(actor, oldCode, newCode) {
    if (!actor) throw new Error('Нужен вход');
    if (actor.code !== String(oldCode || '')) throw new Error('Старый код неверный');
    if (String(newCode || '').length < 4) throw new Error('Код — минимум 4 символа');
    updateRow(actor.login, { 'Код доступа': String(newCode) });
    return { ok: true };
  }

  /**
   * Первичное наполнение листа «Пользователи»: Руководитель + слоты мастер 1…50.
   * Коды доступа Руководитель задаёт позже через save() — слот активируется.
   */
  function seedSlots() {
    Sheets.ensureStructure();
    if (all().length) return { ok: true, skipped: true };
    Sheets.appendRow(CONFIG.SHEETS.USERS, {
      'Логин': 'Руководитель',
      'Имя': 'Руководитель',
      'Код доступа': '0000', // сменить при первом входе
      'Роль': 'руководитель',
      'Статус': 'активен',
      'Создан': new Date().toISOString(),
    });
    for (let i = 1; i <= 50; i++) {
      Sheets.appendRow(CONFIG.SHEETS.USERS, {
        'Логин': 'мастер ' + i,
        'Имя': 'мастер ' + i,
        'Код доступа': '',
        'Роль': 'мастер',
        'Статус': 'ожидает',
        'Создан': new Date().toISOString(),
      });
    }
    return { ok: true, created: 51 };
  }

  function requireRole(actor, role) {
    if (!actor || actor.role !== role) throw new Error('Недостаточно прав');
  }

  function updateRow(login, patch) {
    const sheet = Sheets.service(CONFIG.SHEETS.USERS);
    const headers = Sheets.headers(sheet);
    const rowIndex = Sheets.findRow(sheet, headers, 'Логин', login);
    if (rowIndex < 0) throw new Error('Профиль не найден: ' + login);
    headers.forEach(h => {
      if (patch[h] !== undefined) {
        sheet.getRange(rowIndex, headers.indexOf(h) + 1).setValue(patch[h]);
      }
    });
  }

  function publicUser(u) {
    return { login: u.login, name: u.name, role: u.role, active: u.active };
  }

  return { all, byLogin, byToken, loginOptions, login, save, changeOwnCode, seedSlots };
})();
