# Architecture

The repository uses pnpm workspaces to develop one publishable package alongside two consumers. There is no separate public core package or task orchestration layer.

## Data flow

```text
Accumulated text prop
  -> appended suffix
  -> htmlparser2 in XML mode
  -> stable mutable node tree
  -> immutable snapshots with reused unchanged subtrees
  -> schema-directed prop decoding
  -> memoized React nodes and trusted registered components
```

`parser/MarkupParser.ts` owns tokenization, node IDs, closure state, revisions, and common syntax diagnostics. It never imports React. The tokenizer is a maintained dependency rather than a custom HTML parser.

`runtime/props.ts` walks a component's prop subtree using public Zod APIs. It distinguishes pending, valid, and invalid data and decodes only publishable scalar values. The original schema remains authoritative for values passed to React. It does not patch schemas into permissive partial versions.

`renderer/StreamRenderer.tsx` manages a document session, resets on non-append changes, and renders immutable snapshots. Side effects that advance an existing parser occur after React commits. Initial snapshots also support static server rendering. Ordinary HTML is filtered through `renderer/html.ts`. Registered components have local error boundaries.

`define.ts` provides the typed adapter between a Zod object and a React component. `describe.ts` generates instructions and JSON Schema metadata. The `server` export includes only description generation and type exports, so it does not import React or browser components.

## Dependencies

Runtime dependencies are htmlparser2 and style-to-object. React and Zod are peer dependencies. ECharts belongs only to the playground. Styles, model clients, transports, and chat state are owned by the application.

## Cost model

The parser consumes appended text once, but creating snapshots visits children of changed ancestors, and decoding a changed component walks its current props. This is not constant-time work per token. Unchanged component subtrees retain reference identity and avoid React rerenders. Large single-component arrays may warrant further profiling before adding more complex state machinery.

## Verification

Unit tests cover arbitrary split boundaries, entities, nested array growth, numeric closure, schema constraints, reset behavior, static rendering, sanitization, and component instance preservation. Browser tests exercise the real ECharts integration, error isolation, replay completion, and mobile layout. The minimal example consumes built public exports rather than reaching into source files.
