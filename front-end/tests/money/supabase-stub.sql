-- What Supabase already provides, so the real migrations run unchanged on a plain Postgres.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
