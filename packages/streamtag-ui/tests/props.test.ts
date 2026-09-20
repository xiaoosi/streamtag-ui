import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MarkupParser } from '../src/parser/MarkupParser';
import type { ElementNode } from '../src/parser/MarkupParser';
import { readProps } from '../src/runtime/props';

const schema = z.object({
  title: z.string(),
  series: z
    .array(
      z.object({ name: z.string(), data: z.array(z.number()).default([]) }),
    )
    .default([]),
});

function state(parser: MarkupParser) {
  return readProps(schema, parser.roots[0] as ElementNode);
}

describe('streaming props', () => {
  it('grows nested series by complete points without waiting for the whole series', () => {
    const parser = new MarkupParser();
    parser.append(
      '<line-chart><title>Sales</title><series><item><name>Revenue</name><data><item>120',
    );
    expect(state(parser)).toEqual({
      status: 'ready',
      value: { title: 'Sales', series: [{ name: 'Revenue', data: [] }] },
    });
    parser.append('.5</item>');
    expect(state(parser)).toEqual({
      status: 'ready',
      value: { title: 'Sales', series: [{ name: 'Revenue', data: [120.5] }] },
    });
    parser.append(
      '<item>180</item></data></item><item><name>Cost</name><data><item>60</item>',
    );
    expect(state(parser)).toEqual({
      status: 'ready',
      value: {
        title: 'Sales',
        series: [
          { name: 'Revenue', data: [120.5, 180] },
          { name: 'Cost', data: [60] },
        ],
      },
    });
  });

  it('streams strings but withholds incomplete numeric and boolean values', () => {
    const parser = new MarkupParser();
    parser.append('<card-view><title>Grow');
    const fields = z.object({
      title: z.string(),
      count: z.number().optional(),
      active: z.boolean().optional(),
    });
    const read = () => readProps(fields, parser.roots[0] as ElementNode);
    expect(read()).toEqual({ status: 'ready', value: { title: 'Grow' } });
    parser.append('ing</title><count>12');
    expect(read()).toEqual({ status: 'ready', value: { title: 'Growing' } });
    parser.append('0</count><active>tru');
    expect(read()).toEqual({
      status: 'ready',
      value: { title: 'Growing', count: 120 },
    });
    parser.append('e</active></card-view>');
    expect(read()).toEqual({
      status: 'ready',
      value: { title: 'Growing', count: 120, active: true },
    });
  });

  it('does not publish table rows until their required numeric field is complete', () => {
    const parser = new MarkupParser();
    const table = z.object({
      rows: z
        .array(z.object({ name: z.string(), amount: z.number() }))
        .default([]),
    });
    const read = () => readProps(table, parser.roots[0] as ElementNode);
    parser.append('<data-table><rows><item><name>A</name><amount>120');
    expect(read()).toEqual({ status: 'ready', value: { rows: [] } });
    parser.append('</amount></item>');
    expect(read()).toEqual({
      status: 'ready',
      value: { rows: [{ name: 'A', amount: 120 }] },
    });
  });

  it('distinguishes pending required props from invalid completed props', () => {
    const parser = new MarkupParser();
    parser.append('<line-chart>');
    expect(state(parser).status).toBe('pending');
    parser.append('</line-chart>');
    expect(state(parser).status).toBe('invalid');
  });

  it.each(['NaN', 'Infinity', '12x', '', '0x10'])(
    'rejects malformed completed number %j',
    (number) => {
      const parser = new MarkupParser();
      parser.append(
        `<line-chart><title>Sales</title><series><item><name>A</name><data><item>${number}</item></data></item></series></line-chart>`,
      );
      expect(state(parser).status).toBe('invalid');
    },
  );

  it('validates enums, defaults, nested objects, and unknown props', () => {
    const parser = new MarkupParser();
    parser.append(
      '<card-view><align>right</align><options><active>true</active></options></card-view>',
    );
    const fields = z.object({
      align: z.enum(['left', 'right']),
      count: z.number().default(3),
      options: z.object({ active: z.boolean() }),
    });
    expect(readProps(fields, parser.roots[0] as ElementNode)).toEqual({
      status: 'ready',
      value: { align: 'right', count: 3, options: { active: true } },
    });
    expect(readProps(z.object({}), parser.roots[0] as ElementNode).status).toBe(
      'invalid',
    );
  });
});
