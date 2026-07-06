-- Le CLI Supabase n'expose plus automatiquement les nouvelles tables aux rôles
-- de la Data API (comportement « auto_expose_new_tables » désactivé par défaut) :
-- les RLS ne suffisent pas, il faut des GRANTs explicites par rôle et par opération.

grant select on public.skills to authenticated;
grant select on public.exercises to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.attempts to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
