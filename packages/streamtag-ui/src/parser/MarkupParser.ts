import { Parser } from 'htmlparser2';
import type { StreamIssue } from '../types.js';

export interface TextNode {
  kind: 'text';
  id: number;
  value: string;
}

export interface ElementNode {
  kind: 'element';
  id: number;
  tag: string;
  attributes: Record<string, string>;
  children: MarkupNode[];
  closed: boolean;
  revision: number;
}

export type MarkupNode = TextNode | ElementNode;

/** A single parser consumes appended suffixes and preserves node identity across chunks. */
export class MarkupParser {
  readonly roots: MarkupNode[] = [];
  readonly issues: StreamIssue[] = [];
  private stack: ElementNode[] = [];
  private nextId = 0;
  private ended = false;
  private ending = false;
  private parser: Parser;
  private input = '';
  private consumed = 0;
  private attributeNames = new Set<string>();
  private snapshots = new WeakMap<
    MarkupNode,
    { version: number | string; node: MarkupNode }
  >();

  constructor() {
    this.parser = new Parser(
      {
        onopentagname: () => {
          this.attributeNames.clear();
        },
        onattribute: (name, _value, quote) => {
          if (this.attributeNames.has(name))
            this.issues.push({
              code: 'syntax',
              message: `Duplicate attribute "${name}".`,
            });
          if (!quote)
            this.issues.push({
              code: 'syntax',
              message: `Attribute "${name}" must have a quoted value.`,
            });
          this.attributeNames.add(name);
        },
        oncomment: () => {
          this.consume();
          if (
            !this.input
              .slice(this.parser.startIndex, this.parser.endIndex + 1)
              .endsWith('-->')
          ) {
            this.issues.push({
              code: 'syntax',
              message: 'Unterminated comment.',
            });
          }
        },
        onopentag: (tag, attributes) => {
          this.consume();
          const node: ElementNode = {
            kind: 'element',
            id: this.nextId++,
            tag,
            attributes,
            children: [],
            closed: false,
            revision: 0,
          };
          this.children().push(node);
          this.touch();
          this.stack.push(node);
        },
        ontext: (value) => {
          this.consume();
          if (
            this.input
              .slice(this.parser.startIndex, this.parser.endIndex + 1)
              .includes('<')
          ) {
            this.issues.push({
              code: 'syntax',
              message: 'Literal < must be escaped as &lt;.',
            });
          }
          const children = this.children();
          const last = children.at(-1);
          if (last?.kind === 'text') last.value += value;
          else children.push({ kind: 'text', id: this.nextId++, value });
          this.touch();
        },
        onclosetag: (tag, implied) => {
          if (!this.ending) this.consume();
          const node = this.stack.pop();
          if (!node) return;
          if (this.ending || (implied && !this.isSelfClosing())) {
            this.issues.push({
              code: 'syntax',
              nodeId: node.id,
              tag,
              message: `Missing closing tag for <${tag}>.`,
            });
          } else {
            node.closed = true;
          }
          node.revision++;
          this.touch();
        },
        onprocessinginstruction: () => {
          this.consume();
          this.issues.push({
            code: 'syntax',
            message:
              'Processing instructions and document declarations are not supported.',
          });
        },
        onerror: (error) => {
          this.issues.push({ code: 'syntax', message: error.message });
        },
      },
      { xmlMode: true, decodeEntities: true, recognizeSelfClosing: true },
    );
  }

  private consume(): void {
    const start = this.parser.startIndex;
    if (
      start > this.consumed &&
      this.input.slice(this.consumed, start).trim()
    ) {
      this.issues.push({
        code: 'syntax',
        message: `Unrecognized markup at character ${this.consumed}.`,
      });
    }
    this.consumed = Math.max(this.consumed, this.parser.endIndex + 1);
  }

  private children(): MarkupNode[] {
    return this.stack.at(-1)?.children ?? this.roots;
  }

  private touch(): void {
    for (const ancestor of this.stack) ancestor.revision++;
  }

  private isSelfClosing(): boolean {
    return this.input
      .slice(this.parser.startIndex, this.parser.endIndex + 1)
      .endsWith('/>');
  }

  append(chunk: string): void {
    if (this.ended)
      throw new Error(
        'Cannot append after finishing a stream. Create a new parser.',
      );
    this.input += chunk;
    this.parser.write(chunk);
  }

  /** Reuse unchanged subtrees while publishing immutable snapshots to the renderer. */
  snapshot(): MarkupNode[] {
    const copy = (node: MarkupNode): MarkupNode => {
      const version = node.kind === 'text' ? node.value : node.revision;
      const cached = this.snapshots.get(node);
      if (cached?.version === version) return cached.node;
      const next: MarkupNode =
        node.kind === 'text'
          ? { ...node }
          : {
              ...node,
              attributes: { ...node.attributes },
              children: node.children.map(copy),
            };
      this.snapshots.set(node, { version, node: next });
      return next;
    };
    return this.roots.map(copy);
  }

  finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.ending = true;
    this.parser.end();
    this.ending = false;
    if (this.input.slice(this.consumed).trim()) {
      this.issues.push({
        code: 'syntax',
        message: `Incomplete or unrecognized markup at character ${this.consumed}.`,
      });
    }
  }
}
