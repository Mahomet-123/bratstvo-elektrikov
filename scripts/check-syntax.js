/**
 * ============================================
 * Модуль: check-syntax
 * Ответственность: Проверка синтаксиса всех JS/GS-файлов проекта перед деплоем
 * Зависимости: нет (node scripts/check-syntax.js)
 * ============================================
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tmp = path.join(root, '.check');
let failed = 0;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|gs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(path.join(root, 'public', 'js')),
  ...walk(path.join(root, 'backend')),
];

fs.mkdirSync(tmp, { recursive: true });
files.forEach(file => {
  const copy = path.join(tmp, file.replace(/[\\/]/g, '_') + '.mjs');
  fs.copyFileSync(file, copy);
  try {
    execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error('ОШИБКА синтаксиса:', path.relative(root, file));
    console.error(e.stderr.toString().split('\n').slice(0, 5).join('\n'));
  }
});
fs.rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error(`Провалено файлов: ${failed}`);
  process.exit(1);
}
console.log(`Синтаксис в порядке: файлов проверено — ${files.length}`);
