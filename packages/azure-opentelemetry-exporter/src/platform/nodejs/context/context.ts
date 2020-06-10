import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@opentelemetry/api';
import { ConsoleLogger, LogLevel, SDK_INFO } from '@opentelemetry/core';

import * as Contracts from '../../../Declarations/Contracts';

let instance: Context | null = null;

export class Context {
  public keys: Contracts.ContextTagKeys;

  public tags: { [key: string]: string };

  public static DefaultRoleName: string = 'Node.js';

  public static appVersion: { [path: string]: string } = {};

  public static sdkVersion: string | null = null;

  public static opentelemetryVersion: string | null = null;

  public static nodeVersion: string = '';

  constructor(
    private _logger: Logger = new ConsoleLogger(LogLevel.WARN),
    private _exporterPrefix = '../',
    private _appPrefix = '../../../',
  ) {
    this.keys = new Contracts.ContextTagKeys();
    this.tags = <{ [key: string]: string }>{};

    this._loadApplicationContext();
    this._loadDeviceContext();
    this._loadInternalContext();
  }

  private _loadApplicationContext() {
    if (Object.keys(Context.appVersion).length === 0) {
      // note: this should return the host package.json
      // note: this does not require this._prefix
      const packageJsonPath = path.resolve(__dirname, `${this._appPrefix}../../../../package.json`);
      Context.appVersion[packageJsonPath] = 'unknown';
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson && typeof packageJson.version === 'string') {
          Context.appVersion[packageJsonPath] = packageJson.version;
        }

        this.tags[this.keys.applicationVersion] = Context.appVersion[packageJsonPath];
      } catch (exception) {
        this._logger.warn('Failed to load Application version');
      }
    }
  }

  private _loadDeviceContext() {
    this.tags[this.keys.deviceId] = '';
    this.tags[this.keys.cloudRoleInstance] = os && os.hostname();
    this.tags[this.keys.deviceOSVersion] = os && `${os.type()} ${os.release()}`;
    this.tags[this.keys.cloudRole] = Context.DefaultRoleName;

    // not yet supported tags
    this.tags['ai.device.osArchitecture'] = os && os.arch();
    this.tags['ai.device.osPlatform'] = os && os.platform();
  }

  private _loadInternalContext() {
    if (!Context.sdkVersion) {
      const { node } = process.versions;
      [Context.nodeVersion] = node.split('.');

      // note: this should return the sdk package.json
      const packageJsonPath = path.resolve(__dirname, `${this._exporterPrefix}../../../../package.json`);

      Context.sdkVersion = 'unknown';
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson && typeof packageJson.version === 'string') {
          Context.sdkVersion = packageJson.version;
        }
      } catch (exception) {
        this._logger.warn('Failed to load Exporter version');
      }
    }

    this.tags[
      this.keys.internalSdkVersion
    ] = `node${Context.nodeVersion}|exporter:${Context.sdkVersion}|ot:${SDK_INFO.VERSION}`;
  }
}

export function getInstance(logger?: Logger, exporterPrefix?: string, appPrefix?: string): Context {
  if (!instance) {
    instance = new Context(logger, exporterPrefix, appPrefix);
  }
  return instance;
}
