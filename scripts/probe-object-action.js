/**
 * Пробник: проверить, что действие object отвечает после деплоя v11.
 * Временный диагностический скрипт.
 */
const API = 'https://script.google.com/macros/s/AKfycbyKdQWI77sm4DvsAN_ejI6aGx8oPMhvZhz9ps1kasZCfK3s9cNB7qJrN-his26Ue_Hn/exec';
const post = async (p) => (await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(p),
})).json();

(async () => {
  const t0 = Date.now();
  const login = await post({ action: 'login', login: 'Руководитель', code: '0000', device: 'проверка object' });
  console.log('вход:', login.ok ? 'ок' : 'ОШИБКА ' + login.error, ((Date.now() - t0) / 1000).toFixed(1) + 'с');
  const t1 = Date.now();
  const objs = await fetch(API + '?action=objects&token=' + login.token).then(r => r.json());
  console.log('objects:', objs.ok ? 'ок, объектов: ' + objs.objects.length : 'ОШИБКА ' + objs.error, ((Date.now() - t1) / 1000).toFixed(1) + 'с');
  const test = objs.objects.find(o => o.name.includes('Проверка'));
  const t2 = Date.now();
  const obj = await fetch(API + '?action=object&token=' + login.token + '&id=' + test.id).then(r => r.text());
  let parsed;
  try { parsed = JSON.parse(obj); } catch (e) { parsed = null; }
  console.log('object:', parsed && parsed.ok ? 'ок, записей: ' + parsed.records.length : 'СЫРОЙ ОТВЕТ: ' + obj.slice(0, 200), ((Date.now() - t2) / 1000).toFixed(1) + 'с');
  const t3 = Date.now();
  const prices = await fetch(API + '?action=prices').then(r => r.json());
  console.log('prices:', prices.ok ? 'ок, позиций: ' + prices.prices.length : 'ОШИБКА ' + prices.error, ((Date.now() - t3) / 1000).toFixed(1) + 'с');
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
