import { Logger } from '@opentelemetry/api';
import * as http from 'http';
import * as https from 'https';

export interface ExporterConfig {
  // Buffer
  maxStorageSize: number; // number of envelopes

  // Exporter
  instrumentationKey?: string;
  connectionString?: string;

  // Channel
  maxBatchSizeBeforeSend: number; // number of envelopes
  batchSendIntervalMs: number;
  batchSendRetryIntervalMs: number;
  logger?: Logger;

  // Sender
  maxConsecutiveFailuresBeforeWarning: number;
  endpointUrl: string;
  proxyHttpsUrl?: string;
  proxyHttpUrl?: string;
  httpAgent?: http.Agent;
  httpsAgent?: https.Agent;
}

export const DEFAULT_EXPORTER_CONFIG: ExporterConfig = {
  maxStorageSize: 2_000,
  endpointUrl: 'https://dc.services.visualstudio.com/v2/track',
  maxBatchSizeBeforeSend: 500,
  batchSendIntervalMs: 15_000,
  batchSendRetryIntervalMs: 60_000,
  maxConsecutiveFailuresBeforeWarning: 10,
};
