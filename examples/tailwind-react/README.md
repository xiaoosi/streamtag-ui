# Tailwind CSS + StreamTag UI

A standalone Vite app using the public `streamtag-ui` API and Tailwind CSS 4. The same example is available as **Team overview · Tailwind** in the playground.

From the repository root:

```sh
pnpm install
pnpm --filter streamtag-ui build
pnpm --filter @streamtag-ui/tailwind-react dev
```

Move **Received characters** to reveal the markup. The responsive metric layout uses utility classes in the XML. The registered `activity-feed` uses Tailwind inside its React implementation; complete, schema-valid items appear one by one.

## Where the styles come from

`vite.config.ts` installs `@tailwindcss/vite`. `src/styles.css` imports Tailwind and explicitly scans this example's source and the shared XML fixture:

```css
@import 'tailwindcss' source(none);
@source './';
@source '../../../fixtures/tailwind-dashboard.xml';
```

StreamTag passes `class` through as React's `className`. Tailwind compiles those utilities during the application build; it is not a dependency of the renderer package.

For live model output, define a vocabulary of complete class names in your application and include it in the prompt. Ensure Tailwind sees every allowed class at build time, using source files or `@source inline(...)`. An arbitrary class invented after the build has no CSS unless the host supplies it. See [Tailwind's class detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files).

For example, an application can explicitly include a small vocabulary:

```css
@source inline('grid gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-900');
```

Ordinary CSS, CSS Modules with a host-provided mapping, or other compiled utility libraries work on the same principle: the host owns the stylesheet.
