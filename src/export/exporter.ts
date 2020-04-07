import { ExportResult } from '@opentelemetry/base';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { Envelope } from '../Declarations/Contracts';
import { HttpSender } from '../platform';
import { ExporterConfig, DEFAULT_EXPORTER_CONFIG } from '../config';
import { BaseExporter, TelemetryProcessor } from '../types';
import { ArrayPersist } from '../platform/nodejs/persist/arrayPersist';
import { isRetriable, BreezeResponse } from '../utils/breezeUtils';

export abstract class AzureMonitorBaseExporter implements BaseExporter {
  protected readonly _persister: ArrayPersist<Envelope[]>; // @todo: replace with FileSystemPersister

  protected readonly _logger: Logger;

  protected readonly _sender: HttpSender;

  protected _retryTimer: NodeJS.Timeout | null;

  protected _telemetryProcessors: TelemetryProcessor[];

  constructor(private _options: ExporterConfig = DEFAULT_EXPORTER_CONFIG) {
    this._logger = _options.logger || new NoopLogger();

    // Instrumentation key is required
    // @todo: parse connection strings
    if (!_options.instrumentationKey) {
      this._logger.error('No instrumentation key was provided to the Azure Monitor Exporter');
    }

    this._telemetryProcessors = [];
    this._sender = new HttpSender();
    this._persister = new ArrayPersist<Envelope[]>();
    this._retryTimer = null;
  }

  exportEnvelopes(payload: Envelope[], resultCallback: (result: ExportResult) => void): void {
    const envelopes = this._applyTelemetryProcessors(payload);
    this._sender.send(envelopes, (err, statusCode, resultString) => {
      const persistCb = (persistErr: Error | null, persistSuccess?: boolean) => {
        if (persistErr || !persistSuccess) {
          return resultCallback(ExportResult.FAILED_NOT_RETRYABLE);
        }
        return resultCallback(ExportResult.FAILED_RETRYABLE);
      };

      if (err) {
        // Request failed -- always retry
        this._logger.error(err.message);
        this._persister.push(envelopes, persistCb);
      } else if (statusCode === 200) {
        // Success -- @todo: start retry timer
        if (!this._retryTimer) {
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this._sendFirstPersistedFile();
          }, this._options.batchSendRetryIntervalMs);
          this._retryTimer.unref();
        }
        resultCallback(ExportResult.SUCCESS);
      } else if (statusCode && isRetriable(statusCode)) {
        // Failed -- persist failed data
        if (resultString) {
          this._logger.info(resultString);
          const breezeResponse: BreezeResponse = JSON.parse(resultString);
          const filteredEnvelopes = breezeResponse.errors.reduce(
            (acc, v) => [...acc, envelopes[v.index]],
            [] as Envelope[],
          );
          this._persister.push(filteredEnvelopes, persistCb);
        } else {
          this._persister.push(envelopes, persistCb);
        }
      } else {
        // Failed -- not retriable
        resultCallback(ExportResult.FAILED_NOT_RETRYABLE);
      }
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

  private _sendFirstPersistedFile() {
    this._persister.shift((err, envelopes) => {
      if (err) {
        this._logger.warn(`Failed to fetch persisted file`, err);
      } else if (envelopes) {
        this._sender.send(envelopes, () => {
          /** no-op */
        });
      } else {
        this._logger.info(`No file was found in persistent storage`);
      }
    });
  }
}
