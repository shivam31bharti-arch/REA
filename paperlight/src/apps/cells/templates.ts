import { cellKey } from './engine/address';
import { parseInput } from './engine/format';
import type { CellsDoc } from './files';
import { newId, newSheet, type Cell, type CellStyle, type ChartSpec, type Sheet, type Workbook } from './model';

export function blankBook(template?: CellsTemplate): CellsDoc {
  const source = template ?? CELLS_TEMPLATES[0];
  return { key: newId(), draftId: newId(), title: source.title, workbook: source.build(), filePath: null, dirty: false };
}

export interface CellsTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  build: () => Workbook;
}

type Entry = string | number | { text: string | number; style?: CellStyle };

/** Builds a sheet from rows of typed text, the same way typing them in would. */
function sheetFrom(name: string, rows: Entry[][], options: { widths?: Record<number, number>; styles?: Record<string, CellStyle>; charts?: Omit<ChartSpec, 'id'>[] } = {}): Sheet {
  const sheet = newSheet(name);
  rows.forEach((row, r) => {
    row.forEach((entry, c) => {
      const raw = typeof entry === 'object' ? entry.text : entry;
      const extra = typeof entry === 'object' ? entry.style : undefined;
      if (raw === '') {
        if (extra) sheet.cells[cellKey(r, c)] = { s: extra };
        return;
      }
      const cell: Cell = {};
      if (typeof raw === 'string' && raw.startsWith('=')) cell.f = raw.slice(1);
      else {
        const parsed = typeof raw === 'number' ? { value: raw } : parseInput(raw);
        cell.v = parsed.value;
        if ('format' in parsed && parsed.format) cell.s = { format: parsed.format };
      }
      if (extra) cell.s = { ...cell.s, ...extra };
      sheet.cells[cellKey(r, c)] = cell;
    });
  });
  for (const [key, style] of Object.entries(options.styles ?? {})) {
    sheet.cells[key] = { ...sheet.cells[key], s: { ...sheet.cells[key]?.s, ...style } };
  }
  sheet.cols = options.widths ?? {};
  sheet.charts = (options.charts ?? []).map((chart) => ({ ...chart, id: newId() }));
  return sheet;
}

const head = (text: string, align?: CellStyle['align']): Entry => ({ text, style: { bold: true, align } });
const money = (text: string | number): Entry => ({ text, style: { format: '$#,##0.00' } });
const whole = (text: string | number): Entry => ({ text, style: { format: '#,##0' } });
const bold = (text: string, format?: string): Entry => ({ text, style: { bold: true, format } });

export const CELLS_TEMPLATES: CellsTemplate[] = [
  {
    id: 'blank',
    name: 'Blank workbook',
    description: 'One empty sheet.',
    title: 'Untitled workbook',
    build: () => ({ sheets: [newSheet('Sheet 1')] }),
  },
  {
    id: 'channel',
    name: 'Channel numbers',
    description: 'Views, watch hours and revenue per video, with totals. Sample figures.',
    title: 'Channel numbers 2026',
    build: () => ({
      sheets: [
        sheetFrom(
          'Q3 videos',
          [
            [head('Video'), head('Published'), head('Views', 'right'), head('Watch hours', 'right'), head('CTR', 'right'), head('Revenue', 'right')],
            ['Office suite from scratch', { text: '2026-07-02', style: { format: 'd mmm yyyy' } }, whole(184210), whole(9640), '7.8%', money(1212.4)],
            ['Thumbnail tests', { text: '2026-07-16', style: { format: 'd mmm yyyy' } }, whole(96455), whole(4120), '6.1%', money(604.15)],
            ['Studio setup tour', { text: '2026-07-30', style: { format: 'd mmm yyyy' } }, whole(71980), whole(3310), '5.4%', money(455.9)],
            ['Viewer Q&A', { text: '2026-08-13', style: { format: 'd mmm yyyy' } }, whole(58302), whole(2875), '4.9%', money(361.25)],
            ['Desk build', { text: '2026-08-27', style: { format: 'd mmm yyyy' } }, whole(112640), whole(5980), '6.6%', money(742.8)],
            [bold('Total'), '', bold('=SUM(C2:C6)', '#,##0'), bold('=SUM(D2:D6)', '#,##0'), bold('=AVERAGE(E2:E6)', '0.0%'), bold('=SUM(F2:F6)', '$#,##0.00')],
          ],
          { widths: { 0: 232, 1: 118, 2: 112, 3: 120, 4: 84, 5: 120 } },
        ),
        sheetFrom(
          'Sponsors',
          [
            [head('Sponsor'), head('Video'), head('Status'), head('Amount', 'right')],
            ['Desk lamp brand', 'Desk build', 'Paid', money(400)],
            ['Note app', 'Office suite from scratch', 'Paid', money(650)],
            ['Microphone shop', 'Studio setup tour', 'Invoiced', money(300)],
            ['Keyboard maker', 'Next video', 'Agreed', money(500)],
            [],
            [bold('Paid'), '', '', bold('=SUMIF(C2:C5,"Paid",D2:D5)', '$#,##0.00')],
            [bold('Still to come'), '', '', bold('=SUM(D2:D5)-D7', '$#,##0.00')],
          ],
          { widths: { 0: 180, 1: 220, 2: 104, 3: 112 } },
        ),
        sheetFrom(
          'Upload plan',
          [
            [head('Week of'), head('Video'), head('Status')],
            [{ text: '2026-11-02', style: { format: 'd mmm yyyy' } }, 'Cells, the spreadsheet', 'Editing'],
            [{ text: '=A2+7', style: { format: 'd mmm yyyy' } }, 'Deck, the slides', 'Scripted'],
            [{ text: '=A3+7', style: { format: 'd mmm yyyy' } }, 'Paperlight tour', 'Idea'],
          ],
          { widths: { 0: 120, 1: 220, 2: 104 } },
        ),
      ],
    }),
  },
  {
    id: 'budget',
    name: 'Monthly budget',
    description: 'Income against spending by category, with what is left over. Sample figures.',
    title: 'Monthly budget',
    build: () => ({
      sheets: [
        sheetFrom(
          'November',
          [
            [head('Income'), head('Amount', 'right'), head('Share', 'right')],
            ['Salary', money(3200), { text: '=B2/$B$5', style: { format: '0.0%' } }],
            ['Freelance', money(850), { text: '=B3/$B$5', style: { format: '0.0%' } }],
            ['Channel', money(420), { text: '=B4/$B$5', style: { format: '0.0%' } }],
            [bold('Total income'), bold('=SUM(B2:B4)', '$#,##0.00'), ''],
            [],
            [head('Spending'), head('Amount', 'right'), head('Share of income', 'right')],
            ['Rent', money(1350), { text: '=B8/$B$5', style: { format: '0.0%' } }],
            ['Food', money(520), { text: '=B9/$B$5', style: { format: '0.0%' } }],
            ['Transport', money(140), { text: '=B10/$B$5', style: { format: '0.0%' } }],
            ['Gear', money(260), { text: '=B11/$B$5', style: { format: '0.0%' } }],
            ['Software', money(75), { text: '=B12/$B$5', style: { format: '0.0%' } }],
            ['Savings', money(900), { text: '=B13/$B$5', style: { format: '0.0%' } }],
            [bold('Total spending'), bold('=SUM(B8:B13)', '$#,##0.00'), bold('=B14/$B$5', '0.0%')],
            [],
            [bold('Left over'), bold('=B5-B14', '$#,##0.00'), { text: '=IF(B16<0,"Over budget","On track")', style: { bold: true } }],
          ],
          {
            widths: { 0: 180, 1: 120, 2: 140 },
            charts: [
              {
                kind: 'pie',
                title: 'Where the money goes',
                range: { top: 6, left: 0, bottom: 12, right: 1 },
                anchor: { row: 1, col: 3 },
                width: 420,
                height: 300,
              },
            ],
          },
        ),
      ],
    }),
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Line items with quantity and rate, tax and a total.',
    title: 'Invoice',
    build: () => ({
      sheets: [
        sheetFrom(
          'Invoice',
          [
            [{ text: 'Invoice', style: { bold: true } }, '', '', ''],
            ['Number', 'INV-0001', '', ''],
            ['Date', { text: '=TODAY()', style: { format: 'd mmm yyyy' } }, '', ''],
            ['Bill to', 'Client name', '', ''],
            [],
            [head('Item'), head('Quantity', 'right'), head('Rate', 'right'), head('Amount', 'right')],
            ['Video editing, hours', 12, money(45), { text: '=B7*C7', style: { format: '$#,##0.00' } }],
            ['Thumbnail design', 3, money(60), { text: '=B8*C8', style: { format: '$#,##0.00' } }],
            ['Script review', 1, money(120), { text: '=B9*C9', style: { format: '$#,##0.00' } }],
            [],
            ['', '', 'Subtotal', { text: '=SUM(D7:D9)', style: { format: '$#,##0.00' } }],
            ['', '', 'Tax rate', '10%'],
            ['', '', 'Tax', { text: '=ROUND(D11*D12,2)', style: { format: '$#,##0.00' } }],
            ['', '', bold('Total'), bold('=D11+D13', '$#,##0.00')],
          ],
          { widths: { 0: 220, 1: 124, 2: 112, 3: 120 } },
        ),
      ],
    }),
  },
];
