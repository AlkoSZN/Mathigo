import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. ' +
      'Copier .env.example vers .env.local et remplir avec les valeurs de `npx supabase start`.',
  )
}

/** Client Supabase partagé (auth, données). */
export const supabase = createClient(url, anonKey)
