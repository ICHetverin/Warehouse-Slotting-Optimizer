#!/usr/bin/env python3
"""
convert_dataset.py
──────────────────
Конвертирует реальный датасет обувного склада в формат,
ожидаемый Warehouse Optimizer API:
  layout.csv  → POST /api/v1/upload/layout
  skus.csv    → POST /api/v1/upload/skus
  orders.csv  → POST /api/v1/upload/orders

Использование:
  python convert_dataset.py --dataset ./dataset --out ./converted
  python convert_dataset.py --strategy dedicated  (class|dedicated|hybrid|random)
"""

import ast
import csv
import sys
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# ── Конфигурация ──────────────────────────────────────────────────────────────

SCALE          = 10     # делим координаты (см) на это → дм, целые числа
Y_OFFSET       = 29     # смещение по y чтобы минимум = 0 (raw min y = −29)
DEFAULT_CAP_KG = 50.0   # грузоподъёмность ячейки по умолчанию (нет в датасете)
DEFAULT_VOL_M3 = 0.002  # объём артикула по умолчанию

# Вес по ABC-классу (обувь)
ABC_WEIGHT_KG = {'A': 0.35, 'B': 0.55, 'C': 0.80}

# Файлы стратегий хранения
STRATEGY_FILES = {
    'class':     'Class_Based_Storage.csv',
    'dedicated': 'Dedicated_Storage.csv',
    'hybrid':    'Hybrid_Storage.csv',
    'random':    'Random_Storage.csv',
}

# ── 1. Ячейки склада ──────────────────────────────────────────────────────────

def parse_storage_locations(path: Path) -> dict:
    """
    Storage_Location.csv → dict{label: slot_data}

    originalLocation  A-14-11
    x, y, z           368, 0, 1   (в сантиметрах)

    Расшифровка кода: A - 14 - 11
      A   = зона
      14  = номер стеллажа (→ определяет y-позицию через БД координат)
      1   = уровень (z)
      1   = позиция внутри уровня (→ определяет x)
    """
    locations = {}
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            label = row['originalLocation'].strip()
            try:
                raw_x = int(row['x'])
                raw_y = int(row['y'])
                raw_z = int(row['z'])
            except (ValueError, KeyError):
                continue

            zone = label.split('-')[0] if '-' in label else 'A'

            locations[label] = {
                'label':    label,
                'zone':     zone,
                'raw_x':    raw_x,
                'raw_y':    raw_y,
                'raw_z':    raw_z,
                # grid coords (дм, от 0)
                'col':      raw_x // SCALE,
                'row':      (raw_y + Y_OFFSET) // SCALE,
                'level':    raw_z,
            }
    return locations


def write_layout_csv(locations: dict, out_path: Path):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['slot_label', 'row', 'col', 'level', 'zone', 'capacity_kg'])
        for loc in sorted(locations.values(), key=lambda d: d['label']):
            w.writerow([
                loc['label'],
                loc['row'],
                loc['col'],
                loc['level'],
                loc['zone'],
                DEFAULT_CAP_KG,
            ])
    print(f"  layout.csv:  {len(locations)} ячеек")


# ── 2. Каталог артикулов ─────────────────────────────────────────────────────

def parse_products(product_path: Path) -> dict:
    """
    Product.csv → dict{reference: sku_data}

    Reference  TQBVRI
    ABCCOD     A           → вес: A=0.35, B=0.55, C=0.80 кг
    Sector     Z1          → зона склада
    """
    products = {}
    with open(product_path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            ref    = row['Reference'].strip()
            abc    = (row.get('ABCCOD') or 'B').strip().upper()
            sector = (row.get('Sector') or '').strip()

            # Вес по первой букве ABC-кода
            first = abc[0] if abc else 'B'
            weight = ABC_WEIGHT_KG.get(first, 0.55)

            products[ref] = {
                'code':      ref,
                'name':      ref,
                'weight_kg': weight,
                'volume_m3': DEFAULT_VOL_M3,
                'category':  abc,
                'sector':    sector,
            }
    return products


def write_skus_csv(products: dict, out_path: Path):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['code', 'name', 'weight_kg', 'volume_m3', 'category'])
        for p in sorted(products.values(), key=lambda d: d['code']):
            w.writerow([
                p['code'],
                p['name'],
                p['weight_kg'],
                p['volume_m3'],
                p['category'],
            ])
    print(f"  skus.csv:    {len(products)} артикулов")


# ── 3. Заказы ─────────────────────────────────────────────────────────────────

DATETIME_FORMATS = [
    '%d/%m/%Y %H:%M',      # 19/10/2023 07:18  ← формат датасета
    '%d/%m/%Y %H:%M:%S',
    '%Y-%m-%d %H:%M:%S',
    '%Y-%m-%dT%H:%M:%S',
    '%d-%m-%Y %H:%M:%S',
    '%Y/%m/%d %H:%M:%S',
    '%Y-%m-%d',
    '%d/%m/%Y',
]

def normalise_datetime(raw: str) -> str:
    """
    Приводит дату к формату ISO 8601 с суффиксом Z (UTC).
    Наш бэкенд использует Instant.parse() — требует точно такой формат:
      2023-10-19T07:18:00Z
    """
    raw = raw.strip()
    for fmt in DATETIME_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%dT%H:%M:%SZ')
        except ValueError:
            continue
    # Последний шанс: если уже ISO — добавить Z если нет
    if 'T' in raw and not raw.endswith('Z'):
        return raw + 'Z'
    return raw


def parse_orders(order_path: Path, known_refs: set) -> tuple[list, set]:
    """
    Customer_Order.csv → список строк заказов

    Формат вывода (matching нашему backend UploadService):
      order_id, sku_code, quantity, timestamp

    SKU = Reference (без размера) — ключ совпадает с хранением в ячейках.
    Размер обуви Size(US) сохраняем в order_id как суффикс, чтобы не терять.
    Неизвестные References пропускаем с предупреждением.
    """
    rows     = []
    skipped  = set()
    seen_ids = set()

    with open(order_path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            ref      = row['Reference'].strip()
            order_no = str(row['orderNumber']).strip()
            qty_str  = row['quantity (units)'].strip()
            date_raw = row['creationDate'].strip()

            if ref not in known_refs:
                skipped.add(ref)
                continue

            try:
                qty = int(float(qty_str))
            except ValueError:
                continue

            rows.append({
                'order_id':  order_no,
                'sku_code':  ref,
                'quantity':  qty,
                'timestamp': normalise_datetime(date_raw),
            })

    if skipped:
        print(f"  Предупреждение: {len(skipped)} Reference из заказов не найдены в Product.csv")
        print(f"    Первые 5: {sorted(skipped)[:5]}")

    return rows, skipped


def write_orders_csv(rows: list, out_path: Path):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['order_id', 'sku_code', 'quantity', 'timestamp'])
        for r in rows:
            w.writerow([r['order_id'], r['sku_code'], r['quantity'], r['timestamp']])
    unique_orders = len({r['order_id'] for r in rows})
    print(f"  orders.csv:  {len(rows)} строк, {unique_orders} уникальных заказов")


# ── 4. Начальное назначение SKU → ячейки ─────────────────────────────────────

def parse_storage_strategy(strategy_path: Path, known_locations: set) -> dict:
    """
    Class/Dedicated/Hybrid/Random_Storage.csv → dict{location: primary_sku}

    col_1..col_18 содержат 'product_code;quantity'.
    Берём SKU с максимальным quantity как основной (наш Slot.currentSkuCode).

    Используется для инициализации — показывает текущее состояние
    до того, как наш scoring engine предложит оптимизацию.
    """
    assignment = {}  # location_label → primary_sku_code

    with open(strategy_path, newline='', encoding='utf-8') as f:
        reader   = csv.DictReader(f)
        col_keys = [k for k in reader.fieldnames if k.startswith('col_')]

        for row in reader:
            loc = (row.get('Location') or row.get('originalLocation') or '').strip()
            if loc not in known_locations:
                continue

            best_sku, best_qty = None, -1
            for col_key in col_keys:
                cell = (row.get(col_key) or '').strip()
                if not cell or ';' not in cell:
                    continue
                parts    = cell.split(';', 1)
                sku_code = parts[0].strip()
                try:
                    qty = int(parts[1].strip())
                except (ValueError, IndexError):
                    qty = 0
                if qty > best_qty:
                    best_qty = qty
                    best_sku = sku_code

            if best_sku:
                assignment[loc] = best_sku

    print(f"  Назначения:  {len(assignment)} ячеек занято из {len(known_locations)}")
    return assignment


# ── 5. Депо из Support_Points ─────────────────────────────────────────────────

def find_dock(support_points_path: Path) -> tuple[int, int]:
    """
    Депо явно не помечено в датасете.
    Инферим: точки с минимальным y — вход в склад.
    Возвращает (dock_row, dock_col) в системе нашей сетки.
    """
    min_y        = float('inf')
    entry_xs     = []

    with open(support_points_path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            pts_str = row['points_specified'].strip()
            try:
                coords = ast.literal_eval(pts_str)
                x, y   = float(coords[0]), float(coords[1])
            except Exception:
                continue

            if y < min_y:
                min_y    = y
                entry_xs = [x]
            elif y == min_y:
                entry_xs.append(x)

    if not entry_xs:
        print("  Предупреждение: не удалось найти депо, использую (0, 0)")
        return 0, 0

    dock_raw_x  = sum(entry_xs) / len(entry_xs)   # центр входных точек
    dock_col    = int(dock_raw_x) // SCALE
    dock_row    = int(min_y + Y_OFFSET) // SCALE

    print(f"  Депо:        raw ({int(dock_raw_x)}, {int(min_y)}) "
          f"→ сетка row={dock_row}, col={dock_col}")
    return dock_row, dock_col


# ── 6. Параметры создания склада ──────────────────────────────────────────────

def print_warehouse_payload(locations: dict, dock_row: int, dock_col: int):
    if not locations:
        return
    max_row = max(d['row'] for d in locations.values()) + 2
    max_col = max(d['col'] for d in locations.values()) + 2

    print(f"""
  ── Создать склад (POST /api/v1/warehouses) ──────────────────
  {{
    "name":        "Footwear Warehouse",
    "rows":        {max_row},
    "columns":     {max_col},
    "dockX":       {dock_col},
    "dockY":       {dock_row},
    "aisleWidthM": 1.5
  }}
  ─────────────────────────────────────────────────────────────
  Затем используйте полученный warehouseId при загрузке CSV.
""")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Конвертер датасета склада')
    parser.add_argument('--dataset',  default='.',           help='Папка с исходными CSV')
    parser.add_argument('--out',      default='./converted', help='Папка для результатов')
    parser.add_argument('--strategy', default='class',
                        choices=list(STRATEGY_FILES), help='Стратегия хранения')
    args = parser.parse_args()

    src = Path(args.dataset)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print(f"\nИсточник:  {src}")
    print(f"Вывод:     {out}")
    print(f"Стратегия: {args.strategy}\n")

    # 1. Ячейки
    print("[1/5] Ячейки склада...")
    locations = parse_storage_locations(src / 'Storage_Location.csv')
    write_layout_csv(locations, out / 'layout.csv')

    # 2. Артикулы
    print("[2/5] Каталог артикулов...")
    products = parse_products(src / 'Product.csv')
    write_skus_csv(products, out / 'skus.csv')

    # 3. Заказы
    print("[3/5] История заказов...")
    order_rows, _ = parse_orders(src / 'Customer_Order.csv', set(products.keys()))
    write_orders_csv(order_rows, out / 'orders.csv')

    # 4. Начальное назначение (не загружается в API, используется для анализа)
    strategy_file = src / STRATEGY_FILES[args.strategy]
    if strategy_file.exists():
        print(f"[4/5] Начальное назначение ({args.strategy})...")
        assignment = parse_storage_strategy(strategy_file, set(locations.keys()))
        # Сохраняем для справки
        assign_out = out / f'initial_assignment_{args.strategy}.csv'
        with open(assign_out, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['slot_label', 'sku_code'])
            for slot, sku in sorted(assignment.items()):
                w.writerow([slot, sku])
        print(f"  Сохранено: {assign_out.name}")
    else:
        print(f"[4/5] Файл стратегии не найден: {strategy_file.name}, пропускаем")

    # 5. Депо
    sp_file = src / 'Support_Points.csv'
    if sp_file.exists():
        print("[5/5] Определяем позицию депо...")
        dock_row, dock_col = find_dock(sp_file)
    else:
        print("[5/5] Support_Points.csv не найден, депо = (0, 0)")
        dock_row, dock_col = 0, 0

    print_warehouse_payload(locations, dock_row, dock_col)
    print(f"Готово! Файлы в папке: {out}\n")
    print("Следующие шаги:")
    print("  1. Запустите POST /api/v1/warehouses с payload выше → получите warehouseId")
    print("  2. Загрузите layout.csv  → POST /api/v1/upload/layout?warehouseId=X")
    print("  3. Загрузите skus.csv    → POST /api/v1/upload/skus?warehouseId=X")
    print("  4. Загрузите orders.csv  → POST /api/v1/upload/orders?warehouseId=X")
    print("  5. Запустите скоринг    → POST /api/v1/scoring/run")


if __name__ == '__main__':
    main()
