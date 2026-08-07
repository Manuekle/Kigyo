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

El asistente usa dos servicios: **Foundry IQ** para recuperar contexto y
**Azure OpenAI** para redactar la respuesta. Hacen falta los dos: la API
estable de recuperación `2026-04-01` devuelve contenido extractivo, no una
respuesta redactada.

### 3.1 Knowledge base

En el portal de [Microsoft Foundry](https://ai.azure.com), en **Build →
Knowledge**, crea una knowledge base con al menos un knowledge source de tipo
`searchIndex`.

> **Requisito crítico.** El índice del knowledge source **debe tener un campo
> `org_id` marcado como filtrable**. Todas las recuperaciones envían
> `filterAddOn: org_id eq '<organización>'`. Si el campo no existe o no es
> filtrable, Azure AI Search **ignora el filtro en silencio** y el asistente
> devolverá documentos de todas las organizaciones. No hay error, no hay aviso:
> solo una fuga de datos entre clientes.

Al indexar documentos, escribe en `org_id` el UUID de la organización dueña del
documento.

### 3.2 Modelo

Despliega un modelo de chat (por ejemplo `gpt-4.1`) en tu recurso de Azure
OpenAI y anota el nombre del **deployment**, que no siempre coincide con el del
modelo.

### 3.3 Autenticación

Se prefiere Microsoft Entra sobre las claves de API: una clave no se puede
acotar por permiso, no rota sin desplegar y no se puede atribuir a nadie.

- **En Azure**: asigna una identidad administrada a la app y dale los roles
  `Search Index Data Reader` sobre el servicio de búsqueda y
  `Cognitive Services OpenAI User` sobre el recurso de OpenAI. Deja
  `AZURE_SEARCH_API_KEY` vacío.
- **En local**: `az login`, o define `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` y
  `AZURE_CLIENT_SECRET`.
- **Alternativa**: define `AZURE_SEARCH_API_KEY`. Funciona, pero no es la
  configuración recomendada para producción.

### 3.4 Verificar el aislamiento

```bash
npm run check:foundry
```

Comprueba las variables, que la knowledge base responde y — lo importante —
lanza una recuperación con un UUID de organización que no existe. Si vuelve
cualquier contenido, `filterAddOn` no está aislando nada y hay que reindexar
antes de usar la base con más de un cliente.

---

## 4. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena `.env.local`. **No las pegues en un chat ni las subas al repositorio**
— `.gitignore` ya excluye `.env*`.

| Variable | Dónde se obtiene |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Igual. Es pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | Igual. **Salta RLS: solo en servidor** |
| `NEXT_PUBLIC_APP_URL` | Origen público de la app |
| `AZURE_SEARCH_ENDPOINT` | Servicio de Azure AI Search del proyecto Foundry |
| `FOUNDRY_IQ_KNOWLEDGE_BASE` | Nombre de la knowledge base |
| `FOUNDRY_IQ_KNOWLEDGE_SOURCE` | Nombre del knowledge source |
| `AZURE_OPENAI_ENDPOINT` | Recurso de Azure OpenAI |
| `AZURE_OPENAI_DEPLOYMENT` | Nombre del deployment, no del modelo |

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
