export function isRetriable(statusCode: number): boolean {
  return (
    statusCode === 408 || // Timeout
    statusCode === 429 || // Throttle
    statusCode === 439 || // Quota
    statusCode === 500 || // Server Error
    statusCode === 503
  );
}
