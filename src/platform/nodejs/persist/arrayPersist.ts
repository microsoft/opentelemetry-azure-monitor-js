import { PersistentStorage } from '../../../types';

export class ArrayPersist<T> implements PersistentStorage {
  private _buffer: T[] = [];

  shift(cb: (err: Error | null, value?: T) => void): void {
    cb(null, this._buffer.shift());
  }

  push(value: T, cb: (err: Error | null, result?: boolean | undefined) => void): void {
    this._buffer.push(value);
    cb(null, true);
  }
}
