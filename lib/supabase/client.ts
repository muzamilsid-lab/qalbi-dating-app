import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Fallbacks prevent throws during Next.js SSR/build when env vars are not
  // yet injected. The real values must be set in Vercel env vars for the app
  // to actually function — these placeholders only exist to satisfy the
  // createBrowserClient constructor at build time.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL      ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  );
}
