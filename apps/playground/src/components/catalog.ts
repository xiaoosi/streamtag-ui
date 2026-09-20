import { z } from 'zod';

export const lineDefinition = {
  name: 'line-chart',
  description:
    'A line chart showing monthly values in thousands, from January to June. Series and data points appear progressively.',
  schema: z.object({
    title: z.string(),
    series: z
      .array(
        z.object({ name: z.string(), data: z.array(z.number()).default([]) }),
      )
      .default([]),
  }),
  example:
    '<line-chart><title>Revenue</title><series><item><name>Sales</name><data><item>58</item><item>62</item></data></item></series></line-chart>',
};

export const tableDefinition = {
  name: 'data-table',
  description:
    'A monthly table of revenue and costs, in thousands. A row appears when all its required fields are available.',
  schema: z.object({
    title: z.string(),
    rows: z
      .array(
        z.object({ month: z.string(), revenue: z.number(), cost: z.number() }),
      )
      .default([]),
  }),
};

// This module can be shared with a model-calling server without importing React or ECharts.
export const catalog = [lineDefinition, tableDefinition];
