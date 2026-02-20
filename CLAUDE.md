# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FoodXchange is a grocery price comparison app. Backend is Django/DRF, frontend is React Native with Expo SDK 54.

## Common Commands

### Backend (run from `backend/`)

```bash
# Activate virtualenv
source .venv/bin/activate

# Run dev server
python manage.py runserver

# Run all backend tests
python manage.py test tests --verbosity=2

# Run a specific test module
python manage.py test tests.products.test_models --verbosity=2

# Lint (matches CI)
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

# Run migrations
python manage.py migrate

# Seed database
python manage.py seed_data --clear
```

### Frontend (run from `frontend/`)

```bash
# Install dependencies
npm install

# Start dev server (web)
npx expo start --web

# Run all frontend tests
npm test -- --watchAll=false

# Run a single test file
npx jest __tests__/SearchBar.test.tsx

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Architecture

### Backend (`backend/`)

Django REST Framework with three apps:

- **products/** - `Product`, `Retailer`, and `ProductPrice` (through-model for M2M). Products have `nova_score` (1-4) and `nutri_score` (A-E). Filtering via `DjangoFilterBackend`, `SearchFilter`, `OrderingFilter`.
- **shopping/** - `ShoppingList` and `ShoppingListItem` (per-user). `ShoppingListComparisonService` ranks retailers by item completeness and total cost.
- **users/** - Django's built-in User model with JWT auth (simplejwt).

URL routing is modular per app in `foodxchange/urls.py`. All API endpoints are under `/api/`.

Database: PostgreSQL (Neon) in production, SQLite for local dev. Configured via `DATABASE_URL` env var.

### Frontend (`frontend/`)

React Native (Expo SDK 54) with file-based routing via Expo Router.

- **`app/`** - Route definitions (tabs: index, foodx, cook, pantry, community). `_layout.tsx` defines the tab navigator.
- **`src/screens/`** - Screen implementations referenced by routes.
- **`src/components/`** - Reusable components (`ProductCard`, `ShoppingListItem`, `SearchBar`, etc.).
- **`src/services/api.ts`** - Axios client with JWT interceptor. Toggle `USE_PRODUCTION_API` flag to switch between `localhost:8000` and `foodxchange.onrender.com`.
- **`src/store/`** - Zustand stores (`useAuthStore`, `useShoppingStore`, `useSearchStore`, `useCartStore`).
- **`src/theme/index.ts`** - Centralized colors and design tokens. NOVA/Nutri-Score color mappings live here.
- **`src/types/`** - TypeScript interfaces.

### Token Storage

Platform-aware: `expo-secure-store` on native, `localStorage` on web. Abstracted in `api.ts`.

## Key Patterns

- **ViewSets + DefaultRouter** for DRF endpoints. Read-only nested serializers for GET; `PrimaryKeyRelatedField` (write_only) for mutations.
- **Always use `select_related`/`prefetch_related`** in querysets to avoid N+1 queries.
- **Zustand + Metro web builds**: Adding a new zustand subpath import (e.g., `zustand/middleware`) requires updating `zustandCjsMap` in `frontend/metro.config.js` to map it to the CommonJS version. Builds will break otherwise.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to main:
- Backend: flake8 lint, migrate, `python manage.py test tests --verbosity=2` (PostgreSQL 15)
- Frontend: lint (optional), type check (optional), `npm test -- --watchAll=false`
- Deploy: Triggers Render webhook on main push after tests pass

## Deployment

Backend deployed to Render. Production API: `https://foodxchange.onrender.com/api`. Health check: `/healthz`.
