// The Supabase connection, for testing the app across two phones.
//
// Both values come from a .env file that is NOT committed (see .env.example).
// When either is missing the client is null and the app runs exactly as it did
// before — localStorage only, single device. That fallback is deliberate: the
// Android APK and the offline preview must keep working with no backend.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured
  ? createClient(url, key, {
      // No Supabase Auth yet — the app still uses its own localStorage login,
      // so there is no session for the client to persist or refresh.
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null
