import { memo } from 'react';
import {
  COLUMN_EDGES,
  MARGIN,
  paint,
  PLACEHOLDER_TEXT,
  textPaint,
  SLIDE_H,
  SLIDE_W,
  type ShapeElement,
  type Slide,
  type SlideElement,
  type TextElement,
  type Theme,
} from './model';

interface SlideViewProps {
  slide: Slide;
  theme: Theme;
  index: number;
  count: number;
  deckTitle: string;
  /** Rendered width in pixels; the slide scales to it. */
  width: number;
  /** Show empty placeholders and picture slots, as while editing. */
  placeholders?: boolean;
  /** Elements drawn by someone else on top (the one being edited). */
  hide?: Set<string>;
  className?: string;
}

export function lineHeight(size: number) {
  return size >= 60 ? 1.02 : size >= 40 ? 1.08 : 1.32;
}

function decoration(theme: Theme, slide: Slide) {
  const anchor = slide.elements.find(
    (element): element is TextElement =>
      element.kind === 'text' && (element.placeholder === 'title' || element.placeholder === 'statement' || element.placeholder === 'number'),
  );
  switch (theme.decoration) {
    case 'bar':
      return anchor ? <div className="pl-slide-deco" style={{ left: anchor.x, top: Math.max(24, anchor.y - 30), width: 64, height: 10, background: theme.accent }} /> : null;
    case 'band':
      return <div className="pl-slide-deco" style={{ left: 0, top: 0, width: 18, height: SLIDE_H, background: theme.accent }} />;
    case 'rule':
      return <div className="pl-slide-deco" style={{ left: MARGIN, top: SLIDE_H - 76, width: SLIDE_W - MARGIN * 2, height: 3, background: theme.text }} />;
    case 'grid':
      return (
        <>
          {COLUMN_EDGES.map((x, i) => (
            <div key={i} className="pl-slide-deco" style={{ left: x, top: 0, width: 1, height: SLIDE_H, background: '#ECECEA' }} />
          ))}
          {anchor && <div className="pl-slide-deco" style={{ left: anchor.x, top: Math.max(24, anchor.y - 30), width: 64, height: 10, background: theme.accent }} />}
        </>
      );
  }
}

function ShapeView({ element, theme }: { element: ShapeElement; theme: Theme }) {
  const fill = paint(element.fill, theme);
  const stroke = paint(element.stroke, theme);
  const w = Math.max(element.w, 1);
  const h = Math.max(element.h, 1);
  const sw = element.stroke ? element.strokeWidth : 0;
  const markerId = `arrow-${element.id}`;
  return (
    <svg className="pl-slide-shape" style={{ left: element.x, top: element.y, width: w, height: h }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {element.shape === 'rect' && <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} fill={fill} stroke={stroke} strokeWidth={sw} />}
      {element.shape === 'ellipse' && <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - sw / 2)} ry={Math.max(0, h / 2 - sw / 2)} fill={fill} stroke={stroke} strokeWidth={sw} />}
      {(element.shape === 'line' || element.shape === 'arrow') && (
        <>
          {element.shape === 'arrow' && (
            <defs>
              <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill={stroke === 'transparent' ? fill : stroke} />
              </marker>
            </defs>
          )}
          <line
            x1={0}
            y1={h <= 12 ? h / 2 : 0}
            x2={w}
            y2={h <= 12 ? h / 2 : h}
            stroke={stroke === 'transparent' ? fill : stroke}
            strokeWidth={Math.max(element.strokeWidth, 2)}
            markerEnd={element.shape === 'arrow' ? `url(#${markerId})` : undefined}
          />
        </>
      )}
    </svg>
  );
}

export function ElementView({ element, theme, placeholders }: { element: SlideElement; theme: Theme; placeholders: boolean }) {
  if (element.kind === 'shape') return <ShapeView element={element} theme={theme} />;
  if (element.kind === 'image') {
    if (!element.src) {
      return placeholders ? (
        <div className="pl-slide-picture is-empty" style={{ left: element.x, top: element.y, width: element.w, height: element.h, borderColor: theme.muted, color: theme.muted }}>
          <span>Add a picture</span>
        </div>
      ) : null;
    }
    return (
      <img
        className="pl-slide-picture"
        src={element.src}
        alt=""
        draggable={false}
        style={{ left: element.x, top: element.y, width: element.w, height: element.h, objectFit: element.fit }}
      />
    );
  }
  const empty = element.html.replace(/<[^>]+>/g, '').trim() === '';
  if (empty && !placeholders) return null;
  return (
    <div
      className={`pl-slide-text${empty ? ' is-placeholder' : ''}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        minHeight: element.h,
        fontSize: element.size,
        fontWeight: element.weight,
        lineHeight: lineHeight(element.size),
        textAlign: element.align,
        color: empty ? theme.muted : textPaint(element.color, theme),
        letterSpacing: element.size >= 40 ? '-0.03em' : undefined,
        ['--marker' as string]: theme.accent,
      }}
      dangerouslySetInnerHTML={{ __html: empty ? `<p>${element.placeholder ? PLACEHOLDER_TEXT[element.placeholder] : 'Add text'}</p>` : element.html }}
    />
  );
}

/** One slide, drawn at any size from the same 1280 × 720 layout. */
export const SlideView = memo(function SlideView({ slide, theme, index, count, deckTitle, width, placeholders = false, hide, className }: SlideViewProps) {
  const scale = width / SLIDE_W;
  const footer = slide.layout !== 'title' && slide.layout !== 'statement';
  return (
    <div className={`pl-slide-frame ${className ?? ''}`} style={{ width, height: Math.round(SLIDE_H * scale), background: theme.background }}>
      <div className="pl-slide" style={{ transform: `scale(${scale})`, background: theme.background, color: theme.text }}>
        {decoration(theme, slide)}
        {slide.elements.map((element) => (hide?.has(element.id) ? null : <ElementView key={element.id} element={element} theme={theme} placeholders={placeholders} />))}
        {footer && (
          <div className="pl-slide-foot" style={{ color: theme.muted }}>
            <span>{deckTitle}</span>
            <span>
              {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
