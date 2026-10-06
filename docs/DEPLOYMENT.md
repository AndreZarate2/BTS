# Despliegue

Vercel: Framework Next.js; Root Directory `.`; Install `npm ci`; Build `npm run build`; Output Directory automática. Node 24 LTS (verificado localmente y en la configuración de CI). No hay base de datos ni filesystem persistente local. Sharp usa Node.js runtime; las API largas declaran maxDuration=300. Verifica que el plan elegido admita esa duración y el cron incluido. Para trabajos/colas de alto volumen usa un worker externo; no alojes Qwen en Vercel.

Variables en **Project → Settings → Environment Variables**:

| Variable | Uso / entornos |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Pública; Development, Preview, Production |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Pública; los tres entornos |
| SUPABASE_SECRET_KEY | Solo servidor; los tres entornos con datos reales |
| OPENAI_API_KEY | Solo servidor, cuando se habilite OpenAI |
| OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY | sunburst / high; xhigh opcional |
| IMAGE_PROVIDER_MODE | auto en producción; local_only permite composición sin API; mock se bloquea en Vercel |
| QWEN_BASE_URL / QWEN_IMAGE_MODEL / QWEN_API_KEY | Servidor GPU opcional por entorno |
| PHOTO_RETENTION_HOURS | 24 por defecto |
| IMAGE_MAX_RETRIES | 2 intentos máximos por sesión |
| IMAGE_ENABLE_LOCAL_FALLBACK | true por defecto |
| IMAGE_PROVIDER_TIMEOUT_MS | 70000 por motor |
| CRON_SECRET | Secreto aleatorio de 32 caracteres o más |
| BTS_DEMO_MODE | false; demo aislada no funciona en Vercel |

Preview comparte el mismo Supabase autorizado; utiliza usuarios sintéticos e IMAGE_PROVIDER_MODE=local_only para comprobar la composición sin cargos de generación. No expongas una Preview a terceros como entorno aislado de producción porque comparte datos. Modificar variables públicas requiere nuevo build. Usa credenciales de alcance mínimo y no NEXT_PUBLIC para secretos.

`vercel.json` ejecuta mantenimiento a las 06:00 UTC diariamente. Vercel añade Authorization Bearer CRON_SECRET. En infraestructura externa, configura un secreto igual y usa `npm run worker` con `APP_ORIGIN=https://tu-dominio` en .env.local. El worker llama mantenimiento periódicamente y se detiene con Ctrl+C. También hay limpieza manual en /admin/settings. Supervisa errores, cola y retención.

Después de desplegar: comprueba `/`, redirección de `/admin`, login real, carga de plantilla, aprobación, generación, descarga única y reactivación con datos reales. Usa imágenes sintéticas para verificar la instalación y retíralas al terminar. La compilación local no certifica las credenciales del hosting o la GPU. Las pruebas realizadas y limitaciones están en AUDIT_REPORT.md.
