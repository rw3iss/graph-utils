# CLAUDE.md — @rw3iss/graph-utils

Read first when Claude opens this repo.

## What this repo is

Adapter-driven canvas drawing toolkit for trading-style overlays. Vanilla
TypeScript, zero UI-framework deps. Compiles to ESM + CJS + `.d.ts` via
tsup. The same overlay code runs against `VanillaChartAdapter` (our own
canvas-backed `Chart`) or `TradingViewOverlayAdapter` (a sibling canvas
overlaid on a `lightweight-charts` chart). v0.2 ships both adapters
working; v0.1's TV adapter was a stub.

## Architecture

```
                         ┌────────────────────────┐
                         │       Adapter          │
                         │ getCanvas / getViewport│
   Chart (vanilla) ◀────▶│ toPixel / toData       │◀────▶ Overlay (Layer)
   TV chart       ◀────▶ │ addLayer / invalidate  │
                         └─────────┬──────────────┘
                                   │
                              Viewport (xDomain / yDomain, 'change' event)
                                   │
                              xScale + yScale (scale/invert/ticks)
```

Key shape: the two adapters expose the same `xScale` / `yScale`
contract, so overlays call `adapter.toPixel(t, p)` and don't know which
host they're drawing onto. `TradingViewTimeScaleAdapter` /
`TradingViewPriceScaleAdapter` (private to the TV adapter) wrap TV's
`timeToCoordinate` / `priceToCoordinate` as our `Scale`.

The TV adapter never paints onto TV's own canvases — it appends a
sibling absolute-positioned `<canvas>` to the chart container and
syncs its position via a ResizeObserver.

## Where to look

- Public surface — `src/{core,chart,adapters,overlays}/index.ts`
- Library source — `src/`
- Tests — `tests/{core,chart,adapters,overlays}/*.test.ts` (vitest, mix of
  node + happy-dom environments)
- Demos (Preact + Vite, dev-only) — `playground/`
- Build — `tsup.config.ts`
- Targeted consumer — `/home/rw3iss/Sites/stocks/apps/web/`
  (uses this package via `github:rw3iss/graph-utils`)

## Conventions

- TypeScript strict. `noImplicitAny`, `strictNullChecks`. If you must use
  `any`, prefix with `// reason: ...`.
- No framework imports in `src/` — Preact / React / Vue stay out of the
  package. Demos can use Preact in `playground/`.
- Coordinate discipline: layers read `Viewport` and use `Scale` /
  `Adapter.toPixel`; never hardcode pixel positions. Skip data whose
  pixel is NaN (TV's `timeToCoordinate` returns null for off-screen
  values; the adapter forwards as NaN).
- One CanvasContext per Chart / adapter; `ctx.scale(DPR)` applied once in
  `CanvasContext.resize()`. Drawing fns operate in CSS pixels.
- Primitives all take a single `DrawStyle` options bag — `fill` /
  `stroke` / `lineWidth` / `alpha` / `lineDash` / `lineCap` / `lineJoin`.
  Positional geometry only; no `(color, width)` positional tails.
- Overlays target `Adapter`, not concrete adapter classes.
- `sideEffects: false` — keep barrel files free of side-effect imports.
- Subpath exports (`/core`, `/chart`, `/adapters`, `/overlays`) are the
  preferred entry points; the root barrel is convenience-only.

## Common commands

- `pnpm build` — tsup → `dist/`
- `pnpm test` — vitest run
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — eslint over `src/**/*.ts`
- `pnpm playground` — open the demos (`pnpm --filter graph-utils-playground dev`)

## Testing strategy

- Unit-test the math: `Scale`, `Viewport`, `HitTester`, `EventBus`,
  `BollingerBands.computeBands`, `VWAP.computeVWAP`, `SharedAxis`.
- TV adapter contract test: mock `IChartApi` shape, assert the adapter's
  `toPixel` maps known (time, price) → expected pixel coords, verify
  layer.draw is called, verify destroy unsubscribes. Uses happy-dom +
  a stubbed 2D context.
- Do **not** pixel-test rendering — too brittle.

## v0.3 things on deck

- `PredictionFan`, `RegimeStripes`, `MLConfidenceHeatmap`,
  `StrategyTraces` overlays (data models not yet settled in trader).
- Touch / pinch gestures in `interactions.ts`.
- Server-side render via `node-canvas` for backtest reports.

## Don't

- Don't ship Preact / React / Vue in `src/`.
- Don't add `lightweight-charts` as a runtime `dependency` — it's
  `peerDependencies` + `peerDependenciesMeta.optional: true`.
- Don't paint onto TV's own canvases. The sibling-overlay pattern is
  the supported one.
- Don't add a global state store — everything is per-Chart / per-Adapter.
- Don't add CI workflows (`.github/workflows/`) without the user asking.
- Don't publish to npm. Push to the GitHub remote; tag releases.
