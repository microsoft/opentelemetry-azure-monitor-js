import { Span, BasicTracerProvider } from '@opentelemetry/tracing';
import { SpanKind, CanonicalCode } from '@opentelemetry/api';
import * as assert from 'assert';
import { NoopLogger, hrTimeToMilliseconds } from '@opentelemetry/core';

import { Tags, Properties } from '../../src/types';
import { RequestData, RemoteDependencyData, Envelope } from '../../src/Declarations/Contracts';
import * as http from '../../src/utils/constants/span/httpAttributes';
import * as grpc from '../../src/utils/constants/span/grpcAttributes';
import * as ai from '../../src/utils/constants/applicationinsights';
import { Context, getInstance } from '../../src/platform';
import { msToTimeSpan } from '../../src/utils/breezeUtils';
import { readableSpanToEnvelope } from '../../src/utils/spanUtils';

const context = getInstance(undefined, './', '../../');

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
  assert.strictEqual(Context.sdkVersion, '0.0.1');
  assert.strictEqual(Object.keys(Context.appVersion).length, 1);
  assert.notDeepStrictEqual(Context.appVersion, 'unknown');

  assert.ok(envelope);
  assert.strictEqual(envelope.name, name);
  assert.deepStrictEqual(envelope.data?.baseType, baseType);

  assert.strictEqual(envelope.iKey, 'ikey');
  assert.ok(envelope.time);
  assert.ok(envelope.ver);
  assert.ok(envelope.data);

  assert.deepStrictEqual(envelope.tags, { ...context.tags, ...expectedTags });
  assert.deepStrictEqual(envelope.data?.baseData?.properties, expectedProperties);
  assert.deepStrictEqual(envelope.data?.baseData, expectedBaseData);
}

describe('spanUtils.ts', () => {
  describe('#readableSpanToEnvelope', () => {
    describe('GRPC', () => {
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
          [grpc.GRPC_STATUS_CODE]: CanonicalCode.OK,
          [grpc.GRPC_KIND]: SpanKind.SERVER,
          [grpc.GRPC_METHOD]: '/foo.Example/Foo',
          [grpc.GRPC_ERROR_MESSAGE]: 'some error message',
          [grpc.GRPC_ERROR_NAME]: 'some error name',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [ai.AI_OPERATION_ID]: 'traceid',
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
          [ai.AI_OPERATION_NAME]: '/foo.Example/Foo',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [grpc.GRPC_ERROR_MESSAGE]: 'some error message',
          [grpc.GRPC_ERROR_NAME]: 'some error name',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RequestData> = {
          source: undefined,
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|${span.spanContext.traceId}.${span.spanContext.spanId}.`,
          success: true,
          responseCode: '0',
          url: '/foo.Example/Foo',
          name: `parent span`,
          ver: 1,
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
          [grpc.GRPC_STATUS_CODE]: CanonicalCode.OK,
          [grpc.GRPC_KIND]: SpanKind.CLIENT,
          [grpc.GRPC_METHOD]: '/foo.Example/Foo',
          [grpc.GRPC_ERROR_MESSAGE]: 'some error message',
          [grpc.GRPC_ERROR_NAME]: 'some error name',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [ai.AI_OPERATION_ID]: 'traceid',
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [grpc.GRPC_ERROR_MESSAGE]: 'some error message',
          [grpc.GRPC_ERROR_NAME]: 'some error name',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RemoteDependencyData> = {
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
          id: `|${span.spanContext.traceId}.${span.spanContext.spanId}.`,
          success: true,
          resultCode: '0',
          target: '/foo.Example/Foo',
          data: '/foo.Example/Foo',
          type: 'GRPC',
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
          [ai.AI_OPERATION_ID]: 'traceid',
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RequestData> = {
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
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
          [ai.AI_OPERATION_ID]: 'traceid',
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: Partial<RemoteDependencyData> = {
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
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
          [http.HTTP_METHOD]: 'GET',
          [http.HTTP_ROUTE]: '/api/example',
          [http.HTTP_URL]: 'https://example.com/api/example',
          [http.HTTP_STATUS_CODE]: 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [ai.AI_OPERATION_ID]: 'traceid',
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
          [ai.AI_OPERATION_NAME]: `${readableSpan.attributes[http.HTTP_METHOD]} ${
            readableSpan.attributes[http.HTTP_ROUTE]
          }`,
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: RequestData = {
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
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
          [http.HTTP_METHOD]: 'GET',
          [http.HTTP_URL]: 'https://example.com/api/example',
          [http.HTTP_STATUS_CODE]: 200,
          'extra.attribute': 'foo',
        });
        span.setStatus({
          code: CanonicalCode.OK,
        });
        span.end();
        const readableSpan = span.toReadableSpan();
        const expectedTags: Tags = {
          [ai.AI_OPERATION_ID]: readableSpan.spanContext.traceId,
          [ai.AI_OPERATION_PARENT_ID]: 'parentSpanId',
        };
        const expectedProperties: Properties = {
          'extra.attribute': 'foo',
          [ai.MS_LINKS]: [],
        };

        const expectedBaseData: RemoteDependencyData = {
          duration: msToTimeSpan(hrTimeToMilliseconds(readableSpan.duration)),
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
