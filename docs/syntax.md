# Markup syntax

StreamTag UI uses an XML-style subset of HTML with custom component tags. It is not JSX and does not evaluate expressions.

## Layout

Use quoted attributes and explicit closing tags. Void elements must self-close: `<br/>`, `<img src="..."/>`. Multiple top-level nodes are supported. Tag and prop names are case-sensitive. Comments are ignored. Escape literal ampersands and less-than signs using `&amp;` and `&lt;`; numeric entities are supported. Do not generate doctypes, processing instructions, CDATA, script tags, stylesheet tags, or Markdown code fences.

Supported HTML tags:

```text
a abbr article aside b blockquote br button caption code col colgroup dd del
details div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i
img input label li main mark nav ol p pre s section small span strong sub
summary sup table tbody td textarea th thead time tr u ul
```

Unknown elements are omitted with an `unknown-component` diagnostic. Their children are not rendered independently. For SVG, canvas, interactive forms, or other richer elements, register a trusted React component.

Supported attributes include class, style, id, title, role, aria-_, data-_, href, src, alt, width, height, loading, target, rel, type, name, value, placeholder, disabled, checked, min, max, step, scope, datetime, open, for, colspan, rowspan, and tabindex. Event handlers and executable URL schemes are dropped. Inline declarations containing `url(...)`, escaped CSS values, and legacy CSS expressions are excluded. This is a limited filter, not a CSS resource-request sandbox; other CSS constructs can still reference external resources. External CSS classes are applied as supplied and are not sanitized or isolated.

Raw input/textarea elements use initial values rather than a controlled application state. A file input's non-empty `value` is ignored and produces an `invalid-attribute` diagnostic; browsers prohibit setting a filename programmatically. Use custom React components for application interactions.

## Component props

```xml
<line-chart>
  <title>Monthly revenue</title>
  <series>
    <item>
      <name>Revenue</name>
      <data><item>58</item><item>62</item></data>
    </item>
  </series>
</line-chart>
```

Object keys become child tags. Arrays contain `<item>` entries, including nested arrays. Strings are plain text; nested HTML is not accepted inside a string. Numbers follow JSON numeric syntax. Booleans are exactly `true` or `false`. Custom component attributes do not carry props; use child tags.

Duplicate or unknown object fields are errors, even if the Zod object would otherwise strip them. This avoids silently accepting model misspellings. Dynamic record keys and passthrough object fields are not supported in 0.1.

Top-level component props named `key` or `ref` are reserved by React. Both `defineComponent` and `getComponentDescriptions` reject these schemas. Rename the prop or place it inside a nested object; nested `key` and `ref` fields are supported.

## Supported schemas

- `z.object`, `z.array`, `z.string`, `z.number`, `z.boolean`.
- `z.enum` and scalar `z.literal` values.
- `.optional()` and `.default(...)` wrappers.
- Ordinary refinements such as string lengths, number bounds, and array lengths run through `safeParse`.

Unions, discriminated unions, records, dates, transforms, coercion, async refinements, and React-node slots are outside the initial format. Explicit nullable values do not have a dedicated markup representation. Prefer optional fields for omitted values. Schemas must also be representable by Zod's input JSON Schema exporter when generating model instructions.

The parser is an incremental HTML parser in XML mode, with diagnostics for incomplete tags and common malformed markup. It is not a complete XML conformance validator. Generate the documented subset rather than relying on parser recovery behavior.
