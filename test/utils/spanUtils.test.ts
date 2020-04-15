import { Span, BasicTracerProvider } from '@opentelemetry/tracing';
import { SpanKind, CanonicalCode } from '@opentelemetry/api';
import * as assert from 'assert';
import { NoopLogger, hrTimeToMilliseconds } from '@opentelemetry/core';

import { readableSpanToEnvelope } from '../../src/utils/spanUtils';
import { Tags, Properties } from '../../src/types';
import { RequestData, RemoteDependencyData } from '../../src/Declarations/Contracts';

const tracer = new BasicTracerProvider({
  logger: new NoopLogger(),
}).getTracer('default');

describe('spanUtils.ts', () => {
  describe('#readableSpanToEnvelope', () => {
    describe('HTTP', () => {
      it('(HTTP) should create a Request Envelope for Server Spans', () => {
        const span = new Span(
          tracer,
          'parent span',
          { traceId: 'traceid', spanId: 'spanId', traceFlags: 0 },
          SpanKind.SERVER,
          'parentSpanId',
        );
        span.setAttributes({
          'http.method': 'GET',
          'http.route': '/api/example',
          'http.url': 'https://example.com/api/example',
          'http.status_code': 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          'ai.operation.id': readableSpan.spanContext.traceId,
          'ai.operation.parentId': readableSpan.parentSpanId!,
          'ai.operation.name': `${readableSpan.attributes['http.method']} ${readableSpan.attributes['http.route']}`,
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          '_MS.links': [],
        };

        const expectedBaseData: RequestData = {
          duration: String(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|${span.spanContext.traceId}.${span.spanContext.spanId}.`,
          success: true,
          responseCode: '200',
          url: 'https://example.com/api/example',
          name: `GET /api/example`,
          ver: 1,
          source: undefined,
          properties: expectedProperties,
          measurements: {},
        };

        const envelope = readableSpanToEnvelope(readableSpan, 'ikey');
        assert.ok(envelope);
        assert.strictEqual(envelope.name, 'Microsoft.ApplicationInsights.Request');
        assert.deepStrictEqual(envelope.data?.baseType, 'RequestData');

        assert.strictEqual(envelope.iKey, 'ikey');
        assert.ok(envelope.time);
        assert.ok(envelope.ver);
        assert.ok(envelope.data);

        assert.deepStrictEqual(envelope.tags, expectedTags);
        assert.deepStrictEqual(envelope.data?.baseData?.properties, expectedProperties);
        assert.deepStrictEqual(envelope.data?.baseData, expectedBaseData);
      });
      it('should create a Dependency Envelope for Client Spans', () => {
        const span = new Span(
          tracer,
          'parent span',
          { traceId: 'traceid', spanId: 'spanId', traceFlags: 0 },
          SpanKind.CLIENT,
          'parentSpanId',
        );
        span.setAttributes({
          'http.method': 'GET',
          'http.url': 'https://example.com/api/example',
          'http.status_code': 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          'ai.operation.id': readableSpan.spanContext.traceId,
          'ai.operation.parentId': 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          '_MS.links': [],
        };

        const expectedBaseData: RemoteDependencyData = {
          duration: String(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|traceid.spanId.`,
          success: true,
          resultCode: '200',
          type: 'HTTP',
          target: 'example.com',
          data: 'https://example.com/api/example',
          name: `GET /api/example`,
          ver: 1,
          properties: expectedProperties,
          measurements: {},
        };

        const envelope = readableSpanToEnvelope(readableSpan, 'ikey');
        assert.ok(envelope);
        assert.strictEqual(envelope.name, 'Microsoft.ApplicationInsights.RemoteDependency');
        assert.deepStrictEqual(envelope.data?.baseType, 'RemoteDependencyData');

        assert.strictEqual(envelope.iKey, 'ikey');
        assert.ok(envelope.time);
        assert.ok(envelope.ver);
        assert.ok(envelope.data);

        assert.deepStrictEqual(envelope.tags, expectedTags);
        assert.deepStrictEqual(envelope.data?.baseData?.properties, expectedProperties);
        assert.deepStrictEqual(envelope.data?.baseData, expectedBaseData);
      });
    });
  });
});
