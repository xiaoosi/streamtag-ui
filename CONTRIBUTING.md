# Contributing

Use Node.js 22.12+ and pnpm 10.30.3. Run `pnpm install` from the root. Keep comments, identifiers, documentation, and user-facing example text in English.

## Local checks

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:browser
```

Add focused regression tests when changing parsing, prop publication, or renderer identity. For stream-sensitive changes, test the same document with one-character chunks and every possible split position. Use fixtures for reproducible bug reports. Avoid internal source imports in consumer examples.

Keep the public API small. Internal parser, runtime, and renderer modules should not become separate published packages without a concrete consumer need.

## Changes and releases

Use `pnpm changeset` for user-visible changes. Before a release, review the changesets and run `pnpm version-packages`. Run all checks, then pack the package:

```sh
pnpm --filter streamtag-ui pack
```

Inspect the tarball in a clean consumer before publication. Only the library is publishable; apps, examples, and the workspace root are private. Publishing is a separate maintainer action and is not performed by CI.

## Bug reports

Include the package version, schema, registered component, accumulated markup, the chunk sequence that reproduces the issue, and expected behavior. Replace private data with a minimal fixture. Never include API keys or internal endpoints.
