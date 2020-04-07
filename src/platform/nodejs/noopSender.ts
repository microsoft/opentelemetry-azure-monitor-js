import { NoopLogger } from '@opentelemetry/core';
import { Logger } from '@opentelemetry/api';
import { Sender, SenderCallback } from '../../types';
import { Envelope } from '../../Declarations/Contracts';

export class NoopSender implements Sender {
  private readonly _logger: Logger;

  constructor() {
    this._logger = new NoopLogger();
  }

  send(payload: Envelope[], callback: SenderCallback): void {
    this._logger.info('Sending payload', payload);
    callback(null, 200);
  }

  shutdown(): void {
    this._logger.info('Noop Sender shutting down');
  }
}
