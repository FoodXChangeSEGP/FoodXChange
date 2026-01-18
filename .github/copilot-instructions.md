# FoodXchange AI Coding Agent Instructions

## Project Overview
FoodXchange is a Django REST API for comparing grocery prices across retailers with nutritional data. The backend uses PostgreSQL (via Neon), DRF with JWT, and implements sophisticated price comparison logic.

## Architecture

### Core Apps (Three Independent Services)
- **products**: Manages retailers, products, prices; includes `ProductPrice` through-model for M2M relationships
- **shopping**: User shopping lists and items; integrates price comparison via `ShoppingListComparisonService`
- **users**: Currently uses Django's built-in User model; extensible via [users/models.py](users/models.py)

### Data Flow
1. Products have name, nutrition scores (NOVA 1-4, Nutri-Score A-E), category, barcode
2. Retailers linked via `ProductPrice` (M2M through-model) with stock status and pricing
3. Shopping lists belong to users; items reference products and hold quantities
4. Price comparison service (`ShoppingListComparisonService`) calculates cheapest retailer by completeness + total cost

### Key Models & Relationships
- `Product` ← M2M → `Retailer` (via `ProductPrice`)
- `ShoppingList` ← 1:M → `ShoppingListItem` ← FK → `Product`
- Indexes on `Product`: category+nova_score, nova_score; `ShoppingList`: user+updated_at

## API Patterns & Conventions

### ViewSet Organization
- All apps use DRF's `DefaultRouter` with `ModelViewSet`
- Filter backends: `DjangoFilterBackend`, `SearchFilter`, `OrderingFilter`
- Multiple serializers per viewset based on action (list vs detail vs create/update)
  - Example: [ProductViewSet](products/views.py#L34-L48) uses `ProductListSerializer`, `ProductCreateUpdateSerializer`, `ProductDetailSerializer`
- Custom `@action` methods for computed fields (e.g., `lowest_price`)

### Serializer Patterns
- Read-only nested serializers for related objects (e.g., `RetailerSerializer` nested in `ProductPriceSerializer`)
- PrimaryKeyRelatedField with `write_only=True` for bulk operations
- `SerializerMethodField` for computed values (`lowest_price`, `effective_price`)
- Display fields use `source='get_*_display'` for Django choice field rendering
- Read-only fields always exclude write operations: `read_only_fields = ['id', 'created_at']`

### URL Routing Pattern
```python
# All apps follow this pattern
router.register(r'resource', ResourceViewSet, basename='resource')
```
Then included in [foodxchange/urls.py](foodxchange/urls.py) as `path('api/', include('app.urls'))`

## Developer Workflows

### Setup & Database
```bash
# Activate venv (pre-created)
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed test data (creates retailers, products, shopping lists)
python manage.py seed_data --clear  # --clear flag resets existing data
```

### Local Development
```bash
python manage.py runserver  # Runs on http://127.0.0.1:8000/
```

### API Testing
Use `/api/products/`, `/api/retailers/`, `/api/prices/`, `/api/shopping-lists/` endpoints with filtering:
```
GET /api/products/?category=dairy&nova_score=1
GET /api/shopping-lists/{id}/compare-prices/  # Custom action
```

## Environment & Configuration
- Settings loaded from `.env` (see [foodxchange/settings.py](foodxchange/settings.py#L9-L19))
- PostgreSQL via `dj-database-url` from `DATABASE_URL`
- CORS enabled via `django-cors-headers` middleware
- JWT authentication ready (djangorestframework-simplejwt installed) but not yet enforced
- Third-party: DRF, django-filter, psycopg2, python-dotenv

## Project-Specific Patterns & Gotchas

### Shopping List Price Comparison
`ShoppingListComparisonService` ([shopping/services.py](shopping/services.py)):
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
Seed data command ([products/management/commands/seed_data.py](products/management/commands/seed_data.py)):
- Creates retailers, products with nutrition scores, prices with intentional gaps
- Also creates test user + sample shopping list
- Use `--clear` flag to reset database before reseeding

## Testing & Common Issues
- **Query optimization**: Always use `select_related` for FK fields, `prefetch_related` for reverse FK/M2M
- **Serializer read/write fields**: Nested objects are read-only; use PrimaryKeyRelatedField for writes
- **Filtering**: ProductFilter ([products/filters.py](products/filters.py)) implements custom nova_score filtering
- **Migrations**: Always generated when models change; run `python manage.py makemigrations && python manage.py migrate`
