import { ExportResult } from '@opentelemetry/base';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { Envelope } from '../Declarations/Contracts';
import { NoopSender } from '../platform';
import { ExporterConfig, DEFAULT_EXPORTER_CONFIG } from '../config';
import { BaseExporter, TelemetryProcessor } from '../types';
import { ArrayPersist } from '../platform/nodejs/arrayPersist';
import { isRetriable } from '../utils/breezeUtils';

export abstract class AzureMonitorBaseExporter implements BaseExporter {
  private readonly _persister: ArrayPersist<Envelope[]>; // @todo: replace with FileSystemPersister

  protected readonly _logger: Logger;

  private readonly _sender: NoopSender;

  protected _telemetryProcessors: TelemetryProcessor[];

  constructor(options: ExporterConfig = DEFAULT_EXPORTER_CONFIG) {
    this._logger = options.logger || new NoopLogger();

    // Instrumentation key is required
    // @todo: parse connection strings
    if (!options.instrumentationKey) {
      this._logger.error('No instrumentation key was provided to the Azure Monitor Exporter');
    }

    this._telemetryProcessors = [];
    this._sender = new NoopSender();
    this._persister = new ArrayPersist<Envelope[]>();
  }

  exportEnvelopes(payload: Envelope[], resultCallback: (result: ExportResult) => void): void {
    const envelopes = this._applyTelemetryProcessors(payload);
    this._sender.send(envelopes, (err, exportResult, statusCode, resultString) => {
      const persistCb = (persistErr: Error | null, persistSuccess?: boolean) => {
        if (persistErr || !persistSuccess) {
          return resultCallback(ExportResult.FAILED_NOT_RETRYABLE);
        }
        return resultCallback(ExportResult.FAILED_RETRYABLE);
      };

      if (err) {
        this._logger.error(err.message);
        this._persister.push(envelopes, persistCb);
      } else if (isRetriable(statusCode)) {
        if (resultString) {
          this._logger.info(resultString);
        }
        // @todo: filter retriable envelopes on partial success (206)
        this._persister.push(envelopes, persistCb);
      }
      return resultCallback(exportResult);
    });
  }

  addTelemetryProcessor(processor: TelemetryProcessor): void {
    this._telemetryProcessors.push(processor);
  }

  clearTelemetryProcessors() {
    this._telemetryProcessors = [];
  }

  shutdown() {
    this._sender.shutdown();
  }

  protected _applyTelemetryProcessors(envelopes: Envelope[]): Envelope[] {
    const filteredEnvelopes: Envelope[] = [];
    envelopes.forEach((envelope) => {
      let accepted = true;

      this._telemetryProcessors.forEach((processor) => {
        // Don't use CPU cycles if item is already rejected
        if (accepted && processor(envelope) === false) {
          accepted = false;
        }
      });

      if (accepted) {
        filteredEnvelopes.push(envelope);
      }
    });

    return filteredEnvelopes;
  }
}
