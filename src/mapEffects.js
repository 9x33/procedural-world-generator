// Canvas-only effects stay here so world.js can focus on generation and map layout.
export function createMapEffects(options) {
  const { ctx, getProjection, projectTile, isoCorners, lerpPoint, gridRandom } = options;

  return {
    drawWater(tiles) {
      const projection = getProjection();
      const time = performance.now() * 0.001;
      const unit = projection.tileWidth * projection.cameraScale;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, unit * 0.035);

      for (const tile of tiles) {
        if (!["water", "deepWater"].includes(tile.biome)) continue;
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
    }
  };
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
