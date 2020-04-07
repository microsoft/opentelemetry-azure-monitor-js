/* eslint-disable no-param-reassign */
import { URL } from 'url';
import { ReadableSpan } from '@opentelemetry/tracing';
import { hrTimeToMilliseconds } from '@opentelemetry/core';
import { SpanKind, Logger, CanonicalCode, Link } from '@opentelemetry/api';
import { Envelope, RequestData, RemoteDependencyData } from '../Declarations/Contracts';
import { Tags, Properties } from '../types';

function createTagsFromSpan(span: ReadableSpan): Tags {
  const tags: Tags = {};
  tags['ai.operation.id'] = span.spanContext.traceId;
  if (span.parentSpanId) {
    tags['ai.operation.parentId'] = span.parentSpanId;
  }
  // @todo: is this for RequestData only?
  // @todo: parse grpc attributes where appropriate
  if (
    (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) &&
    span.attributes['http.method'] &&
    span.attributes['http.route']
  ) {
    tags['ai.operation.name'] = `${span.attributes['http.method']} ${span.attributes['http.route']}`;
  }
  return tags;
}

function createPropertiesFromSpan(span: ReadableSpan): Properties {
  const properties: Properties = {};

  // @todo: is this for RequestData only?
  // @todo: parse grpc attributes where appropriate
  if (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) {
    if (span.attributes['http.method']) {
      if (span.attributes['http.route']) {
        properties['request.name'] = `${span.attributes['http.method']} ${span.attributes['http.route']}`;
      } else if (span.attributes['http.path']) {
        properties['request.name'] = `${span.attributes['http.method']} ${span.attributes['http.path']}`;
      }
    }
  }

  // @todo: ignore grpc attributes
  Object.keys(span.attributes).forEach((key: string) => {
    if (!key.startsWith('http.')) {
      properties[key] = span.attributes[key] as string;
    }
  });

  const links = span.links.map((link: Link) => ({
    operation_Id: link.context.traceId,
    id: link.context.spanId,
  }));
  properties['_MS.links'] = JSON.stringify(links);

  return properties;
}

function createDependencyData(span: ReadableSpan): RemoteDependencyData {
  const data = new RemoteDependencyData();
  data.name = span.name;
  data.id = `|${span.spanContext.traceId}.${span.spanContext.spanId}.`;
  data.success = span.status.code === CanonicalCode.OK;
  data.resultCode = span.attributes['http.status_code'] as string;
  data.target = span.attributes['http.url'] as string;
  data.type = 'HTTP';
  data.duration = String(hrTimeToMilliseconds(span.duration));
  data.ver = 1;
  data.baseType = 'RemoteDependencyData';

  if (span.attributes['http.status_code']) {
    data.resultCode = span.attributes['http.status_code'] as string;
  }

  if (span.attributes['http.url']) {
    const url = new URL(span.attributes['http.url'] as string);
    data.target = url.hostname;
    data.data = url.href;

    if (span.attributes['http.method']) {
      data.name = `${span.attributes['http.method']} /${url.pathname}`;
    }
  }

  return data;
}

function createRequestData(span: ReadableSpan): RequestData {
  const data = new RequestData();
  data.baseType = 'RequestData';
  data.name = span.name;
  data.id = `|${span.spanContext.traceId}.${span.spanContext.spanId}.`;
  data.success = span.status.code === CanonicalCode.OK;
  data.responseCode = String(span.status.code);
  data.duration = String(hrTimeToMilliseconds(span.duration));
  data.ver = 1;
  // data.source = @todo

  if (span.attributes['http.method']) {
    data.name = span.attributes['http.method'] as string;

    if (span.attributes['http.status_code']) {
      data.responseCode = span.attributes['http.status_code'] as string;
    }

    if (span.attributes['http.url']) {
      data.url = span.attributes['http.url'] as string;
    }

    if (span.attributes['http.route']) {
      data.name = `${span.attributes['http.method']} ${span.attributes['http.route']}`;
    }
  }

  // @todo: parse grpc attributes

  return data;
}

function createInProcData(span: ReadableSpan): RemoteDependencyData {
  const data = createDependencyData(span);
  data.type = 'InProc';
  data.success = true;
  return data;
}

export function readableSpanToEnvelope(
  span: ReadableSpan,
  instrumentationKey: string,
  logger?: Logger,
): Envelope {
  const envelope = new Envelope();
  const tags = createTagsFromSpan(span);
  const properties = createPropertiesFromSpan(span);
  let data;
  switch (span.kind) {
    case SpanKind.CLIENT:
    case SpanKind.PRODUCER:
      envelope.name = 'Microsoft.ApplicationInsights.RemoteDependency';
      data = createDependencyData(span);
      break;
    case SpanKind.SERVER:
    case SpanKind.CONSUMER:
      envelope.name = 'Microsoft.ApplicationInsights.Request';
      data = createRequestData(span);
      break;
    case SpanKind.INTERNAL:
      envelope.name = 'Microsoft.ApplicationInsights.RemoteDependency';
      data = createInProcData(span);
      break;
    default:
      // never
      if (logger) {
        logger.error(`Unsupported span kind ${span.kind}`);
      }
      throw new Error(`Unsupported span kind ${span.kind}`);
  }

  envelope.data = { ...data, properties };
  envelope.tags = tags;
  envelope.time = new Date().toISOString();
  envelope.iKey = instrumentationKey;
  envelope.ver = 1;
  return envelope;
}
