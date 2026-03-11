/**
 * IIDX Q-Pro Builder - app.js
 *
 * Layers: background, body, face, hair, hand, head
 *
 * Special layer rules:
 *   - face:  single image per option (no sub-variants)
 *   - hair:  two files per option: <name>_b.png (back, z-index 1) and
 *            <name>_f.png (front, z-index 3). Tiles show both composited.
 *   - hand:  two files per option: <name>_l.png (left) and <name>_r.png (right).
 *            Both shown in the tile preview composited.
 *   - head:  two files per option: <name>_b.png (back, z-index 2) and
 *            <name>_f.png (front, z-index 4). Tiles show both composited.
 *
 * Reads manifest.json (generate with: node generate-manifest.js)
 */

// ─── Layer config ────────────────────────────────────────────────────────────

/**
 * Describes each layer panel.
 *
 * type:
 *   'single'  – one file per option (background, body, face)
 *   'fb'      – two files per option: _f (front) and _b (back)  (hair, head)
 *   'lr'      – two files per option: _l (left)  and _r (right) (hand)
 */
const LAYER_CONFIG = [
  { key: 'background', label: 'Background', type: 'single' },
  { key: 'body',       label: 'Body',       type: 'single' },
  { key: 'face',       label: 'Face',       type: 'single' },
  { key: 'hair',       label: 'Hair',       type: 'fb'     },
  { key: 'hand',       label: 'Hand',       type: 'lr'     },
  { key: 'head',       label: 'Head',       type: 'fb'     },
];

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * state[layerKey] = null | filename-stem (without suffix for fb/lr layers)
 * For 'single' layers the value is the full filename. For 'fb'/'lr' it's the stem.
 */
const state = {};
LAYER_CONFIG.forEach(cfg => { state[cfg.key] = null; });

/** Raw file list per layer key (all filenames from manifest, no path prefix) */
const layerFiles = {};
LAYER_CONFIG.forEach(cfg => { layerFiles[cfg.key] = []; });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the src path for a file inside a layer directory */
function srcPath(layerKey, filename) {
  return `src/${layerKey}/${filename}`;
}

/**
 * For fb/lr layers, derive the base stem from a filename.
 * e.g. "aeon_f.png" → "aeon", "bpl2 sh_l.png" → "bpl2 sh"
 */
function stemFrom(filename) {
  return filename.replace(/_[fb]\.png$/i, '').replace(/_[lr]\.png$/i, '');
}

/**
 * For fb/lr layers, collect unique stems from the full file list.
 * Returns an array of stems preserving order of first occurrence.
 */
function stemsFor(layerKey) {
  const seen = new Set();
  const result = [];
  layerFiles[layerKey].forEach(f => {
    const s = stemFrom(f);
    if (!seen.has(s)) { seen.add(s); result.push(s); }
  });
  return result;
}

// ─── Initialise ──────────────────────────────────────────────────────────────

async function init() {
  await loadManifest();
  renderLayerPanels();
  renderPreviewSelections();
  bindActions();
}

// ─── Manifest ────────────────────────────────────────────────────────────────

async function loadManifest() {
  try {
    const res = await fetch('manifest.json');
    if (!res.ok) throw new Error('No manifest.json found');
    const manifest = await res.json();
    LAYER_CONFIG.forEach(cfg => {
      layerFiles[cfg.key] = manifest[cfg.key] || [];
    });
  } catch (err) {
    console.warn('manifest.json not found or invalid.', err);
  }
}

// ─── Render Layer Panels ─────────────────────────────────────────────────────

function renderLayerPanels() {
  const container = document.getElementById('layersPanel');
  container.innerHTML = '';

  LAYER_CONFIG.forEach(cfg => {
    const { key, label, type } = cfg;

    // For fb/lr layers count unique stems; for single count raw files
    const count = (type === 'single')
      ? layerFiles[key].length
      : stemsFor(key).length;

    const section = document.createElement('div');
    section.className = 'layer-section collapsed';
    section.id = `section-${key}`;

    // Header
    const header = document.createElement('div');
    header.className = 'layer-header';
    header.innerHTML = `
      <div class="header-left">
        <span class="layer-badge">${label}</span>
        <span class="layer-count">${count} option${count !== 1 ? 's' : ''}</span>
      </div>
      <span class="collapse-icon">▼</span>
    `;
    header.addEventListener('click', () => toggleSection(section));

    // Body / grid
    const body = document.createElement('div');
    body.className = 'layer-body';

    const grid = document.createElement('div');
    grid.className = 'layer-grid';
    grid.id = `grid-${key}`;

    if (count === 0) {
      const msg = document.createElement('p');
      msg.className = 'loading-msg';
      msg.textContent = `No images found. Add files to src/${key}/ and run generate-manifest.js.`;
      grid.appendChild(msg);
    } else {
      grid.appendChild(createNoneTile(key));

      if (type === 'single') {
        layerFiles[key].forEach(filename => {
          grid.appendChild(createSingleTile(key, filename));
        });
      } else if (type === 'fb') {
        stemsFor(key).forEach(stem => {
          grid.appendChild(createFBTile(key, stem));
        });
      } else if (type === 'lr') {
        stemsFor(key).forEach(stem => {
          grid.appendChild(createLRTile(key, stem));
        });
      }
    }

    body.appendChild(grid);
    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  });
}

// ─── Tile Builders ───────────────────────────────────────────────────────────

function createNoneTile(layerKey) {
  const tile = document.createElement('div');
  tile.className = 'option-tile none-tile';
  tile.dataset.layer = layerKey;
  tile.dataset.stem = '';
  tile.title = 'None (clear this layer)';

  tile.innerHTML = `
    <div class="none-x">✕</div>
    <span class="tile-label">None</span>
    <span class="check-icon">✓</span>
  `;

  if (state[layerKey] === null) tile.classList.add('selected');
  tile.addEventListener('click', () => selectOption(layerKey, null, tile));
  return tile;
}

/** Single-image tile (background, body, face) */
function createSingleTile(layerKey, filename) {
  const tile = document.createElement('div');
  tile.className = 'option-tile';
  tile.dataset.layer = layerKey;
  tile.dataset.stem = filename; // full filename used as the stem for single layers

  const label = filename.replace(/\.(png|avif|jpg|webp)$/i, '');
  tile.title = label;

  tile.innerHTML = `
    <img src="${srcPath(layerKey, filename)}" alt="${label}" loading="lazy" />
    <span class="tile-label">${label}</span>
    <span class="check-icon">✓</span>
  `;

  if (state[layerKey] === filename) tile.classList.add('selected');
  tile.addEventListener('click', () => selectOption(layerKey, filename, tile));
  return tile;
}

/** Front/Back composite tile (hair, head) */
function createFBTile(layerKey, stem) {
  const tile = document.createElement('div');
  tile.className = 'option-tile composite-tile';
  tile.dataset.layer = layerKey;
  tile.dataset.stem = stem;
  tile.title = stem;

  const pathB = srcPath(layerKey, `${stem}_b.png`);
  const pathF = srcPath(layerKey, `${stem}_f.png`);

  tile.innerHTML = `
    <div class="composite-preview">
      <img src="${pathB}" alt="${stem} back"  loading="lazy" class="comp-b" />
      <img src="${pathF}" alt="${stem} front" loading="lazy" class="comp-f" />
    </div>
    <span class="tile-label">${stem}</span>
    <span class="check-icon">✓</span>
  `;

  if (state[layerKey] === stem) tile.classList.add('selected');
  tile.addEventListener('click', () => selectOption(layerKey, stem, tile));
  return tile;
}

/** Left/Right composite tile (hand) */
function createLRTile(layerKey, stem) {
  const tile = document.createElement('div');
  tile.className = 'option-tile composite-tile';
  tile.dataset.layer = layerKey;
  tile.dataset.stem = stem;
  tile.title = stem;

  const pathL = srcPath(layerKey, `${stem}_l.png`);
  const pathR = srcPath(layerKey, `${stem}_r.png`);

  tile.innerHTML = `
    <div class="composite-preview">
      <img src="${pathL}" alt="${stem} left"  loading="lazy" class="comp-l" />
      <img src="${pathR}" alt="${stem} right" loading="lazy" class="comp-r" />
    </div>
    <span class="tile-label">${stem}</span>
    <span class="check-icon">✓</span>
  `;

  if (state[layerKey] === stem) tile.classList.add('selected');
  tile.addEventListener('click', () => selectOption(layerKey, stem, tile));
  return tile;
}

// ─── Selection Logic ─────────────────────────────────────────────────────────

/**
 * value is:
 *   null     → clear layer
 *   filename → for single layers (background, body, face)
 *   stem     → for fb/lr layers (hair, head, hand)
 */
function selectOption(layerKey, value, clickedTile) {
  state[layerKey] = value;

  // Update tile highlights
  const grid = document.getElementById(`grid-${layerKey}`);
  grid.querySelectorAll('.option-tile').forEach(t => t.classList.remove('selected'));
  clickedTile.classList.add('selected');

  // Section border
  const section = document.getElementById(`section-${layerKey}`);
  section.classList.toggle('has-selection', value !== null);

  // Update preview images
  applyPreviewForLayer(layerKey, value);
  renderPreviewSelections();
}

function applyPreviewForLayer(layerKey, value) {
  const cfg = LAYER_CONFIG.find(c => c.key === layerKey);
  if (!cfg) return;

  if (cfg.type === 'single') {
    const img = document.getElementById(`preview-${layerKey}`);
    if (value) {
      img.src = srcPath(layerKey, value);
      img.classList.add('visible');
    } else {
      img.src = '';
      img.classList.remove('visible');
    }

  } else if (cfg.type === 'fb') {
    const imgB = document.getElementById(`preview-${layerKey}-b`);
    const imgF = document.getElementById(`preview-${layerKey}-f`);
    if (value) {
      imgB.src = srcPath(layerKey, `${value}_b.png`);
      imgF.src = srcPath(layerKey, `${value}_f.png`);
      imgB.classList.add('visible');
      imgF.classList.add('visible');
    } else {
      imgB.src = ''; imgB.classList.remove('visible');
      imgF.src = ''; imgF.classList.remove('visible');
    }

  } else if (cfg.type === 'lr') {
    const imgL = document.getElementById(`preview-${layerKey}-l`);
    const imgR = document.getElementById(`preview-${layerKey}-r`);
    if (value) {
      imgL.src = srcPath(layerKey, `${value}_l.png`);
      imgR.src = srcPath(layerKey, `${value}_r.png`);
      imgL.classList.add('visible');
      imgR.classList.add('visible');
    } else {
      imgL.src = ''; imgL.classList.remove('visible');
      imgR.src = ''; imgR.classList.remove('visible');
    }
  }
}

// ─── Active Selections Display ───────────────────────────────────────────────

function renderPreviewSelections() {
  const container = document.getElementById('activeSelections');
  container.innerHTML = '';

  LAYER_CONFIG.forEach(cfg => {
    const row = document.createElement('div');
    row.className = 'selection-row';

    const label = document.createElement('span');
    label.className = 'layer-label';
    label.textContent = cfg.label;

    const value = document.createElement('span');
    const sel = state[cfg.key];
    if (sel) {
      value.className = 'file-name';
      value.textContent = sel;
      value.title = sel;
    } else {
      value.className = 'none-label';
      value.textContent = '— none —';
    }

    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  });
}

// ─── Collapse / Expand ───────────────────────────────────────────────────────

function toggleSection(section) {
  section.classList.toggle('collapsed');
}

// ─── Export / Import ─────────────────────────────────────────────────────────

function exportJSON() {
  const data = {};
  LAYER_CONFIG.forEach(cfg => {
    data[cfg.key] = state[cfg.key] || null;
  });
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qpro-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      applyConfig(data);
    } catch (err) {
      alert('Invalid JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function applyConfig(data) {
  LAYER_CONFIG.forEach(cfg => {
    const { key } = cfg;
    const val = data[key] || null;
    state[key] = val;

    // Sync preview images
    applyPreviewForLayer(key, val);

    // Sync tile highlights
    const grid = document.getElementById(`grid-${key}`);
    if (grid) {
      grid.querySelectorAll('.option-tile').forEach(tile => {
        const tileStem = tile.dataset.stem;
        const match = val ? (tileStem === val) : (tileStem === '');
        tile.classList.toggle('selected', match);
      });
    }

    // Section border
    const section = document.getElementById(`section-${key}`);
    if (section) section.classList.toggle('has-selection', val !== null);
  });

  renderPreviewSelections();
}

// ─── Bind Buttons ────────────────────────────────────────────────────────────

function bindActions() {
  document.getElementById('exportBtn').addEventListener('click', exportJSON);

  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    importJSON(e.target.files[0]);
    e.target.value = '';
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────

init();
