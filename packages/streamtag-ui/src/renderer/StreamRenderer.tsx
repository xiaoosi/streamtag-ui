import {
  Component,
  createElement,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { MarkupParser } from '../parser/MarkupParser.js';
import type { ElementNode, MarkupNode } from '../parser/MarkupParser.js';
import { readProps } from '../runtime/props.js';
import type {
  StreamComponent,
  StreamIssue,
  StreamRendererProps,
} from '../types.js';
import { htmlProps, htmlTags } from './html.js';

interface BoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (issue: StreamIssue) => void;
  node: ElementNode;
}

class ComponentBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.({
      code: 'component-error',
      tag: this.props.node.tag,
      nodeId: this.props.node.id,
      message: error.message,
    });
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}

function ReportIssue({
  issue,
  onError,
}: {
  issue: StreamIssue;
  onError?: (issue: StreamIssue) => void;
}) {
  const reported = useRef<StreamIssue | null>(null);
  useEffect(() => {
    if (!onError) return;
    const previous = reported.current;
    if (
      previous?.code === issue.code &&
      previous.message === issue.message &&
      previous.nodeId === issue.nodeId &&
      previous.tag === issue.tag
    )
      return;
    // Record before notifying: a listener may immediately update its parent's state.
    reported.current = issue;
    onError(issue);
  }, [issue, onError]);
  return null;
}

interface NodeProps {
  node: MarkupNode;
  registry: ReadonlyMap<string, StreamComponent>;
  onError?: (issue: StreamIssue) => void;
}

function ComponentContent({
  definition,
  props,
}: {
  definition: StreamComponent;
  props: unknown;
}) {
  return definition.render(props);
}

const NodeView = memo(function NodeView({
  node,
  registry,
  onError,
}: NodeProps): ReactNode {
  if (node.kind === 'text') return node.value;
  const definition = registry.get(node.tag);
  if (definition) {
    const result = readProps(definition.schema, node);
    if (result.status === 'pending') return definition.fallback ?? null;
    if (result.status === 'invalid')
      return (
        <>
          {definition.fallback ?? null}
          <ReportIssue
            issue={{
              code: 'invalid-props',
              nodeId: node.id,
              tag: node.tag,
              message: result.message,
            }}
            onError={onError}
          />
        </>
      );
    return (
      <ComponentBoundary
        node={node}
        fallback={definition.fallback}
        onError={onError}
      >
        <ComponentContent definition={definition} props={result.value} />
      </ComponentBoundary>
    );
  }
  if (!htmlTags.has(node.tag)) {
    return (
      <ReportIssue
        issue={{
          code: 'unknown-component',
          nodeId: node.id,
          tag: node.tag,
          message: `Unsupported tag <${node.tag}>.`,
        }}
        onError={onError}
      />
    );
  }
  const { props, issues } = htmlProps(node.tag, node.attributes);
  const children = node.children.map((child) => (
    <NodeView
      key={child.id}
      node={child}
      registry={registry}
      onError={onError}
    />
  ));
  let element: ReactNode;
  if (['br', 'hr', 'img', 'input', 'col'].includes(node.tag)) {
    element = createElement(node.tag, props);
  } else if (node.tag === 'textarea') {
    element = createElement('textarea', {
      ...props,
      defaultValue: node.children
        .filter((child) => child.kind === 'text')
        .map((child) => child.value)
        .join(''),
    });
  } else {
    element = createElement(node.tag, props, ...children);
  }
  return (
    <>
      {element}
      {issues.map((issue, index) => (
        <ReportIssue
          key={index}
          issue={{ ...issue, nodeId: node.id }}
          onError={onError}
        />
      ))}
    </>
  );
});

function start(content: string, streaming: boolean) {
  const parser = new MarkupParser();
  parser.append(content);
  if (!streaming) parser.finish();
  return {
    parser,
    content,
    streaming,
    nodes: parser.snapshot(),
    issues: [...parser.issues],
    generation: 0,
  };
}

/** Render accumulated model text. Transport and model selection remain application concerns. */
export function StreamRenderer({
  components,
  content,
  streaming = false,
  onError,
}: StreamRendererProps) {
  const registry = useMemo(() => {
    const entries = new Map<string, StreamComponent>();
    for (const component of components) {
      if (entries.has(component.name))
        throw new Error(`Duplicate component: ${component.name}`);
      entries.set(component.name, component);
    }
    return entries;
  }, [components]);
  const [session, setSession] = useState(() => start(content, streaming));

  useEffect(() => {
    if (session.content === content && session.streaming === streaming) return;
    if (!session.streaming || !content.startsWith(session.content)) {
      const next = start(content, streaming);
      setSession({ ...next, generation: session.generation + 1 });
      return;
    }
    session.parser.append(content.slice(session.content.length));
    if (!streaming) session.parser.finish();
    setSession({
      ...session,
      content,
      streaming,
      nodes: session.parser.snapshot(),
      issues: [...session.parser.issues],
    });
  }, [content, streaming, session]);

  return (
    <>
      {session.nodes.map((node) => (
        <NodeView
          key={`${session.generation}:${node.id}`}
          node={node}
          registry={registry}
          onError={onError}
        />
      ))}
      {session.issues.map((issue, index) => (
        <ReportIssue
          key={`${session.generation}:issue:${index}`}
          issue={issue}
          onError={onError}
        />
      ))}
    </>
  );
}
