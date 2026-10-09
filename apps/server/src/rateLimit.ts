/** Simple token bucket. `capacity` tokens, refilled at `perSecond`. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private capacity: number, private perSecond: number, private now: () => number = Date.now) {
    this.tokens = capacity;
    this.last = now();
  }
  take(n = 1): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}
