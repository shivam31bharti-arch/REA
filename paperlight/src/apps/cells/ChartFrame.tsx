import { ChartBar, ChartColumn, ChartLine, ChartPie, MoreHorizontal, Pencil, Table2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Menu } from '../../ui/Menu';
import { rectName } from './engine/address';
import { Chart, chartConfig, type ChartData } from './charts';
import type { ChartKind, ChartSpec } from './model';

const KIND_ICONS = { column: ChartColumn, bar: ChartBar, line: ChartLine, pie: ChartPie } as const;
const KIND_LABELS = { column: 'Column chart', bar: 'Bar chart', line: 'Line chart', pie: 'Pie chart' } as const;
const HEADER_H = 40;
const MIN_W = 280;
const MIN_H = 200;

interface ChartFrameProps {
  spec: ChartSpec;
  data: ChartData;
  left: number;
  top: number;
  theme: 'light' | 'dark';
  selected: boolean;
  onSelect: () => void;
  onMove: (left: number, top: number) => void;
  onResize: (width: number, height: number) => void;
  onKind: (kind: ChartKind) => void;
  onRename: () => void;
  onSelectData: () => void;
  onDelete: () => void;
}

/** A chart floating over the grid, live with the cells it reads. */
export function ChartFrame(props: ChartFrameProps) {
  const { spec, data, theme } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const width = size?.width ?? spec.width;
  const height = size?.height ?? spec.height;
  const plotHeight = height - HEADER_H;
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current?.destroy();
    canvas.width = width;
    canvas.height = plotHeight;
    const config = chartConfig(spec.kind, data, theme, { animate });
    config.options = { ...config.options, devicePixelRatio: window.devicePixelRatio || 1 };
    chartRef.current = new Chart(canvas, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Rebuilt when the shape changes; data updates go through chart.update below.
  }, [animate, spec.kind, theme, width, plotHeight]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const next = chartConfig(spec.kind, data, theme, { animate });
    chart.data = next.data;
    chart.options = { ...next.options, devicePixelRatio: window.devicePixelRatio || 1 } as typeof chart.options;
    chart.update();
  }, [animate, data, spec.kind, theme]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSelect();
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let latest = { dx: 0, dy: 0 };
    const move = (e: PointerEvent) => {
      latest = { dx: e.clientX - startX, dy: e.clientY - startY };
      setDrag(latest);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setDrag(null);
      if (latest.dx || latest.dy) props.onMove(props.left + latest.dx, props.top + latest.dy);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const startResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let latest = { width: spec.width, height: spec.height };
    const move = (e: PointerEvent) => {
      latest = {
        width: Math.max(MIN_W, Math.round(spec.width + e.clientX - startX)),
        height: Math.max(MIN_H, Math.round(spec.height + e.clientY - startY)),
      };
      setSize(latest);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setSize(null);
      props.onResize(latest.width, latest.height);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const KindIcon = KIND_ICONS[spec.kind];
  const empty = data.series.length === 0;

  return (
    <div
      className="pl-chart"
      data-selected={props.selected || undefined}
      data-dragging={drag ? true : undefined}
      style={{ left: props.left, top: props.top, width, height, transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined }}
      onPointerDown={(event) => {
        event.stopPropagation();
        props.onSelect();
      }}
      role="figure"
      aria-label={`${KIND_LABELS[spec.kind]}: ${spec.title || 'Untitled chart'}, from ${rectName(spec.range)}`}
    >
      <div className="pl-chart-head" onPointerDown={startDrag}>
        <span className="pl-chart-title">{spec.title || 'Untitled chart'}</span>
        <span className="pl-chart-source">{rectName(spec.range)}</span>
        <Menu
          label="Chart type"
          className="pl-btn pl-btn--icon"
          align="end"
          width={200}
          items={(Object.keys(KIND_ICONS) as ChartKind[]).map((kind) => {
            const Icon = KIND_ICONS[kind];
            return { id: kind, label: KIND_LABELS[kind], icon: <Icon />, active: kind === spec.kind, onSelect: () => props.onKind(kind) };
          })}
        >
          <KindIcon aria-hidden="true" />
        </Menu>
        <Menu
          label="Chart actions"
          className="pl-btn pl-btn--icon"
          align="end"
          width={220}
          items={[
            { id: 'rename', label: 'Rename chart…', icon: <Pencil />, onSelect: props.onRename },
            { id: 'data', label: 'Select its data', icon: <Table2 />, onSelect: props.onSelectData },
            { separator: true, id: 'sep' },
            { id: 'delete', label: 'Delete chart', icon: <Trash2 />, danger: true, onSelect: props.onDelete },
          ]}
        >
          <MoreHorizontal aria-hidden="true" />
        </Menu>
      </div>
      <div className="pl-chart-plot" style={{ height: plotHeight }}>
        <canvas ref={canvasRef} style={{ width, height: plotHeight }} aria-hidden="true" />
        {empty && <p className="pl-chart-empty">No numbers in {rectName(spec.range)} to chart yet.</p>}
      </div>
      <span className="pl-chart-resize" onPointerDown={startResize} aria-hidden="true" />
    </div>
  );
}
