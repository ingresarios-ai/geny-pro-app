import { NextResponse } from 'next/server';
import { createAdminClient, createClient, readAppSettings } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';
import type { Json } from '@/lib/database.types';

export const maxDuration = 30;

interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface EarningsRow {
  symbol: string;
  date: string;
}

const INTERVAL_CONFIG = {
  '1min': { yfInterval: '1m', maxDays: 7, intraday: true },
  '5min': { yfInterval: '5m', maxDays: 58, intraday: true },
  '15min': { yfInterval: '15m', maxDays: 58, intraday: true },
  '30min': { yfInterval: '30m', maxDays: 58, intraday: true },
  '1hour': { yfInterval: '60m', maxDays: 720, intraday: true },
  '4hour': { yfInterval: '60m', maxDays: 720, intraday: true },
  '1day': { yfInterval: '1d', maxDays: 3650, intraday: false },
  '1week': { yfInterval: '1wk', maxDays: 3650, intraday: false },
} as const;

type ChartInterval = keyof typeof INTERVAL_CONFIG;

const DEFAULT_RADAR_SYMBOLS = [
  'SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'AMZN', 'MSFT', 'META', 'GOOGL',
  'AMD', 'PLTR', 'NFLX', 'AVGO', 'MU', 'INTC', 'BAC', 'JPM', 'COIN', 'MSTR',
  'SOFI', 'UBER', 'TLT', 'GLD', 'SLV', 'XLF', 'XLE', 'SMH', 'BABA', 'DIS',
  'DIA', 'EEM', 'FXI', 'HYG', 'KRE', 'ARKK', 'XBI', 'GDX', 'BA', 'XOM',
  'CVX', 'WMT', 'COST', 'PYPL', 'CRM', 'ORCL', 'QCOM', 'TSM', 'NIO', 'F',
  'GM', 'C', 'WFC', 'GS', 'PFE', 'LLY', 'UNH', 'V', 'HOOD', 'SHOP',
];

function extractFmpRows(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.historical || obj.data || obj.results;
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function buildYahooSymbolCandidates(symbol: string): string[] {
  const candidates = [symbol];
  if (symbol.includes('.')) {
    candidates.push(symbol.replace(/\./g, '-'));
  }
  const cryptoMatch = symbol.match(/^([A-Z]{2,6})USDT?$/);
  if (cryptoMatch) {
    candidates.push(`${cryptoMatch[1]}-USD`);
  }
  if (/^[A-Z]{6}$/.test(symbol)) {
    candidates.push(`${symbol}=X`);
  }
  return Array.from(new Set(candidates));
}

async function fetchYahooBars(
  symbol: string,
  fromDate: string,
  toDate: string,
  interval: ChartInterval
): Promise<{ bars: DailyBar[]; clampedDays: number | null }> {
  const cfg = INTERVAL_CONFIG[interval];
  const nowMs = Date.now();
  const rawToMs = toDate ? Date.parse(`${toDate}T23:59:59Z`) : nowMs;
  const effectiveToMs = cfg.intraday
    ? Math.min(nowMs, Number.isFinite(rawToMs) ? rawToMs : nowMs)
    : Number.isFinite(rawToMs)
      ? rawToMs
      : nowMs;

  const rawFromMs = fromDate
    ? Date.parse(`${fromDate}T00:00:00Z`)
    : effectiveToMs - Math.min(cfg.maxDays, 450) * 86400_000;
  const minAllowedFromMs = effectiveToMs - cfg.maxDays * 86400_000;
  const clamped = Number.isFinite(rawFromMs) && rawFromMs < minAllowedFromMs;
  const effectiveFromMs = Number.isFinite(rawFromMs)
    ? Math.max(rawFromMs, minAllowedFromMs)
    : minAllowedFromMs;

  const period1 = Math.floor(effectiveFromMs / 1000) - (cfg.intraday ? 0 : 86400);
  const period2 = Math.floor(effectiveToMs / 1000) + (cfg.intraday ? 60 : 86400);
  const effectiveFromDate = new Date(effectiveFromMs).toISOString().slice(0, 10);

  const symbolCandidates = buildYahooSymbolCandidates(symbol);
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

  for (const sym of symbolCandidates) {
    for (const host of hosts) {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(
        sym
      )}?period1=${period1}&period2=${period2}&interval=${encodeURIComponent(
        cfg.yfInterval
      )}&includePrePost=false`;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) continue;

        const json = (await res.json()) as {
          chart?: {
            result?: Array<{
              timestamp?: unknown[];
              indicators?: {
                quote?: Array<{
                  open?: unknown[];
                  high?: unknown[];
                  low?: unknown[];
                  close?: unknown[];
                  volume?: unknown[];
                }>;
              };
            }>;
          };
        };

        const result = json?.chart?.result?.[0];
        const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
        const quote = result?.indicators?.quote?.[0];
        if (!timestamps.length || !quote) continue;

        const opens = Array.isArray(quote.open) ? quote.open : [];
        const highs = Array.isArray(quote.high) ? quote.high : [];
        const lows = Array.isArray(quote.low) ? quote.low : [];
        const closes = Array.isArray(quote.close) ? quote.close : [];
        const volumes = Array.isArray(quote.volume) ? quote.volume : [];

        if (cfg.intraday) {
          const byTs = new Map<number, DailyBar>();
          for (let i = 0; i < timestamps.length; i++) {
            const ts = Number(timestamps[i]);
            const close = Number(closes[i]);
            if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) continue;
            if (ts < period1 || ts > period2) continue;

            const rawOpen = Number(opens[i]);
            const open = Number.isFinite(rawOpen) && rawOpen > 0 ? rawOpen : close;
            const rawHigh = Number(highs[i]);
            const high = Number.isFinite(rawHigh) && rawHigh > 0 ? rawHigh : Math.max(open, close);
            const rawLow = Number(lows[i]);
            const low = Number.isFinite(rawLow) && rawLow > 0 ? rawLow : Math.min(open, close);
            const rawVol = Number(volumes[i]);
            const volume = Number.isFinite(rawVol) && rawVol >= 0 ? Math.round(rawVol) : 0;

            byTs.set(ts, {
              date: new Date(ts * 1000).toISOString(),
              open: Number(open.toFixed(4)),
              high: Number(high.toFixed(4)),
              low: Number(low.toFixed(4)),
              close: Number(close.toFixed(4)),
              volume,
            });
          }

          if (byTs.size > 0) {
            const bars = Array.from(byTs.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([, bar]) => bar);
            return { bars, clampedDays: clamped ? cfg.maxDays : null };
          }
        } else {
          const byDate = new Map<string, DailyBar>();
          for (let i = 0; i < timestamps.length; i++) {
            const ts = Number(timestamps[i]);
            const close = Number(closes[i]);
            if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) continue;

            const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
            if (effectiveFromDate && dateStr < effectiveFromDate) continue;
            if (toDate && dateStr > toDate) continue;

            const rawOpen = Number(opens[i]);
            const open = Number.isFinite(rawOpen) && rawOpen > 0 ? rawOpen : close;
            const rawHigh = Number(highs[i]);
            const high = Number.isFinite(rawHigh) && rawHigh > 0 ? rawHigh : Math.max(open, close);
            const rawLow = Number(lows[i]);
            const low = Number.isFinite(rawLow) && rawLow > 0 ? rawLow : Math.min(open, close);
            const rawVol = Number(volumes[i]);
            const volume = Number.isFinite(rawVol) && rawVol >= 0 ? Math.round(rawVol) : 0;

            byDate.set(dateStr, {
              date: dateStr,
              open: Number(open.toFixed(4)),
              high: Number(high.toFixed(4)),
              low: Number(low.toFixed(4)),
              close: Number(close.toFixed(4)),
              volume,
            });
          }

          if (byDate.size > 0) {
            const bars = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
            return { bars, clampedDays: clamped ? cfg.maxDays : null };
          }
        }
      } catch {
        // Try next mirror or normalized symbol
      }
    }
  }

  return { bars: [], clampedDays: clamped ? cfg.maxDays : null };
}

async function fetchYahooEarningsCalendar(
  symbols: string[],
  fromDate: string,
  toDate: string
): Promise<EarningsRow[] | null> {
  if (!symbols.length) return [];
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  try {
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': ua },
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
    });

    const hdrs = r1.headers as Headers & { getSetCookie?: () => string[] };
    const rawCookies =
      typeof hdrs.getSetCookie === 'function'
        ? hdrs.getSetCookie()
        : (r1.headers.get('set-cookie') || '').split(/,(?=[^;]+=[^;]+)/).filter(Boolean);
    const cookieHeader = rawCookies
      .map((c) => c.split(';')[0])
      .filter(Boolean)
      .join('; ');

    const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': ua,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!r2.ok) return null;

    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.includes('<')) return null;

    const r3 = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        symbols.join(',')
      )}&crumb=${encodeURIComponent(crumb)}`,
      {
        headers: {
          'User-Agent': ua,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!r3.ok) return null;

    const json = (await r3.json()) as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          earningsTimestampStart?: number;
          earningsTimestamp?: number;
        }>;
      };
    };

    const items = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
    const rows: EarningsRow[] = [];
    for (const item of items) {
      const symbol = String(item.symbol || '').trim().toUpperCase();
      const ts = Number(item.earningsTimestampStart || item.earningsTimestamp || 0);
      if (!symbol || !Number.isFinite(ts) || ts <= 0) continue;
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      if (fromDate && date < fromDate) continue;
      if (toDate && date > toDate) continue;
      rows.push({ symbol, date });
    }
    return rows;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const [{ data: profile }, { data: membership }, settings] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('status, source, expires_at, grace_until')
      .eq('user_id', user.id)
      .maybeSingle(),
    readAppSettings(supabase, 'fmp_api_key'),
  ]);

  if (!evaluateMembershipAccess(profile, membership).allowed) {
    return NextResponse.json({ error: 'Membresía inactiva' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams;
  const base = (process.env.FMP_BASE_URL || 'https://financialmodelingprep.com/stable').replace(
    /\/$/,
    ''
  );
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = q.get('from_date') || '';
  const to = q.get('to_date') || '';
  if ((from && !dateRe.test(from)) || (to && !dateRe.test(to))) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }

  const endpoint = q.get('endpoint') || '';
  const tool = q.get('tool') || '';
  const p = new URLSearchParams();
  let path = '';
  let sym = '';
  let chartInterval: ChartInterval = '1day';
  let symbolsList: string[] = [];
  let ttlSec = 3600;
  let cacheKey = '';

  if (tool === 'chart' && endpoint === 'historical-price-eod-full') {
    sym = (q.get('symbol') || '').toUpperCase().trim();
    if (!/^[A-Z0-9.^=-]{1,15}$/.test(sym)) {
      return NextResponse.json({ error: 'Símbolo inválido' }, { status: 400 });
    }
    const rawInterval = (q.get('interval') || '1day').trim();
    if (!(rawInterval in INTERVAL_CONFIG)) {
      return NextResponse.json({ error: 'Intervalo inválido' }, { status: 400 });
    }
    chartInterval = rawInterval as ChartInterval;
    path = '/historical-price-eod/full';
    p.set('symbol', sym);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (chartInterval !== '1day') {
      p.set('interval', chartInterval);
    }
    ttlSec = INTERVAL_CONFIG[chartInterval].intraday ? 300 : 3600;
    cacheKey = `${path}?${p.toString()}`;
  } else if (tool === 'calendar' && endpoint === 'earnings-calendar') {
    path = '/earnings-calendar';
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const symbolsParam = (q.get('symbols') || '').toUpperCase().trim();
    const parsed = symbolsParam
      ? symbolsParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^[A-Z0-9.^=-]{1,12}$/.test(s))
      : DEFAULT_RADAR_SYMBOLS;
    symbolsList = Array.from(new Set(parsed)).slice(0, 75).sort();
    ttlSec = 21600;
    cacheKey = `${path}?${p.toString()}&symbols=${symbolsList.join(',')}`;
  } else {
    return NextResponse.json({ error: 'Consulta no permitida' }, { status: 403 });
  }

  const fmpKey = (settings?.fmp_api_key || process.env.FMP_API_KEY || '').trim();
  const inferredProvider =
    fmpKey && (endpoint === 'earnings-calendar' || chartInterval === '1day') ? 'fmp' : 'yahoo';

  const dbCache = createAdminClient() || supabase;

  // 1. Check shared Supabase market_cache first
  const { data: cached } = await dbCache
    .from('market_cache')
    .select('payload, expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cached?.payload) {
    return NextResponse.json(
      { payload: cached.payload, source: 'cache', provider: inferredProvider },
      {
        headers: {
          'cache-control': 'private, max-age=300',
        },
      }
    );
  }

  // 2. Earnings calendar: try FMP if configured, otherwise use built-in free Yahoo Finance calendar
  if (endpoint === 'earnings-calendar') {
    if (fmpKey) {
      try {
        const fmpRes = await fetch(
          `${base}${path}?${p.toString()}&apikey=${encodeURIComponent(fmpKey)}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (fmpRes.ok) {
          const payload = (await fmpRes.json()) as Json;
          await dbCache.from('market_cache').upsert(
            {
              cache_key: cacheKey,
              payload,
              expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
            },
            { onConflict: 'cache_key' }
          );
          return NextResponse.json(
            { payload, source: 'fmp', provider: 'fmp' },
            { headers: { 'cache-control': 'private, max-age=300' } }
          );
        }
      } catch {
        // Fall back to Yahoo Finance earnings calendar
      }
    }

    const yahooEarnings = await fetchYahooEarningsCalendar(symbolsList, from, to);
    if (yahooEarnings) {
      await dbCache.from('market_cache').upsert(
        {
          cache_key: cacheKey,
          payload: yahooEarnings as unknown as Json,
          expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
        },
        { onConflict: 'cache_key' }
      );
      return NextResponse.json(
        { payload: yahooEarnings as unknown as Json, source: 'yahoo', provider: 'yahoo' },
        { headers: { 'cache-control': 'private, max-age=300' } }
      );
    }

    return NextResponse.json({ payload: [], source: 'none', provider: 'none' });
  }

  // 3. OHLCV bars: try FMP only for 1day if key exists; otherwise use free Yahoo Finance (all intervals)
  let payload: unknown = null;
  let usedSource: 'fmp' | 'yahoo' = 'yahoo';
  let clampedDays: number | null = null;

  if (fmpKey && chartInterval === '1day') {
    try {
      const fmpRes = await fetch(
        `${base}${path}?${p.toString()}&apikey=${encodeURIComponent(fmpKey)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (fmpRes.ok) {
        const fmpJson = await fmpRes.json();
        const rows = extractFmpRows(fmpJson);
        if (rows && rows.length > 0) {
          payload = fmpJson;
          usedSource = 'fmp';
        }
      }
    } catch {
      // Fall back cleanly to Yahoo Finance
    }
  }

  if (!payload) {
    const yahooResult = await fetchYahooBars(sym, from, to, chartInterval);
    clampedDays = yahooResult.clampedDays;
    if (!yahooResult.bars.length) {
      return NextResponse.json(
        { error: `No se encontraron precios para ${sym}` },
        { status: 404 }
      );
    }
    payload = yahooResult.bars;
    usedSource = 'yahoo';
  }

  await dbCache.from('market_cache').upsert(
    {
      cache_key: cacheKey,
      payload: payload as Json,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    },
    { onConflict: 'cache_key' }
  );

  return NextResponse.json(
    {
      payload: payload as Json,
      source: usedSource,
      provider: usedSource,
      ...(clampedDays ? { clampedDays } : {}),
    },
    {
      headers: {
        'cache-control': 'private, max-age=300',
      },
    }
  );
}
