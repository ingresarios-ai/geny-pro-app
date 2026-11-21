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

function extractFmpRows(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.historical || obj.data || obj.results;
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

async function fetchYahooDailyBars(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<DailyBar[]> {
  const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00Z`) : Date.parse('2024-01-01T00:00:00Z');
  const toMs = toDate ? Date.parse(`${toDate}T23:59:59Z`) : Date.now();
  const period1 = Math.floor((Number.isFinite(fromMs) ? fromMs : Date.now() - 450 * 86400_000) / 1000) - 86400;
  const period2 = Math.floor((Number.isFinite(toMs) ? toMs : Date.now()) / 1000) + 86400;

  const symbolCandidates = symbol.includes('.')
    ? [symbol, symbol.replace(/\./g, '-')]
    : [symbol];
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

  for (const sym of symbolCandidates) {
    for (const host of hosts) {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(
        sym
      )}?period1=${period1}&period2=${period2}&interval=1d`;
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

        const byDate = new Map<string, DailyBar>();
        for (let i = 0; i < timestamps.length; i++) {
          const ts = Number(timestamps[i]);
          const close = Number(closes[i]);
          if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) continue;

          const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
          if (fromDate && dateStr < fromDate) continue;
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
          return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        }
      } catch {
        // Try next mirror or normalized symbol
      }
    }
  }

  return [];
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
  let ttlSec = 3600;

  if (tool === 'chart' && endpoint === 'historical-price-eod-full') {
    sym = (q.get('symbol') || '').toUpperCase();
    if (!/^[A-Z0-9.^=-]{1,12}$/.test(sym)) {
      return NextResponse.json({ error: 'Símbolo inválido' }, { status: 400 });
    }
    path = '/historical-price-eod/full';
    p.set('symbol', sym);
    ttlSec = 3600;
  } else if (tool === 'calendar' && endpoint === 'earnings-calendar') {
    path = '/earnings-calendar';
    ttlSec = 21600;
  } else {
    return NextResponse.json({ error: 'Consulta no permitida' }, { status: 403 });
  }

  if (from) p.set('from', from);
  if (to) p.set('to', to);

  const cacheKey = `${path}?${p.toString()}`;
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
      { payload: cached.payload, source: 'cache' },
      {
        headers: {
          'cache-control': 'private, max-age=300',
        },
      }
    );
  }

  const fmpKey = (settings?.fmp_api_key || process.env.FMP_API_KEY || '').trim();

  // 2. Earnings calendar: use FMP when configured, otherwise return empty list cleanly
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
            { payload, source: 'fmp' },
            { headers: { 'cache-control': 'private, max-age=300' } }
          );
        }
      } catch {
        // Return empty earnings cleanly if FMP calendar times out
      }
    }
    return NextResponse.json({ payload: [], source: 'none' });
  }

  // 3. Daily OHLCV bars: try FMP if key exists, otherwise / on fallback use built-in free Yahoo Finance
  let payload: unknown = null;
  let usedSource: 'fmp' | 'yahoo' = 'yahoo';

  if (fmpKey) {
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
    const yahooBars = await fetchYahooDailyBars(sym, from, to);
    if (!yahooBars.length) {
      return NextResponse.json(
        { error: `No se encontraron precios para ${sym}` },
        { status: 404 }
      );
    }
    payload = yahooBars;
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
    { payload: payload as Json, source: usedSource },
    {
      headers: {
        'cache-control': 'private, max-age=300',
      },
    }
  );
}
