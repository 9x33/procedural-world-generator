# Procedural World Generator

An interactive procedural world generator that creates unique terrain, biomes, rivers, roads, and settlements using algorithms and customizable seeds.

The visual direction is slowly moving toward a darker interface with black visual details and stronger contrast.

## Features

- Seed-based generation for repeatable worlds
- Island and ocean shaping
- Elevation, moisture, and temperature noise maps
- Biomes including beaches, grasslands, forests, deserts, hills, mountains, and snow
- River carving from high terrain toward water
- Village placement based on livable terrain
- Road generation between villages using pathfinding
- Pixel-art style canvas rendering

## Try it locally

Open `index.html` in a browser. No install step is required.

## How it works

The generator combines several common game development techniques:

1. A seeded pseudo-random number generator makes the same seed produce the same world.
2. Fractal value noise creates elevation, moisture, and temperature maps.
3. An island mask pushes the edges of the map toward ocean.
4. Biome rules classify each tile using elevation, moisture, and temperature.
5. Rivers start in high terrain and flow downhill.
6. Villages are placed on useful land and roads connect them with pathfinding.

## Next goals

- Add screenshots and demo GIFs to the README
- Export generated maps as PNG files
- Add caves or dungeons
- Add more detailed settlement generation
- Port the generator into Godot with TileMaps
