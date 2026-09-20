import { useEffect, useRef } from 'react';
import { z } from 'zod';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { defineComponent } from 'streamtag-ui';
import { lineDefinition, tableDefinition } from './catalog';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  SVGRenderer,
]);

function RevenueChart({
  title,
  series,
}: z.output<typeof lineDefinition.schema>) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const instance = echarts.init(container.current, undefined, {
      renderer: 'svg',
    });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(
      {
        animation: false,
        color: ['#2563eb', '#94a3b8'],
        grid: { top: 32, bottom: 34, left: 42, right: 18 },
        tooltip: { trigger: 'axis' },
        legend: {
          top: 0,
          right: 8,
          icon: 'circle',
          itemWidth: 7,
          textStyle: { color: '#71717a', fontSize: 11 },
        },
        xAxis: {
          type: 'category',
          data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          boundaryGap: false,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#8b8b96' },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          interval: 25,
          axisLabel: { formatter: '${value}k', color: '#8b8b96' },
          splitLine: { lineStyle: { color: '#f0f0f3', type: 'dashed' } },
        },
        series: series.map((item, index) => ({
          id: String(index),
          name: item.name,
          data: item.data,
          type: 'line',
          smooth: false,
          symbolSize: 7,
          lineStyle: { width: 2.5 },
        })),
      },
      { replaceMerge: ['series'] },
    );
  }, [series]);

  return (
    <div
      className="chart-component"
      data-testid="line-chart"
      data-series={series.length}
      data-points={series.reduce((total, item) => total + item.data.length, 0)}
    >
      <h3>{title}</h3>
      <div
        ref={container}
        className="chart-canvas"
        role="img"
        aria-label={`${title}: ${series.map((item) => `${item.name}: ${item.data.join(', ')}`).join('; ')}`}
      />
      <div className="component-footnote">
        <span className="small-dot" /> React component{' '}
        <span>
          {series.reduce((total, item) => total + item.data.length, 0)} data
          points
        </span>
      </div>
    </div>
  );
}

function DataTable({ title, rows }: z.output<typeof tableDefinition.schema>) {
  return (
    <div data-testid="data-table">
      <h3>{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue</th>
            <th scope="col">Costs</th>
            <th scope="col">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.month}</th>
              <td>${row.revenue}k</td>
              <td>${row.cost}k</td>
              <td>
                <span className="margin-pill">
                  {row.revenue === 0
                    ? '—'
                    : `${Math.round(((row.revenue - row.cost) / row.revenue) * 100)}%`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="empty-rows">Waiting for the first complete row…</p>
      )}
    </div>
  );
}

export const components = [
  defineComponent({
    ...lineDefinition,
    component: RevenueChart,
    fallback: <div className="component-placeholder">Preparing chart…</div>,
  }),
  defineComponent({
    ...tableDefinition,
    component: DataTable,
    fallback: (
      <div className="component-placeholder">Waiting for valid table data…</div>
    ),
  }),
];
