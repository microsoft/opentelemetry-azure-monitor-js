import * as assert from 'assert';
import { FileSystemPersist } from '../../../../src/platform/nodejs/persist/fileSystemPersist';
import { Envelope } from '../../../../src/Declarations/Contracts';

describe('FileSystemPersist', () => {
  describe('#push()', () => {
    it('should store to disk the value provided', (done) => {
      const persister = new FileSystemPersist({ instrumentationKey: 'abc' });
      const envelopes = [new Envelope()];
      persister.push(envelopes, (err, success) => {
        assert.strictEqual(err, null);
        assert.strictEqual(success, true);
        done();
      });
    });
  });

  describe('#shift()', () => {
    it('should get the first file on disk and return it', () => {});
  });
});
