import { createHandler } from './handler.js';
// These values exist only in the protected Supabase Edge runtime.
Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL'),
  clientKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serverKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
