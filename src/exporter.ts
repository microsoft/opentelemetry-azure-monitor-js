import { ExportResult } from '@opentelemetry/base';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';

import { Envelope } from './Declarations/Contracts';
import { AzureMonitorSender } from './platform';
import { ExporterConfig, DEFAULT_EXPORTER_CONFIG } from './config';
import { BaseExporter, TelemetryProcessor } from './types';

export abstract class AzureMonitorBaseExporter implements BaseExporter {
  protected readonly _logger: Logger;

  private readonly _sender: AzureMonitorSender;

  private _telemetryProcessors: TelemetryProcessor[];

  constructor(options: ExporterConfig = DEFAULT_EXPORTER_CONFIG) {
    this._logger = options.logger || new NoopLogger();

    // Instrumentation key is required
    // @todo: parse connection strings
    if (!options.instrumentationKey) {
      this._logger.error('No instrumentation key was provided to the Azure Monitor Exporter');
    }

    this._telemetryProcessors = [];
    this._sender = new AzureMonitorSender();
  }

  exportEnvelopes(payload: Envelope[], resultCallback: (result: ExportResult) => void): void {
    const envelopes = this._applyTelemetryProcessors(payload);
    this._sender.send(envelopes, (err, exportResult, result) => {
      if (err) {
        this._logger.error(err.message);
      } else if (result) {
        this._logger.info(result);
      }
      resultCallback(exportResult);
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

  private _applyTelemetryProcessors(envelopes: Envelope[]): Envelope[] {
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
