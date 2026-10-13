/**
 * ============================================
 * Модуль: Router
 * Ответственность: Маршрутизация GET/POST действий к модулям проекта
 * Зависимости: Users, Objects, Records, Prices, Photos, Visits, Archive
 * ============================================
 */

const Router = (() => {

  function get(params) {
    const action = String(params.action || '');
    const user = Users.byToken(params.token);
    switch (action) {
      case 'bootstrap':
        return bootstrap(user);
      case 'init':
        return initProject();
      case 'login-options':
        return { ok: true, users: Users.loginOptions() };
      case 'prices':
        return { ok: true, prices: Prices.all() };
      case 'objects':
        requireUser(user);
        return { ok: true, objects: Objects.all(), lastRecordDates: Records.lastRecordDates() };
      case 'object':
        requireUser(user);
        return { ok: true, object: Objects.byId(params.id), records: Records.list(params.id) };
      case 'day-summary':
        requireLeader(user);
        return { ok: true, summary: Records.daySummary(params.date), visits: Visits.recent(50) };
      case 'users':
        requireLeader(user);
        return { ok: true, users: Users.all() };
      default:
        throw new Error('Неизвестное действие: ' + action);
    }
  }

  function post(body) {
    const action = String(body.action || '');
    const user = Users.byToken(body.token);
    switch (action) {
      case 'login':
        return Users.login(body.login, body.code, body.device);
      case 'logout':
        return { ok: true };
      case 'records:append':
        requireUser(user);
        return Records.appendBatch(body.objectId, body.items || []);
      case 'photos:upload':
        requireUser(user);
        return Photos.upload(body.objectId, body.base64, body.mime);
      case 'objects:create':
        requireLeader(user);
        return Objects.create(body.data || {});
      case 'objects:update':
        requireLeader(user);
        return Objects.update(body.id, body.patch || {});
      case 'objects:close':
        requireLeader(user);
        return Objects.close(body.id);
      case 'objects:resume':
        requireLeader(user);
        return Objects.resume(body.id);
      case 'users:save':
        requireLeader(user);
        return Users.save(user, body.data || {});
      case 'users:change-own-code':
        requireUser(user);
        return Users.changeOwnCode(user, body.oldCode, body.newCode);
      case 'status:report':
        requireUser(user);
        return Visits.reportStatus(user.login, body.pending, body.comment);
      case 'status:queue-depth':
        requireLeader(user);
        return { ok: true, statuses: Visits.latestStatuses() };
      default:
        throw new Error('Неизвестное действие: ' + action);
    }
  }

  function bootstrap(user) {
    if (!user) return { ok: true, authorized: false };
    return {
      ok: true,
      authorized: true,
      user: { login: user.login, name: user.name, role: user.role },
      prices: Prices.all(),
      objects: Objects.all(),
      lastRecordDates: Records.lastRecordDates(),
    };
  }

  /**
   * Первичная инициализация проекта по ссылке (без терминала и редактора).
   * Безопасно вызывать много раз: создаёт только недостающие листы,
   * профили и прайс заливает, только если соответствующие листы пусты.
   */
  function initProject() {
    Sheets.ensureStructure();
    Users.seedSlots();
    let pricesAdded = 0;
    if (Object.keys(Prices.all().sections).length === 0) {
      pricesAdded = Prices.replace(JSON.parse(SEED_PRICE_JSON)).count;
    }
    return {
      ok: true,
      users: Users.all().length,
      prices: pricesAdded,
      message: pricesAdded
        ? 'Готово: листы, профили и ' + pricesAdded + ' позиций прайса'
        : 'Готово: структура на месте, прайс уже загружен',
    };
  }

  function requireUser(user) {
    if (!user) throw new Error('Требуется вход');
  }

  function requireLeader(user) {
    if (!user) throw new Error('Требуется вход');
    if (user.role !== 'руководитель') throw new Error('Недостаточно прав');
  }

  return { get, post };
})();
