/** A reversible edit. `do()` applies it; `undo()` reverts it exactly. */
export interface Command {
  readonly label: string;
  do(): void;
  undo(): void;
}

/** Bundle several commands into one atomic undo step. */
export function composite(label: string, commands: Command[]): Command {
  return {
    label,
    do: () => {
      for (const c of commands) c.do();
    },
    undo: () => {
      for (let i = commands.length - 1; i >= 0; i--) commands[i].undo();
    },
  };
}

/** Undo/redo stack. `execute` applies + records; `record` logs an already-applied change. */
export class History {
  private past: Command[] = [];
  private future: Command[] = [];

  constructor(private readonly limit = 200) {}

  execute(cmd: Command): void {
    cmd.do();
    this.record(cmd);
  }

  /** Record a command whose effect has already been applied (e.g. after a drag). */
  record(cmd: Command): void {
    this.past.push(cmd);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(): boolean {
    const cmd = this.past.pop();
    if (!cmd) return false;
    cmd.undo();
    this.future.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.future.pop();
    if (!cmd) return false;
    cmd.do();
    this.past.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
