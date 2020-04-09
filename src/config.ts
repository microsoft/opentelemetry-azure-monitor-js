import { Logger } from '@opentelemetry/api';
import { DEFAULT_BREEZE_ENDPOINT } from './Declarations/Constants';

export interface ExporterConfig {
  // Exporter
  instrumentationKey?: string;
  connectionString?: string;
  endpointUrl: string;
  logger?: Logger;

  // Controller
  batchSendRetryIntervalMs: number;

  // Sender
  maxConsecutiveFailuresBeforeWarning: number;
}

export const DEFAULT_EXPORTER_CONFIG: ExporterConfig = {
  endpointUrl: DEFAULT_BREEZE_ENDPOINT,
  batchSendRetryIntervalMs: 60_000,
  maxConsecutiveFailuresBeforeWarning: 10,
};
