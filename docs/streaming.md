# Streaming contract

## Text and values

The public `content` prop is the accumulated document. The parser consumes only its appended suffix. Characters in an unfinished start tag are buffered by the tokenizer. Text nodes can grow before their parent closes. Numbers, booleans, enums, and literals wait for their closing tag, so a prefix such as `120` is not committed while the model might still append `.5`.

An array exposes entries that pass the item schema. Objects can be published before their enclosing tag closes if their current fields pass validation. Nested arrays can therefore grow inside a published series. This is intentionally different from waiting for every array item to close.

A useful chart schema gives its `series` and `data` arrays default empty values. A table schema makes each required numeric column mandatory. Defaults should represent valid application states, not conceal missing required data.

## Validation and rendering

Before a component has valid props, its fallback is displayed. Open values that fail a constraint are pending. Completed invalid values produce `invalid-props` and display the fallback. Existing sibling components continue rendering. If a React component throws during rendering, its error boundary displays the fallback for the remainder of that document; a new renderer key or a replaced document resets the boundary.

The library validates schemas synchronously. Keep schema refinements pure and synchronous. A component's own event-handler or asynchronous failures are outside React error-boundary coverage.

## Identity

Node IDs stay stable during append-only generation. Snapshots reuse unchanged subtrees, and React memoization prevents unaffected components from rerendering when unrelated siblings change. A component can still rerender when its node changes even if the resulting props are equal; 0.1 does not promise field-level subscription scheduling.

Changing `components` definitions or replacing/shortening the source may reset component state. Define the registry outside render functions. Use a React `key` for a new conversation or generation, especially if it starts with the same prefix as the previous one.

## Completion

Set `streaming={false}` to end a stream and report unfinished tags. It defaults to false for saved/static content. A paused replay must keep `streaming={true}` until intentionally ended.

`onError` reports syntax, unknown-component, invalid-props, invalid-attribute, and component-error issues on the client. It is a diagnostic hook, not a transport error handler. Inline callbacks may update application state: an unchanged issue is not reported again just because the callback changes or Strict Mode reruns effects. A changed issue, a newly failing node, or a new document can produce another notification. Server rendering produces markup and fallbacks, but React effects do not run on the server, so `onError` is not a server validation API.

## CSS and trust

Only complete opening tags expose their attributes. Styling comes from the host application. This is not a CSS compiler or security sandbox. The HTML allowlist removes unsupported executable elements and attributes, but trusted React components can run application code and host CSS can affect the page.
