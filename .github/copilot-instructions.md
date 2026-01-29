# FoodXchange AI Agent Instructions (Optimized)

## Critical Workflow

* **Code Style:** Prioritize clean, readable code. Run tests after every change. Modify/add new tests when changing functionality.
* **Process Management:** Run backend/frontend in the background to keep the terminal free.
* **Start & Track:** (in backend folder) `nohup python manage.py runserver > server.log 2>&1 & echo $! > server.pid`
* **Stop:** `kill $(cat server.pid) 2/dev/null || pkill -f runserver`
* **Monitor:** Check `server.log` for errors or startup confirmation.


* **Database:** PostgreSQL (Neon). Seed via `python manage.py seed_data --clear`.

## Architecture & Data Flow

* **Backend (Django/DRF):** - `products`: M2M relationships via `ProductPrice` (includes pricing, stock, sales).
* `shopping`: `ShoppingListComparisonService` (logic for cheapest/most complete retailer).
* `users`: Standard Django User model.


* **Frontend (React Native Expo SDK 50):** - **Routing:** Expo Router (file-based) in `/frontend/app/`.
* **State:** Zustand (Auth, Shopping, Search stores).
* **API:** Axios with JWT interceptor. Toggle `USE_PRODUCTION_API` in `api.ts`.



## Core Patterns

### Backend (DRF)

* **Viewsets:** Use `ModelViewSet` + `DefaultRouter`.
* **Serializers:** Read-only nested serializers for GET; `PrimaryKeyRelatedField` (write_only) for POST/PUT.
* **Queries:** Always use `select_related` (FK) and `prefetch_related` (M2M) to prevent N+1 issues.
* **Filtering:** Use `DjangoFilterBackend`, `SearchFilter`, and `OrderingFilter`.

### Frontend (Expo/React)

* **Design:** Colors from `theme/index.ts`. Follow NOVA (1-4) and Nutri-Score (A-E) color mapping.
* **Components:** Functional components with TypeScript. Reuse `ProductCard` and `ShoppingListItem`.
* **Zustand (CRITICAL):** Metro web builds require CommonJS mapping for Zustand.
* **Action:** If adding a new zustand subpath (e.g., `middleware`), update `zustandCjsMap` in `frontend/metro.config.js`.



## Key Commands & Config

| Task | Command |
| --- | --- |
| **Backend Dev** | (in backend folder) `python manage.py runserver` |
| **Frontend Dev** | (in frontend folder) `npx expo start --web` |
| **Test Backend** | (in backend folder) `python manage.py test` |
| **Type Check** | (in frontend folder) `npm run type-check` |
| **Reset Data** | (in backend folder) `python manage.py seed_data --clear` |
## Deployment (Render)

* **API:** `https://foodxchange.onrender.com/api`
* **Health:** `/healthz`
* **CI/CD:** GitHub Actions (`ci.yml`) runs linting, migrations, and tests before deploying to Render.