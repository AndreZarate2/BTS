# Supabase real: Web bts

Proyecto autorizado: `pchyfdbbjeouqopudogj`; URL `https://pchyfdbbjeouqopudogj.supabase.co`. El backend rechaza otras URLs. Las cuatro migraciones de `supabase/migrations` están aplicadas y corresponden al historial remoto. No vuelvas a ejecutar manualmente la migración inicial en este proyecto.

Hay ocho artistas iniciales y tres buckets privados: artist-templates, user-selfies y generated-images. Solo aparece un artista habilitado con una plantilla activa. El contenido real lo carga el propietario desde /admin. `templates.placement` guarda x, y, width, height, rotation, description y preferred_crop, con coordenadas normalizadas. Retirar una plantilla conserva referencias históricas.

RLS y GRANTS son independientes: authenticated puede leer únicamente su perfil, acceso, sesiones, jobs y eventos de descarga. No puede actualizar estados ni invocar RPC de confianza. Plantillas, catálogo y auditoría se sirven desde el backend autorizado. Las tablas privadas no tienen políticas cliente de forma intencional. Realtime publica user_access, photo_sessions y generation_jobs.

## Activación con credenciales del propietario

1. En **Project Settings → API Keys** obtén una clave secreta del proyecto y colócala como `SUPABASE_SECRET_KEY` en .env.local. La clave publicable pertenece exclusivamente a NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. El conector de auditoría no entrega claves secretas.
2. En **Authentication → Sign In / Providers → Anonymous** activa el acceso anónimo. Alternativamente copia .env.setup.example a .env.setup, configura tu SUPABASE_ACCESS_TOKEN y ejecuta `node --env-file=.env.setup scripts/configure-project.mjs`. Este script solo habilita Auth en el proyecto autorizado.
3. Completa SUPABASE_SECRET_KEY, ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 14 caracteres) en .env.setup; ejecuta `npm run bootstrap`. Crea cuenta real con app_metadata y membresía privada. Para cuenta existente usa `ADMIN_USER_ID` y `node --env-file=.env.setup scripts/register-admin.mjs`. No basta user_metadata.
4. Retira la contraseña y token de configuración al terminar. Conserva la clave del servidor en .env.local y configura una credencial equivalente en Vercel.

En la auditoría inicial no había cuentas reales ni plantillas. El 6 de octubre de 2026 se configuró la cuenta administradora y se activó Anonymous Sign-In; la API de Auth confirmó la activación. La conexión PostgreSQL, RLS, jobs y retención se verificaron también con transacciones revertidas. Las plantillas reales se cargan desde el panel.

## URLs y operación

Para este flujo de contraseña + Anonymous no hay callback OAuth. Configura Site URL con el dominio de producción; añade localhost y URLs Preview necesarias en Redirect URLs si incorporas recuperación por correo u OAuth. No uses comodines amplios para producción. Las rutas de la app son relativas y aceptan cada dominio Preview.

La antigua Edge Function bts-api permanece como respuesta 410 sin operaciones; la app usa `/api/bts` en Next.js. No configures OpenAI en esa función.

Ejecuta `supabase/tests/acceptance.sql` y `supabase/tests/jobs-acceptance.sql` con SQL Editor/CLI administrativo; ambas terminan con ROLLBACK y usan datos sintéticos. Security Advisor devolvió 6 avisos INFO de RLS sin política, intencionales para acceso exclusivo de servidor; ninguno WARN/ERROR. Performance Advisor devolvió 12 INFO de índices aún sin uso; se conservan para los accesos e integridad previstos. Referencias: [RLS sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Actualización de credenciales — 6 de octubre de 2026

La clave secreta del propietario quedó configurada en .env.local y verificada mediante lectura de artistas y Supabase Auth Admin. El acceso anónimo está habilitado y se verificó con un visitante real temporal. Solicitud, aprobación y evento Realtime recibidos correctamente. La cuenta administradora del propietario ya fue creada y autorizada mediante metadata y membresía privada. Login y panel real verificados con HTTP 200. Su contraseña temporal está en .env.admin.local, excluido de Git. La clave debe sustituirse antes de publicar porque fue compartida en el chat.
