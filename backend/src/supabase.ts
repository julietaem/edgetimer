import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Faltan variables de entorno de Supabase');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY. El backend necesita la service role key para consultar datos protegidos sin activar recursiones de RLS.',
  );
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const createSupabaseUserClient = (accessToken: string) =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
