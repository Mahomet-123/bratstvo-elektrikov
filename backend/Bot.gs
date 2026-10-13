/**
 * ============================================
 * Модуль: Bot
 * Ответственность: Telegram-бот: напоминания о неотправленном, незаписанном дне, закрытии объекта
 * Зависимости: Router, Records, Users
 * ============================================
 * ЭТАП 2: файл-заготовка. Активируется после получения токена от @BotFather:
 *   1) setWebhook() один раз: BotSetWebhook('https://script.google.com/macros/s/XXX/exec', token)
 *   2) триггер по расписанию:installReminders — напоминания в 20:00
 */

const BOT_TOKEN_PROPERTY = 'BOT_TOKEN';

function botSendMessage(chatId, text) {
  const token = PropertiesService.getScriptProperties().getProperty(BOT_TOKEN_PROPERTY);
  if (!token) throw new Error('Токен бота не задан (свойства скрипта: BOT_TOKEN)');
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text }),
  });
}

/** Вебхук бота — связывание чата с логином (этап 2). */
function botWebhook(update) {
  // Здесь будет связь «чат ↔ логин» и команды /start, /status
  return { ok: true };
}

/** Напоминания по расписанию (этап 2): незаписанный день, неотправленная очередь. */
function botReminders() {
  // Здесь будет обход Records.daySummary(сегодня) и Visits.latestStatuses()
  // и отправка сообщений привязанным чатам
}
