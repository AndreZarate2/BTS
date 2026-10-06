# Web de administrador

- `login.tsx`: formulario de ingreso.
- `panel.tsx`: dashboard, usuarios, solicitudes, artistas, plantillas, generaciones, actividad y configuración.
- `placement-editor.tsx`: posición y tamaño de la persona en la plantilla.

Las entradas de Next.js están en `../app/admin/`. El ingreso se abre en `/admin/login`; el panel en `/admin`. Las páginas y API administrativas comprueban autorización en el servidor.

Las fotos de artistas se suben desde este panel y se guardan en Storage privado. Solo los artistas activos con plantillas activas aparecen al usuario.

Ejecuta `npm run dev` desde la raíz WEB, donde está package.json. Esta carpeta es parte de la aplicación compartida.
