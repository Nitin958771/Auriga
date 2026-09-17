/**
 * Application Clock Service.
 * Used to control the flow of time for testing the 24h auto-close rule
 * without relying on `new Date()` directly in business logic.
 */
class ClockService {
  private simulatedTime: Date | null = null;

  /**
   * Get the current application time.
   */
  now(): Date {
    if (this.simulatedTime) {
      return new Date(this.simulatedTime);
    }
    return new Date();
  }

  /**
   * Set a simulated time.
   */
  setSimulatedTime(time: Date): void {
    this.simulatedTime = new Date(time);
  }

  /**
   * Reset to use the real system clock.
   */
  reset(): void {
    this.simulatedTime = null;
  }
}

export const clockService = new ClockService();
