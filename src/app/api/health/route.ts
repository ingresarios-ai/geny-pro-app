import { NextResponse } from 'next/server';
import { resolvePublicAppUrl } from '@/lib/app-url';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'geny-pro-app',
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      appUrl: Boolean(resolvePublicAppUrl()),
      geminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      fmpKey: Boolean(process.env.FMP_API_KEY),
    },
  });
}

