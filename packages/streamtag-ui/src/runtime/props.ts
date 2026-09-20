import { z } from 'zod';
import type { ElementNode } from '../parser/MarkupParser.js';

export type PropsResult =
  | { status: 'ready'; value: unknown }
  | { status: 'pending' }
  | { status: 'invalid'; message: string };

const pending: PropsResult = { status: 'pending' };
const invalid = (message: string): PropsResult => ({
  status: 'invalid',
  message,
});

function unwrap(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable)
    return unwrap(schema.unwrap() as z.ZodType);
  if (schema instanceof z.ZodDefault)
    return unwrap(schema.removeDefault() as z.ZodType);
  return schema;
}

/** Decode only publishable fields, then let the original schema enforce the contract. */
export function readProps(schema: z.ZodType, node?: ElementNode): PropsResult {
  if (!node) {
    const missing = schema.safeParse(undefined);
    return missing.success ? { status: 'ready', value: missing.data } : pending;
  }
  const inner = unwrap(schema);
  let value: unknown;

  if (inner instanceof z.ZodObject) {
    const props: Record<string, unknown> = {};
    const children = node.children.filter(
      (child): child is ElementNode => child.kind === 'element',
    );
    const names = new Set<string>();
    for (const child of children) {
      if (names.has(child.tag))
        return invalid(`Duplicate prop <${child.tag}> in <${node.tag}>.`);
      if (!Object.hasOwn(inner.shape, child.tag))
        return invalid(`Unknown prop <${child.tag}> in <${node.tag}>.`);
      names.add(child.tag);
    }
    if (
      node.children.some((child) => child.kind === 'text' && child.value.trim())
    ) {
      return invalid(
        `Object <${node.tag}> must contain prop tags, not bare text.`,
      );
    }
    for (const [key, field] of Object.entries(inner.shape)) {
      const result = readProps(
        field as z.ZodType,
        children.find((child) => child.tag === key),
      );
      if (result.status === 'invalid') return result;
      if (result.status === 'ready') props[key] = result.value;
    }
    value = props;
  } else if (inner instanceof z.ZodArray) {
    const items: unknown[] = [];
    for (const child of node.children) {
      if (child.kind === 'text') {
        if (child.value.trim())
          return invalid(`Array <${node.tag}> must contain <item> entries.`);
        continue;
      }
      if (child.tag !== 'item')
        return invalid(`Array <${node.tag}> must contain <item> entries.`);
      const result = readProps(inner.element as z.ZodType, child);
      if (result.status === 'invalid') return result;
      if (result.status === 'ready') items.push(result.value);
    }
    value = items;
  } else {
    if (node.children.some((child) => child.kind === 'element')) {
      return invalid(`Scalar <${node.tag}> cannot contain nested markup.`);
    }
    const text = node.children
      .map((child) => (child.kind === 'text' ? child.value : ''))
      .join('');
    if (inner instanceof z.ZodString) {
      value = text;
    } else {
      if (!node.closed) return pending;
      const literal = text.trim();
      if (inner instanceof z.ZodNumber) {
        if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(literal)) {
          return invalid(`Invalid number in <${node.tag}>.`);
        }
        value = Number(literal);
      } else if (inner instanceof z.ZodBoolean) {
        if (literal !== 'true' && literal !== 'false')
          return invalid(`Invalid boolean in <${node.tag}>.`);
        value = literal === 'true';
      } else if (inner instanceof z.ZodEnum || inner instanceof z.ZodLiteral) {
        // String literals are tried first to preserve values such as "120".
        if (schema.safeParse(text).success) value = text;
        else {
          try {
            value = JSON.parse(literal);
          } catch {
            value = literal;
          }
        }
      } else {
        return invalid(
          `Unsupported schema for <${node.tag}>. Use objects, arrays, strings, numbers, booleans, enums, or literals.`,
        );
      }
    }
  }

  const result = schema.safeParse(value);
  if (result.success) return { status: 'ready', value: result.data };
  if (!node.closed) return pending;
  return invalid(
    `Invalid <${node.tag}>: ${result.error.issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join('; ')}`,
  );
}
