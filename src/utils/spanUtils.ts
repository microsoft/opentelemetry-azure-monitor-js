import { URL } from 'url';
import { ReadableSpan } from '@opentelemetry/tracing';
import { hrTimeToMilliseconds } from '@opentelemetry/core';
import { SpanKind, Logger, CanonicalCode, Link } from '@opentelemetry/api';
import { Envelope, RequestData, RemoteDependencyData, Base } from '../Declarations/Contracts';
import { Tags, Properties, MSLink } from '../types';
import { HTTP_METHOD, HTTP_ROUTE, HTTP_URL, HTTP_STATUS_CODE } from './constants/span/httpAttributes';
import {
  AI_OPERATION_ID,
  AI_OPERATION_PARENT_ID,
  AI_OPERATION_NAME,
  MS_LINKS,
  INPROC,
} from './constants/applicationinsights';
import {
  GRPC_ERROR_MESSAGE,
  GRPC_ERROR_NAME,
  GRPC_METHOD,
  GRPC_STATUS_CODE,
} from './constants/span/grpcAttributes';

function createTagsFromSpan(span: ReadableSpan): Tags {
  const tags: Tags = {};
  tags[AI_OPERATION_ID] = span.spanContext.traceId;
  if (span.parentSpanId) {
    tags[AI_OPERATION_PARENT_ID] = span.parentSpanId;
  }
  // @todo: is this for RequestData only?
  if ((span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) && span.attributes[GRPC_METHOD]) {
    tags[AI_OPERATION_NAME] = String(span.attributes[GRPC_METHOD]);
  }
  if (
    (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) &&
    span.attributes[HTTP_METHOD] &&
    span.attributes[HTTP_ROUTE]
  ) {
    tags[AI_OPERATION_NAME] = `${span.attributes[HTTP_METHOD]} ${span.attributes[HTTP_ROUTE]}`;
  }
  return tags;
}

function createPropertiesFromSpan(span: ReadableSpan): Properties {
  const properties: Properties = {};

  Object.keys(span.attributes).forEach((key: string) => {
    if (
      key === GRPC_ERROR_MESSAGE ||
      key === GRPC_ERROR_NAME ||
      !(key.startsWith('http.') || key.startsWith('grpc.'))
    ) {
      properties[key] = span.attributes[key] as string;
    }
  });

  const links: MSLink[] = span.links.map((link: Link) => ({
    operation_Id: link.context.traceId,
    id: link.context.spanId,
  }));

  properties[MS_LINKS] = links;
  return properties;
}

function createDependencyData(span: ReadableSpan): RemoteDependencyData {
  const data = new RemoteDependencyData();
  data.name = span.name;
  data.id = `|${span.spanContext.traceId}.${span.spanContext.spanId}.`;
  data.success = span.status.code === CanonicalCode.OK;
  data.resultCode = String(span.status.code);
  data.target = span.attributes[HTTP_URL] as string;
  data.type = 'Dependency';
  data.duration = String(hrTimeToMilliseconds(span.duration));
  data.ver = 1;

  if (span.attributes[HTTP_STATUS_CODE]) {
    data.type = 'HTTP';
    data.resultCode = String(span.attributes[HTTP_STATUS_CODE]);
  }

  if (span.attributes[GRPC_STATUS_CODE] !== undefined) {
    data.type = 'GRPC';
    data.resultCode = String(span.attributes[GRPC_STATUS_CODE]);
  }

  if (span.attributes[GRPC_METHOD]) {
    data.target = String(span.attributes[GRPC_METHOD]);
    data.data = String(span.attributes[GRPC_METHOD]);
  }

  if (span.attributes[HTTP_URL]) {
    const url = new URL(span.attributes[HTTP_URL] as string);
    data.target = url.hostname;
    data.data = url.href;

    if (span.attributes[HTTP_METHOD]) {
      data.name = `${span.attributes[HTTP_METHOD]} ${url.pathname}`;
    }
  }

  return data;
}

function createRequestData(span: ReadableSpan): RequestData {
  const data = new RequestData();
  data.name = span.name;
  data.id = `|${span.spanContext.traceId}.${span.spanContext.spanId}.`;
  data.success = span.status.code === CanonicalCode.OK;
  data.responseCode = String(span.status.code);
  data.duration = String(hrTimeToMilliseconds(span.duration));
  data.ver = 1;
  data.source = undefined;

  if (span.attributes[HTTP_METHOD]) {
    data.name = span.attributes[HTTP_METHOD] as string;

    if (span.attributes[HTTP_STATUS_CODE]) {
      data.responseCode = String(span.attributes[HTTP_STATUS_CODE]);
    }

    if (span.attributes[HTTP_URL]) {
      data.url = span.attributes[HTTP_URL] as string;
    }

    if (span.attributes[HTTP_ROUTE]) {
      data.name = `${span.attributes[HTTP_METHOD]} ${span.attributes[HTTP_ROUTE]}`;
    } else if (span.attributes[HTTP_URL]) {
      const url = new URL(span.attributes[HTTP_URL] as string);
      data.name = `${span.attributes[HTTP_METHOD]} ${url.pathname}`;
    }
  }

  if (span.attributes[GRPC_STATUS_CODE]) {
    data.responseCode = String(span.attributes[GRPC_STATUS_CODE]);
  }
  if (span.attributes[GRPC_METHOD]) {
    data.url = String(span.attributes[GRPC_METHOD]);
  }

  return data;
}

function createInProcData(span: ReadableSpan): RemoteDependencyData {
  const data = createDependencyData(span);
  data.type = INPROC;
  data.success = true;
  return data;
}

export function readableSpanToEnvelope(
  span: ReadableSpan,
  instrumentationKey: string,
  logger?: Logger,
): Envelope {
  const envelope = new Envelope();
  envelope.data = new Base();
  const tags = createTagsFromSpan(span);
  const properties = createPropertiesFromSpan(span);
  let data;
  switch (span.kind) {
    case SpanKind.CLIENT:
    case SpanKind.PRODUCER:
      envelope.name = 'Microsoft.ApplicationInsights.RemoteDependency';
      envelope.data.baseType = 'RemoteDependencyData';
      data = createDependencyData(span);
      break;
    case SpanKind.SERVER:
    case SpanKind.CONSUMER:
      envelope.name = 'Microsoft.ApplicationInsights.Request';
      envelope.data.baseType = 'RequestData';
      data = createRequestData(span);
      break;
    case SpanKind.INTERNAL:
      envelope.data.baseType = 'RemoteDependencyData';
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

  envelope.data.baseData = { ...data, properties };
  envelope.tags = tags;
  envelope.time = new Date().toISOString();
  envelope.iKey = instrumentationKey;
  envelope.ver = 1;
  return envelope;
}
