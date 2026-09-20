import { describe, expect, it } from 'vitest';
import { MarkupParser } from '../src/parser/MarkupParser';
import type { MarkupNode } from '../src/parser/MarkupParser';

function normalized(nodes: MarkupNode[]): unknown {
  return nodes.map((node): unknown =>
    node.kind === 'text'
      ? node.value
      : {
          tag: node.tag,
          attributes: node.attributes,
          closed: node.closed,
          children: normalized(node.children),
        },
  );
}

function parse(chunks: string[]) {
  const parser = new MarkupParser();
  chunks.forEach((chunk) => parser.append(chunk));
  parser.finish();
  return parser;
}

describe('incremental markup parsing', () => {
  it('has the same final result at every possible split, including entities and Unicode', () => {
    const text =
      '<div class="card" title="A &amp; B">Hello 🌱 &lt; world<br/><data-chart><points><item>120.5</item></points></data-chart></div>';
    const expected = normalized(parse([text]).roots);
    for (let i = 0; i <= text.length; i++) {
      const result = parse([text.slice(0, i), text.slice(i)]);
      expect(normalized(result.roots)).toEqual(expected);
      expect(result.issues).toEqual([]);
    }
    expect(normalized(parse(text.split('')).roots)).toEqual(expected);
  });

  it('publishes text before the closing tag arrives', () => {
    const parser = new MarkupParser();
    parser.append('<p>Hello');
    expect(normalized(parser.snapshot())).toEqual([
      { tag: 'p', attributes: {}, closed: false, children: ['Hello'] },
    ]);
  });

  it('preserves node IDs and snapshot identity for unchanged siblings', () => {
    const parser = new MarkupParser();
    parser.append('<p>First</p><p>Sec');
    const first = parser.snapshot();
    parser.append('ond</p>');
    const second = parser.snapshot();
    expect(second[0]).toBe(first[0]);
    expect(second[1]?.id).toBe(first[1]?.id);
    expect(normalized(first)).not.toEqual(normalized(second));
  });

  it('reports incomplete markup only when the stream ends', () => {
    const parser = new MarkupParser();
    parser.append('<div><p>unfinished');
    expect(parser.issues).toEqual([]);
    parser.finish();
    expect(parser.issues).toHaveLength(2);
    expect(() => parser.append('late')).toThrow();
  });

  it.each([
    '<',
    '<div',
    '<div a="',
    '</unknown>',
    '<!--unfinished',
    '<div a="x" a="y"/>',
    '<div class=bare/>',
  ])('reports malformed final input %j', (text) => {
    expect(parse([text]).issues.length).toBeGreaterThan(0);
  });

  it('reports mismatched nesting', () => {
    expect(parse(['<div><p>text</div>']).issues.length).toBeGreaterThan(0);
  });
});
