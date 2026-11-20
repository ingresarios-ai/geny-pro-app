import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { AppSettingsRow, Database } from '@/lib/database.types';

function cleanValidServiceKey(raw?: string): string | null {
  const cleaned = (raw || '').trim().replace(/^['"]|['"]$/g, '');
  if (!cleaned || cleaned.startsWith('sb_publishable_')) {
    return null;
  }
  if (cleaned.startsWith('eyJ')) {
    const parts = cleaned.split('.');
    if (parts.length === 3) {
      try {
        const parsed = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf8')
        ) as { role?: string };
        if (parsed?.role && parsed.role !== 'service_role') {
          return null;
        }
      } catch {
        // Ignore malformed base64 segment and let Supabase verify
      }
    }
  }
  return cleaned;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignored when called inside Server Components where cookies are read-only
          }
        },
      },
    }
  );
}

export function hasServiceRole(): boolean {
  return Boolean(cleanValidServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function createAdminClient() {
  const serviceKey = cleanValidServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceKey) {
    return null;
  }
  return createSupabaseAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function readAppSettings(
  userClient: Awaited<ReturnType<typeof createClient>>,
  columns = '*'
): Promise<Partial<AppSettingsRow> | null> {
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from('app_settings')
      .select(columns as '*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      return data as Partial<AppSettingsRow>;
    }
  }

  const { data: userData } = await userClient
    .from('app_settings')
    .select(columns as '*')
    .eq('id', 1)
    .maybeSingle();
  return (userData as Partial<AppSettingsRow> | null) ?? null;
}
