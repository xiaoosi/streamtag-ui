import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getComponentDescriptions, StreamRenderer } from 'streamtag-ui';
import markup from '../../../fixtures/tailwind-dashboard.xml?raw';
import { components } from './components';
import './styles.css';

const instructions = getComponentDescriptions(components);

function App() {
  const [received, setReceived] = useState(0);
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 font-sans">
      <h1 className="text-xl font-semibold text-slate-900">
        StreamTag UI + Tailwind CSS
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Move the slider to reveal the stream. Layout utilities and React
        component styles come from the same compiled stylesheet.
      </p>
      <div className="my-6 rounded-xl border border-slate-200 p-5">
        <label className="block text-sm text-slate-600">
          Received characters: {received} / {markup.length}
          <input
            aria-label="Received characters"
            type="range"
            className="mt-3 block w-full accent-blue-600"
            min={0}
            max={markup.length}
            value={received}
            onChange={(event) => setReceived(Number(event.target.value))}
          />
        </label>
        <button
          className="mt-4 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setReceived(markup.length)}
        >
          Show complete
        </button>
      </div>
      <StreamRenderer
        components={components}
        content={markup.slice(0, received)}
        streaming={received < markup.length}
      />
      <details className="mt-6 text-sm text-slate-600">
        <summary className="cursor-pointer">Model instructions</summary>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs">
          {instructions}
        </pre>
      </details>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
