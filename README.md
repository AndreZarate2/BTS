# BTS Photo Experience

[![Verify application](https://github.com/AndreZarate2/BTS/actions/workflows/ci.yml/badge.svg)](https://github.com/AndreZarate2/BTS/actions/workflows/ci.yml)

Una aplicación Next.js con experiencia pública en `/`, administrador en `/admin` e ingreso en `/admin/login`. Las fotos de los artistas se cargan exclusivamente desde el panel. La raíz con este README y package.json es la raíz de GitHub y Vercel.

## Carpetas de usuario y administrador

El código de las dos páginas está separado dentro de esta raíz:

| Carpeta | Contenido |
| --- | --- |
| `src/usuario/` | Interfaz pública de `/` |
| `src/administrador/` | Login, panel y editor de plantillas de `/admin` |
| `src/app/` | Entradas de las páginas y API, con protección administrativa en servidor |
| `src/components/`, `src/lib/`, `src/types/` | Componentes, backend y tipos compartidos |

Se instala y se ejecuta toda la plataforma desde WEB, con un solo package.json. Lee [organización de las dos páginas](docs/ORGANIZACION.md) para ubicar cada archivo y ruta.

## LOCAL DEVELOPMENT — WINDOWS / VISUAL STUDIO CODE

1. Instala Node.js 22 LTS o posterior compatible y Git. En Visual Studio Code: **Archivo → Abrir carpeta** y selecciona la carpeta que contiene package.json. En Visual Studio: **Abrir → Carpeta**. No se necesita solución .sln ni index.html.
2. Si partes de GitHub: `git clone https://github.com/AndreZarate2/BTS.git bts-photo-experience`, después `cd bts-photo-experience`.
3. En PowerShell copia el ejemplo solo cuando no exista configuración local:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

4. Abre http://localhost:3000 y http://localhost:3000/admin. `INICIAR.cmd` también inicia desarrollo cuando Node/npm están instalados.
5. Para datos reales completa `SUPABASE_SECRET_KEY` en .env.local, conserva la URL/clave pública del proyecto, verifica Anonymous Sign-In y tu administrador según [SUPABASE](docs/SUPABASE.md). Configura la clave OpenAI únicamente en .env.local o Vercel. Reinicia el servidor al cambiar el entorno.

## Uso real

`npm run dev` y `npm run build` / `npm run start` usan autenticación, base de datos, almacenamiento y proveedores reales. La configuración normal es `BTS_DEMO_MODE=false` e `IMAGE_PROVIDER_MODE=auto`. No existe entrada de demostración en producción. El proveedor `mock` se rechaza en producción y Vercel.

Las fotos de artistas se cargan desde el administrador. La web pública muestra únicamente artistas activos con plantillas activas. Para una edición generativa se necesita saldo/cuota en OpenAI o Gemini, o un endpoint Qwen. Gemini analiza las fotos y revisa la composición con consentimiento v2. El modo automático nunca entrega un recorte local como resultado. Consulta [los proveedores y sus requisitos](docs/IMAGE_PROVIDERS.md). También existe el modo `qwen_free`, que conecta Qwen-Image-Edit-2511 al Space comunitario acelerado de LPX55 con una cuenta gratuita de Hugging Face, cuota diaria compartida y consentimiento específico. Lee [Qwen gratuito](docs/QWEN_GRATUITO.md) antes de activarlo.

## Pruebas locales aisladas para desarrollo

```powershell
npm run demo
```

Detén primero otro servidor del puerto 3000. En `/admin/login` pulsa **Entrar a la demo**, sube una imagen genérica desde **Artistas y plantillas** y abre `/` en otra pestaña. Solicita acceso, apruébalo, selecciona artista, sube selfie y prueba generación/descarga. Los datos son temporales y se pierden al reiniciar. Esta demo solo funciona en desarrollo local; no puede activarse en producción o Vercel. `IMAGE_PROVIDER_MODE=mock` se limita a desarrollo local/pruebas; se rechaza en producción y Vercel.

## Entradas y comandos

| URL | Archivo |
| --- | --- |
| `/` | `src/app/page.tsx` |
| `/admin` | `src/app/admin/page.tsx` |
| `/admin/login` | `src/app/admin/login/page.tsx` |
| Secciones administrativas | `src/app/admin/[section]/page.tsx` |
| API | `src/app/api/bts/route.ts` |

```powershell
npm run typecheck
npm run lint
npm test
npm run check:repo
npm run test:e2e
npm run build
npm run start
```

La matriz E2E cubre escritorio, móviles de 320/360/390/430 px, orientación horizontal y tablet de 768 px. E2E utiliza Edge en Windows. En Linux instala Chromium con `npx playwright install --with-deps chromium`. Cierra cualquier servidor normal antes del E2E: el test inicia una demo aislada. La compilación funciona sin claves. Un servidor de producción con datos reales sí necesita sus variables.

Para una prueba real de OpenAI, facturada por el proveedor y con imágenes sintéticas: `node --env-file=.env.local scripts/smoke-openai.mjs`. No forma parte de `npm test`.

Para verificar el flujo real completo, con datos sintéticos temporales y limpieza al terminar: `node --env-file=.env.local --env-file=.env.admin.local scripts/smoke-live.mjs`. El segundo archivo privado debe declarar ADMIN_EMAIL y ADMIN_PASSWORD de un administrador existente. Esta prueba utiliza el proveedor real configurado y puede consumir saldo; no forma parte de CI. Los resultados quedan en test-results, excluido de Git.

## GitHub y Vercel

Revisa `.env.local` ignorado, ejecuta `npm run check:repo` y publica usando [GITHUB_AND_VERCEL](docs/GITHUB_AND_VERCEL.md). En Vercel importa el repositorio, elige Next.js, **Root Directory = .**, configura variables y despliega. No publiques .env.local ni .env.setup. El cron incluido requiere CRON_SECRET y una duración de funciones que admita hasta 300 segundos.

Lee [arquitectura](docs/ARCHITECTURE.md), [proveedores](docs/IMAGE_PROVIDERS.md), [seguridad](docs/SECURITY.md), [despliegue](docs/DEPLOYMENT.md) y [auditoría](AUDIT_REPORT.md).

## Montaje propio sin API de IA

El modo `browser_local` conserva la foto y permite ajustar el montaje antes de guardar, sin cuotas de generadores externos. Consulta [MONTAJE_LOCAL.md](docs/MONTAJE_LOCAL.md) para configuración, privacidad y límites.
