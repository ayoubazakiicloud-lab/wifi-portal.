-- ÉTAPE 1 : charger d'abord le schéma standard FreeRADIUS pour PostgreSQL
--   (fichier : /etc/freeradius/3.0/mods-config/sql/main/postgresql/schema.sql)
--   Il crée radcheck, radreply, radacct, radpostauth...
-- ÉTAPE 2 : exécuter ce fichier dans le SQL Editor de Supabase.

create table if not exists plans (
  id serial primary key,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_xof int not null default 0
);

create table if not exists vouchers (
  code text primary key,
  plan_id int not null references plans(id),
  status text not null default 'unused' check (status in ('unused','active','expired','disabled')),
  first_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists vouchers_status_idx on vouchers(status);

-- Accès uniquement via la clé service_role (le portail) et le rôle FreeRADIUS.
alter table plans enable row level security;
alter table vouchers enable row level security;

-- Génère des tickets : crée le voucher + les identifiants RADIUS (code = identifiant = mot de passe).
create or replace function generate_vouchers(p_plan int, p_qty int)
returns setof text language plpgsql as $$
declare v_code text; v_minutes int;
begin
  select duration_minutes into v_minutes from plans where id = p_plan;
  if v_minutes is null then raise exception 'Forfait % introuvable', p_plan; end if;
  for i in 1..p_qty loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into vouchers(code, plan_id) values (v_code, p_plan);
    insert into radcheck(username, attribute, op, value) values (v_code, 'Cleartext-Password', ':=', v_code);
    insert into radreply(username, attribute, op, value) values (v_code, 'Session-Timeout', ':=', (v_minutes * 60)::text);
    return next v_code;
  end loop;
end $$;

-- Exemples
insert into plans(name, duration_minutes, price_xof) values
  ('1 heure', 60, 100), ('1 jour', 1440, 300), ('1 semaine', 10080, 1500);
-- select * from generate_vouchers(1, 20);   -- 20 tickets d'1 heure
