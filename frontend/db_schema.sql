-- Core reference
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table tills (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  name text not null,
  active_shift_id uuid
);

-- Customers / CRM
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  doc_type text,
  doc_number text,
  kyc_json jsonb default '{}',
  notes text,
  created_at timestamptz default now()
);

-- Inventory
create type item_type as enum ('piece','serialized','stone','metal');
create type uom_type as enum ('pcs','grams','carats');

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  type item_type not null,
  uom uom_type not null,
  karat text,           -- e.g., '14K', null for non-metal
  color text,           -- metal color or stone color
  barcode text,
  wac_cost numeric(14,4) default 0,  -- Weighted Avg Cost
  price numeric(14,2) default 0,
  branch_id uuid references branches(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table inventory_locations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  name text not null,           -- Safe, Bench, WIP, Quarantine, Storefront
  kind text not null            -- 'safe'|'bench'|'wip'|'quarantine'|'store'
);

create table inventory_balances (
  item_id uuid references inventory_items(id) on delete cascade,
  location_id uuid references inventory_locations(id) on delete cascade,
  qty numeric(16,4) not null default 0,
  uom uom_type not null,
  updated_at timestamptz default now(),
  primary key (item_id, location_id)
);

create type inv_reason as enum ('sale','refund','receive','transfer','consume','return_wip','adjustment','quarantine');
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventory_items(id) on delete cascade,
  from_location uuid references inventory_locations(id),
  to_location uuid references inventory_locations(id),
  qty numeric(16,4) not null,
  uom uom_type not null,
  value numeric(16,4) default 0,
  reason inv_reason not null,
  ref_type text,          -- 'sale'|'loan'|'repair'|'job'|'po' etc.
  ref_id uuid,
  by_user uuid,
  created_at timestamptz default now()
);

-- POS Sales
create table sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  shift_id uuid,
  customer_id uuid references customers(id),
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  tender text not null,           -- cash|card|transfer|gift|mixed
  receipt_no text unique,
  created_at timestamptz default now()
);

create table sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  item_id uuid references inventory_items(id),
  qty numeric(14,4) not null,
  uom uom_type not null,
  price numeric(14,2) not null,
  tax_rate numeric(6,4) default 0,
  total numeric(14,2) not null
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,      -- 'sale'|'loan'|'layaway'|'repair'|'job'
  entity_id uuid not null,
  method text not null,           -- cash|card|transfer
  amount numeric(14,2) not null,
  shift_id uuid,
  created_at timestamptz default now()
);

-- Cash & shifts
create type cash_move as enum ('sale_cash','refund_cash','paid_in','paid_out','drop','opening','adjust');
create table shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  till_id uuid references tills(id),
  cashier_id uuid,
  opened_at timestamptz,
  closed_at timestamptz,
  opening_float numeric(14,2) default 0,
  expected_cash numeric(14,2) default 0,
  over_short numeric(14,2) default 0,
  status text default 'open'
);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete cascade,
  type cash_move not null,
  amount numeric(14,2) not null,
  currency text default 'DOP',
  note text,
  by_user uuid,
  created_at timestamptz default now()
);

-- Loans / Pawns
create table loans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id uuid references branches(id),
  principal numeric(14,2) not null,
  interest_rate numeric(8,4) not null,      -- periodic (e.g., monthly)
  storage_fee numeric(14,2) default 0,
  start_date date not null,
  due_date date not null,
  status text not null default 'active',     -- active|redeemed|defaulted|written_off
  ticket_no text unique,
  collateral_json jsonb default '{}'         -- item snapshot, photos, etc.
);

create table loan_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete cascade,
  type text not null,                        -- renew|redeem|rewrite|payment|fee
  amount numeric(14,2) default 0,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- Layaways
create table layaways (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id uuid references branches(id),
  item_id uuid references inventory_items(id),
  total numeric(14,2) not null,
  deposit numeric(14,2) not null,
  balance numeric(14,2) not null,
  due_date date,
  status text default 'active'
);

-- Repairs & Fabrication (jobs)
create type job_kind as enum ('repair','fabrication');
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind job_kind not null,
  customer_id uuid references customers(id),
  branch_id uuid references branches(id),
  status text not null default 'new',
  deposit numeric(14,2) default 0,
  ring_size text,
  due_at timestamptz,
  approved_at timestamptz,
  closed_at timestamptz,
  notes jsonb default '{}'
);

create table job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  line_type text not null,                   -- part|labor|metal|stone
  ref_sku text,
  description text,
  qty numeric(14,4) default 1,
  uom uom_type default 'pcs',
  unit_cost numeric(14,4) default 0,
  unit_price numeric(14,2) default 0
);

-- Marketing & messaging
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,                     -- sms|whatsapp|email
  segment text,
  template_id text,
  scheduled_at timestamptz,
  status text default 'draft'
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  direction text not null,                   -- in|out
  channel text not null,
  body text,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- Compliance
create table compliance_flags (
  id uuid primary key default gen_random_uuid(),
  entity_type text,                          -- loan|sale|customer
  entity_id uuid,
  kind text,                                 -- police|ofac|irs8300|ffl
  status text default 'pending',
  details jsonb default '{}',
  created_at timestamptz default now()
);
