# Asset Placeholders

These are placeholder assets for the FoodXchange app. Replace with actual branded assets before production.

## Required Assets

1. **icon.png** (1024x1024)
   - App icon displayed on home screen
   - Should be square, no transparency

2. **splash.png** (1284x2778)
   - Splash screen shown on app launch
   - Background color: #004000

3. **adaptive-icon.png** (1024x1024)
   - Android adaptive icon foreground
   - Should have transparent background

4. **favicon.png** (48x48)
   - Web browser favicon

## Color Palette

Use these brand colors from the Figma design:
- Primary Dark: #004000
- Accent Lime: #73FF00
- Accent Orange: #FFB300
- White: #FFFFFF

## Generating PNGs from SVGs

If you have the SVG files, convert to PNG using:

```bash
# Using ImageMagick
convert icon.svg -resize 1024x1024 icon.png
convert splash.svg -resize 1284x2778 splash.png
convert icon.svg -resize 1024x1024 adaptive-icon.png
convert icon.svg -resize 48x48 favicon.png
```

Or use an online tool like https://svgtopng.com/
