# streamtag-ui

Render AI-generated HTML and your React components while text streams in.

```sh
npm install streamtag-ui zod
```

[Documentation and demo](https://github.com/xiaoosi/streamtag-ui#readme) · [Changelog](https://github.com/xiaoosi/streamtag-ui/blob/main/packages/streamtag-ui/CHANGELOG.md)

```tsx
import { z } from 'zod';
import {
  defineComponent,
  getComponentDescriptions,
  StreamRenderer,
} from 'streamtag-ui';

const components = [
  defineComponent({
    name: 'score-card',
    description: 'A numeric score card.',
    schema: z.object({ title: z.string(), score: z.number() }),
    component: ({ title, score }) => (
      <article>
        <h2>{title}</h2>
        <strong>{score}</strong>
      </article>
    ),
  }),
];

const systemPrompt = getComponentDescriptions(components);
// Include systemPrompt in your model request, then render its accumulated text.
const report = (
  <StreamRenderer
    components={components}
    content={text}
    streaming={generating}
  />
);
```

Numbers are published after their closing tag. Strings can grow live. Arrays expose schema-valid entries progressively. Use `.default([])` for arrays that can start empty. Components receive only schema-validated props; optional fallbacks appear while required data is pending or invalid.

React reserves top-level `key` and `ref` props. Definitions and generated descriptions reject schemas with these fields; rename them or place them inside a nested object.

Use `streamtag-ui/server` to import `getComponentDescriptions` without React. Pass shared metadata definitions (`name`, `description`, `schema`, optional `example`) instead of importing browser component implementations.

The host supplies CSS, model integration, and transport. Use `onError` to receive diagnostics. Pass `streaming={false}` on completion; the default is false for static saved markup. Change the renderer key to explicitly start a new document.

Requires React 18.2 or 19 and Zod 4. ESM only. The initial format supports objects, arrays, strings, finite numbers, booleans, enums, scalar literals, optional fields, and defaults. It is an XML-style markup format, not the A2UI JSON protocol. The renderer filters unsupported HTML but is not a security sandbox.

MIT license.
