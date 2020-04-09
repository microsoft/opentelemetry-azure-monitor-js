export const ENV_CONNECTION_STRING = 'APPLICATIONINSIGHTS_CONNECTION_STRING';
export const ENV_INSTRUMENTATION_KEY = 'APPINSIGHTS_INSTRUMENTATIONKEY';

/**
 * Subset of Connection String fields which this SDK can parse. Lower-typecased to
 * allow for case-insensitivity across field names
 * @type ConnectionStringKey
 */
export type ConnectionString = { [key in ConnectionStringKey]?: string }

export type ConnectionStringKey =
  | 'authorization'
  | 'instrumentationkey'
  | 'ingestionendpoint'
  | 'liveendpoint'
  | 'location'
  | 'endpointsuffix';
