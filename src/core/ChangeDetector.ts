export class ChangeDetector {
  private timer: any = null;
  private lastCode = '';
  private isInitialized = false;

  /**
   * Trailing-edge debounce utility.
   * Cancels any pending timer on every keystroke and executes callback only after delayMs of silence.
   */
  public debounce(callback: (code: string) => void, delayMs: number = 800): (code: string) => void {
    return (code: string) => {
      // Guard against initial editor attachment auto-triggering
      if (!this.isInitialized) {
        this.isInitialized = true;
        this.lastCode = code;
        return;
      }

      if (code === this.lastCode) return;
      this.lastCode = code;

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(() => {
        callback(code);
      }, delayMs);
    };
  }

  public cancelPending(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluates if code change appears to be at a function call completion boundary
   */
  public isCallCandidate(code: string): boolean {
    const trimmed = code.trim();
    if (!trimmed) return false;

    return trimmed.includes('(') && (trimmed.includes(')') || trimmed.includes(';'));
  }
}
