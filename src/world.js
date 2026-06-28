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

const canvas = document.querySelector("#worldCanvas");
const ctx = canvas.getContext("2d");
const seedInput = document.querySelector("#seedInput");
const sizeInput = document.querySelector("#sizeInput");
const islandInput = document.querySelector("#islandInput");
const stats = document.querySelector("#stats");
const legend = document.querySelector("#legend");
const tileInfo = document.querySelector("#tileInfo");
let currentWorld = null;
let currentFeatures = { rivers: [], roads: [], villages: [] };

const generateButton = document.querySelector("#generateButton");
const randomButton = document.querySelector("#randomButton");
const saveButton = document.querySelector("#saveButton");

generateButton.addEventListener("click", generate);
randomButton.addEventListener("click", () => {
  seedInput.value = Math.random().toString(36).slice(2, 10);
  generate();
});
saveButton.addEventListener("click", saveMap);
canvas.addEventListener("mousemove", showTileInfo);
canvas.addEventListener("mouseleave", resetTileInfo);

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

  currentWorld = world;
  currentFeatures = { rivers, roads, villages };
  drawWorld(world, rivers, roads, villages);
  updateStats(world, rivers, villages);
  renderLegend();
  resetTileInfo();
}

function saveMap() {
  const link = document.createElement("a");
  const seedName = (seedInput.value || "world").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();

  link.download = `${seedName}-map.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function showTileInfo(event) {
  if (!currentWorld) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / rect.width * currentWorld.size);
  const y = Math.floor((event.clientY - rect.top) / rect.height * currentWorld.size);

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

function featureNameAt(tile) {
  if (currentFeatures.villages.some((village) => village.x === tile.x && village.y === tile.y)) return "Village";
  if (currentFeatures.rivers.some((river) => river.some((point) => point.x === tile.x && point.y === tile.y))) return "River";
  if (currentFeatures.roads.some((road) => road.some((point) => point.x === tile.x && point.y === tile.y))) return "Road";
  return "";
}

function buildTerrain(size, seed, islandStrength) {
  const tiles = [];
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const distance = Math.hypot((x - center) / center, (y - center) / center);
      const islandMask = Math.max(0, 1 - Math.pow(distance, 1.8)) * islandStrength;
      const elevation = clamp(fbm(nx * 5.5, ny * 5.5, seed, 6) * 0.86 + islandMask - 0.32);
      const moisture = fbm(nx * 4.8 + 40, ny * 4.8 - 13, seed + 421, 5);
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
      const nearWater = neighbors(world, tile, 2).some((other) => other.biome === "water" || other.biome === "river");
      const friendly = ["grass", "forest", "beach"].includes(tile.biome);
      if (friendly && tile.elevation > 0.38 && tile.elevation < 0.68) {
        candidates.push({ tile, score: random() + (nearWater ? 0.2 : 0) + (tile.biome === "grass" ? 0.15 : 0) });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const villages = [];
  const minDistance = world.size / 5;

  for (const candidate of candidates) {
    if (villages.length >= 6) break;
    if (villages.every((village) => distance(village, candidate.tile) > minDistance)) {
      villages.push(candidate.tile);
    }
  }

  return villages;
}

function connectVillages(world, villages) {
  const roads = [];

  for (let i = 1; i < villages.length; i++) {
    const path = findPath(world, villages[i - 1], villages[i]);
    if (path.length) roads.push(path);
  }

  return roads;
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

function drawWorld(world, rivers, roads, villages) {
  const image = ctx.createImageData(world.size, world.size);

  for (const row of world.tiles) {
    for (const tile of row) {
      setPixel(image, tile, shadedColor(world, tile, BIOMES[tile.biome].color));
    }
  }

  for (const road of roads) road.forEach((tile) => setPixel(image, tile, BIOMES.road.color));
  for (const river of rivers) river.forEach((tile) => setPixel(image, tile, BIOMES.river.color));
  for (const village of villages) {
    setPixel(image, village, BIOMES.village.color);
    neighbors(world, village).forEach((tile) => {
      if (!["water", "deepWater"].includes(tile.biome)) setPixel(image, tile, BIOMES.village.color);
    });
  }

  const buffer = document.createElement("canvas");
  buffer.width = world.size;
  buffer.height = world.size;
  buffer.getContext("2d").putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}

function shadedColor(world, tile, color) {
  if (tile.biome === "water" || tile.biome === "deepWater" || tile.biome === "river") {
    return color;
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

function setPixel(image, tile, color) {
  const [r, g, b] = Array.isArray(color) ? color : hexToRgb(color);
  const index = (tile.y * image.width + tile.x) * 4;
  image.data[index] = r;
  image.data[index + 1] = g;
  image.data[index + 2] = b;
  image.data[index + 3] = 255;
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

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function key(tile) {
  return `${tile.x},${tile.y}`;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToEdge(world, tile) {
  return Math.min(tile.x, tile.y, world.size - tile.x - 1, world.size - tile.y - 1);
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

generate();
