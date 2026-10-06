# GitHub → Vercel

La raíz de repositorio es la misma carpeta con package.json. Las interfaces están en src/administrador y src/usuario, con entradas compartidas de Next.js en src/app. El ZIP original no se versiona.

Antes del primer commit:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run check:repo
npm run build
git init
git status
git check-ignore .env.local
git diff --check
git add .
git diff --cached --check
git commit -m "Initial production-ready BTS Photo Experience"
git branch -M main
git remote add origin https://github.com/AndreZarate2/BTS.git
git push -u origin main
```

Si ya hay remoto, inspecciona `git remote -v`; no lo reemplaces a ciegas. .env.local, .env.setup, node_modules, .next, cachés, ZIP y resultados de tests están ignorados. El lockfile y .env.example se versionan. No subas claves mediante README, commits ni archivos de pruebas.

En Vercel: conecta GitHub → Add New Project → Import repository → Framework Next.js → Root Directory `.` → configura [variables](DEPLOYMENT.md) → Deploy → revisa Build Logs y Function Logs. Conecta tu dominio y actualiza Site URL de Supabase cuando corresponda. No hay callbacks OAuth en el flujo actual. Las URLs internas relativas admiten dominios Preview.

Para validar una clonación limpia sin secretos: `git clone https://github.com/AndreZarate2/BTS.git`, `npm ci`, `npm run build`. Para usar datos reales después configura .env.local. `npm run demo` sirve para la verificación funcional local sin servicios externos.
