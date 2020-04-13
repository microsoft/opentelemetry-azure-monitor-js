import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { PersistentStorage } from '../../../types';
import { ExporterConfig, DEFAULT_EXPORTER_CONFIG } from '../../../config';
import { confirmDirExists, getShallowDirectorySize } from './fileSystemHelpers';

export class FileSystemPersist implements PersistentStorage {
  static TEMPDIR_PREFIX = 'ot-azure-exporter-';

  maxBytesOnDisk: number = 50_000_000; // ~50MB

  private readonly _options: ExporterConfig;

  private readonly _logger: Logger;

  constructor(options: Partial<ExporterConfig> = DEFAULT_EXPORTER_CONFIG) {
    this._options = { ...DEFAULT_EXPORTER_CONFIG, ...options };
    this._logger = options.logger || new NoopLogger();
    if (!this._options.instrumentationKey) {
      this._logger.error(
        `No instrumentation key was provided to FileSystemPersister. Files may not be properly persisted`,
      );
    }
  }

  push(value: unknown, cb: (err: Error | null, result?: boolean | undefined) => void): void {
    this._logger.info('Pushing value to persistent storage', value as string);
    this._storeToDisk(JSON.stringify(value), cb);
  }

  shift(cb: (err: Error | null, value?: unknown) => void): void {
    this._logger.info('Returning first member of filesystem');
    this._getFirstFileOnDisk((error, buffer) => {
      if (error) {
        cb(error);
      } else if (buffer) {
        cb(null, JSON.parse(buffer.toString('utf8')));
      }
    });
  }

  /**
   * Check for temp telemetry files
   * reads the first file if exist, deletes it and tries to send its load
   */
  private _getFirstFileOnDisk(callback: (error: Error | null, value?: Buffer) => void): void {
    const tempDir = path.join(
      os.tmpdir(),
      FileSystemPersist.TEMPDIR_PREFIX + this._options.instrumentationKey,
    );

    fs.stat(tempDir, (statErr: Error | null, stats: fs.Stats) => {
      if (stats.isDirectory()) {
        fs.readdir(tempDir, (error, origFiles) => {
          if (!error) {
            const files = origFiles.filter((f) => path.basename(f).includes('.ai.json'));
            if (files.length > 0) {
              const firstFile = files[0];
              const filePath = path.join(tempDir, firstFile);
              fs.readFile(filePath, (readFileErr, payload) => {
                if (!readFileErr) {
                  // delete the file first to prevent double sending
                  fs.unlink(filePath, (unlinkError) => {
                    if (!unlinkError) {
                      callback(null, payload);
                    } else {
                      callback(unlinkError);
                    }
                  });
                } else {
                  callback(readFileErr);
                }
              });
            }
          } else {
            callback(error);
          }
        });
      }
    });
  }

  private _storeToDisk(payload: unknown, cb: (error: Error | null, success?: boolean) => void): void {
    const directory = path.join(
      os.tmpdir(),
      FileSystemPersist.TEMPDIR_PREFIX + this._options.instrumentationKey!,
    );

    confirmDirExists(directory, (error) => {
      if (error) {
        this._logger.warn(`Error while checking/creating directory: `, error && error.message);
        cb(error);
        return;
      }

      getShallowDirectorySize(directory, (err, size) => {
        if (err || size < 0) {
          this._logger.warn(`Error while checking directory size: ${err && err.message}`);
          cb(err);
          return;
        }
        if (size > this.maxBytesOnDisk) {
          this._logger.warn(
            `Not saving data due to max size limit being met. Directory size in bytes is: ${size}`,
          );
          cb(new Error(`FileSystemPersist size limit reached: ${this.maxBytesOnDisk}`));
          return;
        }

        // create file - file name for now is the timestamp, a better approach would be a UUID but that
        // would require an external dependency
        const fileName = `${new Date().getTime()}.ai.json`;
        const fileFullPath = path.join(directory, fileName);

        // Mode 600 is w/r for creator and no read access for others (only applies on *nix)
        // For Windows, ACL rules are applied to the entire directory (see logic in _confirmDirExists and _applyACLRules)
        this._logger.info(`saving data to disk at: ${fileFullPath}`);
        fs.writeFile(fileFullPath, payload, { mode: 0o600 }, (writeError) => {
          this._logger.warn(`Error writing file to persistent file storage`, writeError);
          cb(writeError, !writeError);
        });
      });
    });
  }
}
