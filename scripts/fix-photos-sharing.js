/**
 * Служебный вызов обслуживающего действия photos:fix-sharing:
 * открывает просмотр по ссылке всем старым фото в папке Drive.
 * Запуск: node scripts/fix-photos-sharing.js
 */
const API = 'https://script.google.com/macros/s/AKfycbyKdQWI77sm4DvsAN_ejI6aGx8oPMhvZhz9ps1kasZCfK3s9cNB7qJrN-his26Ue_Hn/exec';

async function post(payload) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

(async () => {
  const login = await post({ action: 'login', login: 'Руководитель', code: '0000', device: 'обслуживание' });
  if (!login.token) { console.error('Вход не удался:', JSON.stringify(login)); process.exit(1); }
  console.log('Вход выполнен, токен получен.');
  const result = await post({ action: 'photos:fix-sharing', token: login.token });
  console.log('Результат:', JSON.stringify(result));
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
