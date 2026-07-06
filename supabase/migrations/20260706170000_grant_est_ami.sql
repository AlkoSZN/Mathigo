-- La politique profiles_select_own_or_friend appelle private.est_ami : le rôle
-- authenticated doit pouvoir exécuter la fonction (le revoke initial sur public
-- avait aussi retiré ce droit) et voir le schéma private.

grant usage on schema private to authenticated;
grant execute on function private.est_ami(uuid) to authenticated;
