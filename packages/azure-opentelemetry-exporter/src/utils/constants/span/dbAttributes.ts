// required by https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/data-semantic-conventions.md#databases-client-calls
export const COMPONENT = 'component';
export const DB_TYPE = 'db.type';
export const DB_INSTANCE = 'db.instance';
export const DB_STATEMENT = 'db.statement';
export const PEER_ADDRESS = 'peer.address';
export const PEER_HOSTNAME = 'peer.host';

// Optionals
export const PEER_PORT = 'peer.port';
export const PEER_IPV4 = 'peer.ipv4';
export const PEER_IPV6 = 'peer.ipv6';
export const PEER_SERVICE = 'peer.service';
