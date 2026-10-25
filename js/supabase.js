import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copia .env.example a .env.local y completa los datos públicos del proyecto Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
