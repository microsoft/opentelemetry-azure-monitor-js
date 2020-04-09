import { ConnectionString, ConnectionStringKey } from '../Declarations/Contracts';

import * as Constants from '../Declarations/Constants';

export class ConnectionStringParser {
  private static readonly FIELDS_SEPARATOR = ';';

  private static readonly FIELD_KEY_VALUE_SEPARATOR = '=';

  public static parse(connectionString?: string): ConnectionString {
    if (!connectionString) {
      return {};
    }

    const kvPairs = connectionString.split(ConnectionStringParser.FIELDS_SEPARATOR);

    const result: ConnectionString = kvPairs.reduce((fields: ConnectionString, kv: string) => {
      const kvParts = kv.split(ConnectionStringParser.FIELD_KEY_VALUE_SEPARATOR);

      if (kvParts.length === 2) {
        // only save fields with valid formats
        const key = kvParts[0].toLowerCase() as ConnectionStringKey;
        const value = kvParts[1];
        return { ...fields, [key]: value };
      }
      return fields;
    }, {});

    if (Object.keys(result).length > 0) {
      // this is a valid connection string, so parse the results

      if (result.endpointsuffix) {
        // use endpoint suffix where overrides are not provided
        const locationPrefix = result.location ? `${result.location}.` : '';
        result.ingestionendpoint =
          result.ingestionendpoint || `https://${locationPrefix}dc.${result.endpointsuffix}`;
        result.liveendpoint = result.liveendpoint || `https://${locationPrefix}live.${result.endpointsuffix}`;
      }

      // apply the default endpoints
      result.ingestionendpoint = result.ingestionendpoint || Constants.DEFAULT_BREEZE_ENDPOINT;
      result.liveendpoint = result.liveendpoint || Constants.DEFAULT_LIVEMETRICS_ENDPOINT;
    }

    return result;
  }
}
