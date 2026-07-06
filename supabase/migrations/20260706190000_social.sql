-- Social (phase 6) : classement hebdomadaire entre amis et demandes d'amitié.
-- Les RLS de profiles/attempts ne permettent pas de lire les données des amis
-- en agrégat ni de chercher un utilisateur par e-mail : on passe par des
-- fonctions SECURITY DEFINER qui vérifient toujours auth.uid().

-- XP hebdomadaire approximé : 10 par bonne réponse depuis le début de la
-- semaine (lundi). L'XP exact par tentative n'est pas journalisé en v1.
create or replace function public.classement_hebdo()
returns table (user_id uuid, display_name text, avatar text, xp_semaine bigint)
language sql
security definer
set search_path = ''
as $$
  with membres as (
    select (select auth.uid()) as uid
    union
    select case
      when f.user_id = (select auth.uid()) then f.friend_id
      else f.user_id
    end
    from public.friendships f
    where f.status = 'accepted'
      and (select auth.uid()) in (f.user_id, f.friend_id)
  )
  select p.user_id, p.display_name, p.avatar,
         coalesce(10 * count(a.id) filter (where a.correct), 0)::bigint as xp_semaine
  from membres m
  join public.profiles p on p.user_id = m.uid
  left join public.attempts a
    on a.user_id = p.user_id
   and a.created_at >= date_trunc('week', now())
  group by p.user_id, p.display_name, p.avatar
  order by xp_semaine desc, p.display_name;
$$;

-- Demande d'amitié par e-mail. Si la personne m'a déjà envoyé une demande,
-- elle est acceptée directement.
create or replace function public.demander_ami(cible_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cible uuid;
begin
  select u.id into cible from auth.users u where lower(u.email) = lower(cible_email);
  if cible is null then
    raise exception 'Aucun compte avec cet e-mail.';
  end if;
  if cible = (select auth.uid()) then
    raise exception 'Tu ne peux pas t''ajouter toi-même.';
  end if;
  if exists (
    select 1 from public.friendships
    where user_id = cible and friend_id = (select auth.uid()) and status = 'pending'
  ) then
    update public.friendships set status = 'accepted'
    where user_id = cible and friend_id = (select auth.uid());
  else
    insert into public.friendships (user_id, friend_id, status)
    values ((select auth.uid()), cible, 'pending')
    on conflict (user_id, friend_id) do nothing;
  end if;
end;
$$;

-- Demandes reçues en attente, avec le pseudo du demandeur (invisible via les
-- RLS de profiles tant que l'amitié n'est pas acceptée).
create or replace function public.demandes_recues()
returns table (user_id uuid, display_name text)
language sql
security definer
set search_path = ''
as $$
  select f.user_id, p.display_name
  from public.friendships f
  join public.profiles p on p.user_id = f.user_id
  where f.friend_id = (select auth.uid()) and f.status = 'pending';
$$;

revoke execute on function public.classement_hebdo() from public, anon;
revoke execute on function public.demander_ami(text) from public, anon;
revoke execute on function public.demandes_recues() from public, anon;
grant execute on function public.classement_hebdo() to authenticated;
grant execute on function public.demander_ami(text) to authenticated;
grant execute on function public.demandes_recues() to authenticated;
