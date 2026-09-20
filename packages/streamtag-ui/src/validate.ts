import type { ComponentDescription } from './types.js';

export function validateComponent(component: ComponentDescription): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(component.name)) {
    throw new Error(
      'Component names must use lowercase kebab-case with a hyphen, for example "line-chart".',
    );
  }
  for (const name of ['key', 'ref']) {
    if (Object.hasOwn(component.schema.shape, name)) {
      throw new Error(
        `Component "${component.name}" uses the React-reserved top-level prop "${name}". Rename it or move it inside a nested object.`,
      );
    }
  }
}
