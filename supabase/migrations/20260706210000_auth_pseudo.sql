-- Authentification par pseudo + mot de passe (retrait du lien magique par
-- e-mail). Le client construit un e-mail technique <pseudo>@mathigo.local,
-- jamais envoyé ni vérifié : l'unicité de cet e-mail dans auth.users assure
-- l'unicité du pseudo. Le pseudo réel est passé en métadonnées à l'inscription
-- (raw_user_meta_data->>'username') pour peupler display_name correctement.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;
