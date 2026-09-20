import { createElement } from 'react';
import type { z } from 'zod';
import type { ComponentOptions, StreamComponent } from './types.js';
import { validateComponent } from './validate.js';

/** Define a trusted React component that receives schema-validated streaming props. */
export function defineComponent<S extends z.ZodObject>(
  options: ComponentOptions<S>,
): StreamComponent {
  validateComponent(options);
  return {
    name: options.name,
    description: options.description,
    schema: options.schema,
    example: options.example,
    fallback: options.fallback,
    render: (props) => createElement(options.component, props as z.output<S>),
  };
}
