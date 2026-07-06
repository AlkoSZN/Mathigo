-- Le rôle service (pipeline de génération, administration) a besoin de GRANTs
-- explicites comme les autres rôles Data API — il contourne les RLS mais pas
-- les privilèges de table.

grant select, insert, update, delete on all tables in schema public to service_role;
