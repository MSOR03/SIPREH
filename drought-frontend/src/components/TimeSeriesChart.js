'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';

/**
 * Simple 1‑D time series chart component using Recharts.
 *
 * Props:
 *   data     - array of objects containing { [xKey]:..., [dataKey]:... }
 *   xKey     - key name for x axis (default 'date')
 *   dataKey  - key name for y values (default 'value')
 *   type     - 'line' or 'area' (default 'line')
 *   width    - width for ResponsiveContainer (default '100%')
 *   height   - height (default 300)
 *   stroke   - colour of line/area border
 *   fill     - fill colour when type='area'
 */
export default function TimeSeriesChart({
  data = [],
  xKey = 'date',
  dataKey = 'value',
  type = 'line',
  width = '100%',
  height = 300,
  stroke = '#2563eb',
  fill = '#2563eb33',
}) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => {
            if (v instanceof Date) return v.toLocaleDateString();
            return v;
          }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        {type === 'area' ? (
          <Area type="monotone" dataKey={dataKey} stroke={stroke} fill={fill} />
        ) : (
          <Line type="monotone" dataKey={dataKey} stroke={stroke} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}