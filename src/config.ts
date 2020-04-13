import { Logger } from '@opentelemetry/api';
import { DEFAULT_BREEZE_ENDPOINT } from './Declarations/Constants';

interface InstrumentationKeyRequired {
  instrumentationKey: string;
  connectionString?: undefined;
}

interface ConnectionStringRequired {
  instrumentationKey?: undefined;
  connectionString: string;
}

export interface AzureExporterConfig {
  // Exporter
  logger?: Logger;

  // Channel
  batchSendRetryIntervalMs: number;

  // Sender
  maxConsecutiveFailuresBeforeWarning: number;
  endpointUrl: string;
}

export type AzureExporterConfigWithSetupString = AzureExporterConfig &
  (InstrumentationKeyRequired | ConnectionStringRequired);

export type PartialAzureExporterConfigWithSetupString = Partial<AzureExporterConfig> &
  (InstrumentationKeyRequired | ConnectionStringRequired);

export const DEFAULT_EXPORTER_CONFIG: AzureExporterConfig & InstrumentationKeyRequired = {
  instrumentationKey: '',
  endpointUrl: DEFAULT_BREEZE_ENDPOINT,
  batchSendRetryIntervalMs: 60_000,
  maxConsecutiveFailuresBeforeWarning: 10,
};
