import { z } from 'zod';
import { defineComponent } from 'streamtag-ui';

export const activityDefinition = {
  name: 'activity-feed',
  description:
    'A team activity list. Each entry appears once its required fields pass validation.',
  schema: z.object({
    title: z.string(),
    items: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          detail: z.string(),
          status: z.enum(['Completed', 'In review', 'Queued']),
        }),
      )
      .default([]),
  }),
};

const statusClasses = {
  Completed: 'bg-emerald-50 text-emerald-700',
  'In review': 'bg-blue-50 text-blue-700',
  Queued: 'bg-slate-100 text-slate-600',
};

export const activityFeed = defineComponent({
  ...activityDefinition,
  component: ({ title, items }) => (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      data-testid="activity-feed"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="m-0 text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs tabular-nums text-slate-500">
          {items.length} updates
        </span>
      </div>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-medium text-slate-800">
                {item.title}
              </p>
              <p className="mt-1 mb-0 text-xs leading-5 text-slate-500">
                {item.detail}
              </p>
            </div>
            <span
              className={`rounded-md px-2 py-1 text-xs font-medium ${statusClasses[item.status]}`}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="m-0 px-5 py-6 text-sm text-slate-500">
          Waiting for the first update…
        </p>
      )}
    </section>
  ),
});

export const components = [activityFeed];
