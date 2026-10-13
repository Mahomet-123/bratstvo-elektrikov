/**
 * ============================================
 * Модуль: ObjectCard
 * Ответственность: Карточка объекта: шапка, вкладки «Расчёт / Дни / Закупки / Отчёт», ленивая загрузка записей
 * Зависимости: dataManager, Calculator, DaysJournal, Purchases, ReportView, dom
 * ============================================
 */

import data from '../../db/dataManager.js';
import Calculator from '../Calculator/Calculator.js';
import DaysJournal from '../DaysJournal/DaysJournal.js';
import Purchases from '../Purchases/Purchases.js';
import ReportView from '../ReportView/ReportView.js';
import { el, qs } from '../../utils/dom.js';
import './styles/ObjectCard.css';

const TABS = [
  { id: 'calc', title: 'Расчёт' },
  { id: 'days', title: 'Дни' },
  { id: 'purchases', title: 'Закупки' },
  { id: 'report', title: 'Отчёт' },
];

export async function render(root, objectId, { navigate }) {
  root.innerHTML = '<p class="objectcard__loading">Загружаю объект…</p>';
  // Ленивая загрузка: содержимое объекта тянется только при открытии карточки
  const { object, records } = await data.objectRecords(objectId, { force: true });

  root.innerHTML = `
    <div class="objectcard">
      <button class="objectcard__back" type="button">← К объектам</button>
      <header class="objectcard__head">
        <span class="objectcard__number">${object.number}</span>
        <h1 class="objectcard__title">${object.name}</h1>
        <p class="objectcard__meta">${object.client || 'Клиент не указан'} · ${object.address || ''}</p>
        <p class="objectcard__status">Статус: ${object.status}</p>
      </header>
      <nav class="objectcard__tabs"></nav>
      <div class="objectcard__body"></div>
    </div>`;

  qs('.objectcard__back', root).addEventListener('click', () => navigate('#/objects'));

  const tabs = qs('.objectcard__tabs', root);
  const body = qs('.objectcard__body', root);
  TABS.forEach(tab => {
    const button = el(`<button class="objectcard__tab" type="button" data-tab="${tab.id}">${tab.title}</button>`);
    button.addEventListener('click', () => openTab(tab.id));
    tabs.appendChild(button);
  });

  const afterChange = async () => {
    data.dropObjectCache(objectId);
    await data.objectRecords(objectId, { force: true });
    openTab(activeTab, true);
  };

  let activeTab = 'calc';

  async function openTab(id, keepScroll = false) {
    activeTab = id;
    qsa('.objectcard__tab', root).forEach(b =>
      b.classList.toggle('objectcard__tab--active', b.dataset.tab === id));
    const fresh = await data.objectRecords(objectId, { force: !keepScroll });
    const options = { objectId, navigate, onChange: afterChange };
    if (id === 'calc') Calculator.render(body, options);
    if (id === 'days') DaysJournal.render(body, { ...options, records: fresh.records });
    if (id === 'purchases') Purchases.render(body, { ...options, records: fresh.records });
    if (id === 'report') ReportView.render(body, { ...options, object: fresh.object, records: fresh.records });
  }

  openTab('calc');
}

export default { render };
