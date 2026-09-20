# Quick start

## Local setup

1. Install Node.js 22+ and pnpm 10.30.3.
2. Run `pnpm install` in the repository root.
3. Run `pnpm dev` for the playground.
4. For the minimal consumer, run `pnpm --filter @streamtag-ui/minimal-react dev` after the library has built.

Only `packages/streamtag-ui` is intended for npm publication. Before publication, use the workspace or install a locally packed tarball into another project:

```sh
pnpm --filter streamtag-ui build
cd packages/streamtag-ui
pnpm pack
# In your consumer, install the resulting tarball plus react, react-dom, and zod.
```

## Define, describe, render

`defineComponent({ name, description, schema, component, fallback?, example? })` creates a registry entry. Names must be lowercase kebab-case with a hyphen. Top-level schema fields cannot be named `key` or `ref`, which React reserves; nested fields may use these names. Define entries once outside React render functions. The component receives the output type inferred from its Zod object schema.

`getComponentDescriptions(entries)` returns a string containing markup instructions and input JSON Schemas. The optional `example` supplies a hand-written markup example. Include the returned string in your model's system prompt. The function accepts metadata without a React implementation.

`<StreamRenderer components={entries} content={text} streaming={generating} onError={handler} />` consumes the complete text received so far. This API does not fetch data. It returns a React fragment without adding layout wrappers.

Use a shared metadata module and `streamtag-ui/server` on the server. Bind that metadata to the React implementation through `defineComponent` on the client. This avoids importing a chart library into the model-calling process.

## Transport integration

The renderer works with accumulated text from any model SDK. If you consume a raw UTF-8 response body yourself, decode bytes with `TextDecoder` in streaming mode before appending text. A network byte chunk is not a token and can split a Unicode character.

For SSE, parse SSE framing and extract the model text before passing it to the renderer. Do not pass `data:` frames or JSON envelopes as markup.

Set `streaming={false}` on normal completion. On cancellation, choose whether to finalize and report incomplete markup, or discard the content. Transport failures remain the application's responsibility.

## Styling

Load your own stylesheet and tell the model which classes are available. Inline `style` declarations and CSS custom properties are supported within the documented subset. The library does not inject global CSS, fetch stylesheets, compile Tailwind, or translate CSS Modules names.

## Development feedback

`pnpm dev` builds the package once, then starts the playground. After changing library source, run `pnpm --filter streamtag-ui build`; Vite will pick up the updated package. Playground source changes use normal Vite hot reload.
