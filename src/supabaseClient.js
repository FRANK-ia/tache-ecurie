import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. Voir .env.example.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// V1 mono-centre : identifiant fixe du centre unique (voir brief §1).
export const CENTRE_ID = '00000000-0000-0000-0000-000000000001'
