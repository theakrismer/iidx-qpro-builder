# Jubeat Emblem Builder

A browser-based layered image composer for building Jubeat emblems.

## Setup

1. **Add your images** into the `src/` folders:
   ```
   src/layer1/   ← bottom-most layer
   src/layer2/
   src/layer3/
   src/layer4/
   src/layer5/   ← top-most layer
   ```
   Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`

2. **Generate the manifest** so the browser knows what files exist:
   ```
   node generate-manifest.js
   ```
   This creates/updates `manifest.json`.

3. **Serve the project** with any local HTTP server (required — file:// won't load images cross-origin):
   ```
   npx serve .
   ```
   or
   ```
   npx http-server .
   ```
   Then open `http://localhost:3000` (or the port shown) in your browser.

## Usage

- **Click a tile** in any layer panel to set that layer's image in the 455×455 preview window.
- **Click ✕ (None)** to clear a layer.
- **▼ / collapse headers** to hide/show layer option panels.
- **⬇ Export JSON** — saves your current selections to `emblem-config.json`.
- **⬆ Import JSON** — loads selections from a previously exported JSON file.

## Re-running the manifest

Whenever you add or remove images from the `src/` folders, re-run:
```
node generate-manifest.js
```
Then refresh the browser page.
