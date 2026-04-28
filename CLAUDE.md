# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# CLAUDE.md — Warehouse Slot Optimization SaaS

## Контекст проекта

Строим SaaS-продукт для оптимизации слоттинга и маршрутизации на складе. Ключевое отличие от конкурентов — **инженерная прозрачность**: не чёрный ящик, а открытые формулы, графы и объяснения каждой рекомендации.

### Целевая аудитория
- Технические операционные директора (COO) средних складов (5 000–50 000 SKU)
- Логисты, которые уже пробовали «AI-решения» и не доверяют им
- Warehouse managers, которым нужно обосновать решения перед руководством

### Конкурентный ландшафт
| Конкурент | Что делает | Слабость |
|-----------|-----------|----------|
| SlotWise | Красивый дашборд | Нет реальной математики под капотом |
| Manhattan | Enterprise-комбайн | 6+ месяцев внедрения, консультанты, $$$$ |
| **Мы** | Инженерная строгость в SaaS | Прозрачные формулы, граф маршрута, explainability |

### Ценностное предложение (одной строкой)
> «Вот граф, вот маршрут, вот формула — проверь сам.»

---

## Архитектура: три слоя

```
┌─────────────────────────────────────────────────┐
│              UI / Dashboard (React)             │
│  Карта склада · Рекомендации · Метрики · Графы  │
├─────────────────────────────────────────────────┤
│         Слой 3: Explainability Layer            │
│  Причина каждой рекомендации в человеческом виде│
├─────────────────────────────────────────────────┤
│         Слой 2: Routing Graph                   │
│  Граф склада · Shortest path · Ограничения      │
├─────────────────────────────────────────────────┤
│         Слой 1: Scoring Engine                  │
│  Частота заказов · Co-pick матрица · Расстояние │
├─────────────────────────────────────────────────┤
│         Data Layer (PostgreSQL + Redis)         │
│  SKU · Orders · Warehouse layout · Sessions     │
└─────────────────────────────────────────────────┘
```

---

## Технический стек

- **Backend**: Java 21, Spring Boot 3.x (Spring Web, Spring Data JPA, Spring Data Redis)
- **Алгоритмы**: JGraphT (графы), Apache Commons Math 3 (матрицы, разреженные структуры)
- **БД**: PostgreSQL 16 (данные), Redis (кэш scoring, сессии)
- **Миграции**: Flyway
- **Сборка**: Maven
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, Recharts/D3.js (визуализация графов)
- **Инфра**: Docker Compose (dev), fly.io или Railway (MVP deploy)
- **Тесты**: JUnit 5, Mockito, Spring Boot Test, React Testing Library

---

## Пошаговый план реализации

### Фаза 0: Фундамент (День 1)

#### 0.1 Структура проекта

```
warehouse-optimizer/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/warehouse/optimizer/
│   │   │   │   ├── WarehouseOptimizerApplication.java   # Spring Boot entry point
│   │   │   │   ├── config/
│   │   │   │   │   ├── AppConfig.java                   # Bean definitions
│   │   │   │   │   └── RedisConfig.java
│   │   │   │   ├── model/                               # JPA entities
│   │   │   │   │   ├── Warehouse.java
│   │   │   │   │   ├── Slot.java
│   │   │   │   │   ├── Sku.java
│   │   │   │   │   ├── Order.java
│   │   │   │   │   └── OrderLine.java
│   │   │   │   ├── dto/                                 # Request/Response DTOs (records)
│   │   │   │   ├── repository/                          # Spring Data JPA repositories
│   │   │   │   ├── controller/                          # REST controllers
│   │   │   │   │   ├── UploadController.java
│   │   │   │   │   ├── ScoringController.java
│   │   │   │   │   ├── RoutingController.java
│   │   │   │   │   └── RecommendationController.java
│   │   │   │   ├── engine/                              # Бизнес-логика (ЯДРО)
│   │   │   │   │   ├── ScoringEngine.java               # Слой 1
│   │   │   │   │   ├── RoutingEngine.java               # Слой 2
│   │   │   │   │   └── ExplainerEngine.java             # Слой 3
│   │   │   │   ├── service/                             # Data access, CSV parsing
│   │   │   │   └── exception/                           # ScoringException, RoutingException
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/                        # Flyway SQL scripts (V1__, V2__...)
│   │   └── test/
│   │       └── java/com/warehouse/optimizer/
│   │           ├── engine/                              # Unit tests for engine layer
│   │           └── controller/                          # Integration tests
│   ├── pom.xml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WarehouseMap/    # SVG-карта склада
│   │   │   ├── ScorePanel/      # Панель скоринга
│   │   │   ├── RouteViewer/     # Визуализация маршрута
│   │   │   ├── ExplainCard/     # Карточка с объяснением
│   │   │   └── Upload/          # Загрузка данных
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

#### 0.2 Модели данных

**Таблица `warehouses`**:
- `id`, `name`, `rows`, `columns`, `dock_x`, `dock_y`, `aisle_width_m`

**Таблица `slots`**:
- `id`, `warehouse_id`, `label` (например "B3-02"), `row`, `col`, `level` (ярус), `zone`, `capacity_kg`, `current_sku_id`

**Таблица `skus`**:
- `id`, `warehouse_id`, `code` (внешний код), `name`, `weight_kg`, `volume_m3`, `category`

**Таблица `orders`**:
- `id`, `warehouse_id`, `external_id`, `created_at`

**Таблица `order_lines`**:
- `id`, `order_id`, `sku_id`, `quantity`

**Таблица `recommendations`**:
- `id`, `warehouse_id`, `sku_id`, `from_slot_id`, `to_slot_id`, `score_delta`, `explanation_json`, `status` (pending/accepted/rejected), `created_at`

#### 0.3 Задачи дня 1
1. `docker-compose.yml` — PostgreSQL, Redis, backend, frontend
2. Инициализировать Spring Boot проект с health check `GET /api/v1/health`
3. Создать JPA-сущности и Flyway-миграции (SQL файлы `V1__create_warehouses.sql` и т.д.)
4. Endpoint `POST /api/v1/upload/orders` — парсинг CSV с заказами (OpenCSV или Apache Commons CSV)
5. Endpoint `POST /api/v1/upload/layout` — парсинг CSV/JSON с layout склада
6. Seed-скрипт с тестовыми данными (1000 SKU, 500 ячеек, 10 000 заказов) — `DataSeeder.java` (Spring `@Component` + `CommandLineRunner`)
7. Инициализировать React-проект, базовый layout с sidebar

**Формат CSV заказов** (ожидаемый):
```csv
order_id,sku_code,quantity,timestamp
ORD-001,SKU-A21,2,2024-01-15T10:30:00
ORD-001,SKU-A22,1,2024-01-15T10:30:00
ORD-002,SKU-B05,3,2024-01-15T11:00:00
```

**Формат CSV layout** (ожидаемый):
```csv
slot_label,row,col,level,zone,capacity_kg
A1-01,0,0,1,A,50
A1-02,0,0,2,A,30
B3-01,2,5,1,B,50
```

---

### Фаза 1: Scoring Engine (Дни 2–3)

#### 1.1 Метрики для скоринга каждой пары (SKU → Slot)

**Компонент A — Velocity Score (частота заказов)**:
```java
// velocity[sku] = count_orders(sku, last_90_days) / total_orders(last_90_days)
// Нормализация в [0, 1]: velocity_norm[sku] = velocity[sku] / max(velocity)
// SKU с высокой velocity должны быть ближе к dock
```

**Компонент B — Co-pick Matrix (совместные заказы)**:
```java
// Строим матрицу NxN где N = количество SKU
// copick[i][j] = количество заказов, содержащих И sku_i И sku_j
// Используем разреженное представление (Map<Long, Map<Long, Integer>>)
// copick_score[i][j] = copick[i][j] / max(orders_with_i, orders_with_j)
// SKU с высоким co-pick должны быть рядом друг с другом
```

**Компонент C — Distance Score (расстояние до dock)**:
```java
// Manhattan distance от ячейки до dock:
// distance[slot] = |slot.row - dock.row| + |slot.col - dock.col|
// Нормализация (инвертированная, ближе = лучше):
// dist_norm[slot] = 1.0 - (distance[slot] / maxDistance)
```

**Итоговый Score**:
```java
// score(sku, slot) =
//   w1 * velocity_norm[sku] * dist_norm[slot]      // быстрые товары ближе
// + w2 * copick_affinity(sku, slot.neighbors)       // co-pick рядом
// + w3 * fit_penalty(sku.weight, slot.capacity)     // физ. ограничения
//
// Веса по умолчанию: w1=0.5, w2=0.35, w3=0.15
// Пользователь может менять веса через UI
```

#### 1.2 Greedy Assignment

```java
/**
 * 1. Отсортировать SKU по velocity (убывание)
 * 2. Для каждого SKU:
 *    a. Найти лучшую свободную ячейку по score(sku, slot)
 *    b. Если у SKU есть co-pick партнёры уже размещённые —
 *       дать бонус ячейкам рядом с ними
 *    c. Назначить, пометить ячейку занятой
 * 3. Вернуть список назначений с score и explanation
 *
 * Не ILP, но даёт ~85% качества при x100 скорости — достаточно для MVP.
 */
List<Assignment> runGreedyAssignment(Long warehouseId, ScoringWeights weights);
```

#### 1.3 API endpoints

- `POST /api/v1/scoring/run` — запуск скоринга для warehouse_id
  - Параметры: `weights` (опционально), `dateRange`
  - Возвращает: `jobId` (async) или результат
- `GET /api/v1/scoring/results/{jobId}` — результаты скоринга
- `GET /api/v1/scoring/matrix/{warehouseId}` — co-pick матрица (для визуализации)
- `PATCH /api/v1/scoring/weights` — обновить веса

#### 1.4 Задачи

1. Реализовать `ScoringEngine.java`:
   - `computeVelocity(Long warehouseId, int days) -> Map<Long, Double>`
   - `computeCopickMatrix(Long warehouseId, int days) -> Map<Long, Map<Long, Double>>`
   - `computeSlotDistances(Long warehouseId) -> Map<Long, Double>`
   - `scoreAssignment(Long skuId, Long slotId, ScoringContext ctx) -> double`
   - `runGreedyAssignment(Long warehouseId, ScoringWeights weights) -> List<Assignment>`
2. JUnit 5 unit-тесты на scoring с известными данными
3. API endpoints для scoring
4. Frontend: страница Upload с drag-and-drop для CSV

---

### Фаза 2: Routing Graph (Дни 3–4)

#### 2.1 Граф склада

Склад моделируется как **взвешенный граф** через JGraphT:
- **Узлы**: каждая ячейка (slot) + точки пересечения проходов + dock
- **Рёбра**: физические проходы между узлами
- **Веса рёбер**: расстояние в метрах

```java
import org.jgrapht.Graph;
import org.jgrapht.graph.DefaultWeightedEdge;
import org.jgrapht.graph.SimpleWeightedGraph;

/**
 * 1. Создать узел для каждого slot + dock
 * 2. Добавить рёбра вдоль рядов (горизонтальные проходы)
 * 3. Добавить рёбра между рядами (cross-aisles)
 * 4. Вес = Manhattan или евклидово расстояние в метрах
 */
Graph<Long, DefaultWeightedEdge> buildWarehouseGraph(Warehouse warehouse);
```

#### 2.2 Оптимизация маршрута пикера

```java
/**
 * Вариант TSP с ограничениями вместимости тележки.
 *
 * Для N <= 12: exact через перебор permutations
 * Для N > 12: nearest-neighbor heuristic + 2-opt improvement
 *
 * Если суммарный вес > cartCapacity → несколько рейсов от dock.
 *
 * Возвращает: orderedSlots, totalDistanceM, tripCount, pathEdges
 */
Route optimizePickRoute(Graph<Long, DefaultWeightedEdge> graph,
                        Long dockNode,
                        List<Long> pickList,
                        double cartCapacityKg);
```

#### 2.3 Сравнение маршрутов (before/after)

```java
/**
 * Ключевая фича — показать разницу warehouse manager'у.
 * Returns: currentDistanceM, proposedDistanceM, savingsM, savingsPct,
 *          currentPath, proposedPath
 */
RouteComparison compareRoutes(Graph<Long, DefaultWeightedEdge> graph,
                               Long dock,
                               List<Long> pickList,
                               Map<Long, Long> currentSlots,
                               Map<Long, Long> proposedSlots);
```

#### 2.4 API endpoints

- `POST /api/v1/routing/optimize` — оптимизация маршрута для заказа
  - Body: `{ warehouseId, pickList: [skuId], cartCapacityKg }`
- `POST /api/v1/routing/compare` — сравнение текущего vs предложенного
- `GET /api/v1/routing/graph/{warehouseId}` — полный граф для визуализации

#### 2.5 Задачи

1. Реализовать `RoutingEngine.java`:
   - `buildWarehouseGraph(Warehouse) -> Graph`
   - `findShortestPath(graph, start, end) -> Path`
   - `optimizePickRoute(graph, dock, pickList, capacity) -> Route`
   - `compareRoutes(graph, dock, pickList, current, proposed) -> RouteComparison`
2. JUnit 5 тесты: простой склад 3x3, проверить корректность маршрута
3. API endpoints
4. Frontend: интерактивная карта склада (SVG) с отображением маршрута

---

### Фаза 3: Explainability Layer (День 4–5)

#### 3.1 Формат объяснения

```java
// Каждая рекомендация сопровождается структурированным объяснением:

public record Explanation(
    String skuCode,
    String fromSlot,      // текущая ячейка (или "не размещён")
    String toSlot,        // рекомендуемая ячейка
    double scoreBefore,
    double scoreAfter,
    List<Reason> reasons, // список причин
    Impact impact
) {}

public record Reason(
    String type,          // "velocity" | "copick" | "distance" | "weight_fit"
    String description,   // человекочитаемое описание
    double value,
    Map<String, Object> detail
) {}

// Пример Reason:
// type="copick"
// description="Co-pick с SKU #A22 (43% совместных заказов)"
// value=0.43
// detail={partnerSku: "A22", sharedOrders: 215, totalOrders: 500}

public record Impact(
    double avgRouteSavingsM,
    int dailyPicksAffected,
    double estimatedDailySavingsMin
) {}
```

#### 3.2 Генерация объяснений

```java
/**
 * 1. Собрать все компоненты score для обеих ячеек
 * 2. Для каждого компонента, где toSlot лучше — создать Reason
 * 3. Рассчитать impact через compareRoutes на выборке заказов
 * 4. Собрать Explanation
 */
Explanation explainRecommendation(Sku sku, Slot fromSlot, Slot toSlot,
                                   ScoringContext scoringCtx,
                                   RoutingContext routingCtx);
```

#### 3.3 API endpoints

- `GET /api/v1/recommendations/{warehouseId}` — список с объяснениями
  - Параметры: `sortBy` (score_delta, savings_m), `limit`, `status`
- `PATCH /api/v1/recommendations/{id}/accept`
- `PATCH /api/v1/recommendations/{id}/reject`
- `GET /api/v1/recommendations/{id}/detail`

#### 3.4 Задачи

1. Реализовать `ExplainerEngine.java`
2. Интеграция с ScoringEngine и RoutingEngine
3. API endpoints
4. Frontend: карточки ExplainCard с before/after, кнопки Accept/Reject, формулы

---

### Фаза 4: Frontend Dashboard (Дни 5–7)

#### 4.1 Страницы

1. **Upload** — drag-and-drop, валидация, preview
2. **Warehouse Map** — SVG-карта. Ячейки цветом по velocity. Popup при наведении.
3. **Recommendations** — список с фильтрами. Сортировка по impact. Accept/Reject.
4. **Route Viewer** — визуализация before/after. Анимация пикера.
5. **Analytics** — avg distance, picks/hour, co-pick heatmap
6. **Settings** — слайдеры весов, параметры склада, экспорт

#### 4.2 Ключевые компоненты

- `WarehouseGrid` — SVG-grid с zoom/pan (d3-zoom)
- `RouteOverlay` — SVG path поверх grid, анимация
- `CopickHeatmap` — матрица co-pick (Recharts или D3)
- `ExplainCard` — карточка с раскрывающимся detail
- `ScoreSliders` — интерактивные слайдеры w1, w2, w3
- `BeforeAfterToggle` — переключатель для сравнения маршрутов

---

### Фаза 5: Polish и Launch (Дни 8–10)

1. **Auth**: JWT (Spring Security + jjwt)
2. **Multi-tenant**: `warehouse_id` привязан к `user_id`
3. **Export**: скачать рекомендации в CSV (OpenCSV) / Excel (Apache POI)
4. **Onboarding**: wizard при первом входе (upload → configure → results)
5. **Demo mode**: предзаполненный склад без загрузки данных
6. **Performance**: кэширование scoring в Redis, pagination
7. **Deploy**: Docker → fly.io, PostgreSQL managed, домен
8. **Landing page**: одностраничник с value proposition

---

## Команды для запуска

```bash
# Dev environment (все сервисы)
docker-compose up -d

# Backend (Spring Boot с hot-reload через spring-boot-devtools)
cd backend && mvn spring-boot:run

# Или с конкретным профилем
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Frontend
cd frontend && npm run dev

# Тесты backend (все)
cd backend && mvn test

# Запустить один тест-класс
cd backend && mvn test -Dtest=ScoringEngineTest

# Запустить один метод
cd backend && mvn test -Dtest=ScoringEngineTest#computeVelocity_returnsNormalizedScores

# Миграции (Flyway запускается автоматически при старте, но можно вручную)
cd backend && mvn flyway:migrate

# Seed данные
cd backend && mvn spring-boot:run -Dspring-boot.run.arguments=--seed

# Build production jar
cd backend && mvn clean package -DskipTests

# Frontend build
cd frontend && npm run build
```

---

## Соглашения для разработки

### Код (Java)

- Java 21: использовать records для DTO, sealed interfaces для типов ошибок, pattern matching
- Типизация: не использовать raw types; `@NonNull` / `@Nullable` из Spring
- Именование: camelCase для полей и методов, PascalCase для классов, UPPER_SNAKE для констант
- Ошибки: кастомные исключения (`ScoringException`, `RoutingException`) с HTTP mapping через `@ControllerAdvice`
- Логирование: SLF4J + Logback, JSON-формат в prod (logstash-logback-encoder)
- Конфиги: `application.yml` + `application-dev.yml`, secrets через переменные окружения

### API

- Все endpoints под `/api/v1/`
- Ответы: `{ "data": ..., "meta": { "timestamp", "version" } }`
- Ошибки: `{ "error": { "code", "message", "detail" } }`
- Pagination: `?page=0&size=50` (Spring Data style, zero-based)

### Код (TypeScript / Frontend)

- camelCase везде, PascalCase для компонентов и типов
- Строгий TypeScript: `strict: true` в tsconfig

### Тесты

- Каждый класс в `engine/` должен иметь тест-класс
- Тестовые данные: `@BeforeEach` fixtures прямо в тест-классе или `src/test/resources/`
- Минимум: ScoringEngine на известных данных, RoutingEngine на графе 3x3
- Интеграционные тесты через `@SpringBootTest` + Testcontainers (PostgreSQL, Redis)

### Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Ветки: `main`, `develop`, `feature/scoring-engine`, `feature/routing-graph`

---

## Приоритеты (если нужно резать scope)

1. **MUST**: Upload CSV → Scoring → Recommendations с объяснениями
2. **MUST**: Warehouse map + Route visualization
3. **SHOULD**: Before/After comparison
4. **SHOULD**: Co-pick heatmap
5. **COULD**: Auth, multi-tenant
6. **COULD**: Demo mode, landing page

---

## Метрики успеха MVP

- Пользователь загружает CSV → получает рекомендации за < 30 секунд (для 5000 SKU)
- Каждая рекомендация содержит минимум 2 reasons с конкретными числами
- Маршрут визуализируется на карте с расстоянием в метрах
- Before/After показывает экономию в метрах и процентах
