/**
 * ============================================
 * Модуль: storageAdapter
 * Ответственность: Единственная точка доступа к localStorage/sessionStorage
 * Зависимости: нет
 * ============================================
 */

const PREFIX = 'bratstvo:';

const storage = {
  /** Долгий кэш: сессия, настройки, справочники. */
  local: {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      localStorage.removeItem(PREFIX + key);
    },
  },

  /** Состояние сессии: фильтры, выбранный объект, состояние интерфейса. */
  session: {
    get(key, fallback = null) {
      try {
        const raw = sessionStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      sessionStorage.removeItem(PREFIX + key);
    }
  },
};

export default storage;
