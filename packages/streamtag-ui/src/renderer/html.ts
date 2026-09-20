import type { CSSProperties } from 'react';
import parseStyle from 'style-to-object';
import type { StreamIssue } from '../types.js';

/** Deliberately excludes executable, document-level, and embedded browsing elements. */
export const htmlTags = new Set(
  `a abbr article aside b blockquote br button caption code col colgroup dd del details div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img input label li main mark nav ol p pre s section small span strong sub summary sup table tbody td textarea th thead time tr u ul`.split(
    ' ',
  ),
);

const attributes = new Set(
  `id title role href src alt width height loading target rel type name value placeholder disabled checked min max step scope datetime open`.split(
    ' ',
  ),
);
const booleanAttributes = new Set(['disabled', 'checked', 'open']);
const aliases: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  tabindex: 'tabIndex',
  datetime: 'dateTime',
};

function safeUrl(value: string): boolean {
  const compact = value.replace(/[\u0000-\u0020\u007f]/g, '');
  return (
    !/^[a-z][a-z0-9+.-]*:/i.test(compact) ||
    /^(https?:|mailto:|tel:)/i.test(compact)
  );
}

function styles(value: string): CSSProperties {
  const result: Record<string, string> = {};
  try {
    parseStyle(value, (property, content) => {
      // URL-based styles and executable legacy syntax are outside the supported subset.
      if (/url\s*\(|expression\s*\(|@import|\\/i.test(content)) return;
      const name = property.startsWith('--')
        ? property
        : property
            .replace(/^-ms-/, 'ms-')
            .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      result[name] = content;
    });
  } catch {
    // Ignore an incomplete style declaration until the containing tag is available.
  }
  return result as CSSProperties;
}

export function htmlProps(
  tag: string,
  input: Record<string, string>,
): { props: Record<string, unknown>; issues: StreamIssue[] } {
  const output: Record<string, unknown> = {};
  const issues: StreamIssue[] = [];
  for (const [key, value] of Object.entries(input)) {
    const name = key.toLowerCase();
    if (name.startsWith('on')) continue;
    if (name === 'style') {
      output.style = styles(value);
      continue;
    }
    if (
      !(name in aliases) &&
      !attributes.has(name) &&
      !/^(aria|data)-[a-z0-9-]+$/.test(name)
    )
      continue;
    if ((name === 'href' || name === 'src') && !safeUrl(value)) continue;
    output[aliases[name] ?? name] = booleanAttributes.has(name)
      ? value !== 'false'
      : value;
  }
  if (output.target === '_blank') output.rel = 'noopener noreferrer';
  if (tag === 'input') {
    if ('value' in output) {
      if (String(output.type).toLowerCase() === 'file' && output.value !== '') {
        issues.push({
          code: 'invalid-attribute',
          tag,
          message:
            'A file input cannot have a non-empty value. The value was ignored.',
        });
      } else {
        output.defaultValue = output.value;
      }
      delete output.value;
    }
    if ('checked' in output) {
      output.defaultChecked = output.checked;
      delete output.checked;
    }
  }
  return { props: output, issues };
}
