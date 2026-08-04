import { ValidationError } from './errors.js';

export function assertHttpUrl(url: string, fieldName = 'URL'): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid HTTP or HTTPS URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`Invalid ${fieldName}: must be an HTTP or HTTPS URL`);
  }
}
