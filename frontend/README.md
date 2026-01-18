# FoodXchange Frontend

A React Native mobile app built with Expo for comparing grocery prices across retailers with nutritional data.

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Run on web
npx expo start --web

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android
```

## Project Structure

```
frontend/
├── app/                    # Expo Router pages (file-based routing)
│   ├── _layout.tsx         # Tab navigator layout
│   ├── index.tsx           # Home tab
│   ├── foodx.tsx           # FoodX search tab
│   ├── cook.tsx            # Cook tab (placeholder)
│   ├── pantry.tsx          # Pantry/Shopping lists tab
│   └── community.tsx       # Community tab (placeholder)
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ProductCard.tsx
│   │   ├── ShoppingListItem.tsx
│   │   ├── SearchBar.tsx
│   │   └── PlaceholderCard.tsx
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── FoodXScreen.tsx
│   │   ├── CookScreen.tsx
│   │   ├── PantryScreen.tsx
│   │   └── CommunityScreen.tsx
│   ├── services/           # API and external services
│   │   └── api.ts          # Axios client with JWT handling
│   ├── store/              # Zustand state management
│   │   └── index.ts
│   ├── theme/              # Design tokens from Figma
│   │   └── index.ts
│   └── types/              # TypeScript type definitions
│       └── index.ts
├── assets/                 # Images, fonts, icons
├── app.json                # Expo configuration
├── package.json
├── tsconfig.json
└── babel.config.js
```

## Features

### Implemented
- **Home Screen**: Featured products grid, news articles placeholder, quick actions
- **FoodX Search**: Text search with category filters, barcode scan placeholder
- **Pantry/Shopping Lists**: Create/manage lists, add items, price comparison
- **Bottom Tab Navigation**: 5 tabs with custom icons

### Placeholder/Coming Soon
- **Cook Screen**: Recipe finder, meal planning
- **Community Screen**: Local markets, co-ops, events
- **Barcode Scanning**: Camera integration ready

## API Integration

The app connects to the Django backend at `http://localhost:8000/api/`:

- `GET /api/products/` - List products with filtering
- `GET /api/retailers/` - List retailers
- `GET /api/shopping-lists/` - User shopping lists
- `POST /api/auth/login/` - JWT authentication

## Design System

Colors extracted from Figma design:
- **Primary Dark**: `#004000` (main green)
- **Accent Lime**: `#73FF00` (highlights)
- **Accent Orange**: `#FFB300` (warnings, sales)

NOVA Score badges: 1 (green) → 4 (red)
Nutri-Score badges: A (dark green) → E (red)

## Environment Setup

Create a `.env` file (optional):
```
API_BASE_URL=http://localhost:8000/api
```

## Dependencies

- **Expo SDK 50** - Development platform
- **React Navigation** - Bottom tabs and stack navigation
- **Zustand** - State management
- **Axios** - HTTP client with JWT interceptors
- **Expo Camera/Barcode Scanner** - For product scanning

## Development Notes

- Uses file-based routing via `expo-router`
- TypeScript for type safety
- All API types match Django REST Framework serializers
- Shopping list comparison service mirrors backend logic
