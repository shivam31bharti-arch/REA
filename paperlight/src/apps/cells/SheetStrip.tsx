import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Menu } from '../../ui/Menu';
import { stripBarWidth } from '../../ui/strip';
import { sheetExtent, type Sheet } from './model';

interface SheetStripProps {
  title: string;
  sheets: Sheet[];
  current: number;
  onSelect: (index: number) => void;
  onNew: () => void;
  onRename: (index: number) => void;
  onDuplicate: (index: number) => void;
  onMove: (index: number, to: number) => void;
  onDelete: (index: number) => void;
}

/** The workbook's sheets, numbered like Jotbook pages, each with a bar for how many rows it holds. */
export function SheetStrip({ title, sheets, current, onSelect, onNew, onRename, onDuplicate, onMove, onDelete }: SheetStripProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const counts = sheets.map((sheet) => sheetExtent(sheet).rows);
  const longest = Math.max(1, ...counts);

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <nav className="pl-strip pl-sheet-strip" aria-label={`Sheets in ${title}`}>
      <h2 className="pl-strip-head">
        <span className="pl-strip-title">{title}</span>
        <span className="pl-strip-count">
          {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </span>
      </h2>
      <ol className="pl-strip-list" ref={listRef}>
        {sheets.map((sheet, index) => {
          const rows = counts[index];
          return (
            <li key={sheet.id} className="pl-strip-entry">
              <button
                type="button"
                className="pl-strip-link"
                aria-current={index === current ? 'page' : undefined}
                onClick={() => onSelect(index)}
                onDoubleClick={() => onRename(index)}
              >
                <span className="pl-strip-num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="pl-strip-name">{sheet.name}</span>
                <span className="pl-strip-meter" aria-label={`${rows} ${rows === 1 ? 'row' : 'rows'}`}>
                  <span className="pl-strip-bar" style={{ width: stripBarWidth(rows, longest) }} />
                  <span className="pl-strip-date">
                    {rows} {rows === 1 ? 'row' : 'rows'}
                  </span>
                </span>
              </button>
              <Menu
                label={`Actions for ${sheet.name}`}
                className="pl-btn pl-btn--icon pl-strip-more"
                align="end"
                width={210}
                items={[
                  { id: 'rename', label: 'Rename sheet…', icon: <Pencil />, onSelect: () => onRename(index) },
                  { id: 'duplicate', label: 'Duplicate sheet', icon: <Copy />, onSelect: () => onDuplicate(index) },
                  ...(index > 0 ? [{ id: 'up', label: 'Move up', icon: <ArrowUp />, onSelect: () => onMove(index, index - 1) }] : []),
                  ...(index < sheets.length - 1 ? [{ id: 'down', label: 'Move down', icon: <ArrowDown />, onSelect: () => onMove(index, index + 1) }] : []),
                  ...(sheets.length > 1
                    ? [
                        { separator: true as const, id: 'sep' },
                        { id: 'delete', label: 'Delete sheet…', icon: <Trash2 />, danger: true, onSelect: () => onDelete(index) },
                      ]
                    : []),
                ]}
              >
                <MoreHorizontal aria-hidden="true" />
              </Menu>
            </li>
          );
        })}
      </ol>
      <button type="button" className="pl-strip-add" onClick={onNew}>
        <Plus aria-hidden="true" />
        New sheet
      </button>
    </nav>
  );
}
