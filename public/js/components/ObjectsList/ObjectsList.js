/**
 * ============================================
 * Модуль: ObjectsList
 * Ответственность: Список объектов: карточки, «дней без записи», создание/закрытие (руководитель)
 * Зависимости: dataManager, sheetsClient, queue, dom, toast
 * ============================================
 */

import data from '../../db/dataManager.js';
import sheets from '../../db/sheetsClient.js';
import queue from '../../cache/queue.js';
import { el, qs, fmtDate, loadCss } from '../../utils/dom.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/ObjectsList/styles/ObjectsList.css');

export async function render(root, { navigate }) {
  const objects = await data.objects();
  const dates = data.state.lastRecordDates;
  const isLeader = data.state.user && data.state.user.role === 'руководитель';

  root.innerHTML = `
    <div class="objects">
      <div class="objects__head">
        <h1 class="objects__title">Объекты</h1>
        ${isLeader ? '<button class="objects__add" type="button">+ Новый объект</button>' : ''}
      </div>
      <div class="objects__list"></div>
    </div>`;

  const list = qs('.objects__list', root);
  if (!objects.length) {
    list.appendChild(el('<p class="objects__empty">Объектов пока нет. Создайте первый — руководитель.</p>'));
  }
  objects.forEach(obj => list.appendChild(card(obj, dates[obj.id], isLeader, navigate)));

  const addBtn = qs('.objects__add', root);
  if (addBtn) addBtn.addEventListener('click', () => createDialog(root, navigate));
}

function card(obj, lastDate, isLeader, navigate) {
  const daysWithout = lastDate
    ? Math.max(0, Math.round((Date.now() - new Date(lastDate)) / 86400000))
    : '—';
  const statusCls = obj.status === 'закрыт' ? 'objects__status--closed' : 'objects__status--open';
  const node = el(`
    <article class="objects__card" data-id="${obj.id}">
      <div class="objects__card-head">
        <span class="objects__number">${obj.number}</span>
        <span class="objects__status ${statusCls}">${obj.status}</span>
      </div>
      <h2 class="objects__name">${obj.name}</h2>
      <p class="objects__client">${obj.client || 'Клиент не указан'}</p>
      <p class="objects__meta">${obj.address || ''}</p>
      <p class="objects__meta">Последняя запись: ${lastDate ? fmtDate(lastDate) : 'нет записей'}</p>
      ${isLeader ? `
        <div class="objects__actions">
          ${obj.status === 'закрыт'
            ? `<button class="objects__resume" type="button">Возобновить работы</button>`
            : `<button class="objects__close" type="button">Закрыть объект</button>`}
        </div>` : ''}
    </article>`);

  node.addEventListener('click', async event => {
    if (event.target.closest('button')) return;
    navigate('#/object/' + obj.id);
  });

  const closeBtn = qs('.objects__close', node);
  if (closeBtn) closeBtn.addEventListener('click', async () => {
    if (!confirm(`Закрыть объект «${obj.name}»? Лист уедет в архив года, вернуть можно будет кнопкой «Возобновить работы».`)) return;
    try {
      await sheets.objectsClose(data.state.token, obj.id);
      // Статус меняем сразу в интерфейсе, сервер догонит чтением
      data.dropObjectCache(obj.id);
      data.patchObjectLocal(obj.id, { status: 'закрыт' });
      render(document.getElementById('app-root'), { navigate });
      toast.ok('Объект закрыт, лист в архиве');
      data.refreshObjects(); // в фоне подтянем точное состояние
    } catch (e) {
      toast.error(e.message);
    }
  });

  const resumeBtn = qs('.objects__resume', node);
  if (resumeBtn) resumeBtn.addEventListener('click', async () => {
    try {
      await sheets.objectsResume(data.state.token, obj.id);
      data.dropObjectCache(obj.id);
      data.patchObjectLocal(obj.id, { status: 'в работе' });
      render(document.getElementById('app-root'), { navigate });
      toast.ok('Объект снова в работе, история на месте');
      data.refreshObjects(); // в фоне подтянем точное состояние
    } catch (e) {
      toast.error(e.message);
    }
  });

  return node;
}

function createDialog(root, navigate) {
  const overlay = el(`
    <div class="objects__dialog">
      <form class="objects__form">
        <h2>Новый объект</h2>
        <label>Имя объекта<input name="name" required maxlength="80" placeholder="Например: Квартира на Ленина"></label>
        <label>Клиент<input name="client" maxlength="80" placeholder="ФИО заказчика"></label>
        <label>Адрес<input name="address" maxlength="120" placeholder="Адрес объекта"></label>
        <label>Телефон<input name="phone" maxlength="30" placeholder="+7 …"></label>
        <div class="objects__form-actions">
          <button type="button" class="objects__cancel">Отмена</button>
          <button type="submit" class="objects__save">Создать</button>
        </div>
      </form>
    </div>`);
  document.body.appendChild(overlay);

  qs('.objects__cancel', overlay).addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });

  qs('.objects__form', overlay).addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const payload = {
      name: form.name.value, client: form.client.value,
      address: form.address.value, phone: form.phone.value,
    };
    try {
      try {
        const created = await sheets.objectsCreate(data.state.token, payload);
        // Показываем объект сразу из ответа сервера — чтение таблицы отстаёт на пару секунд
        if (created.ok && created.object) {
          data.addObjectLocal(created.object);
          overlay.remove();
          render(document.getElementById('app-root'), { navigate });
          toast.ok('Объект создан');
          data.refreshObjects(); // в фоне подтянем точное состояние
          return;
        }
      } catch (e) {
        // Нет сети — объект встанет в очередь и создастся сам при подключении
        await queue.enqueue('objects:create', { data: payload });
        overlay.remove();
        render(document.getElementById('app-root'), { navigate });
        toast.ok('Нет связи — объект создастся при появлении интернета');
        return;
      }
      await data.refreshObjects();
      overlay.remove();
      render(document.getElementById('app-root'), { navigate });
      toast.ok('Объект создан');
    } catch (e) {
      toast.error(e.message);
    }
  });
}

export default { render };
