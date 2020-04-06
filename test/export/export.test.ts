/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
import * as assert from 'assert';
import { AzureMonitorBaseExporter } from '../../src/export/exporter';
import { TelemetryProcessor } from '../../src/types';
import { Envelope } from '../../src/Declarations/Contracts';

describe('#AzureMonitorBaseExporter', () => {
  class TestExporter extends AzureMonitorBaseExporter {
    getTelemetryProcesors() {
      return this._telemetryProcessors;
    }
  }

  describe('Telemetry Processors', () => {
    const nameProcessor: TelemetryProcessor = (envelope: Envelope) => {
      envelope.name = 'processor1';
    };

    const rejectProcessor: TelemetryProcessor = () => {
      return false;
    };

    describe('#addTelemetryProcessor()', () => {
      it('should add telemetry processors', () => {
        const exporter = new TestExporter();
        assert.strictEqual(exporter.getTelemetryProcesors().length, 0);

        exporter.addTelemetryProcessor(nameProcessor);
        assert.strictEqual(exporter.getTelemetryProcesors().length, 1);
        assert.strictEqual(exporter.getTelemetryProcesors()[0], nameProcessor);

        exporter.addTelemetryProcessor(rejectProcessor);
        assert.strictEqual(exporter.getTelemetryProcesors().length, 2);
        assert.strictEqual(exporter.getTelemetryProcesors()[0], nameProcessor);
        assert.strictEqual(exporter.getTelemetryProcesors()[1], rejectProcessor);
      });
    });

    describe('#clearTelemetryProcessors()', () => {
      it('should clear all telemetry processors', () => {
        const exporter = new TestExporter();
        assert.strictEqual(exporter.getTelemetryProcesors().length, 0);

        exporter.addTelemetryProcessor(nameProcessor);
        assert.strictEqual(exporter.getTelemetryProcesors().length, 1);
        assert.strictEqual(exporter.getTelemetryProcesors()[0], nameProcessor);

        exporter.clearTelemetryProcessors();
        assert.strictEqual(exporter.getTelemetryProcesors().length, 0);
      });
    });
    describe('#_applyTelemetryProcessors()', () => {
      it('should filter envelopes', () => {
        const fooEnvelope = new Envelope();
        const barEnvelope = new Envelope();
        fooEnvelope.name = 'foo';
        barEnvelope.name = 'bar';

        const exporter = new TestExporter();
        assert.strictEqual(exporter.getTelemetryProcesors().length, 0);

        exporter.addTelemetryProcessor((envelope) => {
          return envelope.name === 'bar';
        });
        const filtered = exporter['_applyTelemetryProcessors']([fooEnvelope, barEnvelope]);
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0], barEnvelope);
      });

      it('should filter modified envelopes', () => {
        const fooEnvelope = new Envelope();
        const barEnvelope = new Envelope();
        fooEnvelope.name = 'foo';
        barEnvelope.name = 'bar';

        const exporter = new TestExporter();
        assert.strictEqual(exporter.getTelemetryProcesors().length, 0);

        exporter.addTelemetryProcessor((envelope) => {
          if (envelope.name === 'bar') {
            envelope.name = 'baz';
          }
        });

        exporter.addTelemetryProcessor((envelope) => {
          return envelope.name === 'baz';
        });

        const filtered = exporter['_applyTelemetryProcessors']([fooEnvelope, barEnvelope]);
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].name, 'baz');
      });
    });
  });
});
