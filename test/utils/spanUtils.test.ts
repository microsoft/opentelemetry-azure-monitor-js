import { Span, BasicTracerProvider } from '@opentelemetry/tracing';
import { SpanKind, CanonicalCode } from '@opentelemetry/api';
import * as assert from 'assert';
import { NoopLogger, hrTimeToMilliseconds } from '@opentelemetry/core';

import { readableSpanToEnvelope } from '../../src/utils/spanUtils';
import { Tags, Properties } from '../../src/types';
import { RequestData, RemoteDependencyData, Envelope } from '../../src/Declarations/Contracts';
import {
  HTTP_METHOD,
  HTTP_ROUTE,
  HTTP_URL,
  HTTP_STATUS_CODE,
} from '../../src/utils/constants/span/httpAttributes';
import {
  AI_OPERATION_ID,
  AI_OPERATION_PARENT_ID,
  MS_LINKS,
  AI_OPERATIION_NAME,
} from '../../src/utils/constants/applicationinsights';

const tracer = new BasicTracerProvider({
  logger: new NoopLogger(),
}).getTracer('default');

function assertEnvelope(
  envelope: Envelope,
  name: string,
  baseType: string,
  expectedTags: Tags,
  expectedProperties: Properties,
  expectedBaseData: Partial<RequestData | RemoteDependencyData>,
) {
  assert.ok(envelope);
  assert.strictEqual(envelope.name, name);
  assert.deepStrictEqual(envelope.data?.baseType, baseType);

  assert.strictEqual(envelope.iKey, 'ikey');
  assert.ok(envelope.time);
  assert.ok(envelope.ver);
  assert.ok(envelope.data);

  assert.deepStrictEqual(envelope.tags, expectedTags);
  assert.deepStrictEqual(envelope.data?.baseData?.properties, expectedProperties);
  assert.deepStrictEqual(envelope.data?.baseData, expectedBaseData);
}

describe('spanUtils.ts', () => {
  describe('#readableSpanToEnvelope', () => {
    describe('Generic', () => {
      it('should create a Request Envelope for Server Spans', () => {
        const span = new Span(
          tracer,
          'parent span',
          { traceId: 'traceid', spanId: 'spanId', traceFlags: 0 },
          SpanKind.SERVER,
          'parentSpanId',
        );
        span.setAttributes({
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [AI_OPERATION_ID]: 'traceid',
          [AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RequestData> = {
          duration: String(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|${span.spanContext.traceId}.${span.spanContext.spanId}.`,
          success: true,
          responseCode: '0',
          name: `parent span`,
          ver: 1,
          source: undefined,
          properties: expectedProperties,
          measurements: {},
        };

        const envelope = readableSpanToEnvelope(span, 'ikey');
        assertEnvelope(
          envelope,
          'Microsoft.ApplicationInsights.Request',
          'RequestData',
          expectedTags,
          expectedProperties,
          expectedBaseData,
        );
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
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [AI_OPERATION_ID]: 'traceid',
          [AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RemoteDependencyData> = {
          duration: String(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|${span.spanContext.traceId}.${span.spanContext.spanId}.`,
          success: true,
          resultCode: '0',
          target: undefined,
          type: 'Dependency',
          name: `parent span`,
          ver: 1,
          properties: expectedProperties,
          measurements: {},
        };

        const envelope = readableSpanToEnvelope(span, 'ikey');
        assertEnvelope(
          envelope,
          'Microsoft.ApplicationInsights.RemoteDependency',
          'RemoteDependencyData',
          expectedTags,
          expectedProperties,
          expectedBaseData,
        );
      });
    });

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
          [HTTP_METHOD]: 'GET',
          [HTTP_ROUTE]: '/api/example',
          [HTTP_URL]: 'https://example.com/api/example',
          [HTTP_STATUS_CODE]: 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [AI_OPERATION_ID]: 'traceid',
          [AI_OPERATION_PARENT_ID]: 'parentSpanId',
          [AI_OPERATIION_NAME]: `${readableSpan.attributes[HTTP_METHOD]} ${readableSpan.attributes[HTTP_ROUTE]}`,
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [MS_LINKS]: [],
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
        assertEnvelope(
          envelope,
          'Microsoft.ApplicationInsights.Request',
          'RequestData',
          expectedTags,
          expectedProperties,
          expectedBaseData,
        );
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
          [HTTP_METHOD]: 'GET',
          [HTTP_URL]: 'https://example.com/api/example',
          [HTTP_STATUS_CODE]: 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [AI_OPERATION_ID]: readableSpan.spanContext.traceId,
          [AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [MS_LINKS]: [],
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
        assertEnvelope(
          envelope,
          'Microsoft.ApplicationInsights.RemoteDependency',
          'RemoteDependencyData',
          expectedTags,
          expectedProperties,
          expectedBaseData,
        );
      });
    });
  });
});
