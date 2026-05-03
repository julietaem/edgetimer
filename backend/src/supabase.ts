import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Faltan variables de entorno de Supabase');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

export const createSupabaseUserClient = (accessToken: string) =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
