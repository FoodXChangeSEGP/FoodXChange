# FoodXchange 🛒

**A full-stack grocery price comparison app** that helps users find the cheapest retailers for their shopping lists by comparing prices across multiple stores and displaying nutrition information (NOVA & Nutri-Score).

- 🌐 **Live Demo**: https://foodxchange.onrender.com
- 📱 **Frontend**: React Native (Expo SDK 50) with Expo Router
- 🔙 **Backend**: Django REST Framework with PostgreSQL
- 🎨 **Design**: Figma-inspired color scheme with health badges

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **Git**

### Clone & Setup

```bash
git clone https://github.com/FoodXChangeSEGP/FoodXChange.git
cd FoodXChange

# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data --clear  # Seed test data

# Frontend setup (in new terminal)
cd frontend
npm install
```

---

## 📋 Running the Project

### Backend (Django)

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

**Runs on**: http://127.0.0.1:8000/
**Test Credentials**:
- Username: `testuser`
- Password: `testpass123`

### Transactional Email (Resend)

Password reset and email verification use Django mail.

- Local development (`DEBUG=True`): emails are printed to console.
- Production (`DEBUG=False`): app sends via SMTP (Resend-ready defaults).

Set these environment variables on Render:

```bash
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=resend
RESEND_API_KEY=<your_resend_api_key>
# optional fallback if you don't use RESEND_API_KEY:
EMAIL_HOST_PASSWORD=<your_resend_api_key>
DEFAULT_FROM_EMAIL="FoodXchange <noreply@your-domain.com>"
```

If both are set, `EMAIL_HOST_PASSWORD` is used first; otherwise Django uses `RESEND_API_KEY`.

### Frontend (Expo)

```bash
cd frontend

# Web (browser)
npm run web                  # Runs on http://localhost:8081

# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Physical device (Expo Go)
npx expo start
```

---

## 🔄 API Toggle: Local vs Production

The frontend can easily switch between local backend and production Render API.

### How to Toggle

Edit [frontend/src/services/api.ts](frontend/src/services/api.ts) line 19:

```typescript
// For local development (default)
const USE_PRODUCTION_API = false;  // Uses http://localhost:8000/api

// For testing against production
const USE_PRODUCTION_API = true;   // Uses https://foodxchange.onrender.com/api
```

The console logs the current API:
```
🌐 API: http://localhost:8000/api
🌐 API: https://foodxchange.onrender.com/api
```

---

## 🏗️ Project Structure

### Backend

```
backend/
├── manage.py                          # Django CLI
├── requirements.txt                   # Python dependencies
├── Procfile                           # Render deployment config
├── render.yaml                        # Infrastructure as code
├── foodxchange/                       # Django project settings
│   ├── settings.py                    # Config (DB, CORS, auth)
│   ├── urls.py                        # Root URL routing
│   ├── wsgi.py                        # WSGI entry point
│   └── asgi.py                        # ASGI entry point
├── products/                          # Products, retailers, prices
│   ├── models.py                      # Product, Retailer, ProductPrice
│   ├── serializers.py                 # DRF serializers
│   ├── views.py                       # ProductViewSet, RetailerViewSet, ProductPriceViewSet
│   ├── filters.py                     # ProductFilter with custom nova_score
│   ├── urls.py                        # API routes
│   └── management/commands/
│       └── seed_data.py               # Test data generator
├── shopping/                          # Shopping lists & price comparison
│   ├── models.py                      # ShoppingList, ShoppingListItem
│   ├── serializers.py                 # DRF serializers
│   ├── services.py                    # ShoppingListComparisonService
│   ├── views.py                       # ShoppingListViewSet with compare-prices action
│   └── urls.py                        # API routes
└── users/                             # User authentication
    ├── models.py                      # Uses Django's built-in User
    ├── serializers.py                 # UserSerializer
    ├── views.py                       # User detail/profile endpoints
    └── urls.py                        # API routes
```

### Frontend

```
frontend/
├── app.json                           # Expo configuration
├── package.json                       # JS dependencies
├── tsconfig.json                      # TypeScript config
├── app/                               # Expo Router (file-based routing)
│   ├── _layout.tsx                    # Root layout with Tabs navigator
│   ├── index.tsx                      # Home tab → HomeScreen
│   ├── foodx.tsx                      # Search tab → FoodXScreen
│   ├── cook.tsx                       # Cook tab → CookScreen (placeholder)
│   ├── pantry.tsx                     # Shopping lists → PantryScreen
│   └── community.tsx                  # Community tab → CommunityScreen (placeholder)
├── src/
│   ├── components/                    # Reusable UI components
│   │   ├── ProductCard.tsx            # Product display with nutrition badges
│   │   ├── ShoppingListItem.tsx       # List item with quantity control
│   │   ├── SearchBar.tsx              # Search input with barcode scan
│   │   └── PlaceholderCard.tsx        # "Coming soon" placeholder
│   ├── screens/                       # Screen implementations
│   │   ├── HomeScreen.tsx             # Overview & featured products
│   │   ├── FoodXScreen.tsx            # Product search & filtering
│   │   ├── PantryScreen.tsx           # Shopping list management
│   │   ├── CookScreen.tsx             # Recipe suggestions (placeholder)
│   │   └── CommunityScreen.tsx        # Community features (placeholder)
│   ├── services/
│   │   ├── api.ts                     # Axios client + API methods with toggle
│   │   └── index.ts                   # Exports
│   ├── store/
│   │   └── index.ts                   # Zustand stores (auth, shopping, search)
│   ├── theme/
│   │   └── index.ts                   # Design tokens (colors, spacing, fonts)
│   └── types/
│       └── index.ts                   # TypeScript interfaces
└── assets/                            # Icons, images, splash screens
```

---

## 📡 API Endpoints

All endpoints return JSON. Base URL: `http://localhost:8000/api/` or `https://foodxchange.onrender.com/api/`

### Products

```
GET    /products/                    # List all products (paginated)
GET    /products/?search=milk        # Search by name
GET    /products/?category=dairy     # Filter by category
GET    /products/?nova_score=1       # Filter by NOVA score (1-4)
GET    /products/{id}/               # Get product details
POST   /products/                    # Create product (admin only)
PUT    /products/{id}/               # Update product (admin only)
DELETE /products/{id}/               # Delete product (admin only)
```

### Retailers

```
GET    /retailers/                   # List all retailers
GET    /retailers/{id}/              # Get retailer details
POST   /retailers/                   # Create retailer (admin only)
```

### Prices (ProductPrice)

```
GET    /prices/                      # List all prices
GET    /prices/?product_id=1         # Get prices for a product
GET    /prices/?retailer_id=1        # Get prices at a retailer
POST   /prices/bulk_update/          # Bulk update prices (admin only)
```

### Shopping Lists

```
GET    /shopping-lists/              # List user's shopping lists
POST   /shopping-lists/              # Create new shopping list
GET    /shopping-lists/{id}/         # Get list details with items
PUT    /shopping-lists/{id}/         # Update list
DELETE /shopping-lists/{id}/         # Delete list
GET    /shopping-lists/{id}/compare-prices/  # Get cheapest retailer

POST   /shopping-lists/{id}/items/   # Add item to list
DELETE /shopping-lists/{id}/items/{item_id}/  # Remove item
PUT    /shopping-lists/{id}/items/{item_id}/  # Update item quantity
```

### Authentication

```
POST   /auth/register/               # Register new user
POST   /auth/login/                  # Login (returns JWT token)
POST   /auth/refresh/                # Refresh JWT token
GET    /auth/logout/                 # Logout
```

### Health Check

```
GET    /healthz/                     # Returns {"status": "ok"}
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
python manage.py test --verbosity=2
```

### Frontend Type Checking

```bash
cd frontend
npx tsc --noEmit
```

### API Testing (cURL)

```bash
# Get all products
curl http://localhost:8000/api/products/

# Search products
curl "http://localhost:8000/api/products/?search=milk"

# Get retailers
curl http://localhost:8000/api/retailers/

# Create shopping list (requires auth)
curl -X POST http://localhost:8000/api/shopping-lists/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Groceries"}'
```

---

## 🎨 Design System

All colors are defined in [frontend/src/theme/index.ts](frontend/src/theme/index.ts):

| Component | Color | Hex |
|-----------|-------|-----|
| **Primary** | Dark Green | `#004000` |
| **Accent** | Lime | `#73FF00` |
| **Warning** | Orange | `#FFB300` |
| **Background** | Light Gray | `#F5F5F5` |

### Nutrition Badges

**NOVA Scores** (Food Processing Level)
- 1️⃣ Unprocessed/Minimally Processed → 🟢 Green
- 2️⃣ Processed Culinary Ingredients → 🟡 Yellow
- 3️⃣ Processed Foods → 🟠 Orange
- 4️⃣ Ultra-Processed Foods → 🔴 Red

**Nutri-Scores** (Nutritional Quality)
- A → 🟢 Dark Green (Excellent)
- B → 🟢 Light Green (Good)
- C → 🟡 Yellow (Moderate)
- D → 🟠 Orange (Low)
- E → 🔴 Red (Poor)

---

## 🚀 Deployment

### Production (Render)

The app is automatically deployed to [https://foodxchange.onrender.com](https://foodxchange.onrender.com) on every push to `main`.

**Manual Deploy** (if needed):
1. Ensure changes are pushed to `main` branch
2. Visit [Render Dashboard](https://dashboard.render.com)
3. Select **FoodXChange** service
4. Click **Manual Deploy** → **Deploy latest commit**

### CI/CD Pipeline ([.github/workflows/ci.yml](.github/workflows/ci.yml))

Runs on every push to `main` and pull request:

1. **Backend Tests**
   - Python 3.10 + PostgreSQL 15
   - Linting (flake8)
   - Migrations
   - Unit tests

2. **Frontend Tests**
   - Node.js 18
   - TypeScript validation
   - ESLint (optional)

3. **Deploy** (if tests pass)
   - Triggers Render webhook
   - Deploys latest code to production

---

## 🔧 Common Tasks

### Add a New Product

```bash
python manage.py shell

from products.models import Product, Retailer, ProductPrice

# Create product
p = Product.objects.create(
    name="Milk",
    category="Dairy",
    nova_score=1,
    nutri_score="A",
    barcode="5000112120892"
)

# Add price at retailer
retailer = Retailer.objects.get(name="BudgetMart")
ProductPrice.objects.create(
    product=p,
    retailer=retailer,
    price=2.50,
    in_stock=True
)
```

### Reset Database

```bash
# Clear all data and reseed
python manage.py seed_data --clear

# Or manually
python manage.py flush
python manage.py migrate
python manage.py seed_data
```

### Add Frontend Component

```typescript
// src/components/MyComponent.tsx
import { View, Text } from 'react-native';
import { useTheme } from '@/theme';

export function MyComponent() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.primary }}>
      <Text>My Component</Text>
    </View>
  );
}
```

Then export from [src/components/index.ts](frontend/src/components/index.ts):
```typescript
export { MyComponent } from './MyComponent';
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error**: `ModuleNotFoundError: No module named 'django'`

**Solution**: Activate .venv and install dependencies
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend API Connection Fails

**Error**: `Failed to connect to localhost:8000`

**Solution**: Ensure backend is running
```bash
cd backend && python manage.py runserver
```

Or toggle to production API in [frontend/src/services/api.ts](frontend/src/services/api.ts):
```typescript
const USE_PRODUCTION_API = true;
```

### Database Locked

**Error**: `database is locked`

**Solution**: Delete SQLite database and recreate
```bash
rm db.sqlite3
python manage.py migrate
python manage.py seed_data
```

### Expo Port Already in Use

**Error**: `Port 8081 is already in use`

**Solution**: Kill the process or use a different port
```bash
npm run web -- --port 8082
```

### TypeScript Errors After Changes

**Error**: Type mismatch between frontend and backend

**Solution**: Validate types match DRF serializers
```bash
npx tsc --noEmit
```

---

## 📚 Key Concepts

### Shopping List Price Comparison

The `ShoppingListComparisonService` ([backend/shopping/services.py](backend/shopping/services.py)) intelligently ranks retailers by:

1. **Completeness**: % of items in stock
2. **Total Cost**: Sum of effective prices (includes sale prices)

Example:
```
ShoppingList: [Milk, Bread, Cheese]

BudgetMart: 3/3 items = $8.50 ✅ CHEAPEST
FreshFoods: 2/3 items = $7.00 (missing Cheese)
SuperStore: 3/3 items = $9.20
```

### Many-to-Many through Model

`ProductPrice` is the through-model connecting `Product` ↔ `Retailer`:

```python
Product (e.g., Milk)
  ↓
ProductPrice (e.g., Milk @BudgetMart for $2.50)
  ↓
Retailer (e.g., BudgetMart)
```

Always use `prefetch_related('prices__retailer')` to optimize queries:
```python
products = Product.objects.prefetch_related('prices__retailer')
```

### Zustand State Management

Frontend state is managed with Zustand for persistence:

```typescript
// Store
const useAuthStore = create(...)

// In component
const { user, login } = useAuthStore();
await login(email, password);
```

---

## 👥 Contributing

1. **Create a branch** for your feature: `git checkout -b feature/my-feature`
2. **Make changes** and test locally
3. **Run tests**: `python manage.py test` + `npx tsc --noEmit`
4. **Push to branch**: `git push origin feature/my-feature`
5. **Open a Pull Request** to `main`

---

## 📋 To-Do Items

- [ ] Implement user authentication (JWT tokens not yet enforced)
- [ ] Complete Cook screen (recipe suggestions)
- [ ] Complete Community screen (user reviews & ratings)
- [ ] Add barcode scanning functionality
- [ ] Implement price history graphs
- [ ] Add real retailer APIs (currently seeded data)
- [ ] Multi-language support
- [ ] iOS/Android native builds

---

## 📄 License

MIT License - See LICENSE file for details

---

## 📧 Questions?

For questions or issues:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review [.github/copilot-instructions.md](.github/copilot-instructions.md) for architecture details
3. Open an issue on [GitHub Issues](https://github.com/FoodXChangeSEGP/FoodXChange/issues)

---

**Happy coding! 🎉**
