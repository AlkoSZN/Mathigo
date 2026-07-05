-- Mathigo — schéma initial (phase 1)
-- Tables : skills, exercises, attempts, reviews, profiles, friendships
-- RLS activées sur toutes les tables, politiques séparées par opération et par rôle.

-- Schéma privé pour les fonctions internes (jamais exposé via l'API)
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- skills — arbre de compétences (contenu public en lecture, géré par migrations/seed)
-- ---------------------------------------------------------------------------
create table public.skills (
  id          text primary key,
  branch      text not null,
  title       text not null,
  description text,
  position    int  not null,
  prereq_ids  text[] not null default '{}',
  icon        text
);

alter table public.skills enable row level security;

create policy "skills_select_authenticated"
  on public.skills for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- exercises — exercices validés (insérés par le pipeline avec la clé service)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  skill_id   text not null references public.skills (id) on delete cascade,
  difficulty int  not null check (difficulty between 1 and 5),
  payload    jsonb not null,
  validation text  not null default 'auto' check (validation in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create index exercises_skill_id_idx on public.exercises (skill_id);

alter table public.exercises enable row level security;

create policy "exercises_select_authenticated"
  on public.exercises for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- profiles — profil et gamification, créé automatiquement à l'inscription
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  avatar             text,
  xp                 int  not null default 0 check (xp >= 0),
  streak_days        int  not null default 0 check (streak_days >= 0),
  last_activity_date date
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- friendships — demandes et liens d'amitié (leaderboard)
-- ---------------------------------------------------------------------------
create table public.friendships (
  user_id   uuid not null references public.profiles (user_id) on delete cascade,
  friend_id uuid not null references public.profiles (user_id) on delete cascade,
  status    text not null default 'pending' check (status in ('pending', 'accepted')),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friendships_friend_id_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;

-- Vérifie qu'un lien d'amitié accepté existe entre l'utilisateur courant et `cible`.
-- SECURITY DEFINER : contourne les RLS de friendships pour éviter la récursion
-- de politiques ; l'identité de l'appelant est toujours vérifiée via auth.uid().
create or replace function private.est_ami(cible uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = (select auth.uid()) and f.friend_id = cible)
        or (f.friend_id = (select auth.uid()) and f.user_id = cible))
  );
$$;

revoke execute on function private.est_ami(uuid) from public, anon;

-- profiles : lecture de son propre profil et de ceux de ses amis (leaderboard)
create policy "profiles_select_own_or_friend"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()) or private.est_ami(user_id));

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- friendships : chacun voit les liens qui le concernent
create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- envoi d'une demande : toujours en 'pending', jamais au nom d'un autre
create policy "friendships_insert_own"
  on public.friendships for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- acceptation : seul le destinataire peut modifier le statut
create policy "friendships_update_recipient"
  on public.friendships for update
  to authenticated
  using (friend_id = (select auth.uid()))
  with check (friend_id = (select auth.uid()));

-- suppression : l'une ou l'autre des deux parties
create policy "friendships_delete_either_party"
  on public.friendships for delete
  to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- attempts — journal des tentatives (immuable : select + insert uniquement)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (user_id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete cascade,
  correct           bool not null,
  chosen_error_type text,
  duration_ms       int check (duration_ms >= 0),
  created_at        timestamptz not null default now()
);

create index attempts_user_id_created_at_idx on public.attempts (user_id, created_at desc);
create index attempts_exercise_id_idx on public.attempts (exercise_id);

alter table public.attempts enable row level security;

create policy "attempts_select_own"
  on public.attempts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "attempts_insert_own"
  on public.attempts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reviews — état FSRS par (utilisateur, compétence)
-- ---------------------------------------------------------------------------
create table public.reviews (
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  skill_id   text not null references public.skills (id) on delete cascade,
  fsrs_state jsonb not null,
  due_at     timestamptz not null,
  mastery    real not null default 0 check (mastery between 0 and 1),
  primary key (user_id, skill_id)
);

create index reviews_user_id_due_at_idx on public.reviews (user_id, due_at);

alter table public.reviews enable row level security;

create policy "reviews_select_own"
  on public.reviews for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "reviews_update_own"
  on public.reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (trigger sur auth.users)
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
