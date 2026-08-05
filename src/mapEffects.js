// Canvas-only effects stay here so world.js can focus on generation and map layout.
export function createMapEffects(options) {
  const { ctx, getProjection, projectTile, isoCorners, lerpPoint, gridRandom } = options;

  return {
    drawWater(tiles) {
      const projection = getProjection();
      const time = performance.now() * 0.001;
      const unit = projection.tileWidth * projection.cameraScale;
      const waterTiles = tiles.filter((tile) => ["water", "deepWater"].includes(tile.biome));
      const landKeys = new Set(
        tiles
          .filter((tile) => !["water", "deepWater"].includes(tile.biome))
          .map((tile) => `${tile.x},${tile.y}`)
      );

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, unit * 0.035);

      for (const tile of waterTiles) {
        if (gridRandom(tile.x, tile.y, 3421) < 0.9) continue;

        const wave = Math.sin(time * 2.2 + tile.x * 0.35 + tile.y * 0.21);
        if (wave < -0.25) continue;

        const point = projectTile(tile, 0.6);
        const corners = isoCorners(point.x, point.y);
        const centerA = lerpPoint(corners.left, corners.top, 0.48 + wave * 0.08);
        const centerB = lerpPoint(corners.bottom, corners.right, 0.48 + wave * 0.08);
        const start = lerpPoint(centerA, centerB, 0.34);
        const end = lerpPoint(centerA, centerB, 0.68);

        ctx.globalAlpha = tile.biome === "deepWater" ? 0.12 + wave * 0.05 : 0.18 + wave * 0.07;
        ctx.strokeStyle = tile.biome === "deepWater" ? "#7fc5e7" : "#9de4f0";
        ctx.beginPath();
        ctx.moveTo(start[0], start[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
      }

      drawCoastBreath(ctx, projection, waterTiles, landKeys, time, projectTile, isoCorners, lerpPoint, gridRandom);
      ctx.restore();
    },

    drawLights(villages, structures, sites) {
      const projection = getProjection();
      const time = performance.now() * 0.001;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const village of villages) {
        const point = projectTile(village, 6.2);
        const strength = village.settlementRank === "Capital" ? 1.25 : village.settlementRank === "Town" ? 0.9 : 0.55;
        const flicker = 0.78 + Math.sin(time * 2.6 + village.x * 0.3) * 0.12;
        drawGlow(ctx, projection, point.x, point.y - projection.tileWidth * projection.cameraScale * 0.6, strength * flicker, "240, 197, 111");
      }

      for (const structure of structures) {
        if (!["keep", "hall", "market", "harbor", "gate", "chapel", "cathedral", "citadel"].includes(structure.type)) continue;
        if (gridRandom(structure.tile.x, structure.tile.y, 9122) < 0.46) continue;

        const point = projectTile(structure.tile, 6.8);
        const flicker = 0.72 + Math.sin(time * 3.1 + structure.tile.y) * 0.16;
        drawGlow(ctx, projection, point.x, point.y - projection.tileWidth * projection.cameraScale * 0.45, 0.48 * flicker, "255, 216, 138");
      }

      for (const site of sites) {
        if (!["port", "dungeon", "fort", "watch"].includes(site.type)) continue;

        const point = projectTile(site.tile, 6.4);
        const color = site.type === "dungeon" ? "180, 88, 159" : site.type === "port" ? "240, 197, 111" : "215, 189, 131";
        const flicker = 0.66 + Math.sin(time * 2.4 + site.tile.x + site.tile.y) * 0.18;
        drawGlow(ctx, projection, point.x, point.y - projection.tileWidth * projection.cameraScale * 0.45, 0.7 * flicker, color);
      }

      ctx.restore();
    },

    drawAtmosphere(world, villages, sites) {
      const projection = getProjection();
      const time = performance.now() * 0.001;
      const unit = projection.tileWidth * projection.cameraScale;

      ctx.save();
      drawMapVignette(ctx);
      drawLowFog(ctx, projection, world, time);

      ctx.globalCompositeOperation = "screen";
      for (const site of sites) {
        if (!["obelisk", "grove", "ruin", "cave"].includes(site.type)) continue;
        const point = projectTile(site.tile, 5);
        const pulse = 0.76 + Math.sin(time * 1.4 + site.tile.x * 0.21) * 0.1;
        const color = site.type === "grove" ? "92, 152, 103" : site.type === "obelisk" ? "215, 201, 149" : "143, 118, 132";
        drawSoftAura(ctx, point.x, point.y - unit * 0.22, unit * 1.15 * pulse, color, 0.16);
      }

      for (const village of villages) {
        if (village.settlementRank === "Village") continue;
        const point = projectTile(village, 8);
        drawSoftAura(ctx, point.x, point.y - unit * 0.65, unit * (village.settlementRank === "Capital" ? 1.85 : 1.25), "215, 189, 131", 0.1);
      }

      ctx.restore();
    }
  };
}

function drawCoastBreath(ctx, projection, waterTiles, landKeys, time, projectTile, isoCorners, lerpPoint, gridRandom) {
  const unit = projection.tileWidth * projection.cameraScale;
  if (unit < 2.4) return;

  ctx.save();
  ctx.lineWidth = Math.max(1, unit * 0.045);
  ctx.strokeStyle = "rgba(212, 232, 221, 0.22)";
  ctx.lineCap = "round";

  for (const tile of waterTiles) {
    if (tile.biome === "deepWater") continue;
    if (gridRandom(tile.x, tile.y, 5031) < 0.72) continue;
    if (!touchesLand(tile, landKeys)) continue;

    const point = projectTile(tile, 0.9);
    const corners = isoCorners(point.x, point.y);
    const drift = 0.5 + Math.sin(time * 1.7 + tile.x * 0.24 + tile.y * 0.31) * 0.18;
    const start = lerpPoint(corners.left, corners.top, drift);
    const end = lerpPoint(corners.bottom, corners.right, drift);

    ctx.globalAlpha = 0.18 + drift * 0.14;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMapVignette(ctx) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.43, width * 0.22, width * 0.5, height * 0.5, width * 0.74);

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.62, "rgba(8, 7, 12, 0.08)");
  gradient.addColorStop(1, "rgba(3, 2, 5, 0.42)");

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawLowFog(ctx, projection, world, time) {
  const unit = projection.tileWidth * projection.cameraScale;
  if (unit < 1.7) return;

  const bands = Math.max(5, Math.min(9, Math.round(world.size / 20)));

  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(18, unit * 2.8);

  for (let i = 0; i < bands; i++) {
    const seed = i * 19.17;
    const y = ctx.canvas.height * (0.18 + i * 0.105) + Math.sin(time * 0.23 + seed) * unit * 4;
    const startX = -ctx.canvas.width * 0.08;
    const endX = ctx.canvas.width * 1.08;
    const bow = Math.sin(time * 0.18 + seed) * unit * 3.2;

    ctx.globalAlpha = 0.025 + (i % 3) * 0.008;
    ctx.strokeStyle = i % 2 ? "rgba(185, 179, 170, 0.5)" : "rgba(128, 158, 160, 0.42)";
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.bezierCurveTo(ctx.canvas.width * 0.24, y - bow, ctx.canvas.width * 0.68, y + bow, endX, y + Math.sin(seed) * unit * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function drawSoftAura(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(6, radius));

  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(0.45, `rgba(${color}, ${alpha * 0.42})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(6, radius), 0, Math.PI * 2);
  ctx.fill();
}

function touchesLand(tile, landKeys) {
  return landKeys.has(`${tile.x - 1},${tile.y}`)
    || landKeys.has(`${tile.x + 1},${tile.y}`)
    || landKeys.has(`${tile.x},${tile.y - 1}`)
    || landKeys.has(`${tile.x},${tile.y + 1}`);
}

function drawGlow(ctx, projection, x, y, scale, color) {
  const unit = projection.tileWidth * projection.cameraScale;
  const radius = Math.max(5, unit * 0.75 * scale);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

  gradient.addColorStop(0, `rgba(${color}, 0.76)`);
  gradient.addColorStop(0.35, `rgba(${color}, 0.28)`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
