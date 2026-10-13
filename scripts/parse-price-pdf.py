#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Разбор прайс-листа «Братство Электриков ЧР» из PDF в JSON Seeds для Google Таблицы.
Запуск: python scripts/parse-price-pdf.py [путь_к_pdf] [путь_к_json]
По умолчанию читает файл из Downloads и пишет backend/seed/price.json.
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

DEFAULT_PDF = Path(r"C:\Users\HP\Downloads\Telegram Desktop\Прайс_Лист_Братство_Электриков_ЧР_Погонаж.pdf")
DEFAULT_JSON = Path(__file__).resolve().parent.parent / "backend" / "seed" / "price.json"

# Кружки-маркеры разделов в PDF: ①..⑧
SECTIONS = {
    "①": "Монтажные работы",
    "②": "Черновые работы",
    "③": "Установка щитов",
    "④": "Чистовая установка",
    "⑤": "Дополнительные работы",
    "⑥": "Умный дом и IoT",
    "⑦": "Коэффициенты и особые условия",
    "⑧": "Примечания",
}

UNITS = ("шт.", "м/п", "см.", "кв.м", "кВА", "%", "коэф.")
ROW_RE = re.compile(
    r"^(?P<n>\d{1,3})\s+(?P<name>.+?)\s+"
    r"(?P<unit>шт\.|м/п|см\.|кв\.м|кВА|%|коэф\.)\s*"
    r"(?P<ot>от\s+)?(?P<price>\d+)\s*$"
)


def parse_pdf(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    rows = []
    section = ""
    for page in reader.pages:
        text = page.extract_text() or ""
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if "Прайс-Лист" in line or "Братство Электриков" in line:
                continue
            marker = line[0] if line and line[0] in SECTIONS else None
            if marker:
                section = SECTIONS[marker]
                line = line[1:].strip()
                if not line:
                    continue
            m = ROW_RE.match(line)
            if m:
                rows.append({
                    "section": section,
                    "n": int(m.group("n")),
                    "name": m.group("name").strip(),
                    "unit": m.group("unit"),
                    "from": bool(m.group("ot")),
                    "price": int(m.group("price")),
                })
    return rows


def main():
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    json_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_JSON
    rows = parse_pdf(pdf_path)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Разобрано позиций: {len(rows)} → {json_path}")
    for r in rows[:3]:
        print(r)
    print("...")
    print(rows[-1])


if __name__ == "__main__":
    main()
