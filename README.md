# Bounce Inferno

Bounce Inferno is a noncommercial browser game inspired by the rolling physics of Bounce Tales and Limbo in Dante’s *Inferno*. You start near the center of Limbo and can explore the Sighing Shore, the Poets’ Fire, the Noble Castle and the Undercroft in different orders. Talk with Virgil and four poets, follow the water to the castle, or look for the carved alcoves in the Undercroft. The castle opens when you pull both levers. Complete Limbo to descend into the first playable pass of Lust, or open [localhost:3000/?circle=2](http://localhost:3000/?circle=2) to play it directly.

## Play locally

Use Node.js 20 or later. Run `npm start` from this directory and open [localhost:3000](http://localhost:3000).

Use Left and Right to roll, Space to jump, and Down or S to drop through ledges or the lift. Press E when a Use prompt appears. E also advances dialogue and Escape closes it. R restarts. Touch devices show corresponding controls. The lift cycles automatically.

## Deploy on Railway

1. In Railway, create a project from the GitHub repository that contains this code and select the `main` branch.
2. Keep the repository root as the service root. Railway detects the Dockerfile. The server listens on the assigned `PORT`, and the health check is `/healthz`.
3. Open the service’s Networking settings and generate a Railway domain to play the build.

## Edit the levels and art

- `public/level.json` and `public/lust.json` hold the world geometry and object positions. World coordinates are in logical pixels and Y increases downward. Solid polygons run clockwise. The `rim` value counts the vertices along the walkable top. A ledge with `oneWay` can be jumped through from below. The `background` field names the single WebP used for the level. The `poets` and `cave.dialogue` entries hold the conversations and the relief inscription.
- `public/assets/` holds the original painted placeholder sprites, backgrounds, and terrain textures created for this build. Replace the WebP files using the same names and approximate proportions. Transparent objects use alpha. Collision geometry lives in the level data.
- `public/game.js` holds the movement, camera, stage events, and renderer. The `artFiles` object maps sprite names to files.

The [game design document](DESIGN.md) covers progression, dialogue, symbolism, and art production.

## References

- [Dante’s *Inferno*, Canto IV, translated by Henry Wadsworth Longfellow](https://en.wikisource.org/wiki/Divine_Comedy_(Longfellow_1867)/Volume_1/Canto_4)
- [Danteworlds at UT Austin](https://danteworlds.laits.utexas.edu/circle1.html)
- [HelloOO7/BounceTales](https://github.com/HelloOO7/BounceTales) and [Wafer-EX/BounceTalesReversed](https://github.com/Wafer-EX/BounceTalesReversed) for movement and camera reference
- [abdellatifAhammad/bounce_tales](https://github.com/abdellatifAhammad/bounce_tales) for browser adaptation reference
- [Vireth4114/BTMaker](https://github.com/Vireth4114/BTMaker) for level-data reference
