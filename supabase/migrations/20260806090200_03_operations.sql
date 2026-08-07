-- ═══════════════════════════════════════════════════════════════════════════
-- 03 — Operations: projects, commerce, documents, HSEQ, tickets, channels.
--
-- Consolidations applied here, all of which the mock data got wrong:
--   · One `projects` table replaces four incompatible project id conventions
--     (PRY-001 / P-001 / 'P-001 • Torre Sur' / 'P-001 · Instalación Torre Sur').
--   · One `products` table replaces the triplicated catalogue that lived in
--     catalogos, tienda and compras with diverging prices.
--   · Every amount is bigint minor units. `hseq.monto` used to be free text.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Projects ───────────────────────────────────────────────────────────────

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  code           text,
  name           text not null,
  client         text not null default '',
  location       text not null default '',
  kind           text not null default 'Instalación'
                   check (kind in ('Instalación', 'Mantenimiento', 'Ampliación', 'Diagnóstico', 'Otro')),
  capacity_kwp   numeric(10,2) check (capacity_kwp is null or capacity_kwp >= 0),
  status         text not null default 'Planificación'
                   check (status in ('Planificación', 'En ejecución', 'En pausa', 'Finalizado', 'Cancelado')),
  progress       smallint not null default 0 check (progress between 0 and 100),
  budget_cents   bigint not null default 0 check (budget_cents >= 0),
  starts_on      date,
  ends_on        date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (org_id, code),
  constraint projects_dates_ordered check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index projects_org_idx on public.projects (org_id, status) where deleted_at is null;

create trigger projects_code  before insert on public.projects
  for each row execute function app.set_code('project', 'PRY', '4');
create trigger projects_touch before update on public.projects
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('projects', 'proyectos:read', 'proyectos:write');

create table public.project_members (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  role         text not null default '',
  unique (project_id, employee_id)
);

select app.apply_child_rls('project_members', 'projects', 'project_id',
                           'proyectos:read', 'proyectos:write');

-- ─── Products (single catalogue) ────────────────────────────────────────────

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  sku           text not null,
  name          text not null,
  category      text not null default 'Otro',
  description   text not null default '',
  -- Purely decorative; the storefront rendered an emoji per product.
  emoji         text,
  unit          text not null default 'UN'
                  check (unit in ('UN', 'KIT', 'RL', 'KW', 'SERV', 'M', 'HR')),
  price_cents   bigint not null default 0 check (price_cents >= 0),
  cost_cents    bigint not null default 0 check (cost_cents  >= 0),
  stock         int    not null default 0 check (stock >= 0),
  supplier      text not null default '',
  is_active     boolean not null default true,
  -- Controls storefront visibility without hiding the item from procurement.
  in_storefront boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (org_id, sku)
);

create index products_org_idx on public.products (org_id, category) where deleted_at is null;

create trigger products_touch before update on public.products
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('products', 'catalogos:read', 'catalogos:write');

-- ─── Quotes ─────────────────────────────────────────────────────────────────

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  code          text,
  client        text not null,
  contact       text not null default '',
  project_id    uuid references public.projects (id) on delete set null,
  owner_id      uuid references public.employees (id) on delete set null,
  kind          text not null default 'Comercial'
                  check (kind in ('Comercial', 'Rural', 'Industrial', 'Residencial')),
  status        text not null default 'Borrador'
                  check (status in ('Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida')),
  probability   smallint not null default 0 check (probability between 0 and 100),
  issued_on     date not null default current_date,
  expires_on    date,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (org_id, code)
);

create trigger quotes_code  before insert on public.quotes
  for each row execute function app.set_code('quote', 'C', '4');
create trigger quotes_touch before update on public.quotes
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('quotes', 'cotizaciones:read', 'cotizaciones:write');

create table public.quote_items (
  id                 uuid primary key default gen_random_uuid(),
  quote_id           uuid not null references public.quotes (id) on delete cascade,
  product_id         uuid references public.products (id) on delete set null,
  description        text not null,
  quantity           numeric(12,2) not null check (quantity > 0),
  unit_price_cents   bigint not null default 0 check (unit_price_cents >= 0),
  position           smallint not null default 0
);

alter table public.quote_items
  add column subtotal_cents bigint
  generated always as (round(quantity * unit_price_cents)::bigint) stored;

create index quote_items_quote_idx on public.quote_items (quote_id, position);

select app.apply_child_rls('quote_items', 'quotes', 'quote_id',
                           'cotizaciones:read', 'cotizaciones:write');

-- ─── Purchase requests → purchase orders ────────────────────────────────────

create table public.purchase_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  supplier     text not null default '',
  project_id   uuid references public.projects (id) on delete set null,
  owner_id     uuid references public.employees (id) on delete set null,
  category     text not null default 'Materiales'
                 check (category in ('Materiales', 'Servicios', 'Logística', 'Otro')),
  status       text not null default 'Borrador'
                 check (status in ('Borrador', 'Pendiente', 'Aprobada', 'Rechazada', 'OC generada')),
  urgency      text not null default 'Normal' check (urgency in ('Alta', 'Normal', 'Baja')),
  needed_on    date,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code)
);

create trigger purchase_requests_code  before insert on public.purchase_requests
  for each row execute function app.set_code('purchase_request', 'REQ', '4');
create trigger purchase_requests_touch before update on public.purchase_requests
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('purchase_requests', 'compras:read', 'compras:write');

create table public.purchase_request_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  description         text not null,
  quantity            numeric(12,2) not null check (quantity > 0),
  unit                text not null default 'UN',
  unit_cost_cents     bigint not null default 0 check (unit_cost_cents >= 0),
  position            smallint not null default 0
);

alter table public.purchase_request_items
  add column subtotal_cents bigint
  generated always as (round(quantity * unit_cost_cents)::bigint) stored;

select app.apply_child_rls('purchase_request_items', 'purchase_requests', 'purchase_request_id',
                           'compras:read', 'compras:write');

create table public.purchase_request_events (
  id                  uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests (id) on delete cascade,
  actor_id            uuid references public.employees (id) on delete set null,
  note                text not null,
  occurred_at         timestamptz not null default now()
);

select app.apply_child_rls('purchase_request_events', 'purchase_requests', 'purchase_request_id',
                           'compras:read', 'compras:write');

create table public.purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  code                text,
  purchase_request_id uuid references public.purchase_requests (id) on delete set null,
  supplier            text not null,
  project_id          uuid references public.projects (id) on delete set null,
  status              text not null default 'Pendiente'
                        check (status in ('Pendiente', 'Aprobada', 'Recibida', 'Cancelada')),
  issued_on           date not null default current_date,
  due_on              date,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (org_id, code)
);

create trigger purchase_orders_code  before insert on public.purchase_orders
  for each row execute function app.set_code('purchase_order', 'OC', '4');
create trigger purchase_orders_touch before update on public.purchase_orders
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('purchase_orders', 'compras:read', 'compras:write');

create table public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  description       text not null,
  quantity          numeric(12,2) not null check (quantity > 0),
  unit_price_cents  bigint not null default 0 check (unit_price_cents >= 0),
  position          smallint not null default 0
);

alter table public.purchase_order_items
  add column subtotal_cents bigint
  generated always as (round(quantity * unit_price_cents)::bigint) stored;

select app.apply_child_rls('purchase_order_items', 'purchase_orders', 'purchase_order_id',
                           'compras:read', 'compras:write');

-- ─── Inventory ──────────────────────────────────────────────────────────────

create table public.inventory_assets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  name         text not null,
  category     text not null default 'Otro'
                 check (category in ('Cómputo', 'Monitor', 'Móvil', 'Tablet', 'Periférico',
                                     'Mobiliario', 'Herramientas', 'Vehículos', 'Electrónica', 'Otro')),
  -- Null means unassigned. The mock used the sentinel string '—'.
  employee_id  uuid references public.employees (id) on delete set null,
  serial       text not null default '',
  status       text not null default 'Disponible'
                 check (status in ('Asignado', 'Disponible', 'Mantenimiento', 'Baja')),
  acquired_on  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code),
  -- An asset cannot be 'Asignado' with nobody holding it.
  constraint inventory_assets_assignment_consistent
    check ((status = 'Asignado') = (employee_id is not null))
);

create index inventory_assets_org_idx on public.inventory_assets (org_id, status) where deleted_at is null;
create unique index inventory_assets_serial_key
  on public.inventory_assets (org_id, serial) where serial <> '' and deleted_at is null;

create trigger inventory_assets_code  before insert on public.inventory_assets
  for each row execute function app.set_code('inventory_asset', 'INV', '4');
create trigger inventory_assets_touch before update on public.inventory_assets
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('inventory_assets', 'inventario:read', 'inventario:write');

create table public.supplier_invoices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  supplier    text not null,
  issued_on   date not null default current_date,
  status      text not null default 'Pendiente'
                check (status in ('Pendiente', 'En revisión', 'Pagada', 'Anulada')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, code)
);

create trigger supplier_invoices_code  before insert on public.supplier_invoices
  for each row execute function app.set_code('supplier_invoice', 'FAC', '4');
create trigger supplier_invoices_touch before update on public.supplier_invoices
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('supplier_invoices', 'inventario:read', 'inventario:write');

create table public.supplier_invoice_items (
  id                  uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references public.supplier_invoices (id) on delete cascade,
  description         text not null,
  quantity            numeric(12,2) not null check (quantity > 0),
  unit_price_cents    bigint not null default 0 check (unit_price_cents >= 0),
  position            smallint not null default 0
);

alter table public.supplier_invoice_items
  add column subtotal_cents bigint
  generated always as (round(quantity * unit_price_cents)::bigint) stored;

select app.apply_child_rls('supplier_invoice_items', 'supplier_invoices', 'supplier_invoice_id',
                           'inventario:read', 'inventario:write');

create table public.inventory_orders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  code              text,
  item              text not null,
  supplier          text not null default '',
  quantity          int not null check (quantity > 0),
  est_price_cents   bigint not null default 0 check (est_price_cents >= 0),
  requested_by_id   uuid references public.employees (id) on delete set null,
  status            text not null default 'Solicitado'
                      check (status in ('Solicitado', 'Aprobado', 'En tránsito', 'Facturado', 'Cancelado')),
  ordered_on        date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (org_id, code)
);

create trigger inventory_orders_code  before insert on public.inventory_orders
  for each row execute function app.set_code('inventory_order', 'PED', '4');
create trigger inventory_orders_touch before update on public.inventory_orders
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('inventory_orders', 'inventario:read', 'inventario:write');

-- ─── Documents ──────────────────────────────────────────────────────────────

create table public.document_folders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  key         text not null,
  name        text not null,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (org_id, key)
);

select app.apply_standard_rls('document_folders', 'documentos:read', 'documentos:write');

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  folder_id    uuid references public.document_folders (id) on delete set null,
  name         text not null,
  kind         text not null default 'Otro'
                 check (kind in ('Contrato', 'Política', 'Acta', 'Plan', 'Manual', 'Anexo', 'Otro')),
  department   text not null default '',
  owner_id     uuid references public.employees (id) on delete set null,
  status       text not null default 'Vigente'
                 check (status in ('Vigente', 'Borrador', 'Archivado', 'Vencido')),
  tags         text[] not null default '{}',
  -- Object key in the Supabase Storage `documents` bucket. Never a public URL:
  -- downloads go through a short-lived signed URL issued after an auth check.
  storage_path text,
  mime_type    text,
  size_bytes   bigint check (size_bytes is null or size_bytes >= 0),
  -- Result of the AI review, kept separate from human-entered fields.
  ai_verdict   text,
  ai_checked_at timestamptz,
  expires_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code)
);

create index documents_org_idx    on public.documents (org_id, status) where deleted_at is null;
create index documents_folder_idx on public.documents (folder_id) where deleted_at is null;
create index documents_tags_idx   on public.documents using gin (tags);

create trigger documents_code  before insert on public.documents
  for each row execute function app.set_code('document', 'DOC', '4');
create trigger documents_touch before update on public.documents
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('documents', 'documentos:read', 'documentos:write');

create table public.document_shares (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  employee_id  uuid references public.employees (id) on delete cascade,
  email        text check (email is null or email = lower(email)),
  access       text not null default 'Puede ver'
                 check (access in ('Propietario', 'Puede editar', 'Puede ver')),
  created_at   timestamptz not null default now(),
  constraint document_shares_target_present check (employee_id is not null or email is not null)
);

create unique index document_shares_employee_key
  on public.document_shares (document_id, employee_id) where employee_id is not null;
create unique index document_shares_email_key
  on public.document_shares (document_id, email) where email is not null;

select app.apply_child_rls('document_shares', 'documents', 'document_id',
                           'documentos:read', 'documentos:write');

-- ─── Electronic signatures ──────────────────────────────────────────────────

create table public.signature_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  code          text,
  document_id   uuid references public.documents (id) on delete set null,
  title         text not null,
  signer_id     uuid references public.employees (id) on delete set null,
  signer_email  text check (signer_email is null or signer_email = lower(signer_email)),
  kind          text not null default 'Otro'
                  check (kind in ('Contrato', 'NDA', 'Política', 'Anexo', 'Adenda',
                                  'Acuerdo', 'Terminación', 'Otro')),
  status        text not null default 'Pendiente'
                  check (status in ('Pendiente', 'Firmado', 'Vencido', 'Cancelado')),
  requested_on  date not null default current_date,
  due_on        date,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (org_id, code),
  constraint signature_requests_signed_consistent
    check ((status = 'Firmado') = (signed_at is not null))
);

create index signature_requests_org_idx
  on public.signature_requests (org_id, status, due_on) where deleted_at is null;

create trigger signature_requests_code  before insert on public.signature_requests
  for each row execute function app.set_code('signature_request', 'FIR', '4');
create trigger signature_requests_touch before update on public.signature_requests
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('signature_requests', 'firmas:read', 'firmas:write');

-- ─── HSEQ ───────────────────────────────────────────────────────────────────

create table public.hseq_reports (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  category     text not null check (category in ('Seguridad', 'Calidad', 'Ambiente')),
  kind         text not null default 'Incidente'
                 check (kind in ('Incidente', 'Permiso', 'Hallazgo', 'Auditoría')),
  status       text not null default 'Pendiente'
                 check (status in ('Pendiente', 'En curso', 'Cerrado')),
  priority     text not null default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  -- Deliberately four levels where `priority` has three: the mock conflated
  -- how urgent the follow-up is with how bad the event was.
  severity     text not null default 'Media'
                 check (severity in ('Crítica', 'Alta', 'Media', 'Baja')),
  area         text not null default '',
  project_id   uuid references public.projects (id) on delete set null,
  location     text not null default '',
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  owner_id     uuid references public.employees (id) on delete set null,
  notes        text not null default '',
  reported_on  date not null default current_date,
  due_on       date,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code)
);

create trigger hseq_reports_code  before insert on public.hseq_reports
  for each row execute function app.set_code('hseq_report', 'HSEQ', '4');
create trigger hseq_reports_touch before update on public.hseq_reports
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('hseq_reports', 'hseq:read', 'hseq:write');

create table public.hseq_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  hseq_report_id  uuid not null references public.hseq_reports (id) on delete cascade,
  label           text not null,
  is_done         boolean not null default false,
  position        smallint not null default 0
);

select app.apply_child_rls('hseq_checklist_items', 'hseq_reports', 'hseq_report_id',
                           'hseq:read', 'hseq:write');

create table public.hseq_updates (
  id              uuid primary key default gen_random_uuid(),
  hseq_report_id  uuid not null references public.hseq_reports (id) on delete cascade,
  actor_id        uuid references public.employees (id) on delete set null,
  note            text not null,
  occurred_at     timestamptz not null default now()
);

select app.apply_child_rls('hseq_updates', 'hseq_reports', 'hseq_report_id',
                           'hseq:read', 'hseq:write');

-- ─── Tickets ────────────────────────────────────────────────────────────────

create table public.tickets (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  code          text,
  subject       text not null check (length(btrim(subject)) between 1 and 200),
  body          text not null default '',
  area          text not null default 'Otro'
                  check (area in ('TI', 'Nómina', 'Personas', 'Finanzas', 'Legal',
                                  'Contratos', 'Onboarding', 'Permisos', 'Capacitación',
                                  'Administración', 'Beneficios', 'Otro')),
  priority      text not null default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  status        text not null default 'Abierto'
                  check (status in ('Abierto', 'En proceso', 'Resuelto', 'Cerrado')),
  requester_id  uuid references public.employees (id) on delete set null,
  assignee_id   uuid references public.employees (id) on delete set null,
  tags          text[] not null default '{}',
  -- Board ordering within a status column, so the kanban survives a reload.
  board_position numeric not null default 0,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (org_id, code)
);

create index tickets_org_idx  on public.tickets (org_id, status, board_position) where deleted_at is null;
create index tickets_tags_idx on public.tickets using gin (tags);

create trigger tickets_code  before insert on public.tickets
  for each row execute function app.set_code('ticket', 'TK', '4');
create trigger tickets_touch before update on public.tickets
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('tickets', 'tickets:read', 'tickets:write');

create table public.ticket_comments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references public.employees (id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

select app.apply_child_rls('ticket_comments', 'tickets', 'ticket_id',
                           'tickets:read', 'tickets:write');

-- ─── Channels ───────────────────────────────────────────────────────────────

create table public.channels (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  slug        text not null,
  name        text not null,
  kind        text not null default 'grupo' check (kind in ('grupo', 'directo')),
  project_id  uuid references public.projects (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, slug)
);

create trigger channels_touch before update on public.channels
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('channels', 'canales:read', 'canales:write');

create table public.channel_members (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.channels (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  unique (channel_id, employee_id)
);

select app.apply_child_rls('channel_members', 'channels', 'channel_id',
                           'canales:read', 'canales:write');

create table public.channel_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.channels (id) on delete cascade,
  author_id   uuid references public.employees (id) on delete set null,
  body        text not null,
  -- Optional project card attached to the message.
  project_id  uuid references public.projects (id) on delete set null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);

create index channel_messages_channel_idx
  on public.channel_messages (channel_id, created_at desc) where deleted_at is null;

select app.apply_child_rls('channel_messages', 'channels', 'channel_id',
                           'canales:read', 'canales:write');

-- ─── Calendar ───────────────────────────────────────────────────────────────

create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  title        text not null,
  kind         text not null default 'Interna'
                 check (kind in ('Interna', '1:1', 'Entrevista', 'Onboarding',
                                 'Consultoría', 'Reclutamiento', 'Confidencial', 'Otro')),
  -- Full timestamps. The mock stored a bare day-of-month integer and a
  -- separate 'HH:MM' string, which made ordering across months impossible.
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  location     text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code),
  constraint calendar_events_range_ordered check (ends_at > starts_at)
);

create index calendar_events_org_idx
  on public.calendar_events (org_id, starts_at) where deleted_at is null;

create trigger calendar_events_code  before insert on public.calendar_events
  for each row execute function app.set_code('calendar_event', 'M', '4');
create trigger calendar_events_touch before update on public.calendar_events
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('calendar_events', 'calendario:read', 'calendario:write');

create table public.calendar_attendees (
  id                 uuid primary key default gen_random_uuid(),
  calendar_event_id  uuid not null references public.calendar_events (id) on delete cascade,
  employee_id        uuid references public.employees (id) on delete cascade,
  email              text check (email is null or email = lower(email)),
  response           text not null default 'Pendiente'
                       check (response in ('Pendiente', 'Aceptada', 'Rechazada')),
  constraint calendar_attendees_target_present check (employee_id is not null or email is not null)
);

select app.apply_child_rls('calendar_attendees', 'calendar_events', 'calendar_event_id',
                           'calendario:read', 'calendario:write');

-- ─── Consulting ─────────────────────────────────────────────────────────────

create table public.consultations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  topic        text not null,
  requester_id uuid references public.employees (id) on delete set null,
  category     text not null default 'Otro'
                 check (category in ('Regulatorio', 'Normativo', 'Contractual', 'Laboral', 'Otro')),
  advisor      text not null default '',
  status       text not null default 'Agendada'
                 check (status in ('Agendada', 'En curso', 'Resuelta', 'Cancelada')),
  answer       text not null default '',
  scheduled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code)
);

create trigger consultations_code  before insert on public.consultations
  for each row execute function app.set_code('consultation', 'CN', '4');
create trigger consultations_touch before update on public.consultations
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('consultations', 'consultoria:read', 'consultoria:write');
