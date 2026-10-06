# Organización de las dos páginas

BTS Photo Experience es **una plataforma Next.js con dos interfaces distintas**. Sigue la instrucción posterior del propietario: una aplicación, con web de usuario en `/` y web de administrador en `/admin`.

El código de cada interfaz está separado en dos carpetas dentro de WEB:

```text
WEB/
├── package.json                  ← instalación y ejecución de toda la plataforma
├── src/
│   ├── usuario/                  ← interfaz de la página pública
│   │   └── experience.tsx
│   ├── administrador/            ← interfaz del administrador
│   │   ├── login.tsx
│   │   ├── panel.tsx
│   │   └── placement-editor.tsx
│   ├── app/                      ← entradas y rutas de Next.js
│   │   ├── page.tsx              ← abre la interfaz de usuario
│   │   ├── admin/                ← ingreso, panel y secciones protegidas
│   │   └── api/                  ← endpoints del servidor
│   ├── components/               ← controles visuales compartidos
│   ├── lib/                      ← autenticación, base, jobs y proveedores
│   └── types/                    ← tipos compartidos
├── supabase/                     ← migraciones y pruebas de la base
├── tests/                        ← pruebas unitarias y de navegador
└── docs/                         ← documentación
```

| Página | URL local | Entrada | Interfaz |
| --- | --- | --- | --- |
| Usuario | http://localhost:3000 | `src/app/page.tsx` | `src/usuario/experience.tsx` |
| Ingreso administrador | http://localhost:3000/admin/login | `src/app/admin/login/page.tsx` | `src/administrador/login.tsx` |
| Panel administrador | http://localhost:3000/admin | `src/app/admin/page.tsx` | `src/administrador/panel.tsx` |

Se instala y se inicia desde **WEB**, con un solo package.json:

```powershell
npm ci
npm run dev
```

No hay que iniciar dos servidores. Ambas interfaces comparten Supabase, el servidor, tipos, configuración y estilos base; cada una tiene su propio flujo y permisos. La protección administrativa se verifica en el servidor.

Las fotos de artistas se suben exclusivamente en el administrador. Al activar un artista y una de sus plantillas, aparece automáticamente en la página del usuario. No hace falta editar ni volver a publicar el código para añadir esas fotos.

## Estado de activación

La cuenta administradora y la carga real de imágenes se comprobaron. Las credenciales locales se conservan en archivos privados excluidos de Git. La organización de carpetas no modifica esos archivos.

Estado para utilizar el flujo con visitantes reales:

1. Anonymous Sign-In ya está habilitado y se verificó con solicitudes y aprobaciones reales.
2. Subir y activar las plantillas reales de artistas desde el administrador; la última comprobación encontró ocho artistas y cero plantillas.
3. Resolver el saldo de OpenAI; la última edición real devolvió `credit_balance_exhausted`. No se ha generado todavía una imagen real con OpenAI en las pruebas.
4. Importar el repositorio AndreZarate2/BTS en Vercel y configurar las variables del hosting para acceso desde Internet.

Qwen necesita un endpoint GPU externo para probarse con imágenes reales. La composición local funciona como alternativa, con calidad distinta a la generación por IA. Los resultados y límites de las pruebas están en `../AUDIT_REPORT.md`.
