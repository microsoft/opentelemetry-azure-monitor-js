export interface BreezeError {
  index: number;
  statusCode: number;
  message: string;
}

export interface BreezeResponse {
  itemsReceived: number;
  itemsAccepted: number;
  errors: BreezeError[];
}

export function isRetriable(statusCode: number): boolean {
  return (
    statusCode === 206 || // Retriable
    statusCode === 408 || // Timeout
    statusCode === 429 || // Throttle
    statusCode === 439 || // Quota
    statusCode === 500 || // Server Error
    statusCode === 503
  );
}
