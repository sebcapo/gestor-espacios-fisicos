# Migraciones

`schema.sql` es el esquema completo y actualizado, pensado para **instalaciones
nuevas**. Esta carpeta guarda los cambios incrementales que hay que aplicar, en
orden numérico (`NNN_*.sql`), sobre una base de datos que **ya existe**.

Aplícalas desde el SQL Editor de Supabase, una por una y en orden. Para una base
nueva no hace falta: basta `schema.sql` + los `seed_*.sql`.
