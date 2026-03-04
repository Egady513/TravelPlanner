/**
 * DirectionsQueue — serialized request queue for Google Maps DirectionsService.
 *
 * Prevents OVER_QUERY_LIMIT errors by:
 * - Serializing all DirectionsService calls through a single queue
 * - Staggering requests 300ms apart
 * - Retrying OVER_QUERY_LIMIT with exponential backoff (300ms → 600ms → 1200ms)
 * - Supporting cancellation via generation counter
 */

interface QueuedRequest {
  request: google.maps.DirectionsRequest;
  resolve: (result: google.maps.DirectionsResult) => void;
  reject: (status: string) => void;
  retries: number;
  generation: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;
const STAGGER_MS = 300;

export class DirectionsQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private generation = 0;
  private service: google.maps.DirectionsService | null = null;

  private getService(): google.maps.DirectionsService {
    if (!this.service) {
      this.service = new google.maps.DirectionsService();
    }
    return this.service;
  }

  /** Enqueue a DirectionsService request. Returns a promise that resolves with
   *  the DirectionsResult or rejects with the status string. */
  enqueue(request: google.maps.DirectionsRequest): Promise<google.maps.DirectionsResult> {
    const capturedGen = this.generation;
    return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      this.queue.push({ request, resolve, reject, retries: 0, generation: capturedGen });
      this.processNext();
    });
  }

  /** Cancel all pending requests (in-flight request will be silently dropped). */
  clear(): void {
    this.generation++;
    this.queue = [];
  }

  // ── internal ──────────────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const item = this.queue.shift()!;

    // Stale request — silently discard
    if (item.generation !== this.generation) {
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      const result = await this.makeRequest(item.request);

      // Check generation again — trip data may have changed while awaiting
      if (item.generation === this.generation) {
        item.resolve(result);
      }
    } catch (status) {
      const statusStr = String(status);

      if (statusStr === 'OVER_QUERY_LIMIT' && item.retries < MAX_RETRIES) {
        // Exponential backoff: 300ms, 600ms, 1200ms
        const backoff = BASE_DELAY_MS * Math.pow(2, item.retries);
        item.retries++;
        // Re-insert at front of queue for immediate retry after backoff
        this.queue.unshift(item);
        await this.delay(backoff);
      } else if (item.generation === this.generation) {
        item.reject(statusStr);
      }
    }

    // Stagger before processing next item
    await this.delay(STAGGER_MS);
    this.processing = false;
    this.processNext();
  }

  private makeRequest(
    request: google.maps.DirectionsRequest
  ): Promise<google.maps.DirectionsResult> {
    return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      this.getService().route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          reject(status);
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
