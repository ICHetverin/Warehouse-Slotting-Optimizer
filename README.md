# Warehouse Slotting Optimizer



SaaS для оптимизации **слоттинга** (размещения SKU по ячейкам) и **маршрутизации сборки** на складе.
Ключевое отличие от конкурентов — **инженерная прозрачность**: не чёрный ящик, а открытые формулы,
граф склада и статистически обоснованное объяснение каждой рекомендации.

Система по истории заказов, габаритам товаров и геометрии склада предлагает, **какой товар в какую
ячейку переставить**, чтобы сократить путь пикера, и доказывает это числами (доверительные интервалы,
значимость, экономия в метрах и времени).

---

## Содержание
- [Проблема и ценность](#проблема-и-ценность)
- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Склады-примеры](#склады-примеры-реальные-данные)
- [REST API](#rest-api)
- [Статистика и скоринг](#статистика-и-скоринг)
- [Структура проекта](#структура-проекта)
- [Тесты](#тесты)
- [Документация](#документация)

---

## Проблема и ценность

На складе 5 000–50 000 SKU расположение товаров обычно случайно или унаследовано. Пикер проходит
лишние километры в день. «AI-решения» предлагают переставить товары, но не объясняют почему —
и логисты им не доверяют.

**Мы решаем это так:** каждая рекомендация сопровождается (1) **формулой скоринга**, (2) **графом
маршрута** до и после, (3) **статистическим обоснованием** (значима ли перестановка, какая
гарантированная экономия). Логист может проверить каждое решение.

Целевая аудитория: операционные директора средних складов, логисты, warehouse-менеджеры, которым
нужно обосновать решения перед руководством.

---

## Возможности

- **Скоринг размещения** — жадный алгоритм с богатой формулой: velocity (экспоненциально-взвешенная,
  Wilson-стабилизированная), **ABC/XYZ** классификация, эргономика (golden zone), co-pick affinity,
  centroid bias, физическая пригодность (вес + объём).
- **Статистически значимые рекомендации** — показываются **только** значимые перестановки
  (Benjamini-Hochberg FDR над p-value из demand-теста и **lift χ²** co-pick), поэтому их **число
  варьируется**, а не фиксировано. У каждой — ≥2 человекочитаемых довода с числами, lift, p/q-value.
- **Принять / Принять все** — accept **реально перемещает** товар в новую ячейку; bulk-применение с
  разрешением конфликтов; **аудит решений** (когда и что принято).
- **Маршрутизация (TSP)** — граф склада на JGraphT, Dijkstra, точный перебор для ≤10 остановок,
  nearest-neighbour + 2-opt для больших списков, мульти-рейсы при превышении вместимости тележки.
- **Карта склада** — SVG-тепловая карта приоритета ячеек + **анимированный маршрут пикера** прямо на
  схеме, режим «до / после».
- **Аналитика** — матрица ABC×XYZ с профилями, **co-pick heatmap** (lift), распределения.
- **Симуляция «что если»** — проигрывает историю заказов на предложенном размещении, оценивает
  экономию пути/времени до внедрения.
- **Автотюнинг весов** — grid-search по целевой метрике, один клик «подобрать → применить →
  сгенерировать рекомендации».
- **Валидация** — три KPI: точность прогноза (**WAPE**), индекс стабильности размещения,
  эффективность маршрута с **bootstrap доверительным интервалом**.
- **Склады-примеры** — галерея из реальных публичных датасетов, загрузка в один клик.
- **UX** — единый светлый дизайн, глобальный выбор склада, демо-тур, адаптивная вёрстка.

---

## Архитектура

Три слоя «инженерной прозрачности» поверх данных:

```
┌─────────────────────────────────────────────────────────┐
│              UI / Dashboard (React + Ant Design)          │
│   Карта · Рекомендации · Метрики · Графы · Маршрут        │
├─────────────────────────────────────────────────────────┤
│  Слой 3: Explainability  — ExplainerEngine                │
│     причина каждой рекомендации в человеческом виде       │
├─────────────────────────────────────────────────────────┤
│  Слой 2: Routing Graph   — RoutingEngine (JGraphT)        │
│     граф склада · shortest path · TSP · сравнение         │
├─────────────────────────────────────────────────────────┤
│  Слой 1: Scoring Engine  — ScoringEngine + Statistics     │
│     velocity · co-pick (lift) · ABC/XYZ · fit · FDR-гейт  │
├─────────────────────────────────────────────────────────┤
│  Данные: PostgreSQL (Flyway) + Redis                      │
└─────────────────────────────────────────────────────────┘
```

Вся бизнес-логика — в пакете `engine/`; контроллеры и сервисы тонкие. `ScoringContext` —
неизменяемый бандл прекомпьютнутых карт, собирается один раз на прогон.

---

## Технологический стек

**Backend:** Java 21, Spring Boot 3.3.5 (Web, Data JPA, Data Redis), **JGraphT** (графы),
**Apache Commons Math 3** (χ², нормальное/хи-квадрат распределения), **Flyway** (миграции),
**OpenCSV**, Lombok, Maven.
**БД:** PostgreSQL 16, Redis 7.
**Frontend:** React 18 + TypeScript (strict), Vite, **Ant Design 6**, **Recharts**, Axios.
**Инфра:** Docker Compose.
**Тесты:** JUnit 5, Mockito, Testcontainers.

---

## Быстрый старт

### Вариант 1 — всё в Docker
```bash
docker compose up -d           # postgres, redis, backend (:8080), frontend (:3000)
```
Открыть **http://localhost:3000**.

### Вариант 2 — dev-режим (hot reload)
```bash
# 1. Инфраструктура
docker compose up -d postgres redis

# 2. Backend (:8080) — Flyway сам накатит схему
cd backend && mvn spring-boot:run

# 3. Frontend (:3000), прокси /api → :8080
cd frontend && npm install && npm run dev
```

### Первый запуск
На странице **«Склады»** нажмите «Загрузить» у любого примера (≈5–15 с) — появится активный склад.
Дальше: **Скоринг** → запустить, **Рекомендации** → принять, **Карта** → маршрут, **Симуляция** →
экономия. Или нажмите **«Демо-тур»** в шапке.

Конфигурация БД/Redis — через переменные окружения (`DB_URL`, `DB_USER`, `DB_PASSWORD`,
`REDIS_HOST`, `REDIS_PORT`, `PORT`), дефолты — в `backend/src/main/resources/application.yml`.

---

## Склады-примеры (реальные данные)

Загружаются одной кнопкой из галереи (`POST /api/v1/upload/examples/{key}`):

| Ключ | Источник | Размер | Что демонстрирует |
|------|----------|--------|-------------------|
| `mendeley-footwear` | Mendeley Data (CC BY-NC) | 208 SKU · 2 292 ячейки · ~33 тыс. заказов | **Реальные CAD-координаты** + 4 стратегии размещения |
| `online-retail` | UCI Online Retail II (CC BY) | 800 SKU · ~30 тыс. строк | Реальные корзины UK-ритейла — velocity + co-pick |
| `groceries` | arules Groceries | 169 SKU · 9 835 корзин | Классический market-basket — плотный co-pick |

Датасеты без реальных координат получают **синтезированный layout** (category-banded grid) — есть
что оптимизировать. Файлы лежат в `backend/src/main/resources/datasets/`.

---

## REST API

Все эндпоинты под `/api/v1`. Ответы обёрнуты в `{ data, meta }`; ошибки нормализованы
(`{ error: { code, message } }`) через `GlobalExceptionHandler`.

**Health** — `GET /health`

**Warehouses**
`GET /warehouses` · `POST /warehouses` · `GET /warehouses/{id}` · `GET /warehouses/{id}/skus` · `GET /warehouses/{id}/slots`

**Upload / datasets**
`POST /upload/{orders|layout|skus}` (CSV) · `POST /upload/mendeley` · `GET /upload/examples` · `POST /upload/examples/{key}`

**Scoring**
`POST /scoring/run` · `GET /scoring/results/{jobId}` · `GET /scoring/matrix/{wh}` (co-pick) · `GET /scoring/abcxyz/{wh}` · `PATCH /scoring/weights` · `POST /scoring/simulate` · `POST /scoring/tune`

**Routing**
`POST /routing/optimize` · `POST /routing/compare` · `GET /routing/graph/{wh}`

**Recommendations**
`POST /recommendations/generate` · `GET /recommendations/{wh}` · `GET /recommendations/detail/{id}` · `PATCH /recommendations/{id}/accept` · `PATCH /recommendations/{id}/reject` · `POST /recommendations/{wh}/accept-all`

---

## Статистика и скоринг

Скоринг богаче, чем `w1·velocity + w2·copick + w3·fit`. Рекомендации **статистически обоснованы**:

- **Co-pick = lift + χ²**: `lift = pairCount·N/(cntX·cntY)`, значимость по таблице 2×2 — отличает
  реальную совместную встречаемость от случайной.
- **Velocity = интервал Уилсона**: стабилизирует оценку для редких SKU (shrinkage).
- **Отбор рекомендаций = Benjamini-Hochberg FDR** над p-value → **переменное число** только значимых.
- **Экономия маршрута = percentile bootstrap CI** (нижняя граница > 0 = не случайна).
- **Прогноз = WAPE** (устойчив к нулям, в отличие от MAPE/sMAPE).
- **ABC/XYZ**, экспоненциально-взвешенная velocity, эргономика golden-zone, centroid bias.

---

## Структура проекта

```
backend/  (Spring Boot)
  engine/        ScoringEngine, RoutingEngine, ExplainerEngine, ValidationEngine,
                 AutoTuningEngine, SimulationEngine, Statistics, ScoringContext
  service/       RecommendationService, ScoringService, RoutingService, UploadService,
                 MendeleyDatasetImporter, ExampleDatasetImporter, DataSeeder
  controller/    Health, Warehouse, Upload, Scoring, Routing, Recommendation
  model/ dto/ repository/ config/ exception/
  resources/db/migration/   V1, V2, V4 (Flyway; ddl-auto=validate)
  resources/datasets/        mendeley-footwear, online-retail, groceries

frontend/ (React + Vite)
  app/           WarehouseContext, WeightsContext (глобальное состояние)
  pages/         Dashboard, Warehouses, Import, Scoring, Recommendations, Tuning,
                 WarehouseMap, AbcXyz, Copick, Routes, Simulation
  components/    layout/ (AppLayout, PageContainer, PageHeader, WarehouseSelector, HealthBadge)
                 common/ (StatCard, SectionCard, EmptyState, WeightSliders, …)
                 ExplainCard, DemoTour, Upload
  api/client.ts  единый Axios-клиент (24+ метода)
  theme.ts       дизайн-токены
```

---

## Тесты

```bash
cd backend && mvn test                       # все
mvn test -Dtest=ScoringEngineTest            # один класс
```
Юнит-тесты движков (`ScoringEngineTest`, `SimulationEngineTest`) + бенчмарк на реальном датасете
(`MendeleyDatasetBenchmarkTest`, требует Docker для Testcontainers), проверяющий, что жадная
оптимизация превосходит базовые стратегии размещения.

---