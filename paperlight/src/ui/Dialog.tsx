import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface FrameProps {
  role: 'dialog' | 'alertdialog';
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

function DialogFrame({ role, title, onCancel, onSubmit, children }: FrameProps) {
  const titleId = useId();
  return (
    <div className="pl-dialog-scrim" onPointerDown={onCancel}>
      <form
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className="pl-dialog"
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <h2 id={titleId} className="pl-dialog-title">
          {title}
        </h2>
        {children}
      </form>
    </div>
  );
}

interface PromptDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  /** Returns a message when the value can't be used. */
  validate?: (value: string) => string | null;
}

export function PromptDialog({ title, label, initialValue = '', confirmLabel, onConfirm, onCancel, validate }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const problemId = useId();

  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const message = validate?.(trimmed) ?? null;
    setProblem(message);
    if (!message) onConfirm(trimmed);
  };

  return (
    <DialogFrame role="dialog" title={title} onCancel={onCancel} onSubmit={submit}>
      <label className="pl-field-row">
        <span>{label}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          maxLength={80}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
        />
      </label>
      {problem && (
        <p id={problemId} className="pl-field-problem">
          {problem}
        </p>
      )}
      <div className="pl-dialog-actions">
        <button type="button" className="pl-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pl-btn pl-btn--primary" disabled={!value.trim()}>
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** For destructive actions: Cancel comes first and takes focus; the danger action sits apart at the end. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <DialogFrame role="alertdialog" title={title} onCancel={onCancel} onSubmit={onConfirm}>
      <p className="pl-dialog-message">{message}</p>
      <div className="pl-dialog-actions">
        <button ref={cancelRef} type="button" className="pl-btn pl-btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <span className="pl-dialog-spacer" />
        <button type="submit" className="pl-btn pl-btn--danger">
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
