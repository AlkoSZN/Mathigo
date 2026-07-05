import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * Store d'authentification.
 * `session` : undefined tant que la session initiale n'est pas connue,
 * puis null (déconnecté) ou l'objet session Supabase.
 */
export const useAuth = create((set) => ({
  session: undefined,

  /**
   * Charge la session courante et s'abonne aux changements d'état d'auth.
   * @returns {() => void} fonction de désabonnement
   */
  init: () => {
    supabase.auth.getSession().then(({ data }) => set({ session: data.session }))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => set({ session }))
    return () => subscription.unsubscribe()
  },
}))
