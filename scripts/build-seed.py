#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка backend/Seed.gs из backend/seed/price.json.
Запускать после обновления прайса: python scripts/build-seed.py
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
price = json.loads((root / "backend" / "seed" / "price.json").read_text(encoding="utf-8"))
template = (root / "scripts" / "Seed.template.gs").read_text(encoding="utf-8")
# Экранируем только то, что сломает JS-строку: обратный слеш и кавычки
payload = json.dumps(price, ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'")
out = template.replace("__SEED_PRICE_JSON__", payload)
(root / "backend" / "Seed.gs").write_text(out, encoding="utf-8")
print(f"Seed.gs собран, позиций: {len(price)}")
