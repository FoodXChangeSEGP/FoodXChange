# FoodXchange AI Coding Agent Instructions

## Project Overview
FoodXchange is a full-stack grocery price comparison app with a Django REST backend and React Native Expo frontend. The backend uses PostgreSQL (via Neon), DRF with JWT, and sophisticated price comparison logic. The frontend is a mobile app built with Expo SDK 50 and React Navigation for iOS/Android.

## Architecture

### Backend - Core Apps (Three Independent Services)
- **products**: Manages retailers, products, prices; includes `ProductPrice` through-model for M2M relationships
- **shopping**: User shopping lists and items; integrates price comparison via `ShoppingListComparisonService`
- **users**: Currently uses Django's built-in User model; extensible via [backend/users/models.py](backend/users/models.py)

### Frontend - React Native Expo App
- **Expo Router**: File-based routing using `/frontend/app/` directory structure
- **Bottom Tab Navigation**: 5 main tabs (Home, FoodX, Cook, Pantry, Community) with custom icons
- **Screens**: [HomeScreen](frontend/src/screens/HomeScreen.tsx), [FoodXScreen](frontend/src/screens/FoodXScreen.tsx), [PantryScreen](frontend/src/screens/PantryScreen.tsx), [CookScreen](frontend/src/screens/CookScreen.tsx), [CommunityScreen](frontend/src/screens/CommunityScreen.tsx)
- **Components**: Reusable [ProductCard](frontend/src/components/ProductCard.tsx), [ShoppingListItem](frontend/src/components/ShoppingListItem.tsx), [SearchBar](frontend/src/components/SearchBar.tsx), [PlaceholderCard](frontend/src/components/PlaceholderCard.tsx)

### Data Flow
1. Products have name, nutrition scores (NOVA 1-4, Nutri-Score A-E), category, barcode
2. Retailers linked via `ProductPrice` (M2M through-model) with stock status and pricing
3. Shopping lists belong to users; items reference products and hold quantities
4. Price comparison service (`ShoppingListComparisonService`) calculates cheapest retailer by completeness + total cost
5. Frontend fetches products/lists via Django REST API with JWT authentication
6. Mobile app caches state with Zustand and displays nutrition scores with color-coded badges

### Key Models & Relationships
- `Product` ← M2M → `Retailer` (via `ProductPrice`)
- `ShoppingList` ← 1:M → `ShoppingListItem` ← FK → `Product`
- Indexes on `Product`: category+nova_score, nova_score; `ShoppingList`: user+updated_at

### Frontend Structure
```
frontend/
├── app/                       # Expo Router (file-based routing)
│   ├── _layout.tsx            # Root layout with Tabs navigator
│   ├── index.tsx              # Home tab screen
│   ├── foodx.tsx              # Search/FoodX tab
│   ├── cook.tsx               # Cook tab (placeholder)
│   ├── pantry.tsx             # Shopping lists tab
│   └── community.tsx          # Community tab (placeholder)
├── src/
│   ├── components/            # Reusable UI components
│   ├── screens/               # 5 main screen components
│   ├── services/api.ts        # Axios client + API methods
│   ├── store/index.ts         # Zustand stores (auth, shopping, search)
│   ├── theme/index.ts         # Design tokens from Figma
│   └── types/index.ts         # TypeScript interfaces
├── assets/                    # Icons, images, placeholders
└── app.json                   # Expo configuration
```

## API Patterns & Conventions

### Backend ViewSet Organization
- All apps use DRF's `DefaultRouter` with `ModelViewSet`
- Filter backends: `DjangoFilterBackend`, `SearchFilter`, `OrderingFilter`
- Multiple serializers per viewset based on action (list vs detail vs create/update)
  - Example: [ProductViewSet](products/views.py#L34-L48) uses `ProductListSerializer`, `ProductCreateUpdateSerializer`, `ProductDetailSerializer`
- Custom `@action` methods for computed fields (e.g., `lowest_price`)

### Backend Serializer Patterns
- Read-only nested serializers for related objects (e.g., `RetailerSerializer` nested in `ProductPriceSerializer`)
- PrimaryKeyRelatedField with `write_only=True` for bulk operations
- `SerializerMethodField` for computed values (`lowest_price`, `effective_price`)
- Display fields use `source='get_*_display'` for Django choice field rendering
- Read-only fields always exclude write operations: `read_only_fields = ['id', 'created_at']`

### Backend URL Routing Pattern
```python
# All apps follow this pattern
router.register(r'resource', ResourceViewSet, basename='resource')
```
Then included in [foodxchange/urls.py](foodxchange/urls.py) as `path('api/', include('app.urls'))`

### Frontend API Service ([frontend/src/services/api.ts](frontend/src/services/api.ts))
- Axios instance with JWT interceptor for token refresh
- **Local vs Production Toggle**: Set `USE_PRODUCTION_API` flag in api.ts
  - `false` (default): Uses local backend at `http://localhost:8000/api`
  - `true`: Uses production Render API at `https://foodxchange.onrender.com/api`
  - Logs current API endpoint in dev mode for clarity
- Type-safe API methods matching Django endpoints:
  - `auth.login()`, `auth.register()`, `auth.refreshToken()`
  - `products.getAll()`, `products.search()`, `products.getById()`
  - `retailers.getAll()`
  - `shoppingLists.getAll()`, `shoppingLists.create()`, `shoppingLists.comparePrices()`
  - `prices.getAll()`, `prices.bulkUpdate()`
- Request/response types defined inline matching DRF serializers

### Frontend State Management (Zustand)
- `useAuthStore`: `user`, `token`, `isLoading`, `login()`, `logout()`, `register()`
- `useShoppingStore`: `shoppingLists`, `selectedList`, `addItem()`, `removeItem()`, `fetchLists()`
- `useSearchStore`: `query`, `results`, `filters`, `search()`, `clearSearch()`

### Frontend Component Patterns
- All components are function components with TypeScript
- Use theme colors from [frontend/src/theme/index.ts](frontend/src/theme/index.ts)
- `ProductCard`: Displays product with NOVA badge (1=green→4=red), Nutri-Score badge (A=dark→E=red), price, and in-stock status
- `ShoppingListItem`: Checkbox item with product name, quantity selector, per-unit price
- `SearchBar`: TextInput with barcode scan button (expo-barcode-scanner placeholder)
- `PlaceholderCard`: Reusable "coming soon" card for unimplemented features

### Design System from Figma
- **Primary Dark Green**: `#004000` (nav, buttons, active state)
- **Accent Lime**: `#73FF00` (highlights, badges)
- **Accent Orange**: `#FFB300` (warnings, on-sale indicators)
- **NOVA Scores**: 1→green, 2→yellow, 3→orange, 4→red
- **Nutri-Scores**: A→dark green, B→light green, C→yellow, D→orange, E→red

## Developer Workflows

### Backend Setup & Database
```bash
# Activate venv (pre-created)
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed test data (creates retailers, products, shopping lists)
python manage.py seed_data --clear  # --clear flag resets existing data
```

### Backend Local Development
```bash
python manage.py runserver  # Runs on http://127.0.0.1:8000/

Test Credentials:
Username: testuser
Password: testpass123
```

### Frontend Setup & Development
```bash
cd frontend
npm install
npx expo start --web    # Web development (hot reload)
npx expo start --ios    # iOS Simulator
npx expo start --android # Android Emulator

Build and publish:
npx eas build --platform ios
npx eas build --platform android
```

### API Testing
Use `/api/products/`, `/api/retailers/`, `/api/prices/`, `/api/shopping-lists/` endpoints with filtering:
```
GET /api/products/?category=dairy&nova_score=1
GET /api/shopping-lists/{id}/compare-prices/  # Custom action
```

Frontend API calls via `useAuthStore` and service methods:
```typescript
import { api } from '@/services/api';
const products = await api.products.search({ query: 'milk', category: 'dairy' });
const comparison = await api.shoppingLists.comparePrices(listId);
```

## Environment & Configuration
- **Backend Settings**: Loaded from `.env` (see [backend/foodxchange/settings.py](backend/foodxchange/settings.py#L9-L19))
  - PostgreSQL via `dj-database-url` from `DATABASE_URL`
  - CORS enabled via `django-cors-headers` middleware
  - JWT authentication ready (djangorestframework-simplejwt installed) but not yet enforced
  - Third-party: DRF, django-filter, psycopg2, python-dotenv

- **Frontend Settings**: Flexible API endpoint configuration
  - Toggle between local and production via `USE_PRODUCTION_API` flag in [frontend/src/services/api.ts](frontend/src/services/api.ts)
  - Expo SDK 50 configured in [frontend/app.json](frontend/app.json)
  - Metro bundler (React Native build tool) configured in [frontend/metro.config.js](frontend/metro.config.js)
  - Third-party: Expo, React Navigation, Zustand, Axios

## Deployment & CI/CD

### Production Deployment (Render)
- **Service**: [FoodXChange](https://foodxchange.onrender.com) running at https://foodxchange.onrender.com
- **Health check**: GET `/healthz` returns `{"status": "ok"}`
- **Auto-deploy**: Enabled on pushes to `main` branch via Render blueprint ([render.yaml](render.yaml))
- **Build command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- **Start command**: `gunicorn foodxchange.wsgi:application --bind 0.0.0.0:$PORT`

### CI/CD Workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml))
- **Backend Tests**: Runs Django tests with PostgreSQL 15 service
  - Lints code with flake8
  - Runs migrations
  - Executes `python manage.py test --verbosity=2`
- **Frontend Tests**: Type checks and lints React Native code
  - TypeScript validation with `tsc --noEmit`
  - ESLint checks (continue-on-error)
  - Jest tests (continue-on-error)
- **Deploy Job**: Triggered after successful tests on `main` branch
  - Gracefully handles missing `RENDER_DEPLOY_HOOK_URL` secret
  - Skips deployment with warning if secret not configured

### Testing Deployment Locally
```bash
# Frontend against production API
# In frontend/src/services/api.ts, set:
const USE_PRODUCTION_API = true;

# Then start dev server
cd frontend && npx expo start --web
```

## Project-Specific Patterns & Gotchas

### Shopping List Price Comparison
`ShoppingListComparisonService` ([backend/shopping/services.py](backend/shopping/services.py)):
- **Single responsibility**: Compare prices across retailers for a shopping list
- **Lazy loading**: Items, product_quantities, all_prices cached as properties to minimize queries
- **Critical logic**: Filters to `in_stock=True` products only; sorts by completeness then cost
- When adding features: Maintain the comparison ranking logic and caching pattern

### Many-to-Many Through Model
`ProductPrice` is the through-model for Product ↔ Retailer:
- Always use `prefetch_related('prices__retailer')` in Product queries for performance
- Contains pricing logic: `is_on_sale`, `sale_price`, `effective_price` (computed), `in_stock`, `last_updated`
- ProductPrice is directly exposed as a viewset for bulk price updates

### Custom Management Commands
Seed data command ([backend/products/management/commands/seed_data.py](backend/products/management/commands/seed_data.py)):
- Creates retailers, products with nutrition scores, prices with intentional gaps
- Also creates test user + sample shopping list
- Use `--clear` flag to reset database before reseeding

### Expo Router File-Based Routing
- Routes are defined by file structure in `/frontend/app/`
- `_layout.tsx` is the root layout wrapping all child routes
- Files like `index.tsx`, `foodx.tsx`, `pantry.tsx` map directly to route names
- Tab navigator in `_layout.tsx` renders bottom tabs with Ionicons
- Each tab route file imports and renders its corresponding Screen component

### Frontend Screen Architecture
- All screens import components and use theme colors/spacing
- Screens fetch data via API service methods in useEffect hooks
- State persisted via Zustand stores (auth, shopping, search)
- Each screen includes try-catch error handling and loading states
- Placeholder screens use `PlaceholderCard` component for "coming soon" features

## Testing & Common Issues
- **Query optimization**: Always use `select_related` for FK fields, `prefetch_related` for reverse FK/M2M
- **Serializer read/write fields**: Nested objects are read-only; use PrimaryKeyRelatedField for writes
- **Filtering**: ProductFilter ([backend/products/filters.py](backend/products/filters.py)) implements custom nova_score filtering
- **Migrations**: Always generated when models change; run `python manage.py makemigrations && python manage.py migrate`

## Frontend Debugging & Development

### Common Issues
- **API Connection**: Ensure backend is running on `http://localhost:8000/` before starting frontend
- **TypeScript Errors**: Run `npm run type-check` to validate all types match backend serializers
- **Missing Assets**: Placeholder SVGs in `/frontend/assets/` - replace with actual PNG files before production
- **Expo Linking**: Use `npx expo start` to get QR code for scanning on physical devices

### Useful Commands
```bash
cd frontend
npm install                 # Install dependencies
npx expo start             # Start dev server with menu
npx expo start --clear     # Clear cache and restart
npx expo prebuild          # Generate native iOS/Android directories
npm run type-check         # Validate TypeScript
```
