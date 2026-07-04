const BIOMES = {
  deepWater: { name: "Deep Ocean", color: "#183d67" },
  water: { name: "Ocean", color: "#236a96" },
  beach: { name: "Beach", color: "#d8c47b" },
  grass: { name: "Grassland", color: "#70a64b" },
  forest: { name: "Forest", color: "#2f7d45" },
  desert: { name: "Desert", color: "#caa85b" },
  hills: { name: "Hills", color: "#8c9557" },
  mountain: { name: "Mountain", color: "#777a76" },
  snow: { name: "Snow", color: "#d9e8ea" },
  river: { name: "River", color: "#58b7d9" },
  road: { name: "Road", color: "#8b6c4d" },
  village: { name: "Village", color: "#e6d4a3" }
};

const ISO_PADDING = 34;
const START_ZOOM = 1;
const MIN_ZOOM = 1;
const CLOSE_ZOOM = 24;
const MAX_ZOOM = 240;
const ZOOM_SENSITIVITY = 0.004;
const MAX_WHEEL_DELTA = 80;
const STRUCTURE_TYPES = {
  keep: { name: "Keep", wall: "#b9a06f", roof: "#5e1729", height: 1.75, width: 1.16 },
  hall: { name: "Village Hall", wall: "#d1b579", roof: "#7c2435", height: 1.35, width: 1.08 },
  house: { name: "House", wall: "#c7aa74", roof: "#6d2431", height: 0.9, width: 0.78 },
  manor: { name: "Manor", wall: "#c5ad7c", roof: "#671d31", height: 1.15, width: 1.18 },
  workshop: { name: "Workshop", wall: "#b69a6a", roof: "#3a3038", height: 0.82, width: 0.92 },
  market: { name: "Market", wall: "#d8bd88", roof: "#8f2545", height: 0.58, width: 1.05 },
  chapel: { name: "Chapel", wall: "#cbbf9e", roof: "#2b2630", height: 1.28, width: 0.82 },
  gate: { name: "Gate", wall: "#9f927b", roof: "#2c2730", height: 1.2, width: 1.05 },
  tower: { name: "Watchtower", wall: "#9a9382", roof: "#2f252b", height: 1.7, width: 0.62 },
  shrine: { name: "Shrine", wall: "#d9c995", roof: "#362c36", height: 1.12, width: 0.7 },
  ruins: { name: "Ruins", wall: "#77746b", roof: "#56534f", height: 0.72, width: 0.86 }
};

const canvas = document.querySelector("#worldCanvas");
const ctx = canvas.getContext("2d");
const seedInput = document.querySelector("#seedInput");
const sizeInput = document.querySelector("#sizeInput");
const islandInput = document.querySelector("#islandInput");
const stats = document.querySelector("#stats");
const legend = document.querySelector("#legend");
const tileInfo = document.querySelector("#tileInfo");
const worldSummary = document.querySelector("#worldSummary");
let currentWorld = null;
let currentFeatures = { rivers: [], roads: [], villages: [], structures: [] };
let currentProjection = null;
let viewPan = { x: 0, y: 0 };
let viewZoom = START_ZOOM;
let targetZoom = START_ZOOM;
let viewRotation = 0;
let dragState = null;
let zoomFrame = null;

const generateButton = document.querySelector("#generateButton");
const randomButton = document.querySelector("#randomButton");

generateButton.addEventListener("click", generate);
randomButton.addEventListener("click", () => {
  seedInput.value = Math.random().toString(36).slice(2, 10);
  generate();
});
canvas.addEventListener("mousemove", showTileInfo);
canvas.addEventListener("mouseleave", resetTileInfo);
canvas.addEventListener("pointerdown", startMapDrag);
canvas.addEventListener("wheel", zoomMap, { passive: false });
window.addEventListener("pointermove", dragMap);
window.addEventListener("pointerup", stopMapDrag);
window.addEventListener("pointercancel", stopMapDrag);

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = gridRandom(xi, yi, seed);
  const b = gridRandom(xi + 1, yi, seed);
  const c = gridRandom(xi, yi + 1, seed);
  const d = gridRandom(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

function fbm(x, y, seed, octaves = 5) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * frequency, y * frequency, seed + i * 97) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / max;
}

function gridRandom(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function generate() {
  const size = Number(sizeInput.value);
  const seed = hashString(seedInput.value || "world");
  const random = mulberry32(seed);
  const islandStrength = Number(islandInput.value) / 100;
  const world = buildTerrain(size, seed, islandStrength);
  const rivers = carveRivers(world, random);
  const villages = placeVillages(world, random);
  const roads = connectVillages(world, villages);
  const structures = placeStructures(world, villages, random);

  resetView();
  currentWorld = world;
  currentFeatures = { rivers, roads, villages, structures };
  drawWorld(world, rivers, roads, villages, structures);
  updateStats(world, rivers, villages);
  updateWorldSummary(world, rivers, villages);
  renderLegend();
  resetTileInfo();
}

function showTileInfo(event) {
  if (!currentWorld) return;

  const rect = canvas.getBoundingClientRect();
  const point = screenToTile(
    (event.clientX - rect.left) / rect.width * canvas.width,
    (event.clientY - rect.top) / rect.height * canvas.height
  );
  const x = point.x;
  const y = point.y;

  if (x < 0 || y < 0 || x >= currentWorld.size || y >= currentWorld.size) {
    resetTileInfo();
    return;
  }

  const tile = currentWorld.tiles[y][x];
  const biome = featureNameAt(tile) || BIOMES[tile.biome].name;
  const elevation = Math.round(tile.elevation * 100);
  const moisture = Math.round(tile.moisture * 100);

  tileInfo.innerHTML = `
    <span>Tile ${x}, ${y}</span>
    <strong>${biome} | Elevation ${elevation}% | Moisture ${moisture}%</strong>
  `;
}

function resetTileInfo() {
  tileInfo.innerHTML = "<span>Tile</span><strong>Move over the map</strong>";
}

function resetView() {
  viewPan = { x: 0, y: 0 };
  viewZoom = START_ZOOM;
  targetZoom = START_ZOOM;
  viewRotation = 0;
  if (zoomFrame) {
    cancelAnimationFrame(zoomFrame);
    zoomFrame = null;
  }
}

function startMapDrag(event) {
  if (!currentWorld || event.button !== 0) return;

  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: viewPan.x,
    panY: viewPan.y
  };

  canvas.classList.add("is-dragging");
  canvas.setPointerCapture?.(event.pointerId);
}

function dragMap(event) {
  if (!dragState || !currentWorld) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  viewPan = {
    x: dragState.panX + (event.clientX - dragState.startX) * scaleX,
    y: dragState.panY + (event.clientY - dragState.startY) * scaleY
  };

  drawCurrentWorld();
  showTileInfo(event);
}

function stopMapDrag(event) {
  if (!dragState) return;

  try {
    canvas.releasePointerCapture?.(dragState.pointerId ?? event.pointerId);
  } catch {
    // Pointer capture may already be gone if the drag ends outside the canvas.
  }

  dragState = null;
  canvas.classList.remove("is-dragging");
}

function drawCurrentWorld() {
  if (!currentWorld) return;
  drawWorld(currentWorld, currentFeatures.rivers, currentFeatures.roads, currentFeatures.villages, currentFeatures.structures);
}

function zoomMap(event) {
  if (!currentWorld) return;

  event.preventDefault();
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);

  if (horizontal || event.shiftKey) {
    const delta = horizontal ? event.deltaX : event.deltaY;
    viewRotation = normalizeRotation(viewRotation + delta * 0.006);
    drawCurrentWorld();
  } else {
    const zoomDirection = event.deltaY < 0 ? 1 : -1;
    const zoomBase = targetZoom;
    const wheelDelta = Math.min(Math.abs(event.deltaY), MAX_WHEEL_DELTA);
    const zoomFactor = Math.exp(wheelDelta * ZOOM_SENSITIVITY * zoomDirection);
    const scaledZoom = zoomBase * zoomFactor;
    const nextZoom = zoomDirection > 0 && zoomBase < CLOSE_ZOOM
      ? Math.max(scaledZoom, CLOSE_ZOOM)
      : scaledZoom;

    targetZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    startZoomAnimation();
  }

  showTileInfo(event);
}

function startZoomAnimation() {
  if (zoomFrame) return;

  const step = () => {
    viewZoom += (targetZoom - viewZoom) * 0.24;

    if (Math.abs(targetZoom - viewZoom) < 0.002) {
      viewZoom = targetZoom;
      zoomFrame = null;
    } else {
      zoomFrame = requestAnimationFrame(step);
    }

    drawCurrentWorld();
  };

  zoomFrame = requestAnimationFrame(step);
}

function normalizeRotation(rotation) {
  const fullTurn = Math.PI * 2;
  return ((rotation % fullTurn) + fullTurn) % fullTurn;
}

function featureNameAt(tile) {
  const structure = currentFeatures.structures.find((item) => item.tile.x === tile.x && item.tile.y === tile.y);
  if (structure) return STRUCTURE_TYPES[structure.type].name;
  if (currentFeatures.villages.some((village) => village.x === tile.x && village.y === tile.y)) return "Village";
  if (currentFeatures.rivers.some((river) => river.some((point) => point.x === tile.x && point.y === tile.y))) return "River";
  if (currentFeatures.roads.some((road) => road.some((point) => point.x === tile.x && point.y === tile.y))) return "Road";
  return "";
}

function buildTerrain(size, seed, islandStrength) {
  const tiles = [];
  const center = (size - 1) / 2;
  const ridgeAngle = gridRandom(1, 4, seed) * Math.PI;
  const ridgeOffset = (gridRandom(8, 3, seed) - 0.5) * 0.36;
  const dryAngle = ridgeAngle + Math.PI / 2;

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const cx = (x - center) / center;
      const cy = (y - center) / center;
      const distance = Math.hypot((x - center) / center, (y - center) / center);
      const islandMask = Math.max(0, 1 - Math.pow(distance, 1.8)) * islandStrength;
      const alongRidge = cx * Math.cos(ridgeAngle) + cy * Math.sin(ridgeAngle);
      const acrossRidge = cx * Math.cos(ridgeAngle + Math.PI / 2) + cy * Math.sin(ridgeAngle + Math.PI / 2);
      const ridge = Math.exp(-Math.pow((acrossRidge - ridgeOffset) * 3.3, 2)) * (0.72 + Math.abs(alongRidge) * 0.18);
      const drySide = (cx * Math.cos(dryAngle) + cy * Math.sin(dryAngle) + 1) / 2;
      const broadLand = fbm(nx * 2.1 + 12, ny * 2.1 - 7, seed + 31, 4);
      const detail = fbm(nx * 8.5, ny * 8.5, seed + 89, 5);
      const elevation = clamp(broadLand * 0.48 + detail * 0.24 + ridge * 0.25 + islandMask - 0.34);
      const moisture = clamp(fbm(nx * 3.8 + 40, ny * 3.8 - 13, seed + 421, 5) * 0.68 + (1 - drySide) * 0.22 + (0.72 - ridge) * 0.08);
      const temperature = clamp(1 - y / size + fbm(nx * 2.2 - 9, ny * 2.2 + 21, seed + 77, 3) * 0.34 - elevation * 0.25);

      row.push({
        x,
        y,
        elevation,
        moisture,
        temperature,
        biome: classifyBiome(elevation, moisture, temperature)
      });
    }
    tiles.push(row);
  }

  return { size, tiles };
}

function classifyBiome(elevation, moisture, temperature) {
  if (elevation < 0.28) return "deepWater";
  if (elevation < 0.36) return "water";
  if (elevation < 0.4) return "beach";
  if (elevation > 0.82) return temperature < 0.42 ? "snow" : "mountain";
  if (elevation > 0.68) return "hills";
  if (moisture < 0.3 && temperature > 0.46) return "desert";
  if (moisture > 0.58) return "forest";
  return "grass";
}

function carveRivers(world, random) {
  const rivers = [];
  const starts = [];

  for (const row of world.tiles) {
    for (const tile of row) {
      if (tile.elevation > 0.72 && tile.biome !== "snow" && random() > 0.982) {
        starts.push(tile);
      }
    }
  }

  starts.slice(0, 12).forEach((start) => {
    const river = [];
    let current = start;
    const seen = new Set();

    for (let step = 0; step < world.size * 2; step++) {
      const key = `${current.x},${current.y}`;
      if (seen.has(key)) break;
      seen.add(key);
      river.push(current);

      if (current.biome === "water" || current.biome === "deepWater") break;

      const next = neighbors(world, current)
        .sort((a, b) => (a.elevation + distanceToEdge(world, a) * 0.02) - (b.elevation + distanceToEdge(world, b) * 0.02))[0];

      if (!next || next.elevation > current.elevation + 0.03) break;
      current = next;
    }

    if (river.length > 10) rivers.push(river);
  });

  return rivers;
}

function placeVillages(world, random) {
  const candidates = [];

  for (const row of world.tiles) {
    for (const tile of row) {
      const nearWater = hasNearbyBiome(world, tile, ["water", "river"], 3);
      const friendly = ["grass", "forest", "beach", "hills"].includes(tile.biome);
      const centrality = 1 - distanceToCenter(world, tile);
      const flatness = 1 - localSlope(world, tile);
      if (friendly && tile.elevation > 0.38 && tile.elevation < 0.68) {
        candidates.push({
          tile,
          score: centrality * 0.52 + flatness * 0.28 + (nearWater ? 0.22 : 0) + (tile.biome === "grass" ? 0.16 : 0) + random() * 0.14
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return [];

  const villages = [];
  const capital = candidates[0].tile;
  villages.push(capital);

  const sectors = 6;
  const minDistance = world.size / 6.2;
  for (let sector = 0; sector < sectors; sector++) {
    const targetAngle = sector / sectors * Math.PI * 2;
    const next = candidates
      .filter((candidate) => distance(candidate.tile, capital) > minDistance)
      .filter((candidate) => villages.every((village) => distance(village, candidate.tile) > minDistance))
      .map((candidate) => {
        const angleScore = 1 - angularDifference(angleFromCenter(world, candidate.tile), targetAngle) / Math.PI;
        const rangeScore = clamp(distance(candidate.tile, capital) / (world.size * 0.42));
        return { tile: candidate.tile, score: candidate.score + angleScore * 0.32 + rangeScore * 0.16 };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (next) villages.push(next.tile);
  }

  for (const candidate of candidates) {
    if (villages.length >= 8) break;
    if (villages.every((village) => distance(village, candidate.tile) > minDistance)) {
      villages.push(candidate.tile);
    }
  }

  return villages;
}

function connectVillages(world, villages) {
  const roads = [];
  if (villages.length < 2) return roads;
  const capital = villages[0];

  for (let i = 1; i < villages.length; i++) {
    addRoad(roads, findPath(world, capital, villages[i]));
  }

  const outerVillages = villages
    .slice(1)
    .sort((a, b) => angleFromCenter(world, a) - angleFromCenter(world, b));

  for (let i = 0; i < outerVillages.length; i++) {
    const current = outerVillages[i];
    const next = outerVillages[(i + 1) % outerVillages.length];
    if (distance(current, next) < world.size * 0.42) {
      addRoad(roads, findPath(world, current, next));
    }
  }

  return roads;
}

function addRoad(roads, path) {
  if (path.length > 5) roads.push(path);
}

function addSettlementTowers(world, structures, occupied, village) {
  const towerAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const towerTiles = neighbors(world, village, 4)
    .filter((tile) => canBuildOn(tile) && distance(tile, village) > 2.4)
    .map((tile) => ({
      tile,
      angle: angleFromPoint(tile, village)
    }));

  for (const targetAngle of towerAngles) {
    const tower = towerTiles
      .filter((candidate) => !occupied.has(key(candidate.tile)))
      .sort((a, b) => angularDifference(a.angle, targetAngle) - angularDifference(b.angle, targetAngle))[0];

    if (tower) addStructure(structures, occupied, tower.tile, targetAngle === 0 ? "gate" : "tower");
  }
}

function placeStructures(world, villages, random) {
  const structures = [];
  const occupied = new Set();

  villages.forEach((village, villageIndex) => {
    const isCapital = villageIndex === 0;
    addStructure(structures, occupied, village, isCapital ? "keep" : "hall");

    const settlementTiles = neighbors(world, village, isCapital ? 4 : 2)
      .filter((tile) => canBuildOn(tile))
      .sort((a, b) => {
        const aRing = Math.abs(distance(a, village) - (isCapital ? 2.5 : 1.6));
        const bRing = Math.abs(distance(b, village) - (isCapital ? 2.5 : 1.6));
        return aRing - bRing || angleFromPoint(a, village) - angleFromPoint(b, village);
      });

    if (isCapital) {
      addSettlementTowers(world, structures, occupied, village);
    }

    settlementTiles.slice(0, isCapital ? 20 : 9).forEach((tile, index) => {
      if (random() < (isCapital ? 0.08 : 0.22)) return;
      const type = chooseSettlementStructure(index, isCapital, random);
      addStructure(structures, occupied, tile, type);
    });
  });

  const landmarkTiles = world.tiles
    .flat()
    .filter((tile) => ["hills", "mountain", "forest"].includes(tile.biome) && tile.elevation > 0.62)
    .sort((a, b) => gridRandom(b.x, b.y, 707) - gridRandom(a.x, a.y, 707));

  for (const tile of landmarkTiles) {
    if (structures.length >= villages.length * 8 + 8) break;
    if (random() > 0.08) continue;
    if (structures.every((structure) => distance(structure.tile, tile) > world.size / 8)) {
      addStructure(structures, occupied, tile, random() > 0.55 ? "tower" : "ruins");
    }
  }

  return structures;
}

function chooseSettlementStructure(index, isCapital, random) {
  if (isCapital) {
    if (index === 0 || index === 5) return "manor";
    if (index === 2 || index === 9) return "market";
    if (index === 4 || index === 12) return "chapel";
    if (index % 6 === 0) return "workshop";
  } else {
    if (index === 0 && random() > 0.45) return "market";
    if (index === 2 && random() > 0.35) return "chapel";
    if (index % 5 === 0) return "workshop";
  }

  return random() > 0.82 ? "manor" : "house";
}

function canBuildOn(tile) {
  return ["grass", "forest", "beach", "hills", "desert"].includes(tile.biome);
}

function addStructure(structures, occupied, tile, type) {
  const tileKey = key(tile);
  if (occupied.has(tileKey) || !canBuildOn(tile)) return;

  occupied.add(tileKey);
  structures.push({ tile, type });
}

function findPath(world, start, goal) {
  const open = [start];
  const cameFrom = new Map();
  const scores = new Map([[key(start), 0]]);

  while (open.length) {
    open.sort((a, b) => (scores.get(key(a)) + distance(a, goal)) - (scores.get(key(b)) + distance(b, goal)));
    const current = open.shift();
    if (current === goal) return rebuildPath(cameFrom, current);

    for (const next of neighbors(world, current)) {
      if (["water", "deepWater", "mountain", "snow"].includes(next.biome)) continue;
      const cost = scores.get(key(current)) + 1 + Math.abs(next.elevation - current.elevation) * 8;
      if (cost < (scores.get(key(next)) ?? Infinity)) {
        cameFrom.set(key(next), current);
        scores.set(key(next), cost);
        if (!open.includes(next)) open.push(next);
      }
    }
  }

  return [];
}

function rebuildPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(key(current))) {
    current = cameFrom.get(key(current));
    path.push(current);
  }
  return path;
}

function neighbors(world, tile, radius = 1) {
  const found = [];
  for (let y = tile.y - radius; y <= tile.y + radius; y++) {
    for (let x = tile.x - radius; x <= tile.x + radius; x++) {
      if (x === tile.x && y === tile.y) continue;
      if (x >= 0 && y >= 0 && x < world.size && y < world.size) found.push(world.tiles[y][x]);
    }
  }
  return found;
}

function drawWorld(world, rivers, roads, villages, structures = []) {
  currentProjection = createProjection(world);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMapBackdrop();

  const tiles = world.tiles.flat().sort((a, b) => depthForTile(a) - depthForTile(b));
  for (const tile of tiles) {
    drawIsoTile(tile, shadedColor(world, tile, BIOMES[tile.biome].color));
  }

  drawTerrainDetails(world, tiles);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const road of roads) drawFeaturePath(road, BIOMES.road.color, 2.4);
  for (const river of rivers) drawFeaturePath(river, BIOMES.river.color, 3.1);
  ctx.restore();

  drawBridges(roads, rivers);
  villages.forEach((village, index) => drawSettlementBase(village, index === 0));

  const orderedStructures = structures
    .slice()
    .sort((a, b) => depthForTile(a.tile) - depthForTile(b.tile));
  for (const structure of orderedStructures) {
    drawStructure(structure);
  }
}

function createProjection(world) {
  const tileWidth = Math.max(4.6, (canvas.width - ISO_PADDING) / (world.size * 0.94));
  const tileHeight = tileWidth * 0.52;
  const heightScale = tileWidth * 6.2;
  const projection = {
    tileWidth,
    tileHeight,
    heightScale,
    originX: canvas.width / 2,
    originY: ISO_PADDING + heightScale * 1.7,
    cameraScale: 1,
    cameraX: 0,
    cameraY: 0
  };

  frameProjection(world, projection);
  return projection;
}

function frameProjection(world, projection) {
  const bounds = measureWorldBounds(world, projection);
  const frameWidth = canvas.width + ISO_PADDING * 0.5;
  const frameHeight = canvas.height - ISO_PADDING * 1.6;
  const zoom = Math.min(frameWidth / bounds.width, frameHeight / bounds.height, 2.18);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;

  projection.cameraScale = Math.max(1, zoom) * viewZoom;
  projection.cameraX = canvas.width / 2 - centerX * projection.cameraScale + viewPan.x;
  projection.cameraY = canvas.height * 0.54 - centerY * projection.cameraScale + viewPan.y;
}

function measureWorldBounds(world, projection) {
  const featuredTiles = world.tiles
    .flat()
    .filter((tile) => !["water", "deepWater"].includes(tile.biome));
  const tiles = featuredTiles.length ? featuredTiles : world.tiles.flat();
  const bounds = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity
  };

  for (const tile of tiles) {
    const tileBounds = rawTileBounds(tile, projection);
    bounds.left = Math.min(bounds.left, tileBounds.left);
    bounds.right = Math.max(bounds.right, tileBounds.right);
    bounds.top = Math.min(bounds.top, tileBounds.top);
    bounds.bottom = Math.max(bounds.bottom, tileBounds.bottom);
  }

  const padding = projection.tileWidth * 5;
  return {
    left: bounds.left - padding,
    right: bounds.right + padding,
    top: bounds.top - padding,
    bottom: bounds.bottom + padding,
    width: bounds.right - bounds.left + padding * 2,
    height: bounds.bottom - bounds.top + padding * 2
  };
}

function rawTileBounds(tile, projection) {
  const point = rawProjectTile(tile, projection);
  const height = tileHeight(tile, projection);
  const corners = isoCorners(point.x, point.y, projection.tileWidth, projection.tileHeight);

  return {
    left: Math.min(corners.left[0], corners.top[0], corners.right[0], corners.bottom[0]),
    right: Math.max(corners.left[0], corners.top[0], corners.right[0], corners.bottom[0]),
    top: Math.min(corners.top[1], corners.left[1], corners.right[1]),
    bottom: corners.bottom[1] + height
  };
}

function drawMapBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0b233a");
  gradient.addColorStop(0.55, "#112b42");
  gradient.addColorStop(1, "#071321");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawIsoTile(tile, baseColor) {
  const point = projectTile(tile);
  const height = tileHeight(tile) * currentProjection.cameraScale;
  const top = [baseColor[0] + blockTexture(tile), baseColor[1] + blockTexture(tile), baseColor[2] + blockTexture(tile)].map(clampColor);
  const right = top.map((value) => value - 34).map(clampColor);
  const left = top.map((value) => value - 52).map(clampColor);
  const isWater = tile.biome === "water" || tile.biome === "deepWater";
  const corners = isoCorners(point.x, point.y);

  if (!isWater && height > 1) {
    fillPolygon([
      corners.right,
      corners.bottom,
      [corners.bottom[0], corners.bottom[1] + height],
      [corners.right[0], corners.right[1] + height]
    ], rgbToCss(right));

    fillPolygon([
      corners.left,
      corners.bottom,
      [corners.bottom[0], corners.bottom[1] + height],
      [corners.left[0], corners.left[1] + height]
    ], rgbToCss(left));
  }

  fillPolygon([corners.top, corners.right, corners.bottom, corners.left], rgbToCss(top));

  if (!isWater && tile.biome !== "beach") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 0.5;
    strokePolygon([corners.top, corners.right, corners.bottom, corners.left]);
  }
}

function drawFeaturePath(path, color, width) {
  if (path.length < 2) return;

  drawPathStroke(path, "rgba(31, 21, 23, 0.45)", width + 1.35, 1.5);
  drawPathStroke(path, color, width, 1.8);
}

function drawPathStroke(path, color, width, lift) {
  ctx.beginPath();
  path.forEach((tile, index) => {
    const point = projectTile(tile, lift);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, currentProjection.tileWidth * currentProjection.cameraScale * width / 6);
  ctx.stroke();
}

function drawTerrainDetails(world, tiles) {
  const detailTiles = tiles.filter((tile) => {
    if (tile.biome === "forest") return gridRandom(tile.x, tile.y, 1201) > 0.86;
    if (tile.biome === "hills") return gridRandom(tile.x, tile.y, 1202) > 0.91;
    if (tile.biome === "mountain") return gridRandom(tile.x, tile.y, 1203) > 0.9;
    if (tile.biome === "desert") return gridRandom(tile.x, tile.y, 1204) > 0.94;
    if (tile.biome === "snow") return gridRandom(tile.x, tile.y, 1205) > 0.94;
    return false;
  });

  for (const tile of detailTiles) {
    if (tile.biome === "forest") drawDarkTree(tile);
    else if (tile.biome === "desert") drawDryMarker(tile);
    else drawStoneCluster(tile, tile.biome === "snow");
  }
}

function drawBridges(roads, rivers) {
  const riverTiles = new Set(rivers.flat().map(key));
  const bridgeTiles = [];

  for (const road of roads) {
    for (const tile of road) {
      if (riverTiles.has(key(tile)) && bridgeTiles.every((other) => distance(other, tile) > 3)) {
        bridgeTiles.push(tile);
      }
    }
  }

  for (const tile of bridgeTiles) drawBridge(tile);
}

function drawBridge(tile) {
  const point = projectTile(tile, 2.8);
  const unit = currentProjection.tileWidth * currentProjection.cameraScale;
  const length = unit * 0.72;
  const thickness = Math.max(2, unit * 0.1);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(Math.PI / 8);
  ctx.fillStyle = "#7f6147";
  ctx.fillRect(-length / 2, -thickness / 2, length, thickness);
  ctx.fillStyle = "rgba(30, 20, 18, 0.55)";
  ctx.fillRect(-length / 2, thickness * 0.8, length, Math.max(1, thickness * 0.28));
  ctx.restore();
}

function drawDarkTree(tile) {
  const point = projectTile(tile, 4.2);
  const unit = currentProjection.tileWidth * currentProjection.cameraScale;
  const trunkHeight = Math.max(3, unit * 0.42);
  const crownHeight = Math.max(5, unit * 0.9);

  ctx.fillStyle = "#2a1d1d";
  ctx.fillRect(point.x - unit * 0.035, point.y, unit * 0.07, trunkHeight);

  fillPolygon([
    [point.x, point.y - crownHeight],
    [point.x + unit * 0.26, point.y + unit * 0.06],
    [point.x, point.y + unit * 0.2],
    [point.x - unit * 0.26, point.y + unit * 0.06]
  ], "#163c2a");

  fillPolygon([
    [point.x, point.y - crownHeight * 0.66],
    [point.x + unit * 0.21, point.y + unit * 0.02],
    [point.x, point.y + unit * 0.14],
    [point.x - unit * 0.21, point.y + unit * 0.02]
  ], "#0f2b22");
}

function drawStoneCluster(tile, isSnow) {
  const point = projectTile(tile, 3.6);
  const unit = currentProjection.tileWidth * currentProjection.cameraScale;
  const colors = isSnow ? ["#e9f5f4", "#cddada", "#f8ffff"] : ["#6f6e66", "#85847c", "#4f4e48"];

  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * unit * 0.12;
    const top = isoCorners(point.x + offset, point.y + unit * 0.08 * i, unit * (0.18 + i * 0.03), unit * 0.1);
    drawPrism(top, unit * (0.12 + i * 0.04), colors[i]);
  }
}

function drawDryMarker(tile) {
  const point = projectTile(tile, 3.8);
  const unit = currentProjection.tileWidth * currentProjection.cameraScale;
  const height = unit * 0.7;

  ctx.strokeStyle = "#4a332d";
  ctx.lineWidth = Math.max(1, unit * 0.04);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y + height * 0.35);
  ctx.lineTo(point.x, point.y - height);
  ctx.moveTo(point.x, point.y - height * 0.2);
  ctx.lineTo(point.x - unit * 0.16, point.y - height * 0.48);
  ctx.moveTo(point.x, point.y - height * 0.38);
  ctx.lineTo(point.x + unit * 0.16, point.y - height * 0.64);
  ctx.stroke();
}

function drawSettlementBase(village, isCapital) {
  const radius = isCapital ? 3 : 2;
  const tiles = neighbors(currentWorld, village, radius)
    .filter((tile) => canBuildOn(tile) && distance(tile, village) <= radius + 0.3)
    .sort((a, b) => depthForTile(a) - depthForTile(b));

  ctx.save();
  ctx.globalAlpha = isCapital ? 0.42 : 0.28;
  for (const tile of tiles) {
    const point = projectTile(tile, 1.2);
    const corners = isoCorners(point.x, point.y);
    const shade = gridRandom(tile.x, tile.y, 306) > 0.5 ? "rgba(214, 189, 131, 0.24)" : "rgba(75, 49, 55, 0.24)";
    fillPolygon([corners.top, corners.right, corners.bottom, corners.left], shade);
  }
  ctx.restore();
}

function drawStructure(structure) {
  const settings = STRUCTURE_TYPES[structure.type];
  const point = projectTile(structure.tile, 4);
  const unit = currentProjection.tileWidth * currentProjection.cameraScale;
  const width = unit * settings.width;
  const height = currentProjection.tileHeight * currentProjection.cameraScale * settings.width;
  const blockHeight = unit * settings.height;
  const roofHeight = Math.max(3, unit * 0.42);
  const top = isoCorners(point.x, point.y, width, height);
  const baseBottom = top.bottom[1] + blockHeight;
  const isRuin = structure.type === "ruins";

  if (structure.type === "market") {
    drawMarket(top, blockHeight, settings);
    return;
  }

  if (structure.type === "gate") {
    drawGate(point, unit, settings);
    return;
  }

  if (structure.type === "chapel") {
    drawChapel(point, top, blockHeight, roofHeight, settings);
    return;
  }

  if (structure.type === "manor") {
    drawManor(point, top, blockHeight, roofHeight, settings);
    return;
  }

  if (structure.type === "keep") {
    drawKeep(point, top, blockHeight, roofHeight, settings);
    return;
  }

  drawPrism(top, blockHeight, settings.wall);

  if (isRuin) {
    drawRuinDetails(top, blockHeight, settings.roof);
    return;
  }

  const roofPeak = [top.top[0], top.top[1] - roofHeight];
  fillPolygon([roofPeak, top.right, top.bottom, top.left], settings.roof);
  fillPolygon([roofPeak, top.right, [top.right[0], top.right[1] + blockHeight * 0.2], top.bottom], adjustCss(settings.roof, -28));
  fillPolygon([roofPeak, top.left, [top.left[0], top.left[1] + blockHeight * 0.2], top.bottom], adjustCss(settings.roof, -46));

  if (structure.type === "tower") {
    const cap = isoCorners(point.x, point.y - roofHeight * 0.58, width * 0.72, height * 0.72);
    fillPolygon([cap.top, cap.right, cap.bottom, cap.left], "#302832");
    drawBuildingDetails(point, width, blockHeight, "#171218", 1);
  }

  ctx.fillStyle = "rgba(35, 24, 24, 0.55)";
  ctx.fillRect(point.x - width * 0.08, baseBottom - blockHeight * 0.2, Math.max(2, width * 0.16), Math.max(3, blockHeight * 0.2));
}

function drawKeep(point, top, blockHeight, roofHeight, settings) {
  drawPrism(top, blockHeight, settings.wall);
  const cap = isoCorners(point.x, top.top[1] - roofHeight * 0.22, top.right[0] - top.left[0], (top.bottom[1] - top.top[1]) * 0.84);
  fillPolygon([cap.top, cap.right, cap.bottom, cap.left], settings.roof);
  drawBattlements(top, blockHeight, settings.wall);
  drawBuildingDetails(point, top.right[0] - top.left[0], blockHeight, "#211923", 3);
}

function drawManor(point, top, blockHeight, roofHeight, settings) {
  drawPrism(top, blockHeight, settings.wall);
  drawGabledRoof(top, blockHeight, roofHeight, settings.roof);

  const wingWidth = (top.right[0] - top.left[0]) * 0.48;
  const wingHeight = (top.bottom[1] - top.top[1]) * 0.72;
  const leftWing = isoCorners(point.x - wingWidth * 0.36, point.y + wingHeight * 0.32, wingWidth, wingHeight);
  const rightWing = isoCorners(point.x + wingWidth * 0.36, point.y + wingHeight * 0.32, wingWidth, wingHeight);
  drawPrism(leftWing, blockHeight * 0.52, adjustCss(settings.wall, -10));
  drawPrism(rightWing, blockHeight * 0.52, adjustCss(settings.wall, -16));
  drawGabledRoof(leftWing, blockHeight * 0.52, roofHeight * 0.58, adjustCss(settings.roof, -8));
  drawGabledRoof(rightWing, blockHeight * 0.52, roofHeight * 0.58, adjustCss(settings.roof, -14));
  drawBuildingDetails(point, top.right[0] - top.left[0], blockHeight, "#20151d", 4);
}

function drawChapel(point, top, blockHeight, roofHeight, settings) {
  drawPrism(top, blockHeight, settings.wall);
  drawGabledRoof(top, blockHeight, roofHeight * 1.15, settings.roof);

  const spireBase = isoCorners(point.x, top.top[1] - roofHeight * 0.38, (top.right[0] - top.left[0]) * 0.38, (top.bottom[1] - top.top[1]) * 0.38);
  drawPrism(spireBase, blockHeight * 0.48, adjustCss(settings.wall, -8));
  const spirePeak = [spireBase.top[0], spireBase.top[1] - roofHeight * 1.25];
  fillPolygon([spirePeak, spireBase.right, spireBase.bottom, spireBase.left], settings.roof);
  drawBuildingDetails(point, top.right[0] - top.left[0], blockHeight, "#17131a", 2);
}

function drawGate(point, unit, settings) {
  const towerWidth = unit * 0.42;
  const towerHeight = unit * 0.25;
  const leftTop = isoCorners(point.x - unit * 0.28, point.y, towerWidth, towerHeight);
  const rightTop = isoCorners(point.x + unit * 0.28, point.y, towerWidth, towerHeight);
  const wallTop = isoCorners(point.x, point.y + unit * 0.08, unit * 0.82, towerHeight * 0.78);

  drawPrism(wallTop, unit * 0.72, adjustCss(settings.wall, -10));
  drawPrism(leftTop, unit * settings.height, settings.wall);
  drawPrism(rightTop, unit * settings.height, settings.wall);
  drawGabledRoof(leftTop, unit * settings.height, unit * 0.26, settings.roof);
  drawGabledRoof(rightTop, unit * settings.height, unit * 0.26, settings.roof);

  ctx.fillStyle = "rgba(18, 13, 15, 0.76)";
  ctx.fillRect(point.x - unit * 0.13, point.y + unit * 0.38, unit * 0.26, unit * 0.34);
}

function drawMarket(top, blockHeight, settings) {
  const height = blockHeight * 0.42;
  drawPrism(top, height, settings.wall);

  const stripes = [settings.roof, "#ead8bd", adjustCss(settings.roof, -28)];
  const canopyTop = [top.top[0], top.top[1] - height * 0.44];
  [top.left, top.top, top.right, top.bottom].forEach((corner, index) => {
    const next = [top.left, top.top, top.right, top.bottom][(index + 1) % 4];
    fillPolygon([canopyTop, corner, next], stripes[index % stripes.length]);
  });

  ctx.strokeStyle = "rgba(25, 18, 20, 0.48)";
  ctx.lineWidth = Math.max(1, currentProjection.cameraScale * 0.7);
  strokePolygon([top.top, top.right, top.bottom, top.left]);
}

function drawGabledRoof(top, blockHeight, roofHeight, color) {
  const ridgeLeft = [(top.top[0] + top.left[0]) / 2, top.top[1] - roofHeight];
  const ridgeRight = [(top.top[0] + top.right[0]) / 2, top.top[1] - roofHeight];

  fillPolygon([ridgeLeft, ridgeRight, top.right, top.bottom, top.left], color);
  fillPolygon([ridgeRight, top.right, [top.right[0], top.right[1] + blockHeight * 0.18], top.bottom], adjustCss(color, -30));
  fillPolygon([ridgeLeft, top.left, [top.left[0], top.left[1] + blockHeight * 0.18], top.bottom], adjustCss(color, -44));
}

function drawBattlements(top, blockHeight, color) {
  const width = top.right[0] - top.left[0];
  const blockWidth = Math.max(2, width / 7);
  ctx.fillStyle = adjustCss(color, 10);

  for (let i = 0; i < 5; i++) {
    const x = top.left[0] + blockWidth * (i + 1);
    ctx.fillRect(x, top.top[1] + blockHeight * 0.06, blockWidth * 0.55, blockHeight * 0.16);
  }
}

function drawBuildingDetails(point, width, blockHeight, color, count) {
  const windowWidth = Math.max(2, width * 0.055);
  const windowHeight = Math.max(2, blockHeight * 0.08);
  ctx.fillStyle = color;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * width * 0.16;
    ctx.fillRect(point.x + offset - windowWidth / 2, point.y + blockHeight * 0.28, windowWidth, windowHeight);
  }
}

function drawPrism(top, blockHeight, color) {
  fillPolygon([
    top.right,
    top.bottom,
    [top.bottom[0], top.bottom[1] + blockHeight],
    [top.right[0], top.right[1] + blockHeight]
  ], adjustCss(color, -30));
  fillPolygon([
    top.left,
    top.bottom,
    [top.bottom[0], top.bottom[1] + blockHeight],
    [top.left[0], top.left[1] + blockHeight]
  ], adjustCss(color, -54));
  fillPolygon([top.top, top.right, top.bottom, top.left], color);
}

function drawRuinDetails(top, blockHeight, color) {
  ctx.strokeStyle = adjustCss(color, -20);
  ctx.lineWidth = Math.max(1, currentProjection.cameraScale * 1.1);
  [
    [top.left, [top.left[0], top.left[1] + blockHeight * 0.55]],
    [top.right, [top.right[0], top.right[1] + blockHeight * 0.42]],
    [top.bottom, [top.bottom[0], top.bottom[1] + blockHeight * 0.35]]
  ].forEach(([start, end]) => {
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
  });
}

function projectTile(tile, lift = 0) {
  const projection = currentProjection;
  const point = rawProjectTile(tile, projection);
  return {
    x: point.x * projection.cameraScale + projection.cameraX,
    y: (point.y - lift) * projection.cameraScale + projection.cameraY
  };
}

function rawProjectTile(tile, projection) {
  const point = rotatedTilePoint(tile);
  const baseX = projection.originX + (point.x - point.y) * projection.tileWidth / 2;
  const baseY = projection.originY + (point.x + point.y) * projection.tileHeight / 2;

  return {
    x: baseX,
    y: baseY - tileHeight(tile, projection)
  };
}

function screenToTile(screenX, screenY) {
  if (!currentProjection || !currentWorld) return { x: -1, y: -1 };

  const projection = currentProjection;
  const worldX = (screenX - projection.cameraX) / projection.cameraScale;
  const worldY = (screenY - projection.cameraY) / projection.cameraScale;
  const localX = worldX - projection.originX;
  const localY = worldY - projection.originY + projection.heightScale * 0.26;
  const rotatedX = localY / projection.tileHeight + localX / projection.tileWidth;
  const rotatedY = localY / projection.tileHeight - localX / projection.tileWidth;
  const point = unrotatedTilePoint(rotatedX, rotatedY);
  const approxX = Math.floor(point.x);
  const approxY = Math.floor(point.y);

  return {
    x: Math.max(0, Math.min(currentWorld.size - 1, approxX)),
    y: Math.max(0, Math.min(currentWorld.size - 1, approxY))
  };
}

function rotatedTilePoint(tile) {
  const center = (currentWorld.size - 1) / 2;
  const dx = tile.x - center;
  const dy = tile.y - center;
  const cos = Math.cos(viewRotation);
  const sin = Math.sin(viewRotation);

  return {
    x: center + dx * cos - dy * sin,
    y: center + dx * sin + dy * cos
  };
}

function unrotatedTilePoint(x, y) {
  const center = (currentWorld.size - 1) / 2;
  const dx = x - center;
  const dy = y - center;
  const cos = Math.cos(-viewRotation);
  const sin = Math.sin(-viewRotation);

  return {
    x: center + dx * cos - dy * sin,
    y: center + dx * sin + dy * cos
  };
}

function depthForTile(tile) {
  const point = rotatedTilePoint(tile);
  return point.x + point.y;
}

function tileHeight(tile, projection = currentProjection) {
  if (tile.biome === "water" || tile.biome === "deepWater") return 0;

  const base = Math.max(0, tile.elevation - 0.34) * projection.heightScale;
  const biomeBoosts = {
    beach: 0.08,
    grass: 0.18,
    forest: 0.26,
    desert: 0.15,
    hills: 0.46,
    mountain: 0.72,
    snow: 0.84
  };

  return base + projection.tileWidth * (biomeBoosts[tile.biome] ?? 0.16);
}

function isoCorners(
  x,
  y,
  width = currentProjection.tileWidth * currentProjection.cameraScale,
  height = currentProjection.tileHeight * currentProjection.cameraScale
) {
  return {
    top: [x, y - height / 2],
    right: [x + width / 2, y],
    bottom: [x, y + height / 2],
    left: [x - width / 2, y]
  };
}

function fillPolygon(points, color) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function strokePolygon(points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

function blockTexture(tile) {
  if (tile.biome === "water" || tile.biome === "deepWater") return 0;
  return Math.round((gridRandom(tile.x, tile.y, 911) - 0.5) * 18);
}

function shadedColor(world, tile, color) {
  if (tile.biome === "water" || tile.biome === "deepWater" || tile.biome === "river") {
    return hexToRgb(color);
  }

  const west = world.tiles[tile.y][Math.max(0, tile.x - 1)];
  const east = world.tiles[tile.y][Math.min(world.size - 1, tile.x + 1)];
  const north = world.tiles[Math.max(0, tile.y - 1)][tile.x];
  const south = world.tiles[Math.min(world.size - 1, tile.y + 1)][tile.x];
  const slope = (west.elevation - east.elevation) + (north.elevation - south.elevation);
  const height = Math.max(0, tile.elevation - 0.38);
  const light = slope * 46 + height * 28;

  return adjustColor(color, light);
}

function updateStats(world, rivers, villages) {
  const total = world.size * world.size;
  const land = world.tiles.flat().filter((tile) => !["water", "deepWater"].includes(tile.biome)).length;
  stats.innerHTML = `
    <div><dt>Land</dt><dd>${Math.round(land / total * 100)}%</dd></div>
    <div><dt>Rivers</dt><dd>${rivers.length}</dd></div>
    <div><dt>Villages</dt><dd>${villages.length}</dd></div>
  `;
}

function updateWorldSummary(world, rivers, villages) {
  const total = world.size * world.size;
  const land = world.tiles.flat().filter((tile) => !["water", "deepWater"].includes(tile.biome)).length;
  const features = rivers.length + villages.length;

  worldSummary.innerHTML = `
    <div><span>Seed</span><strong>${seedInput.value || "world"}</strong></div>
    <div><span>Size</span><strong>${world.size} x ${world.size}</strong></div>
    <div><span>Land</span><strong>${Math.round(land / total * 100)}%</strong></div>
    <div><span>Features</span><strong>${features}</strong></div>
  `;
}

function renderLegend() {
  legend.innerHTML = Object.values(BIOMES)
    .map((biome) => `<span><i style="background:${biome.color}"></i>${biome.name}</span>`)
    .join("");
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function adjustColor(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return [
    clampColor(r + amount),
    clampColor(g + amount),
    clampColor(b + amount)
  ];
}

function rgbToCss(rgb) {
  const [r, g, b] = rgb.map(clampColor);
  return `rgb(${r}, ${g}, ${b})`;
}

function adjustCss(hex, amount) {
  return rgbToCss(adjustColor(hex, amount));
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function key(tile) {
  return `${tile.x},${tile.y}`;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToCenter(world, tile) {
  const center = (world.size - 1) / 2;
  return Math.hypot((tile.x - center) / center, (tile.y - center) / center);
}

function distanceToEdge(world, tile) {
  return Math.min(tile.x, tile.y, world.size - tile.x - 1, world.size - tile.y - 1);
}

function angleFromCenter(world, tile) {
  const center = (world.size - 1) / 2;
  return normalizeRotation(Math.atan2(tile.y - center, tile.x - center));
}

function angleFromPoint(tile, point) {
  return normalizeRotation(Math.atan2(tile.y - point.y, tile.x - point.x));
}

function angularDifference(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function localSlope(world, tile) {
  const nearby = neighbors(world, tile);
  if (!nearby.length) return 0;

  const total = nearby.reduce((sum, other) => sum + Math.abs(tile.elevation - other.elevation), 0);
  return clamp(total / nearby.length * 8);
}

function hasNearbyBiome(world, tile, biomes, radius) {
  return neighbors(world, tile, radius).some((other) => biomes.includes(other.biome));
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

generate();
