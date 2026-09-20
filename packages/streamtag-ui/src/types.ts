import type { ComponentType, ReactNode } from 'react';
import type { z } from 'zod';

/** Serializable metadata is derived from the schema when descriptions are generated. */
export interface ComponentDescription {
  name: string;
  description: string;
  schema: z.ZodObject;
  example?: string;
}

export interface ComponentOptions<S extends z.ZodObject> extends Omit<
  ComponentDescription,
  'schema'
> {
  schema: S;
  component: ComponentType<z.output<S>>;
  fallback?: ReactNode;
}

export interface StreamComponent extends ComponentDescription {
  /** Internal adapter keeps heterogeneous components type-safe at their definition boundary. */
  render: (props: unknown) => ReactNode;
  fallback?: ReactNode;
}

export interface StreamIssue {
  code:
    | 'syntax'
    | 'unknown-component'
    | 'invalid-props'
    | 'invalid-attribute'
    | 'component-error';
  message: string;
  nodeId?: number;
  tag?: string;
}

export interface StreamRendererProps {
  components: readonly StreamComponent[];
  /** The complete text received so far. Appended suffixes are parsed incrementally. */
  content: string;
  /** Set to false when generation finishes so incomplete markup is reported. */
  streaming?: boolean;
  onError?: (issue: StreamIssue) => void;
}
