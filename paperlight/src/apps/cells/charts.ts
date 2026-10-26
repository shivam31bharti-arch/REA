import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Title,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';
import { cellKey } from './engine/address';
import { formatValue } from './engine/format';
import { isError, type CellValue } from './engine/values';
import type { ChartKind, ChartSpec, Sheet } from './model';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, PieController, ArcElement, CategoryScale, LinearScale, Legend, Tooltip, Title);

export interface ChartSeries {
  name: string;
  values: (number | null)[];
  format?: string;
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

const SERIES = {
  light: ['#2448D8', '#111111', '#D63A22', '#0B7A6C', '#C99A12', '#8F8F8C'],
  dark: ['#7D97FF', '#EDEDED', '#F26B54', '#3FBFA9', '#F2C230', '#8F8F8C'],
};

const INK = {
  light: { text: '#262626', muted: '#595959', grid: '#EEEEEC', seam: '#111111', page: '#FFFFFF' },
  dark: { text: '#D6D6D6', muted: '#A6A6A6', grid: '#242424', seam: '#3A3A3A', page: '#171717' },
};

const FONT = 'Geist, "Segoe UI Variable", system-ui, sans-serif';

function isDateFormat(format: string | undefined) {
  return !!format && /[yd]/i.test(format.replace(/"[^"]*"/g, '')) && !/[0#]/.test(format);
}

/**
 * Reads a chart's range: a first row of names becomes series names, a first column of text
 * (or dates) becomes the labels, and every other numeric column becomes a series.
 */
export function chartData(sheet: Sheet, spec: ChartSpec, value: (row: number, col: number) => CellValue, text: (row: number, col: number) => string): ChartData {
  const { top, left, bottom, right } = spec.range;
  const format = (row: number, col: number) => sheet.cells[cellKey(row, col)]?.s?.format;
  let headerRow = false;
  if (bottom > top) {
    let textCount = 0;
    let numberCount = 0;
    for (let col = left; col <= right; col += 1) {
      const v = value(top, col);
      if (typeof v === 'string') textCount += 1;
      if (typeof v === 'number') numberCount += 1;
    }
    headerRow = textCount > 0 && numberCount === 0;
  }
  const firstData = headerRow ? top + 1 : top;
  const labelCol = (() => {
    for (let row = firstData; row <= bottom; row += 1) {
      const v = value(row, left);
      if (typeof v === 'string' || isDateFormat(format(row, left))) return true;
    }
    return false;
  })();

  const labels: string[] = [];
  for (let row = firstData; row <= bottom; row += 1) labels.push(labelCol ? text(row, left) : String(row - firstData + 1));

  const series: ChartSeries[] = [];
  for (let col = labelCol ? left + 1 : left; col <= right; col += 1) {
    let numeric = 0;
    let dated = false;
    for (let row = firstData; row <= bottom; row += 1) {
      if (typeof value(row, col) === 'number') numeric += 1;
      if (isDateFormat(format(row, col))) dated = true;
    }
    if (numeric === 0 || dated) continue;
    const values: (number | null)[] = [];
    for (let row = firstData; row <= bottom; row += 1) {
      const v = value(row, col);
      values.push(typeof v === 'number' && !isError(v) ? v : null);
    }
    series.push({
      name: headerRow ? text(top, col) || `Series ${series.length + 1}` : `Series ${series.length + 1}`,
      values,
      format: format(firstData, col),
    });
  }
  return { labels, series };
}

const background: Plugin = {
  id: 'paperlight-background',
  beforeDraw(chart, _args, options: { color?: string }) {
    if (!options.color) return;
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = options.color;
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

export function chartConfig(kind: ChartKind, data: ChartData, theme: 'light' | 'dark', options: { title?: string; animate?: boolean; fill?: boolean } = {}): ChartConfiguration {
  const palette = SERIES[theme];
  const ink = INK[theme];
  const format = data.series[0]?.format;
  const tick = (value: number | string) => (typeof value === 'number' ? formatValue(value, format && !format.includes('%') ? format.replace(/\.0+/, '') : format) : value);
  const font = { family: FONT, size: 12 };
  const pie = kind === 'pie';
  const datasets = (pie ? data.series.slice(0, 1) : data.series).map((series, index) => ({
    label: series.name,
    data: series.values,
    backgroundColor: pie ? data.labels.map((_, i) => palette[i % palette.length]) : palette[index % palette.length],
    borderColor: pie ? ink.page : palette[index % palette.length],
    borderWidth: pie ? 2 : kind === 'line' ? 2 : 0,
    borderRadius: 0,
    maxBarThickness: 56,
    pointRadius: kind === 'line' ? 3 : 0,
    pointBackgroundColor: palette[index % palette.length],
    tension: 0,
  }));

  return {
    type: kind === 'column' || kind === 'bar' ? 'bar' : kind,
    data: { labels: data.labels, datasets },
    plugins: [background],
    options: {
      responsive: false,
      maintainAspectRatio: false,
      indexAxis: kind === 'bar' ? 'y' : 'x',
      animation: options.animate === false ? false : { duration: 200, easing: 'easeOutQuart' },
      layout: { padding: { top: options.title ? 4 : 12, right: 16, bottom: 8, left: 8 } },
      plugins: {
        'paperlight-background': { color: options.fill ? ink.page : undefined },
        title: options.title
          ? { display: true, text: options.title, align: 'start', color: ink.text, font: { family: FONT, size: 16, weight: 700 }, padding: { top: 12, bottom: 12 } }
          : { display: false },
        legend: {
          display: pie || data.series.length > 1,
          position: 'bottom',
          align: 'start',
          labels: { color: ink.muted, font, boxWidth: 10, boxHeight: 10, padding: 14 },
        },
        tooltip: {
          backgroundColor: theme === 'dark' ? '#EDEDED' : '#111111',
          titleColor: theme === 'dark' ? '#111111' : '#FFFFFF',
          bodyColor: theme === 'dark' ? '#111111' : '#FFFFFF',
          titleFont: { ...font, weight: 600 },
          bodyFont: font,
          cornerRadius: 0,
          displayColors: data.series.length > 1 || pie,
          callbacks: {
            label: (item) => {
              const series = data.series[pie ? 0 : item.datasetIndex];
              const raw = item.raw as number | null;
              return `${pie ? item.label : series?.name}: ${raw === null ? '' : formatValue(raw, series?.format)}`;
            },
          },
        },
      },
      scales: pie
        ? {}
        : {
            [kind === 'bar' ? 'y' : 'x']: {
              grid: { display: false },
              border: { color: ink.seam },
              ticks: { color: ink.muted, font, maxRotation: 0, autoSkip: true },
            },
            [kind === 'bar' ? 'x' : 'y']: {
              beginAtZero: true,
              grid: { color: ink.grid },
              border: { display: false },
              ticks: { color: ink.muted, font, callback: (value) => tick(value as number), maxTicksLimit: 6 },
            },
          },
    },
  } as ChartConfiguration;
}

/** A light-theme picture of the chart, with its title, for saving into .xlsx files. */
export function chartPicture(spec: ChartSpec, data: ChartData): string {
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = spec.width;
  canvas.height = spec.height;
  const config = chartConfig(spec.kind, data, 'light', { title: spec.title, animate: false, fill: true });
  config.options = { ...config.options, devicePixelRatio: scale };
  const chart = new Chart(canvas, config);
  const url = chart.toBase64Image('image/png');
  chart.destroy();
  return url;
}

export { Chart };
