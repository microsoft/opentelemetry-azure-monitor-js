import { Logger } from '@opentelemetry/api';

export interface ExporterConfig {
  // Exporter
  instrumentationKey?: string;
  connectionString?: string;

  // Channel
  batchSendRetryIntervalMs: number;
  logger?: Logger;

  // Sender
  maxConsecutiveFailuresBeforeWarning: number;
}

export const DEFAULT_EXPORTER_CONFIG: ExporterConfig = {
  batchSendRetryIntervalMs: 60_000,
  maxConsecutiveFailuresBeforeWarning: 10,
};
