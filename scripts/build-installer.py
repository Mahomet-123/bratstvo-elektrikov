#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка файла-установщика Установщик.gs.
Установщик вставляется в Apps Script ОДИН раз и сам создаёт все 14 модулей
проекта отдельными файлами через Apps Script API.
Запуск: python scripts/build-installer.py
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
backend = root / "backend"

# Порядок важен: конфиг и данные первыми, точка входа последней
ORDER = [
    "Config.gs",
    "Seed.gs",
    "Sheets.gs",
    "Users.gs",
    "Visits.gs",
    "Objects.gs",
    "Records.gs",
    "Prices.gs",
    "Photos.gs",
    "Archive.gs",
    "Cabinet.gs",
    "Router.gs",
    "Bot.gs",
    "Code.gs",
]

HEADER = '''/**
 * ============================================
 * Модуль: Установщик
 * Ответственность: Установка модулей проекта «Братство Электриков»
 *                   в Apps Script отдельными файлами
 * Зависимости: сервис Apps Script API (подключается один раз в редакторе)
 * ============================================
 * Как пользоваться:
 *   1. Вставь содержимое этого файла в редактор Apps Script
 *      (таблица → «Расширения» → «Apps Script» → заменить содержимое «Код.gs»)
 *   2. Один раз: «Сервисы» → «+» → «Apps Script API» → «Добавить»
 *   3. Выполнить функцию installAll — модули встанут отдельными файлами,
 *      сам установщик удалится из проекта
 *   4. Выполнить ensureStructure, затем seedPricesFromBackend
 *
 * Файл сгенерирован scripts/build-installer.py — не редактировать вручную.
 */

const MODULES = [
'''

FOOTER = '''];

function installAll() {
  const scriptId = ScriptApp.getScriptId();
  const files = MODULES.map(m => ({ name: m.name, type: 'SERVER_JS', source: m.source }));
  try {
    Script.Projects.updateContent(scriptId, { files: files });
  } catch (e) {
    throw new Error(
      'Не удалось установить модули: ' + e +
      '. Проверь, что добавлен сервис Apps Script API (Сервисы → + → Apps Script API).'
    );
  }
  let count = files.length;
  try {
    count = Script.Projects.getContent(scriptId).files.length;
  } catch (e) { /* подсчёт не критичен */ }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Установлено модулей: ' + count + '. Обнови страницу редактора.');
  } catch (e) { /* не табличный скрипт — просто молчим */ }
  return count;
}
'''

parts = [HEADER]
for name in ORDER:
    source = (backend / name).read_text(encoding="utf-8").strip()
    file_name = name.split("/")[-1].replace(".gs", "")
    parts.append(
        "  { name: '%s', source: %s },\n" % (file_name, json.dumps(source, ensure_ascii=False))
    )
parts.append(FOOTER)

out = root / "Установщик.gs"
out.write_text("".join(parts), encoding="utf-8")
print(f"Собран {out.name}: модулей {len(ORDER)}, строк {len(''.join(parts).splitlines())}")
