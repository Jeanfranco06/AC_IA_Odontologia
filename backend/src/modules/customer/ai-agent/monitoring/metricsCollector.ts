export interface MetricSummary {
  uptimeSeconds: number;
  requestsTotal: number;
  requestsByStatus: Record<string, number>;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  toolExecutionsTotal: number;
  toolExecutionsByName: Record<string, number>;
  llmCallsTotal: number;
  llmErrorsTotal: number;
  ragSearchesTotal: number;
  activeAlertsCount: number;
}

class MetricsCollector {
  private startTime = Date.now();
  private latencies: number[] = [];
  private maxLatenciesHistory = 1000;
  private requestsByStatus: Record<string, number> = {};
  private toolExecutionsByName: Record<string, number> = {};
  private llmCalls = 0;
  private llmErrors = 0;
  private ragSearches = 0;

  recordRequest(status: number, latencyMs: number): void {
    const key = String(status);
    this.requestsByStatus[key] = (this.requestsByStatus[key] || 0) + 1;
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatenciesHistory) {
      this.latencies.shift();
    }
  }

  recordToolExecution(toolName: string): void {
    this.toolExecutionsByName[toolName] = (this.toolExecutionsByName[toolName] || 0) + 1;
  }

  recordLlmCall(success: boolean): void {
    this.llmCalls++;
    if (!success) this.llmErrors++;
  }

  recordRagSearch(): void {
    this.ragSearches++;
  }

  getSummary(): MetricSummary {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const totalRequests = Object.values(this.requestsByStatus).reduce((a, b) => a + b, 0);
    const sumLatency = this.latencies.reduce((a, b) => a + b, 0);

    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const avg = sorted.length ? sumLatency / sorted.length : 0;

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      requestsTotal: totalRequests,
      requestsByStatus: { ...this.requestsByStatus },
      averageLatencyMs: Number(avg.toFixed(2)),
      p50LatencyMs: Number(p50.toFixed(2)),
      p95LatencyMs: Number(p95.toFixed(2)),
      toolExecutionsTotal: Object.values(this.toolExecutionsByName).reduce((a, b) => a + b, 0),
      toolExecutionsByName: { ...this.toolExecutionsByName },
      llmCallsTotal: this.llmCalls,
      llmErrorsTotal: this.llmErrors,
      ragSearchesTotal: this.ragSearches,
      activeAlertsCount: 0
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.latencies = [];
    this.requestsByStatus = {};
    this.toolExecutionsByName = {};
    this.llmCalls = 0;
    this.llmErrors = 0;
    this.ragSearches = 0;
  }
}

export const metricsCollector = new MetricsCollector();
