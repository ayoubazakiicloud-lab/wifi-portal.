# /etc/freeradius/3.0/mods-available/sql  (champs à modifier)

    sql {
        driver    = "rlm_sql_postgresql"
        dialect   = "postgresql"
        server    = "aws-0-REGION.pooler.supabase.com"   # Session pooler Supabase
        port      = 5432
        login     = "postgres.VOTRE_REF_PROJET"
        password  = "MOT_DE_PASSE_DB"
        radius_db = "postgres"
        read_clients = no
        pool { start = 2  min = 2  max = 10 }
    }

Puis :
    ln -s /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
    # Dans sites-enabled/default : décommenter « sql » dans authorize, accounting, session et post-auth
    systemctl restart freeradius
Test : radtest CODE CODE 127.0.0.1 0 testing123   (avec un client localhost déclaré)
