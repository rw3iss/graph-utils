import { useState } from 'preact/hooks';
import { LineDemo } from './demos/LineDemo.js';
import { CandleDemo } from './demos/CandleDemo.js';
import { MultiPaneDemo } from './demos/MultiPaneDemo.js';

const DEMOS = [
  { id: 'line', label: 'Line chart', Component: LineDemo },
  { id: 'candle', label: 'Candle + overlays', Component: CandleDemo },
  { id: 'multipane', label: 'Multi-pane (strategy debugger)', Component: MultiPaneDemo },
] as const;

export function App() {
  const [active, setActive] = useState<(typeof DEMOS)[number]['id']>('line');
  const Demo = DEMOS.find((d) => d.id === active)!.Component;
  return (
    <div>
      <div class="tabs">
        {DEMOS.map((d) => (
          <button
            key={d.id}
            class={`tab ${active === d.id ? 'active' : ''}`}
            onClick={() => setActive(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div class="demo">
        <Demo />
      </div>
    </div>
  );
}
