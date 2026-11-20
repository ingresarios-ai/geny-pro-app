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

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    !host.includes('.') ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.startsWith('[')
  ) {
    return false;
  }
  // Block IPv4 loopback, link-local, 0.0.0.0/8, and RFC1918 private ranges
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts.some((n) => n < 0 || n > 255)) return false;
    const [a, b] = parts;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return false;
    }
  }
  return true;
}
