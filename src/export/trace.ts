import { ExportResult } from '@opentelemetry/base';
import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { readableSpanToEnvelope } from '../utils/spanUtils';
import { DEFAULT_EXPORTER_CONFIG, AzureExporterConfig } from '../config';
import { AzureMonitorBaseExporter } from './exporter';

export class AzureMonitorTraceExporter extends AzureMonitorBaseExporter implements SpanExporter {
  constructor(options: Partial<AzureExporterConfig> = DEFAULT_EXPORTER_CONFIG) {
    super(options);
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this._logger.info('Exporting spans', spans);
    const envelopes = spans.map((span) => readableSpanToEnvelope(span, '', this._logger));
    this.exportEnvelopes(envelopes, resultCallback);
  }

  shutdown(): void {
    this._logger.info('Azure Monitor Trace Exporter shutting down');
    super.shutdown();
  }
}
