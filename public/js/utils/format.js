/**
 * ============================================
 * Модуль: format
 * Ответственность: Форматирование чисел, рублей, подписей единиц измерения
 * Зависимости: нет
 * ============================================
 */

const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** Число в рублях: 1 200 ₽ */
function money(value) {
  return rub.format(Number(value) || 0);
}

/** Подпись единицы измерения для калькулятора. */
function unitLabel(unit) {
  const labels = {
    'шт.': 'шт.',
    'м/п': 'м.п.',
    'см.': 'см.',
    'кв.м': 'кв.м',
    'кВА': 'кВА',
    '%': '%',
    'коэф.': 'коэф.',
    'раз': 'раз',
  };
  return labels[unit] || unit || '';
}

/** Короткая сумма для аналитики: 12 500 ₽ → 12,5 тыс. ₽ */
function shortMoney(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' млн ₽';
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1).replace('.', ',') + ' тыс. ₽';
  return money(n);
}

export { money, unitLabel, shortMoney };
