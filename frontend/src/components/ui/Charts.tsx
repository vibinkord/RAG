import React, { useEffect, useRef, useState } from 'react';

// Hook to make SVG charts responsive to container size
function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ 
        width: width || 300, 
        height: height || 200 
      });
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return { ref, dimensions };
}

// -------------------------------------------------------------
// 1. Donut Pie Chart (Website Status Distribution)
// -------------------------------------------------------------
interface PieDataPoint {
  name: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieDataPoint[];
}

export const PieChart: React.FC<PieChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const size = 160;
  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
      {/* Circle Donut Graph */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1F2937"
            strokeWidth={strokeWidth}
          />
          {total > 0 && data.map((item, index) => {
            const percentage = item.value / total;
            const strokeLength = percentage * circumference;
            const strokeOffset = circumference - strokeLength + currentOffset;
            currentOffset -= strokeLength;

            return (
              <circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                title={`${item.name}: ${item.value}`}
              />
            );
          })}
        </svg>

        {/* Text overlay in the middle of donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold font-mono text-white">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Websites</span>
        </div>
      </div>

      {/* Legends list */}
      <div className="flex flex-col gap-2.5">
        {data.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={index} className="flex items-center gap-2.5 text-xs text-zinc-400">
              <span 
                className="h-2.5 w-2.5 rounded-full shrink-0" 
                style={{ backgroundColor: item.color }} 
              />
              <span className="font-medium text-zinc-300 min-w-16">{item.name}</span>
              <span className="font-mono text-zinc-400 font-semibold">{item.value}</span>
              <span className="font-mono text-zinc-500 text-[10px]">({percent}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. Line Chart (Knowledge Base Growth: Pages, Chunks, Embeddings)
// -------------------------------------------------------------
interface LineChartDataPoint {
  name: string; // date/label
  pages: number;
  chunks: number;
  embeddings: number;
}

interface LineChartProps {
  data: LineChartDataPoint[];
}

export const LineChart: React.FC<LineChartProps> = ({ data }) => {
  const { ref, dimensions } = useResizeObserver<HTMLDivElement>();
  const { width, height } = dimensions;

  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find max value to calibrate Y axis
  const maxVal = Math.max(
    ...data.flatMap(d => [d.pages, d.chunks, d.embeddings]),
    10 // fallback minimum max
  );
  // Round maxVal to nice increment
  const roundedMax = Math.ceil(maxVal * 1.15);

  const getCoordinates = (index: number, value: number) => {
    const x = paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (value / roundedMax) * chartHeight;
    return { x, y };
  };

  // Build SVG Paths for lines
  const generatePath = (key: 'pages' | 'chunks' | 'embeddings') => {
    if (data.length === 0) return '';
    return data.map((d, i) => {
      const { x, y } = getCoordinates(i, d[key]);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const pagesPath = generatePath('pages');
  const chunksPath = generatePath('chunks');
  const embeddingsPath = generatePath('embeddings');

  // Y axis ticks
  const yTicksCount = 4;
  const yTicks = Array.from({ length: yTicksCount }, (_, i) => {
    const value = Math.round((roundedMax / (yTicksCount - 1)) * i);
    const y = paddingTop + chartHeight - (value / roundedMax) * chartHeight;
    return { value, y };
  });

  return (
    <div ref={ref} className="w-full h-64 select-none relative">
      <svg width={width} height={height}>
        {/* Horizontal Grid lines & Y Axis Labels */}
        {yTicks.map((tick, index) => (
          <g key={index}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="#334155"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94A3B8"
              fontSize={10}
              fontFamily="monospace"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {data.map((d, index) => {
          const { x } = getCoordinates(index, 0);
          return (
            <text
              key={index}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={10}
              fontFamily="sans-serif"
            >
              {d.name}
            </text>
          );
        })}

        {/* Lines */}
        {data.length > 0 && (
          <>
            {/* Pages line (Green) */}
            <path
              d={pagesPath}
              fill="none"
              stroke="#10B981"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Chunks line (Orange) */}
            <path
              d={chunksPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Embeddings line (Blue) */}
            <path
              d={embeddingsPath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Points markers for latest value */}
            {(() => {
              const lastIndex = data.length - 1;
              const p = getCoordinates(lastIndex, data[lastIndex].pages);
              const c = getCoordinates(lastIndex, data[lastIndex].chunks);
              const e = getCoordinates(lastIndex, data[lastIndex].embeddings);
              return (
                <g>
                  <circle cx={p.x} cy={p.y} r={4} fill="#10B981" stroke="#0F172A" strokeWidth={1.5} />
                  <circle cx={c.x} cy={c.y} r={4} fill="#F59E0B" stroke="#0F172A" strokeWidth={1.5} />
                  <circle cx={e.x} cy={e.y} r={4} fill="#3B82F6" stroke="#0F172A" strokeWidth={1.5} />
                </g>
              );
            })()}
          </>
        )}
      </svg>

      {/* Float Legend inside graph */}
      <div className="absolute top-2 right-4 flex items-center gap-3 bg-[#111827]/80 backdrop-blur border border-[#334155] rounded px-2.5 py-1 text-[10px]">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="h-1.5 w-3 bg-[#10B981] rounded-sm inline-block" />
          <span>Pages</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="h-1.5 w-3 bg-[#F59E0B] rounded-sm inline-block" />
          <span>Chunks</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="h-1.5 w-3 bg-[#3B82F6] rounded-sm inline-block" />
          <span>Embeddings</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. Area Chart (Query Activity count)
// -------------------------------------------------------------
interface AreaChartDataPoint {
  name: string; // date/day
  queries: number;
}

interface AreaChartProps {
  data: AreaChartDataPoint[];
}

export const AreaChart: React.FC<AreaChartProps> = ({ data }) => {
  const { ref, dimensions } = useResizeObserver<HTMLDivElement>();
  const { width, height } = dimensions;

  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => d.queries), 5);
  const roundedMax = Math.ceil(maxVal * 1.2);

  const getCoordinates = (index: number, value: number) => {
    const x = paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (value / roundedMax) * chartHeight;
    return { x, y };
  };

  // Area paths: line path + closing corners
  const generatePaths = () => {
    if (data.length === 0) return { strokePath: '', fillPath: '' };
    
    const points = data.map((d, i) => getCoordinates(i, d.queries));
    
    const strokePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    
    const startCorner = getCoordinates(0, 0);
    const endCorner = getCoordinates(data.length - 1, 0);
    const fillPath = `${strokePath} L ${endCorner.x.toFixed(1)} ${endCorner.y.toFixed(1)} L ${startCorner.x.toFixed(1)} ${startCorner.y.toFixed(1)} Z`;
    
    return { strokePath, fillPath };
  };

  const { strokePath, fillPath } = generatePaths();

  // Y ticks
  const yTicksCount = 4;
  const yTicks = Array.from({ length: yTicksCount }, (_, i) => {
    const value = Math.round((roundedMax / (yTicksCount - 1)) * i);
    const y = paddingTop + chartHeight - (value / roundedMax) * chartHeight;
    return { value, y };
  });

  return (
    <div ref={ref} className="w-full h-60 select-none relative">
      <svg width={width} height={height}>
        {/* Gradients */}
        <defs>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((tick, index) => (
          <g key={index}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="#334155"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94A3B8"
              fontSize={10}
              fontFamily="monospace"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {data.map((d, index) => {
          const { x } = getCoordinates(index, 0);
          return (
            <text
              key={index}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={10}
              fontFamily="sans-serif"
            >
              {d.name}
            </text>
          );
        })}

        {/* Fill Area */}
        {data.length > 0 && (
          <path
            d={fillPath}
            fill="url(#area-gradient)"
          />
        )}

        {/* Outline Line */}
        {data.length > 0 && (
          <path
            d={strokePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Hover markers */}
        {data.map((d, index) => {
          const { x, y } = getCoordinates(index, d.queries);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={3.5}
              fill="#3B82F6"
              stroke="#0F172A"
              strokeWidth={1.5}
              className="cursor-pointer transition-transform duration-100 hover:scale-150"
              title={`${d.name}: ${d.queries} queries`}
            />
          );
        })}
      </svg>
    </div>
  );
};
