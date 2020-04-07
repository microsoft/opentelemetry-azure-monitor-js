import * as http from 'http';
import * as https from 'https';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { DEFAULT_BREEZE_ENDPOINT } from '../Declarations/Constants';

export interface SenderOptions {
  logger: Logger;
  endpointUrl: string;
  batchSendRetryIntervalMs: number;
  proxyHttpsUrl?: string;
  proxyHttpUrl?: string;
  httpAgent?: http.Agent;
  httpsAgent?: https.Agent;
}

export const DEFAULT_SENDER_OPTIONS: SenderOptions = {
  logger: new NoopLogger(),
  batchSendRetryIntervalMs: 60_000,
  endpointUrl: DEFAULT_BREEZE_ENDPOINT,
};
