import type { ConsoleLogEntry } from './types';

type ConsoleLevel = 'log' | 'warn' | 'error' | 'info';
const LEVELS: ConsoleLevel[] = ['log', 'warn', 'error', 'info'];
const MAX_MESSAGE_LENGTH = 2000;

export class ConsoleCapture {
  private entries: ConsoleLogEntry[] = [];
  private maxEntries: number;
  private originals: Record<ConsoleLevel, (...args: unknown[]) => void> = {} as any;
  private running = false;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const level of LEVELS) {
      this.originals[level] = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        this.originals[level](...args);
        const message = args
          .map((a) => {
            try {
              return typeof a === 'string' ? a : JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' ')
          .slice(0, MAX_MESSAGE_LENGTH);

        this.entries.push({
          level,
          message,
          timestamp: new Date().toISOString(),
        });

        if (this.entries.length > this.maxEntries) {
          this.entries.shift();
        }
      };
    }
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const level of LEVELS) {
      if (this.originals[level]) {
        console[level] = this.originals[level];
      }
    }
  }

  getLogs(): ConsoleLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}
