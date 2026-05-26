# CLAUDE.md — @rw3iss/graph-utils

Read first when Claude opens this repo.

## What this repo is

Vanilla-TypeScript canvas drawing toolkit. Zero UI-framework deps.
Compiles to ESM + CJS + `.d.ts` via tsup. Designed so the same overlay
code can run on a bare canvas (`VanillaChartAdapter`) or on top of a
TradingView chart (`TradingViewOverlayAdapter`, stubbed in v0.1, real in
v0.2).

## Where to look

- Public surface — `src/{core,chart,adapters,overlays}/index.ts`
- Library source — `src/`
- Tests — `tests/core/*.test.ts` (vitest)
- Demos (Preact + Vite, dev-only) — `playground/`
- Build — `tsup.config.ts`
- Targeted consumer — `/home/rw3iss/Sites/stocks/apps/web/src/pages/Chart.tsx`
  (not yet integrated; planned post-v0.1 release)

## Conventions

- TypeScript strict. `noImplicitAny`, `strictNullChecks`. If you must use
  `any`, prefix with `// reason: ...`.
- No framework imports in `src/` — Preact / React / Vue stay out of the
  package. Demos can use Preact in `playground/`.
- Coordinate discipline: layers read `Viewport` and use `Scale` /
  `Adapter.toPixel`; never hardcode pixel positions.
- One CanvasContext per Chart; `ctx.scale(DPR)` applied once in
  `CanvasContext.resize()`. Drawing functions operate in CSS pixels.
- Overlays target `Adapter`, not concrete adapter classes.
- `sideEffects: false` — keep barrel files free of side-effect imports.
- Subpath exports (`/core`, `/chart`, `/adapters`, `/overlays`) are the
  preferred entry points; the root barrel is convenience-only.

## Common commands

- `pnpm build` — tsup → `dist/`
- `pnpm test` — vitest run
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — eslint over `src/**/*.ts`
- `pnpm --filter graph-utils-playground dev` — open the demos

## Testing strategy

- Unit-test the math: `Scale`, `Viewport`, `HitTester`, `EventBus`.
- Do **not** pixel-test rendering — too brittle.
- If exercising `CanvasContext` flow, mock `CanvasRenderingContext2D` with a
  minimal stub.

## v0.2 things on deck

- Real `TradingViewOverlayAdapter` against `lightweight-charts`
- `PredictionFan`, `RegimeStripes`, `MLConfidenceHeatmap`, `StrategyTraces`
- Crosshair + tooltip layer
- Touch / pinch gestures in `interactions.ts`

## Don't

- Don't ship Preact / React / Vue in `src/`.
- Don't add a global state store — everything is per-Chart.
- Don't add CI workflows (`.github/workflows/`) without the user asking.
- Don't publish to npm. Push to the GitHub remote; tag releases.
