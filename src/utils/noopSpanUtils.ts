import { ReadableSpan } from '@opentelemetry/tracing';
import { Logger } from '@opentelemetry/api';
import { Envelope } from '../Declarations/Contracts';

export function readableSpanToEnvelope(
  span: ReadableSpan,
  instrumentationKey: string,
  logger?: Logger,
): Envelope {
  if (logger) {
    logger.info('Noop: Reshaping span', span, instrumentationKey);
  }

  return new Envelope();
}
