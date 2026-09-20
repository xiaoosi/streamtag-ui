import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import {
  defineComponent,
  getComponentDescriptions,
  StreamRenderer,
} from 'streamtag-ui';
import './styles.css';

const card = defineComponent({
  name: 'score-card',
  description: 'Display a title and numeric score.',
  schema: z.object({ title: z.string(), score: z.number() }),
  component: ({ title, score }) => (
    <article className="score">
      <h2>{title}</h2>
      <strong>{score}</strong>
    </article>
  ),
  fallback: <p>Waiting for the complete score…</p>,
});
const components = [card];
const markup =
  '<section><h1>Your first stream</h1><score-card><title>Weekly score</title><score>120.5</score></score-card></section>';
const instructions = getComponentDescriptions(components);

function App() {
  const [length, setLength] = useState(0);
  return (
    <main>
      <h1>StreamTag UI · Minimal example</h1>
      <p>
        Move the slider to simulate arriving text. The numeric score appears
        only after its closing tag.
      </p>
      <label>
        Received characters{' '}
        <input
          type="range"
          min="0"
          max={markup.length}
          value={length}
          onChange={(event) => setLength(Number(event.target.value))}
        />
      </label>
      <pre>{markup.slice(0, length)}</pre>
      <StreamRenderer
        components={components}
        content={markup.slice(0, length)}
        streaming={length < markup.length}
      />
      <details>
        <summary>Model instructions</summary>
        <pre>{instructions}</pre>
      </details>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
