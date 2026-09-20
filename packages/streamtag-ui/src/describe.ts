import { z } from 'zod';
import type { ComponentDescription } from './types.js';
import { validateComponent } from './validate.js';

/** Generate the shared markup rules and component catalog for a model system prompt. */
export function getComponentDescriptions(
  components: readonly ComponentDescription[],
): string {
  const seen = new Set<string>();
  const catalog = components.map((component) => {
    validateComponent(component);
    if (seen.has(component.name))
      throw new Error(`Duplicate component: ${component.name}`);
    seen.add(component.name);
    return [
      `## <${component.name}>`,
      component.description,
      'Props (JSON Schema):',
      JSON.stringify(
        z.toJSONSchema(component.schema, { io: 'input' }),
        null,
        2,
      ),
      component.example
        ? `Markup example:
${component.example}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  });
  return [
    'Generate markup directly, without Markdown fences or a surrounding html/body document.',
    'Use HTML for layout and the registered custom tags for components. Do not output JavaScript, event handlers, scripts, stylesheets, or unregistered custom tags.',
    'Use only CSS classes supplied by the application, or inline CSS declarations. Classes require styles already loaded by the application.',
    'Use case-sensitive, well-formed XML-style markup: quote attributes, close every tag, and self-close void elements such as <br/> and <img/>.',
    'Pass component props as child tags, not attributes. Object keys become tags. Array entries use <item>. Nest objects and arrays recursively.',
    'Escape literal & and < as &amp; and &lt;. Text fields contain plain text, not nested HTML. Numbers and booleans are plain literals.',
    'Text may appear while its tag is open. Numbers and booleans are published only after their tag closes. Arrays expose valid entries progressively; provide required fields before long arrays.',
    ...catalog,
  ].join('\n\n');
}
