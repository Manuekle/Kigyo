# Puesta en marcha

Pasos para llevar Kigyo de un checkout limpio a una instancia funcionando.
Nada aquí es opcional salvo lo marcado como tal.

---

## 1. Dependencias

```bash
npm install
```

Requiere Node 20 o superior.

---

## 2. Supabase

### 2.1 Crear el proyecto

En [supabase.com](https://supabase.com) crea un proyecto. Anota la región: si
la app se despliega en Vercel, elige la región más cercana a tu función, porque
cada consulta paga esa latencia.

### 2.2 Aplicar las migraciones

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

Las migraciones están en `supabase/migrations/`, numeradas y en orden. Crean 58
tablas, las políticas RLS, los triggers de auditoría y los contadores de rate
limiting.

Si no puedes usar la CLI, ejecuta cada archivo **en orden** desde el SQL Editor
del panel de Supabase. El orden importa: la migración 01 define las funciones
que usan todas las demás.

**Si ya creaste cuentas antes de aplicar las migraciones**, la 09 las repara.
`handle_new_user` solo dispara en `INSERT`, así que una cuenta anterior al
esquema se queda sin perfil, sin organización y sin membresía: autentica bien y
luego rebota entre `/dashboard` y `/login` para siempre, sin nada que lo
explique. La migración 09 corre esa misma lógica una vez sobre lo que ya
existe, es idempotente, y puedes volver a lanzarla cuando quieras:

```sql
select * from app.backfill_orphan_accounts();
```

### 2.3 Verificar antes de confiar

Contra un Postgres local, sin Docker:

```bash
npm run db:verify
```

Aplica todas las migraciones a una base desechable y corre las aserciones de
RLS. La que importa: **un miembro de la organización A leyendo tablas de la
organización B recibe cero filas.** Si esto falla, no despliegues.

### 2.4 Plantilla de correo de recuperación

La pantalla de recuperación pide un código de 6 dígitos, no un enlace. En
**Authentication → Email Templates → Reset Password**, la plantilla debe
incluir `{{ .Token }}`:

```html
<h2>Recupera tu contraseña</h2>
<p>Tu código de verificación es:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
<p>Caduca en 1 hora. Si no lo pediste, ignora este correo.</p>
```

Sin `{{ .Token }}` el correo llega con un enlace que la pantalla no sabe usar,
y la recuperación queda rota sin ningún error visible.

### 2.5 Ajustes de Auth

En **Authentication → Providers → Email**:

- **Confirm email**: activado. Con esto, `POST /api/auth/register` devuelve
  `requiresEmailConfirmation: true` y la interfaz muestra «revisa tu correo».
- **Minimum password length**: 8 o más, para que coincida con la validación de
  `src/lib/validation/auth.ts`.

En **Authentication → URL Configuration**:

- **Site URL**: el valor de `NEXT_PUBLIC_APP_URL`.
- **Redirect URLs**: añade `<NEXT_PUBLIC_APP_URL>/api/auth/confirm`.

### 2.6 Limpieza programada (opcional pero recomendado)

`app.rate_limits` solo crece. Programa un job diario:

```sql
select cron.schedule(
  'rate-limit-gc', '0 4 * * *',
  $$ select public.rate_limit_gc('1 day'::interval) $$
);
```

---

## 3. Microsoft Foundry

Son **dos recursos distintos**, y solo el primero es obligatorio.

### 3.1 Modelos (obligatorio para el asistente)

En [Microsoft Foundry](https://ai.azure.com) → **Deployments**, despliega un
modelo de chat y anota el nombre del **deployment** (no siempre coincide con el
del modelo).

El endpoint es la superficie compatible con OpenAI de tu recurso. Ambas formas
funcionan:

```
https://<recurso>.openai.azure.com/openai/v1
https://<recurso>.services.ai.azure.com/openai/v1
```

Va en `AZURE_FOUNDRY_ENDPOINT`, el deployment en `AZURE_FOUNDRY_DEPLOYMENT`.

El código habla con este endpoint por el proveedor OpenAI del AI SDK con
`baseURL`, no por el proveedor de Azure. El de Azure reescribe la URL
(`{baseURL}/v1{path}`), lo que choca con un endpoint que ya trae su propia
ruta, y necesita separar clave y token; el endpoint de Foundry acepta ambos
como *bearer*, así que un solo camino cubre claves y Entra.

### 3.2 Foundry IQ (opcional)

Foundry IQ **no** es lo mismo que los modelos: es una knowledge base servida
por un servicio de **Azure AI Search**, que se crea e indexa aparte. Tener
modelos sin knowledge base es una configuración normal.

Sin ella el asistente sigue funcionando: responde consultando la base de datos
en vivo — de donde salen las respuestas operativas ("¿qué firmas están
pendientes?"). Lo que se pierde es el anclaje en documentos subidos, y las
respuestas no llevan citas.

Si la configuras, en **Build → Knowledge** crea una knowledge base con al menos
un knowledge source de tipo `searchIndex`.

> **Requisito crítico si la usas con más de una organización.** El índice del
> knowledge source **debe tener un campo `org_id` marcado como filtrable**.
> Todas las recuperaciones envían `filterAddOn: org_id eq '<organización>'`. Si
> el campo no existe o no es filtrable, Azure AI Search **ignora el filtro en
> silencio** y el asistente devolverá documentos de todas las organizaciones.
> No hay error, no hay aviso: solo una fuga de datos entre clientes.

Al indexar documentos, escribe en `org_id` el UUID de la organización dueña.

### 3.3 Autenticación

Se prefiere Microsoft Entra sobre las claves de API: una clave no se puede
acotar por permiso, no rota sin desplegar y no se puede atribuir a nadie.

- **En Azure**: asigna una identidad administrada a la app con los roles
  `Cognitive Services OpenAI User` sobre el recurso de Foundry y, si usas
  Foundry IQ, `Search Index Data Reader` sobre el servicio de búsqueda. Deja
  `AZURE_FOUNDRY_API_KEY` y `AZURE_SEARCH_API_KEY` en blanco.
- **En local**: `az login`, o define `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` y
  `AZURE_CLIENT_SECRET`.
- **Alternativa**: rellena las claves. Funciona, pero no es la configuración
  recomendada para producción.

### 3.4 Verificar

```bash
npm run check:foundry
```

Comprueba que el modelo responde, y — si Foundry IQ está configurado — lanza
una recuperación con un UUID de organización que no existe. Si vuelve cualquier
contenido, `filterAddOn` no está aislando nada y hay que reindexar antes de
usarla con más de un cliente. Sin knowledge base, ese bloque se salta.

---

## 4. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena `.env.local`. **No las pegues en un chat ni las subas al repositorio**
— `.gitignore` ya excluye `.env*`.

| Variable | Obligatoria | Dónde se obtiene |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | sí | Origen público de la app |
| `NEXT_PUBLIC_SUPABASE_URL` | sí | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí | Igual. Es pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Igual. **Salta RLS: solo en servidor** |
| `AZURE_FOUNDRY_ENDPOINT` | para la IA | Recurso de Foundry, ruta `/openai/v1` |
| `AZURE_FOUNDRY_DEPLOYMENT` | para la IA | Nombre del deployment, no del modelo |
| `AZURE_FOUNDRY_API_KEY` | no | En blanco para usar Entra |
| `AZURE_SEARCH_ENDPOINT` | no | Solo si usas Foundry IQ |
| `FOUNDRY_IQ_KNOWLEDGE_BASE` | no | Solo si usas Foundry IQ |
| `FOUNDRY_IQ_KNOWLEDGE_SOURCE` | no | Solo si usas Foundry IQ |
| `AZURE_SEARCH_API_KEY` | no | En blanco para usar Entra |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | no | Solo para Entra con app registration |

---

## 5. Datos de demostración (opcional)

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```

Crea una organización con 8 empleados, 5 tickets, 4 firmas, inventario,
documentos, riesgos, proyectos y calendario, y una cuenta de acceso. Imprime
las credenciales al terminar. **No lo ejecutes contra una base con datos
reales.**

---

## 6. Ejecutar

```bash
npm run dev
```

### Comprobaciones antes de desplegar

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run db:verify   # migraciones + aserciones RLS
npm run build       # producción
npm audit           # sin vulnerabilidades altas
```

Una comprobación manual que ninguna de las anteriores cubre — que la app ya no
acepta una sesión falsificada:

```bash
curl -si -H 'Cookie: wb-session=cualquier-cosa' http://localhost:3000/dashboard | head -1
```

Debe responder `307` hacia `/login`. En la versión anterior devolvía `200` y el
dashboard completo.

---

## 7. Qué está conectado y qué no

Cablearlo todo no entraba en esta pasada. El estado real:

**Sobre la base de datos**

| Módulo | Estado |
| --- | --- |
| Autenticación (login, registro, recuperación) | Supabase Auth |
| Configuración → Roles y permisos | `role_permissions` + `memberships` |
| Configuración → Perfil y empresa | `profiles` + `organizations` |
| Trazabilidad | `audit_log`, escrito por trigger |
| Asistente IA | Foundry IQ + Azure OpenAI, con historial |
| Exportación a Excel | Ruta de servidor con permisos |

**Todavía con datos de ejemplo en el cliente**

`empleados`, `tickets`, `firmas`, `documentos`, `inventario`, `riesgos`,
`asistencia`, `nómina`, `proyectos`, `cotizaciones`, `compras`,
`órdenes de compra`, `tienda`, `catálogos`, `consultoría`, `HSEQ`, `canales`,
`calendario` y el resumen del dashboard.

El esquema, las políticas RLS y los tipos generados **ya existen** para todos
ellos. Lo que falta es la capa de consulta y las mutaciones por módulo,
siguiendo el patrón que ya establecen `src/server/queries/settings.ts`,
`src/server/mutations/settings.ts` y `src/server/queries/audit.ts`.

Cada una de esas pantallas ya está protegida por permisos en el servidor: sin
el permiso correspondiente no se envía ni su bundle. Lo que muestran son datos
de ejemplo, no datos de otra organización.
