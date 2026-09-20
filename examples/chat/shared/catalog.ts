import { z } from 'zod';

export const metricDefinition = {
  name: 'metric-card',
  description:
    'A key metric. value is a complete number; unit is an optional suffix, e.g. $k, %, users. change is a short comparison, e.g. +12% vs. last month. tone controls the comparison color.',
  schema: z.object({
    label: z.string(),
    value: z.number(),
    unit: z.string().default(''),
    change: z.string().default(''),
    tone: z.enum(['neutral', 'positive', 'negative']).default('neutral'),
  }),
  example:
    '<metric-card><label>Monthly revenue</label><value>128</value><unit>$k</unit><change>+12% vs. last month</change><tone>positive</tone></metric-card>',
};

export const lineDefinition = {
  name: 'line-chart',
  description:
    'An interactive line chart. Each series contains a name and ordered points, each with label (x-axis category) and numeric value. Output all points of one series before the next. Use the same labels across series. Series and points render progressively. unit is an optional y-axis unit.',
  schema: z.object({
    title: z.string(),
    unit: z.string().default(''),
    series: z
      .array(
        z.object({
          name: z.string(),
          points: z
            .array(z.object({ label: z.string(), value: z.number() }))
            .default([]),
        }),
      )
      .default([]),
  }),
  example:
    '<line-chart><title>Revenue trend</title><unit>$k</unit><series><item><name>Revenue</name><points><item><label>Jan</label><value>58</value></item><item><label>Feb</label><value>72</value></item></points></item></series></line-chart>',
};

export const tableDefinition = {
  name: 'data-table',
  description:
    'A sortable data table. Write columns first, then rows. Each row has cells: an array of display strings, one per column. Keep column and cell counts equal.',
  schema: z.object({
    title: z.string(),
    columns: z.array(z.string()).default([]),
    rows: z
      .array(z.object({ cells: z.array(z.string()).default([]) }))
      .default([]),
  }),
  example:
    '<data-table><title>Channels</title><columns><item>Channel</item><item>Revenue</item></columns><rows><item><cells><item>Organic</item><item>$32k</item></cells></item></rows></data-table>',
};

export const stepsDefinition = {
  name: 'task-list',
  description:
    'A checklist or itinerary with interactive checkboxes. Each item has title, optional detail, and status: pending, doing, or done. Order items chronologically for itineraries.',
  schema: z.object({
    title: z.string(),
    items: z
      .array(
        z.object({
          title: z.string(),
          detail: z.string().default(''),
          status: z.enum(['pending', 'doing', 'done']).default('pending'),
        }),
      )
      .default([]),
  }),
};

export const catalog = [
  metricDefinition,
  lineDefinition,
  tableDefinition,
  stepsDefinition,
];
