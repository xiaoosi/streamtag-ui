import { useMemo, useState } from 'react';
import { ArrowUpDown, Check, Circle } from 'lucide-react';
import { defineComponent } from 'streamtag-ui';
import type { z } from 'zod';
import {
  lineDefinition,
  metricDefinition,
  stepsDefinition,
  tableDefinition,
} from '../../shared/catalog';

const palette = ['#3975e8', '#14a38b', '#b084df', '#eb9a42', '#e56b7a'];
const formatNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

function MetricCard({
  label,
  value,
  unit,
  change,
  tone,
}: z.output<typeof metricDefinition.schema>) {
  return (
    <div className="metric-card" data-testid="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {formatNumber.format(value)}
        <span>{unit}</span>
      </div>
      {change && <div className={`metric-change ${tone}`}>{change}</div>}
    </div>
  );
}

function LineChart({
  title,
  unit,
  series,
}: z.output<typeof lineDefinition.schema>) {
  const [hidden, setHidden] = useState<number[]>([]);
  const [hover, setHover] = useState<{ series: number; point: number } | null>(
    null,
  );
  const labels = [
    ...new Set(
      series.flatMap((item) => item.points.map((point) => point.label)),
    ),
  ];
  const values = series.flatMap((item, index) =>
    hidden.includes(index) ? [] : item.points.map((point) => point.value),
  );
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const roughStep = (high - low) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step =
    [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= roughStep)! *
    magnitude;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step,
  );
  const left = 62,
    top = 22,
    width = 670,
    height = 224;
  const x = (label: string) =>
    left +
    (labels.length <= 1
      ? width / 2
      : (labels.indexOf(label) / (labels.length - 1)) * width);
  const y = (value: number) =>
    top + height - ((value - min) / (max - min)) * height;
  const selected = hover
    ? series[hover.series]?.points[hover.point]
    : undefined;
  const pointCount = series.reduce(
    (count, item) => count + item.points.length,
    0,
  );

  return (
    <section
      className="chart-card"
      data-testid="line-chart"
      data-series={series.length}
      data-points={pointCount}
    >
      <div className="component-title">
        <h3>{title}</h3>
        {unit && <span>{unit}</span>}
      </div>
      <div className="chart-legend">
        {series.map((item, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={!hidden.includes(index)}
            className={hidden.includes(index) ? 'is-hidden' : ''}
            onClick={() =>
              setHidden((current) =>
                current.includes(index)
                  ? current.filter((value) => value !== index)
                  : [...current, index],
              )
            }
          >
            <i style={{ background: palette[index % palette.length] }} />
            {item.name || '…'}
          </button>
        ))}
        {!series.length && (
          <span className="muted small">Waiting for the first series…</span>
        )}
      </div>
      <div className="chart-wrap">
        <svg
          viewBox="0 0 760 280"
          role="img"
          aria-label={`${title}, ${series.length} series, ${pointCount} data ${pointCount === 1 ? 'point' : 'points'}`}
        >
          <title>{title}</title>
          {ticks.map((value) => {
            return (
              <g key={value}>
                <line
                  x1={left}
                  x2={left + width}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#edf0f4"
                  strokeDasharray="4 4"
                />
                <text
                  x={left - 12}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="axis-label"
                >
                  {formatNumber.format(value)}
                </text>
              </g>
            );
          })}
          {labels.map((label, index) =>
            index % Math.max(1, Math.ceil(labels.length / 8)) === 0 ||
            index === labels.length - 1 ? (
              <text
                key={label}
                x={x(label)}
                y={270}
                textAnchor="middle"
                className="axis-label"
              >
                {label.length > 9 ? `${label.slice(0, 8)}…` : label}
              </text>
            ) : null,
          )}
          {series.map((item, index) =>
            hidden.includes(index) ? null : (
              <g key={index}>
                <polyline
                  fill="none"
                  stroke={palette[index % palette.length]}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={item.points
                    .map((point) => `${x(point.label)},${y(point.value)}`)
                    .join(' ')}
                />
                {item.points.map((point, pointIndex) => (
                  <g key={pointIndex}>
                    <circle
                      cx={x(point.label)}
                      cy={y(point.value)}
                      r={3.5}
                      fill="white"
                      stroke={palette[index % palette.length]}
                      strokeWidth="2"
                    />
                    <circle
                      cx={x(point.label)}
                      cy={y(point.value)}
                      r={12}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${item.name} ${point.label}: ${point.value}${unit}`}
                      onMouseEnter={() =>
                        setHover({ series: index, point: pointIndex })
                      }
                      onMouseLeave={() => setHover(null)}
                      onFocus={() =>
                        setHover({ series: index, point: pointIndex })
                      }
                      onBlur={() => setHover(null)}
                    />
                  </g>
                ))}
              </g>
            ),
          )}
        </svg>
        {selected && hover && (
          <div className="chart-tooltip" role="status">
            {series[hover.series]?.name} · {selected.label}
            <strong>
              {formatNumber.format(selected.value)} {unit}
            </strong>
          </div>
        )}
      </div>
    </section>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: z.output<typeof tableDefinition.schema>) {
  const [sort, setSort] = useState<{ index: number; direction: number } | null>(
    null,
  );
  const ordered = useMemo(
    () =>
      sort
        ? [...rows].sort(
            (a, b) =>
              (a.cells[sort.index] || '').localeCompare(
                b.cells[sort.index] || '',
                'en-US',
                { numeric: true },
              ) * sort.direction,
          )
        : rows,
    [rows, sort],
  );
  return (
    <section
      className="table-card"
      data-testid="data-table"
      data-rows={rows.length}
    >
      <div className="component-title">
        <h3>{title}</h3>
        <span>
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  aria-sort={
                    sort?.index === index
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() =>
                      setSort((current) => ({
                        index,
                        direction:
                          current?.index === index ? -current.direction : 1,
                      }))
                    }
                  >
                    {column}
                    <ArrowUpDown size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row, index) => (
              <tr key={index}>
                {columns.map((_, column) => (
                  <td key={column}>{row.cells[column] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="component-empty">Waiting for the first row…</p>
      )}
    </section>
  );
}

function TaskList({ title, items }: z.output<typeof stepsDefinition.schema>) {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  return (
    <section className="task-card" data-testid="task-list">
      <div className="component-title">
        <h3>{title}</h3>
      </div>
      <div className="task-items">
        {items.map((item, index) => {
          const checked = overrides[index] ?? item.status === 'done';
          return (
            <label
              key={index}
              className={`task-item ${checked ? 'is-done' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  setOverrides((value) => ({
                    ...value,
                    [index]: event.target.checked,
                  }))
                }
              />
              <span className="task-check">
                {checked ? (
                  <Check size={13} />
                ) : item.status === 'doing' ? (
                  <Circle size={9} fill="currentColor" />
                ) : null}
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

const placeholder = (
  <div className="component-loading">
    <span />
    Receiving component data…
  </div>
);
export const components = [
  defineComponent({
    ...metricDefinition,
    component: MetricCard,
    fallback: placeholder,
  }),
  defineComponent({
    ...lineDefinition,
    component: LineChart,
    fallback: placeholder,
  }),
  defineComponent({
    ...tableDefinition,
    component: DataTable,
    fallback: placeholder,
  }),
  defineComponent({
    ...stepsDefinition,
    component: TaskList,
    fallback: placeholder,
  }),
];
