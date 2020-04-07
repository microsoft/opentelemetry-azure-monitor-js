import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { Logger } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { PersistentStorage } from '../../../types';
import { ExporterConfig, DEFAULT_EXPORTER_CONFIG } from '../../../config';

function getShallowDirectorySize(directory: string, callback: (err: Error | null, size: number) => void) {
  // Get the directory listing
  fs.readdir(directory, (err, files) => {
    if (err) {
      callback(err, -1);
      return;
    }

    if (files.length === 0) {
      callback(null, 0);
      return;
    }

    let error: Error | null = null;
    let totalSize = 0;
    let count = 0;

    // Query all file sizes
    files.forEach((file) => {
      fs.stat(path.join(directory, file), (statErr, fileStats) => {
        count += 1;

        if (statErr) {
          error = statErr;
        } else if (fileStats.isFile()) {
          totalSize += fileStats.size;
        }

        if (count === files.length) {
          // Did we get an error?
          if (error) {
            callback(error, -1);
          } else {
            callback(error, totalSize);
          }
        }
      });
    });
  });
}

function getACLArguments(directory: string, identity: string) {
  return [
    directory,
    '/grant',
    '*S-1-5-32-544:(OI)(CI)F', // Full permission for Administrators
    '/grant',
    `${identity}:(OI)(CI)F`, // Full permission for current user
    '/inheritance:r',
  ]; // Remove all inherited permissions
}

export class FileSystemPersist implements PersistentStorage {
  static TEMPDIR_PREFIX = 'ot-azure-exporter';

  maxBytesOnDisk: number = 50_000_000; // ~50MB

  private readonly _options: ExporterConfig;

  private readonly _logger: Logger;

  private static readonly USE_ICACLS = os.type() === 'Windows_NT';

  private static ICACLS_PATH = `${process.env.systemdrive}/windows/system32/icacls.exe`;

  private static POWERSHELL_PATH = `${process.env.systemdrive}/windows/system32/windowspowershell/v1.0/powershell.exe`;

  private static ACLED_DIRECTORIES: { [id: string]: boolean } = {};

  private static ACL_IDENTITY: string | null = null;

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
    this._storeToDisk(value, cb);
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

    this._confirmDirExists(directory, (error) => {
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

  // eslint-disable-next-line class-methods-use-this
  private _getACLIdentity(callback: (error: Error | null, identity?: string) => void) {
    if (FileSystemPersist.ACL_IDENTITY) {
      callback(null, FileSystemPersist.ACL_IDENTITY);
      return;
    }
    const psProc = childProcess.spawn(
      FileSystemPersist.POWERSHELL_PATH,
      ['-Command', '[System.Security.Principal.WindowsIdentity]::GetCurrent().Name'],
      <any>{
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Needed to prevent hanging on Win 7
      },
    );
    let data = '';
    psProc.stdout.on('data', (d: string) => {
      data += d;
    });
    psProc.on('error', (e: Error) => callback(e));
    psProc.on('close', (code: number) => {
      FileSystemPersist.ACL_IDENTITY = data && data.trim();
      return callback(
        code === 0 ? null : new Error(`Getting ACL identity did not succeed (PS returned code ${code})`),
        FileSystemPersist.ACL_IDENTITY,
      );
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private _runICACLS(args: string[], callback: (err: Error | null) => void) {
    const aclProc = childProcess.spawn(FileSystemPersist.ICACLS_PATH, args, <any>{ windowsHide: true });
    aclProc.on('error', (e) => callback(e));
    aclProc.on('close', (code) => {
      return callback(
        code === 0
          ? null
          : new Error(`Setting ACL restrictions did not succeed (ICACLS returned code ${code})`),
      );
    });
  }

  private _applyACLRules(directory: string, callback: (err: Error | null) => void) {
    if (!FileSystemPersist.USE_ICACLS) {
      callback(null);
      return;
    }

    // For performance, only run ACL rules if we haven't already during this session
    if (FileSystemPersist.ACLED_DIRECTORIES[directory] === undefined) {
      // Avoid multiple calls race condition by setting ACLED_DIRECTORIES to false for this directory immediately
      // If batches are being failed faster than the processes spawned below return, some data won't be stored to disk
      // This is better than the alternative of potentially infinitely spawned processes
      FileSystemPersist.ACLED_DIRECTORIES[directory] = false;

      // Restrict this directory to only current user and administrator access
      this._getACLIdentity((err, identity) => {
        if (err || !identity) {
          FileSystemPersist.ACLED_DIRECTORIES[directory] = false; // false is used to cache failed (vs undefined which is "not yet tried")
          callback(err);
          return;
        }

        this._runICACLS(getACLArguments(directory, identity), (runIcaclsErr) => {
          FileSystemPersist.ACLED_DIRECTORIES[directory] = !runIcaclsErr;
          callback(runIcaclsErr);
        });
      });
    } else {
      callback(
        FileSystemPersist.ACLED_DIRECTORIES[directory]
          ? null
          : new Error('Setting ACL restrictions did not succeed (cached result)'),
      );
    }
  }

  /**
   * Computes the size (in bytes) of all files in a directory at the root level. Asynchronously.
   */
  private _confirmDirExists(directory: string, callback: (err: Error | null) => void): void {
    fs.lstat(directory, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        fs.mkdir(directory, (mkdirErr) => {
          if (mkdirErr && mkdirErr.code !== 'EEXIST') {
            // Handle race condition by ignoring EEXIST
            callback(mkdirErr);
          } else {
            this._applyACLRules(directory, callback);
          }
        });
      } else if (!err && stats.isDirectory()) {
        this._applyACLRules(directory, callback);
      } else {
        callback(err || new Error('Path existed but was not a directory'));
      }
    });
  }
}
