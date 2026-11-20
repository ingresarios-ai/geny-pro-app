export function isLocalhostOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

export function resolvePublicAppUrl(fallbackOrigin?: string): string {
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');

  if (configured && !(isProd && isLocalhostOrigin(configured))) {
    return configured;
  }

  const cleanFallback = (fallbackOrigin || '').trim().replace(/\/$/, '');
  if (cleanFallback && !(isProd && isLocalhostOrigin(cleanFallback))) {
    return cleanFallback;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  return configured || cleanFallback || 'http://localhost:3000';
}
