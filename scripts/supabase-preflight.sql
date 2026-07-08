-- Ejecutar en modo lectura antes de aplicar migraciones.
select current_database(), current_user, version();
select table_name from information_schema.tables where table_schema='public' order by table_name;
select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('clientes','facturas','tickets','registro_accesos') order by table_name,ordinal_position;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
select relname,n_live_tup,n_dead_tup,last_analyze from pg_stat_user_tables order by n_live_tup desc;
select indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname;
