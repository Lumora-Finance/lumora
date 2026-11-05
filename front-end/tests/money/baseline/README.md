# Test baseline

The database schema up to the point the original migrations were removed from `supabase/migrations`, after the live database was changed directly. Tests build a throwaway database from these files, then apply `supabase/migrations` on top.

These files are never applied to a real database. If the live database changes outside a migration, repeat the change here or in a new migration, or tests will no longer match it.
