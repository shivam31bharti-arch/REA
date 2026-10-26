import { SquareFunction } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { CellInput, type EditState } from './Grid';

interface FormulaLineProps {
  address: string;
  content: string;
  edit: EditState | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onBeginEdit: () => void;
  onChange: (value: string, caret: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCaret: (caret: number) => void;
  onGo: (text: string) => boolean;
  onDone: () => void;
  suggestions: ReactNode;
}

/** The address box and the full contents of the active cell, editable in place. */
export function FormulaLine(props: FormulaLineProps) {
  const [address, setAddress] = useState(props.address);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setAddress(props.address);
    setInvalid(false);
  }, [props.address]);

  const editingHere = props.edit?.origin === 'line';

  return (
    <div className="pl-formula-line">
      <input
        className="pl-address"
        value={address}
        aria-label="Cell address. Type one to go there"
        aria-invalid={invalid || undefined}
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setAddress(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (props.onGo(address)) props.onDone();
            else setInvalid(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setAddress(props.address);
            props.onDone();
          }
        }}
        onBlur={() => setAddress(props.address)}
      />
      <span className="pl-fx" aria-hidden="true">
        <SquareFunction />
      </span>
      <div className="pl-formula-field">
        {editingHere && props.edit ? (
          <>
            <CellInput
              inputRef={props.inputRef}
              edit={props.edit}
              onChange={props.onChange}
              onKeyDown={props.onKeyDown}
              onCaret={props.onCaret}
              className="pl-formula-input"
              ariaLabel="Formula"
            />
            {props.suggestions}
          </>
        ) : (
          <button type="button" className="pl-formula-text" onClick={props.onBeginEdit} aria-label={`Edit ${props.address}: ${props.content || 'empty'}`}>
            {props.edit ? props.edit.value : props.content}
          </button>
        )}
      </div>
    </div>
  );
}
