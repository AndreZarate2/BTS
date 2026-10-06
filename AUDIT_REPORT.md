# Auditoría y entrega — BTS Photo Experience

## Versión preparada para GitHub — 6 de octubre de 2026

Repositorio autorizado: https://github.com/AndreZarate2/BTS. Aplicación real, con `BTS_DEMO_MODE=false` e `IMAGE_PROVIDER_MODE=auto`. El modo mock está bloqueado en producción/Vercel. La cuenta administrativa, el almacenamiento privado y Anonymous Sign-In están configurados. Las secciones posteriores conservan el historial de verificaciones anteriores.

- Compilación de producción, TypeScript, lint y 58 pruebas unitarias: PASS.
- Siete tamaños: escritorio, 320/360/390/430 px, horizontal 844×390 y tablet 768×1024. Se corrigió el ancho mínimo de la tabla administrativa; los cuatro escenarios de tablet/horizontal pasaron al repetirse. Los otros diez escenarios habían pasado. GitHub Actions ejecutará los 14 escenarios en Linux.
- Auditoría npm de dependencias de producción: cero vulnerabilidades. Los avisos de herramientas de desarrollo siguen documentados más abajo.
- Servidor compilado real: login administrativo, alta anónima, solicitud pendiente, aprobación, carga privada de plantilla y selfie, generación persistente, descarga JPEG, rechazo de segunda descarga y estado CONSUMED: PASS. El motor usado fue `local_composite`, con fallback real por falta de saldo de OpenAI.
- Realtime: entrega de aprobación confirmada después de esperar la señal de suscripción de PostgreSQL. El cliente conserva recuperación por consulta cada cinco segundos para cambios que ocurren durante la conexión o una interrupción.
- Se retiraron el visitante, artista, plantillas, fotos y registros sintéticos creados durante estas pruebas. Las fotos definitivas las carga el propietario desde el administrador.

La llamada directa de edición OpenAI devolvió HTTP 429 / `credit_balance_exhausted`. No se afirma una generación real OpenAI ni Qwen; Qwen necesita un endpoint GPU. Vercel se desplegará después desde el repositorio, con sus variables privadas. Las claves locales no se incluyen en Git.

Revisión: 5–6 de octubre de 2026. Una aplicación Next.js, raíz única, preparada para ejecución local y configuración del hosting. No se ha publicado en GitHub ni Vercel. La demo funciona sin servicios externos. El servicio con datos reales necesita las credenciales y activaciones enumeradas al final.

## Baseline conservado

Antes de modificar, WEB contenía dos aplicaciones independientes, administrador en 3001 y usuario en 3000. Ambas tenían src/app/page.tsx; no faltaba un index.html. Faltaban package.json raíz, /admin, /admin/login y una entrada unificada. Los lockfiles pnpm no correspondían al npm ci solicitado.

Supabase real tenía seis tablas públicas, dos privadas, ocho artistas, tres buckets privados, dos migraciones y Edge Function bts-api v3. No había cuentas, perfiles ni plantillas reales. Anonymous Sign-In estaba deshabilitado. El respaldo de las fuentes iniciales se conserva en un ZIP separado del repositorio.

Se confirmaron dos hallazgos medios: la carga concurrente podía dejar imágenes huérfanas y el límite de cuerpos dependía de Content-Length. También se identificó retención incompleta de experiencias abandonadas. No había jobs persistentes, Qwen, router de fallbacks, compositor local, mock completo, editor de placement, aprobación múltiple ni preparación de raíz para Vercel.

## Cambios implementados

- Una raíz npm/Next.js con src/app; `/`, `/admin`, `/admin/login` y siete secciones administrativas.
- API del mismo origen, autorización administrativa en servidor, cookies HttpOnly, membresía privada, CSRF, rate limits atómicos y mensajes de error saneados.
- Jobs persistentes con enqueue idempotente, restricción de job activo, bloqueo, lease y token de finalización; recuperación de cola y reintento explícito limitado.
- Interfaz de motores OpenAI, Qwen, composición local y mock; registro de motor, tiempo y fallback. Rechazos de seguridad/autorización no se derivan a otro motor.
- Carga real de plantillas desde el administrador, miniaturas privadas, disponibilidad automática por catálogo, selección aleatoria en servidor y placement editable.
- Aprobación múltiple, búsqueda/filtros, historial, reactivación con nueva sesión, vista de generaciones, previsualización y comprobación Qwen.
- Realtime por usuario con RLS, limpieza de listeners y polling para recuperar cambios.
- Límite de bytes durante lectura del stream, comprobación MIME/decodificación, eliminación de EXIF, JPEG canónico y UUID en rutas.
- Registro de todos los objetos personales y sustitución que devuelve la ruta previa bajo bloqueo; limpieza recuperable de objetos y sesiones abandonadas. Conservación del estado histórico CONSUMED al purgar las fotos.
- Scripts npm, lockfile reproducible, configuración VS Code en puerto 3000, archivo de inicio Windows, Git inicializado, exclusiones de secretos y documentación de despliegue.
- Se eliminaron las dos raíces obsoletas después del respaldo y migración. La Edge Function antigua ahora devuelve 410 y no ejecuta operaciones. Su gateway conserva verify_jwt=true.
- Sharp actualizado a 0.35.5 para corregir los avisos de sus bibliotecas de imágenes. Se corrigieron una carrera de navegación administrativa, la comprobación Origin/Host local, codificaciones y finales de línea.

## Estado real de Supabase

Solo se intervino `pchyfdbbjeouqopudogj`. Cuatro migraciones aplicadas y sincronizadas con archivos locales. Ocho artistas y cero perfiles/plantillas/jobs reales al finalizar las pruebas iniciales. Posteriormente se creó y verificó una cuenta administradora real; sus credenciales permanecen privadas. Los datos sintéticos SQL fueron revertidos con ROLLBACK.

Los tres buckets siguen privados, con JPEG/PNG/WebP y límites 10/10/20 MiB. Realtime publica user_access, photo_sessions y generation_jobs. Las tablas de usuarios permiten únicamente SELECT propio a authenticated; mutations, tablas de catálogo y RPC de confianza están restringidas al servidor. Los administradores requieren metadata protegida y membresía privada.

Security Advisor: cero WARN/ERROR, seis INFO de RLS sin políticas cliente en tablas exclusivas del servidor. Performance Advisor: doce INFO de índices aún sin uso; se mantienen por el diseño de accesos y FK. Véanse [RLS sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

La clave pública proporcionada se verificó con HTTP 200. Anonymous Sign-In continúa deshabilitado. SUPABASE_SECRET_KEY ya quedó configurada localmente y verificada con Data API y Auth Admin. La cuenta administradora del propietario ya fue creada, con metadata y membresía protegidas; su inicio de sesión y consulta del panel real devolvieron HTTP 200. El conector MCP permitió auditar/migrar la base, pero no proporciona esa clave privada ni modifica la configuración de Auth.

## Verificaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| npm ci en WEB y en copia limpia sin secretos | PASS, 407 paquetes |
| npm run build en copia limpia sin .env.local | PASS |
| npm run build en carpeta WEB | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | 53/53 PASS, incluyendo Sharp actualizado |
| npm run test:e2e | 8/8 PASS: escritorio 1440 y móviles 360, 390, 430 |
| supabase/tests/acceptance.sql | PASS en Supabase real, ROLLBACK |
| supabase/tests/jobs-acceptance.sql | PASS en Supabase real, ROLLBACK |
| npm run check:repo | PASS: imports con mayúsculas exactas, rutas y patrones de secretos |
| git diff --check / exclusiones | PASS después de normalizar finales de línea |
| Búsqueda de clave OpenAI real en .next/static | 0 coincidencias |
| npm audit --omit=dev | 0 vulnerabilidades |
| npm run start / HTTP | / y /admin/login: 200; /admin y /admin/users: 307 al login |
| Mantenimiento sin secreto / login demo en producción | 401 / 401 |
| OpenAI: acceso al modelo deseado | 200 |
| OpenAI: edición real con imágenes sintéticas | 429, credit_balance_exhausted; no se obtuvo imagen |

El E2E ejecuta la aplicación y API HTTP reales en demo local aislada; no intercepta las rutas del navegador. Cubre carga WebP, placement, nombre, espera, aprobación múltiple, asignación persistente tras refrescar, selfie, job mock, READY, descarga, rechazo del segundo intento y reactivación. SQL cubre propiedad, RLS, grants, bloqueo administrativo, idempotencia, tokens, retención y huérfanos. La prueba de Supabase Auth/Realtime extremo a extremo con credenciales reales queda pendiente de habilitar Anonymous Sign-In; la clave secreta local ya está configurada y verificada.

Se inspeccionaron capturas en escritorio y móvil; no se detectó desbordamiento horizontal. No se ejecutó el proyecto en hardware móvil ni en Linux/Vercel; se revisaron imports, case sensitivity y ausencia de rutas absolutas, y se compiló una copia independiente en Windows.

## Aviso de desarrollo pendiente

La auditoría completa npm conserva cinco avisos HIGH derivados de una sola dependencia transitiva de lint: braces 3.0.3, usada por fast-glob dentro de eslint-config-next. No hay versión corregida publicada. La ruta afectada requiere patrones en settings.next.rootDir; esta configuración no la usa y no recibe datos del navegador. No está en las dependencias de producción. Se mantiene la versión compatible de Next/ESLint; no se degradó Next para silenciar el aviso. ESLint 9 también emite aviso de fin de soporte. Reevaluar al actualizar las herramientas de lint. [Aviso oficial de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

La revisión de seguridad fue estática y con pruebas dirigidas; no certifica terceros, un endpoint GPU inexistente ni resistencia a tráfico de producción. Los dos hallazgos del baseline se corrigieron en la arquitectura actual y se verificaron con pruebas de bytes, reemplazos, grants y propiedad.

## Activaciones externas pendientes

1. Configurar la clave secreta en Vercel al desplegar; localmente ya está guardada y verificada. Habilitar Anonymous Sign-In; la cuenta administradora ya está creada y verificada. Sustituir la clave compartida en el chat antes de producción.
2. Añadir saldo a la cuenta OpenAI. La clave quedó únicamente en .env.local; sustituirla antes de producción porque fue compartida en el chat.
3. Para Qwen real, proporcionar URL/token de una GPU compatible. El adaptador y health check ya están implementados; sin infraestructura no se afirma una generación real Qwen.
4. Autorizar/conectar GitHub y Vercel, copiar el CRON_SECRET generado localmente y configurar las variables del hosting. Las plataformas no fueron publicadas desde esta entrega.
5. Subir imágenes de artistas autorizadas desde /admin y verificar el resultado real antes del evento.

El compositor local funciona con segmentación clásica y se beneficia de fondo liso contrastante; su calidad es inferior a un modelo generativo. La demo permite revisar toda la experiencia inmediatamente con `npm run demo`.

## Activación administrativa posterior

Cuenta administradora configurada localmente por el propietario. Contraseña temporal guardada únicamente en .env.admin.local, excluido de Git. La aplicación está iniciada en modo real con npm run dev. Verificados login, /admin y admin_dashboard (HTTP 200), ocho artistas y cookies HttpOnly. El acceso anónimo continúa pendiente de activación en Supabase. La revisión automática del navegador no pudo completarse por falta de créditos del espacio de trabajo, por lo que no se cambió esa configuración desde el navegador.

Prueba administrativa real adicional: carga WebP a un artista de QA deshabilitado, miniatura JPEG firmada (HTTP 200), activación/desactivación y retirada correctas. Se eliminaron los objetos y registros temporales al terminar; el catálogo conserva sus ocho artistas originales y no se dejaron plantillas de prueba.

## Organización de interfaces — 6 de octubre de 2026

Se separó el código público en `src/usuario` y el administrativo en `src/administrador`. Las entradas `src/app/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx` y las secciones conservan sus URLs y la autorización del servidor. Se mantiene una sola aplicación y un package.json, conforme a la instrucción posterior del propietario. Se añadieron README por interfaz y `docs/ORGANIZACION.md`.

Verificado después de mover los archivos: typecheck, lint, compilación de producción, 53 pruebas unitarias, comprobación de imports/secretos y dos pruebas E2E de escritorio, todas correctas. El E2E volvió a cubrir el flujo completo en demo: carga administrativa, aprobación, selfie, generación mock, descarga única y reactivación. Las ocho pruebas de escritorio/móviles de la revisión anterior siguen documentadas arriba; en esta reorganización se repitieron las dos de escritorio.

Consulta real de solo lectura realizada en esta revisión: Auth settings HTTP 200, acceso anónimo deshabilitado; ocho artistas y cero plantillas. Sigue pendiente habilitar Anonymous Sign-In y subir las fotos reales desde el administrador. La última prueba de edición OpenAI devolvió falta de saldo; no se repitió una solicitud facturada durante esta reorganización. GitHub y Vercel siguen sin publicar. Los avisos de dependencias de desarrollo descritos arriba continúan pendientes.
