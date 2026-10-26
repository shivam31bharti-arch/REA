import { createContext, useContext, useEffect } from 'react';

export interface Command {
  id: string;
  title: string;
  group: string;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

/** Commands live in a ref-backed registry so registering never re-renders the shell. */
export class CommandRegistry {
  private sources = new Map<string, Command[]>();

  set(source: string, commands: Command[]) {
    this.sources.set(source, commands);
  }

  remove(source: string) {
    this.sources.delete(source);
  }

  all(): Command[] {
    return [...this.sources.values()].flat();
  }
}

export const CommandRegistryContext = createContext<CommandRegistry>(new CommandRegistry());

export function useRegisterCommands(source: string, commands: Command[]) {
  const registry = useContext(CommandRegistryContext);
  useEffect(() => {
    registry.set(source, commands);
  }, [registry, source, commands]);
  useEffect(() => () => registry.remove(source), [registry, source]);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string) {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const wantsCtrl = parts.includes('ctrl');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt');
  return (
    (event.ctrlKey || event.metaKey) === wantsCtrl &&
    event.shiftKey === wantsShift &&
    event.altKey === wantsAlt &&
    event.key.toLowerCase() === key
  );
}
