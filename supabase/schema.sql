-- ============================================================
-- R² — esquema da base de dados (Supabase / Postgres)
-- v2 — inclui: eliminar reversível, histórico de alterações,
-- e proteção contra condições de corrida em vendas e SKUs.
--
-- Corre este ficheiro inteiro no SQL Editor do Supabase.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- FORNECEDORES ----------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nome text not null,
  nif text,
  redes_sociais text,
  site text,
  localidade text,
  contacto text,
  email text,
  status text default 'Ativo',
  avaliacao int default 0,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- COMPRAS ----------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  supplier_id uuid references suppliers(id) on delete set null,
  valor_aquisicao numeric default 0,
  desconto numeric default 0,
  estado text default 'Reservado',
  data_envio date,
  data_chegada date,
  codigo_rastreio text,
  fatura text,
  fatura_url text,
  quem_comprou text,
  data date default current_date,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- ARTIGOS / STOCK ----------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  sku text,
  tipo text,
  artigo text not null,
  cor text,
  padrao text default 'Liso',
  owner text,
  preco_unitario numeric default 0,
  preco_medio numeric default 0,
  iva numeric default 0,
  quantidade numeric default 0,
  valor_venda numeric default 0,
  purchase_id uuid references purchases(id) on delete set null,
  foto_url text,
  publicado boolean not null default false,
  etiquetado boolean not null default false,
  uso_interno boolean not null default false, -- material interno (etiquetas, caixas, sacos, etc.) — nunca vendido, marca-se sozinho a partir do Tipo
  estado text not null default 'Em stock', -- 'Novo — Sem compras' | 'Em stock' | 'Esgotado — vai repor' | 'Sem Reposição' | 'Pausado' | 'A aguardar validação'
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- CLIENTES ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  plataforma text,
  rede_social text,
  nif text,
  morada_faturacao text,
  morada_entrega text,
  email text,
  telefone text,
  aniversario date,
  avaliacao int default 0,
  codigo_desconto text,
  data_inicio_desconto date,
  data_fim_desconto date,
  desconto_utilizado boolean not null default false,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- VENDAS ----------
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  article_id uuid references articles(id) on delete set null,
  quantidade numeric default 1,
  valor_venda numeric default 0,
  quem_vendeu text,
  client_id uuid references clients(id) on delete set null,
  forma_pagamento text,
  estado text default 'Aguarda pagamento',
  estado_envio text default 'Não Definido',
  metodo_envio text,
  codigo_envio text,
  fatura text,
  fatura_url text,
  comprovativo_url text,
  data_reserva date,
  data_limite_reserva date,
  data_pagamento date,
  data_envio date,
  data date default current_date,
  notas text,
  encomenda_id uuid, -- ver tabela encomendas, mais abaixo (fk adicionada depois, por ordem de criação)
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- ENCOMENDAS (agrupam várias Vendas do mesmo cliente para um único envio) ----------
-- Uma Venda pode continuar totalmente "solta", com os seus próprios dados de envio/fatura
-- (secções 3 e 4 do formulário, exatamente como sempre foi). Quando várias Vendas do mesmo
-- cliente vão ser preparadas e enviadas juntas, juntam-se numa Encomenda — a partir daí, o
-- Estado de envio, Método, Código de rastreio, Data de envio e Fatura passam a viver aqui,
-- partilhados por todas as Vendas que a Encomenda contém (ver sync_encomenda_to_sales, que
-- mantém as Vendas sempre com os mesmos valores da Encomenda, para o resto da app — alertas,
-- mensagens, exportação — continuar a funcionar sem alterações, lendo sempre os campos da Venda).
create table if not exists encomendas (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  client_id uuid references clients(id) on delete set null,
  estado_envio text default 'Não Definido',
  metodo_envio text,
  valor_portes numeric,
  codigo_envio text,
  data_envio date,
  fatura_rosa text, -- fatura emitida pela Rosa para as suas peças desta encomenda
  fatura_rosa_url text,
  fatura_rita text, -- fatura emitida pela Rita para as suas peças desta encomenda
  fatura_rita_url text,
  embalagem_id uuid, -- ver tabela embalagens, mais abaixo (fk adicionada depois, por ordem de criação)
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
alter table encomendas add column if not exists valor_portes numeric;

-- Métodos de Envio configuráveis (nome + valor de portes cada) — substitui a lista fixa
-- antiga (CTT/Entrega em mão/Transportadora) e os dois campos soltos de portes
-- nacionais/internacionais. O valor de portes de cada método é só uma sugestão: fica
-- guardado à parte em cada Encomenda (encomendas.valor_portes), editável caso a caso.
create table if not exists metodos_envio (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_portes numeric not null default 0,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table sales add column if not exists encomenda_id uuid;
alter table sales drop constraint if exists sales_encomenda_id_fkey;
alter table sales add constraint sales_encomenda_id_fkey foreign key (encomenda_id) references encomendas(id) on delete set null;

-- v3i — a Fatura de uma encomenda passa a ser DUAS (Rosa e Rita), para o caso de as
-- peças de uma mesma encomenda precisarem de faturas emitidas por pessoas diferentes.
alter table encomendas add column if not exists fatura_rosa text;
alter table encomendas add column if not exists fatura_rosa_url text;
alter table encomendas add column if not exists fatura_rita text;
alter table encomendas add column if not exists fatura_rita_url text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'encomendas' and column_name = 'fatura') then
    update encomendas set fatura_rosa = coalesce(fatura_rosa, fatura), fatura_rosa_url = coalesce(fatura_rosa_url, fatura_url)
    where fatura is not null or fatura_url is not null;
    alter table encomendas drop column if exists fatura;
    alter table encomendas drop column if exists fatura_url;
  end if;
end $$;

alter table encomendas enable row level security;
drop policy if exists "authenticated full access" on encomendas;
create policy "authenticated full access" on encomendas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'encomendas') then
    alter publication supabase_realtime add table encomendas;
  end if;
end $$;

-- ---------- EMBALAGENS (módulo de etiquetas e embalagens) ----------
-- Um Tipo de Embalagem (ex: "Normal", "Premium") é uma receita fixa de artigos de
-- Material Interno (sacos, papel de seda, cartões, autocolantes…) — nunca etiquetas, que
-- continuam a dar baixa só pelo pisco "Peça já etiquetada" de cada venda (secção 6/9), para
-- não haver risco de contar a etiqueta duas vezes. Escolher uma Embalagem numa Encomenda
-- (obrigatório) dá baixa de 1 vez a todos os artigos da receita — ver embalagem_consumos.
create table if not exists embalagens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  notas text,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists embalagem_itens (
  id uuid primary key default gen_random_uuid(),
  embalagem_id uuid not null references embalagens(id) on delete cascade,
  article_id uuid references articles(id) on delete set null, -- artigo fixo desta linha da receita (ex: "Saco grande")
  quantidade numeric not null default 1,
  is_test boolean not null default false,
  created_at timestamptz default now()
);

-- Um registo por artigo consumido, por Encomenda — permite reverter (ao mudar de
-- Embalagem, ou ao eliminar a Encomenda) devolvendo exatamente o que tinha sido gasto.
create table if not exists embalagem_consumos (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references encomendas(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  quantidade numeric not null default 1,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table embalagens enable row level security;
drop policy if exists "authenticated full access" on embalagens;
create policy "authenticated full access" on embalagens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'embalagens') then
    alter publication supabase_realtime add table embalagens;
  end if;
end $$;

alter table metodos_envio enable row level security;
drop policy if exists "authenticated full access" on metodos_envio;
create policy "authenticated full access" on metodos_envio
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'metodos_envio') then
    alter publication supabase_realtime add table metodos_envio;
  end if;
end $$;

alter table embalagem_itens enable row level security;
drop policy if exists "authenticated full access" on embalagem_itens;
create policy "authenticated full access" on embalagem_itens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'embalagem_itens') then
    alter publication supabase_realtime add table embalagem_itens;
  end if;
end $$;

alter table embalagem_consumos enable row level security;
drop policy if exists "authenticated full access" on embalagem_consumos;
create policy "authenticated full access" on embalagem_consumos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'embalagem_consumos') then
    alter publication supabase_realtime add table embalagem_consumos;
  end if;
end $$;

alter table encomendas add column if not exists embalagem_id uuid;
alter table encomendas drop constraint if exists encomendas_embalagem_id_fkey;
alter table encomendas add constraint encomendas_embalagem_id_fkey foreign key (embalagem_id) references embalagens(id) on delete set null;

-- ============================================================
-- Cria (ou atualiza) um Tipo de Embalagem e a sua receita (lista de artigos + quantidade),
-- tudo numa operação atómica — mesmo padrão de save_purchase_with_items.
-- ============================================================
create or replace function save_embalagem(
  p_id uuid,
  p_nome text,
  p_notas text,
  p_ativo boolean,
  p_itens jsonb,
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_keep_ids uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Indica um nome para a Embalagem';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  if not exists (select 1 from embalagens where id = v_id) then
    insert into embalagens (id, nome, notas, ativo, is_test)
    values (v_id, p_nome, p_notas, coalesce(p_ativo, true), coalesce(p_is_test, false));
  else
    update embalagens set nome = p_nome, notas = p_notas, ativo = coalesce(p_ativo, true)
    where id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_keep_ids := array_append(v_keep_ids, v_item_id);
    insert into embalagem_itens (id, embalagem_id, article_id, quantidade, is_test)
    values (v_item_id, v_id, (v_item->>'article_id')::uuid, coalesce((v_item->>'quantidade')::numeric, 1), coalesce(p_is_test, false))
    on conflict (id) do update set
      article_id = excluded.article_id, quantidade = excluded.quantidade;
  end loop;

  delete from embalagem_itens where embalagem_id = v_id and not (id = any(v_keep_ids));

  return v_id;
end;
$$;

-- ---------- CONSUMOS E TRANSFORMAÇÕES DE MATERIAL INTERNO ----------
-- Além das baixas automáticas (etiqueta numa venda, embalagem numa encomenda), o material
-- interno também pode ter: (a) um consumo manual avulso, com motivo (ex: "fita para decorar
-- a montra"); (b) uma Transformação — consome vários materiais (inputs) e dá entrada de
-- stock a um único artigo de saída (ex: 20 folhas + 5ml de tinteiro → +100 etiquetas). Uma
-- Transformação pode ser aplicada a partir de um Tipo guardado (reutilizável, em Definições)
-- ou avulsa, sem guardar receita nenhuma — as duas ficam sempre registadas do mesmo jeito.
create table if not exists consumos_manuais (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete set null,
  quantidade numeric not null default 1,
  motivo text,
  data date default current_date,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Saída de dinheiro que não é uma Compra de artigo nem uma venda — ex: gasóleo, portes,
-- serviços diversos. Texto livre + valor + quem pagou (owner); fornecedor é opcional, só
-- para ligar a um fornecedor já existente quando fizer sentido (ex: bomba de gasolina).
create table if not exists gastos_diversos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric not null default 0,
  owner text,
  supplier_id uuid references suppliers(id) on delete set null,
  data date default current_date,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Dinheiro que entra no negócio sem ser de uma venda (a Rosa/Rita mete capital), ou que sai
-- sem ser uma Compra/Gasto (uma delas retira dinheiro para uso pessoal). Junto com Compras,
-- Vendas pagas e Gastos Diversos, dá o Saldo em Caixa no Painel — quanto dinheiro há
-- disponível agora, distinto do Lucro (que mede rentabilidade, não saldo).
create table if not exists movimentos_capital (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Entrada', 'Saída')),
  valor numeric not null default 0,
  owner text,
  motivo text,
  data date default current_date,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Tipo de Transformação guardado (opcional) — receita fixa: vários inputs, sempre 1 output.
create table if not exists transformacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  notas text,
  output_article_id uuid references articles(id) on delete set null,
  output_quantidade numeric not null default 1,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists transformacao_itens (
  id uuid primary key default gen_random_uuid(),
  transformacao_id uuid not null references transformacoes(id) on delete cascade,
  article_id uuid references articles(id) on delete set null, -- artigo fixo (input) desta linha da receita
  quantidade numeric not null default 1,
  is_test boolean not null default false,
  created_at timestamptz default now()
);

-- Cada vez que uma Transformação é executada (a partir de um Tipo guardado, ou avulsa) fica
-- um registo aqui — com o output e a data — e um por cada input em transformacao_execucao_itens,
-- já com as quantidades reais (por lote × nº de lotes). Eliminar a execução devolve tudo.
create table if not exists transformacao_execucoes (
  id uuid primary key default gen_random_uuid(),
  transformacao_id uuid references transformacoes(id) on delete set null, -- nulo se avulsa
  nome text,
  output_article_id uuid references articles(id) on delete set null,
  output_quantidade numeric not null default 0,
  lotes numeric not null default 1,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists transformacao_execucao_itens (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references transformacao_execucoes(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  quantidade numeric not null default 0,
  is_test boolean not null default false,
  created_at timestamptz default now()
);

alter table consumos_manuais enable row level security;
drop policy if exists "authenticated full access" on consumos_manuais;
create policy "authenticated full access" on consumos_manuais
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'consumos_manuais') then
    alter publication supabase_realtime add table consumos_manuais;
  end if;
end $$;

alter table gastos_diversos enable row level security;
drop policy if exists "authenticated full access" on gastos_diversos;
create policy "authenticated full access" on gastos_diversos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'gastos_diversos') then
    alter publication supabase_realtime add table gastos_diversos;
  end if;
end $$;

alter table movimentos_capital enable row level security;
drop policy if exists "authenticated full access" on movimentos_capital;
create policy "authenticated full access" on movimentos_capital
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'movimentos_capital') then
    alter publication supabase_realtime add table movimentos_capital;
  end if;
end $$;

alter table transformacoes enable row level security;
drop policy if exists "authenticated full access" on transformacoes;
create policy "authenticated full access" on transformacoes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transformacoes') then
    alter publication supabase_realtime add table transformacoes;
  end if;
end $$;

alter table transformacao_itens enable row level security;
drop policy if exists "authenticated full access" on transformacao_itens;
create policy "authenticated full access" on transformacao_itens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transformacao_itens') then
    alter publication supabase_realtime add table transformacao_itens;
  end if;
end $$;

alter table transformacao_execucoes enable row level security;
drop policy if exists "authenticated full access" on transformacao_execucoes;
create policy "authenticated full access" on transformacao_execucoes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transformacao_execucoes') then
    alter publication supabase_realtime add table transformacao_execucoes;
  end if;
end $$;

alter table transformacao_execucao_itens enable row level security;
drop policy if exists "authenticated full access" on transformacao_execucao_itens;
create policy "authenticated full access" on transformacao_execucao_itens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transformacao_execucao_itens') then
    alter publication supabase_realtime add table transformacao_execucao_itens;
  end if;
end $$;

-- ============================================================
-- Cria (ou atualiza) um Tipo de Transformação e a sua receita de inputs — mesmo padrão de
-- save_embalagem.
-- ============================================================
create or replace function save_transformacao(
  p_id uuid,
  p_nome text,
  p_notas text,
  p_ativo boolean,
  p_output_article_id uuid,
  p_output_quantidade numeric,
  p_itens jsonb,
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_keep_ids uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Indica um nome para a Transformação';
  end if;
  if p_output_article_id is null then
    raise exception 'Escolhe o artigo de saída';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  if not exists (select 1 from transformacoes where id = v_id) then
    insert into transformacoes (id, nome, notas, ativo, output_article_id, output_quantidade, is_test)
    values (v_id, p_nome, p_notas, coalesce(p_ativo, true), p_output_article_id, coalesce(p_output_quantidade, 1), coalesce(p_is_test, false));
  else
    update transformacoes set
      nome = p_nome, notas = p_notas, ativo = coalesce(p_ativo, true),
      output_article_id = p_output_article_id, output_quantidade = coalesce(p_output_quantidade, 1)
    where id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_keep_ids := array_append(v_keep_ids, v_item_id);
    insert into transformacao_itens (id, transformacao_id, article_id, quantidade, is_test)
    values (v_item_id, v_id, (v_item->>'article_id')::uuid, coalesce((v_item->>'quantidade')::numeric, 1), coalesce(p_is_test, false))
    on conflict (id) do update set
      article_id = excluded.article_id, quantidade = excluded.quantidade;
  end loop;

  delete from transformacao_itens where transformacao_id = v_id and not (id = any(v_keep_ids));

  return v_id;
end;
$$;

-- ============================================================
-- Executa uma Transformação — a partir de um Tipo guardado (p_transformacao_id) ou avulsa
-- (nula). p_itens e p_output_quantidade já vêm com as quantidades REAIS (por lote × nº de
-- lotes) — dá baixa de stock a cada input e entrada de stock ao output, tudo numa operação.
-- ============================================================
create or replace function executar_transformacao(
  p_transformacao_id uuid,
  p_nome text,
  p_output_article_id uuid,
  p_output_quantidade numeric,
  p_lotes numeric,
  p_itens jsonb,
  p_notas text,
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_execucao_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_output_article_id is null then
    raise exception 'Escolhe o artigo de saída';
  end if;
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indica pelo menos um artigo consumido (input)';
  end if;

  v_execucao_id := gen_random_uuid();
  insert into transformacao_execucoes (id, transformacao_id, nome, output_article_id, output_quantidade, lotes, notas, is_test)
  values (v_execucao_id, p_transformacao_id, p_nome, p_output_article_id, coalesce(p_output_quantidade, 0), coalesce(p_lotes, 1), p_notas, coalesce(p_is_test, false));

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    insert into transformacao_execucao_itens (execucao_id, article_id, quantidade, is_test)
    values (v_execucao_id, (v_item->>'article_id')::uuid, coalesce((v_item->>'quantidade')::numeric, 0), coalesce(p_is_test, false));
  end loop;

  return v_execucao_id;
end;
$$;

-- Mantém os campos de envio/fatura de cada Venda ligada a uma Encomenda sempre iguais aos
-- da própria Encomenda. A Fatura espelhada na venda é a de quem a vendeu (quem_vendeu) —
-- Rosa por defeito, se não estiver definido.
create or replace function sync_encomenda_to_sales(p_encomenda_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_encomenda_id is null then return; end if;
  update sales s set
    estado_envio = e.estado_envio, metodo_envio = e.metodo_envio, valor_portes = e.valor_portes, codigo_envio = e.codigo_envio,
    data_envio = e.data_envio,
    fatura = case when s.quem_vendeu = 'Rita' then e.fatura_rita else e.fatura_rosa end,
    fatura_url = case when s.quem_vendeu = 'Rita' then e.fatura_rita_url else e.fatura_rosa_url end
  from encomendas e
  where e.id = p_encomenda_id and s.encomenda_id = p_encomenda_id;
end;
$$;

create or replace function trg_encomendas_sync_sales_fn() returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform sync_encomenda_to_sales(new.id);
  return new;
end;
$$;
drop trigger if exists trg_encomendas_sync_sales on encomendas;
create trigger trg_encomendas_sync_sales after update on encomendas
for each row execute function trg_encomendas_sync_sales_fn();

-- Sincroniza também quando uma venda acaba de ser ligada a uma encomenda (encomenda_id muda).
create or replace function trg_sales_sync_from_encomenda_fn() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.encomenda_id is not null and (old.encomenda_id is distinct from new.encomenda_id) then
    perform sync_encomenda_to_sales(new.encomenda_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sales_encomenda_change on sales;
create trigger trg_sales_encomenda_change after update of encomenda_id on sales
for each row execute function trg_sales_sync_from_encomenda_fn();

-- ============================================================
-- Cria (ou atualiza) uma Encomenda e liga-lhe as Vendas escolhidas, tudo numa operação
-- atómica. Todas as vendas têm de ser do mesmo cliente da encomenda, e ainda não pertencer
-- a outra encomenda. Só é possível ACRESCENTAR vendas novas enquanto o Estado de envio da
-- encomenda for "Em Preparação" — as já incluídas mantêm-se mesmo que o estado tenha avançado.
-- Um Tipo de Embalagem é obrigatório — ao escolher (ou mudar) a Embalagem, dá-se baixa de
-- 1 vez a todos os artigos da receita (ver embalagem_consumos); mudar de Embalagem devolve
-- o consumo antigo e aplica o novo.
-- ============================================================
drop function if exists save_encomenda(uuid, text, uuid, text, text, text, date, text, text, text, text, text, uuid[], boolean);
create or replace function save_encomenda(
  p_id uuid,
  p_codigo text,
  p_client_id uuid,
  p_estado_envio text,
  p_metodo_envio text,
  p_valor_portes numeric,
  p_codigo_envio text,
  p_data_envio date,
  p_fatura_rosa text,
  p_fatura_rosa_url text,
  p_fatura_rita text,
  p_fatura_rita_url text,
  p_embalagem_id uuid,
  p_notas text,
  p_sale_ids uuid[],
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_estado_atual text;
  v_embalagem_atual uuid;
  v_invalidas int;
  v_novas_bloqueadas int;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_client_id is null then
    raise exception 'Indica o cliente da encomenda';
  end if;
  if p_embalagem_id is null then
    raise exception 'Escolhe um Tipo de Embalagem para a encomenda';
  end if;
  if p_sale_ids is null or array_length(p_sale_ids, 1) is null then
    raise exception 'Escolhe pelo menos uma venda para a encomenda';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  select count(*) into v_invalidas
  from sales
  where id = any(p_sale_ids)
    and (client_id is distinct from p_client_id or (encomenda_id is not null and encomenda_id is distinct from v_id));
  if v_invalidas > 0 then
    raise exception 'Todas as vendas escolhidas têm de ser do mesmo cliente e ainda não pertencer a outra encomenda';
  end if;

  select estado_envio, embalagem_id into v_estado_atual, v_embalagem_atual from encomendas where id = v_id;
  if v_estado_atual is not null and v_estado_atual <> 'Em Preparação' then
    select count(*) into v_novas_bloqueadas
    from unnest(p_sale_ids) sid
    where not exists (select 1 from sales where id = sid and encomenda_id = v_id);
    if v_novas_bloqueadas > 0 then
      raise exception 'Só é possível acrescentar vendas a uma encomenda enquanto o Estado de envio for "Em Preparação"';
    end if;
  end if;

  if v_estado_atual is null then
    insert into encomendas (id, codigo, client_id, estado_envio, metodo_envio, valor_portes, codigo_envio, data_envio, fatura_rosa, fatura_rosa_url, fatura_rita, fatura_rita_url, embalagem_id, notas, is_test)
    values (v_id, p_codigo, p_client_id, coalesce(p_estado_envio, 'Não Definido'), p_metodo_envio, p_valor_portes, p_codigo_envio, p_data_envio, p_fatura_rosa, p_fatura_rosa_url, p_fatura_rita, p_fatura_rita_url, p_embalagem_id, p_notas, coalesce(p_is_test, false));
  else
    update encomendas set
      codigo = p_codigo, client_id = p_client_id, estado_envio = coalesce(p_estado_envio, 'Não Definido'),
      metodo_envio = p_metodo_envio, valor_portes = p_valor_portes, codigo_envio = p_codigo_envio, data_envio = p_data_envio,
      fatura_rosa = p_fatura_rosa, fatura_rosa_url = p_fatura_rosa_url,
      fatura_rita = p_fatura_rita, fatura_rita_url = p_fatura_rita_url,
      embalagem_id = p_embalagem_id, notas = p_notas
    where id = v_id;
  end if;

  if v_embalagem_atual is distinct from p_embalagem_id then
    update embalagem_consumos set deleted_at = now() where encomenda_id = v_id and deleted_at is null;
    insert into embalagem_consumos (encomenda_id, article_id, quantidade, is_test)
    select v_id, ei.article_id, ei.quantidade, coalesce(p_is_test, false)
    from embalagem_itens ei
    where ei.embalagem_id = p_embalagem_id;
  end if;

  update sales set encomenda_id = v_id where id = any(p_sale_ids) and (encomenda_id is null or encomenda_id = v_id);

  perform sync_encomenda_to_sales(v_id);

  return v_id;
end;
$$;

-- Elimina uma Encomenda: solta as vendas (Estado de envio "Não Definido"), devolve o
-- consumo de Embalagem, e move a Encomenda para a Lixeira.
create or replace function delete_encomenda(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  update sales set encomenda_id = null, estado_envio = 'Não Definido', metodo_envio = null, valor_portes = null, codigo_envio = null, data_envio = null, fatura = null, fatura_url = null
  where encomenda_id = p_id;
  update embalagem_consumos set deleted_at = now() where encomenda_id = p_id and deleted_at is null;
  update encomendas set deleted_at = now() where id = p_id;
end;
$$;

-- ---------- CENTRO DE CONTEÚDO (publicações nas redes sociais) ----------
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  tipo text default 'Reel', -- 'Reel' | 'Post' | 'Stories'
  article_id uuid references articles(id) on delete set null,
  titulo text, -- só para conteúdo sem artigo associado (o "nome" a mostrar em vez do artigo)
  link_onedrive text, -- pasta com o material a publicar (fotos/vídeo) — só para conteúdo sem artigo
  estado text default 'Por fotografar',
  rede text,
  link text,
  data_publicacao date,
  observacoes text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- DEFINIÇÕES ----------
-- Uma única linha (id fixo) com os limiares/parâmetros que a app usa nas suas regras
-- automáticas — para a Rosa e a Rita poderem ajustar sem ser preciso pedir alterações ao
-- código. Se a linha não existir ainda, a app usa os valores por defeito abaixo.
create table if not exists settings (
  id boolean primary key default true check (id), -- garante que só pode haver uma linha
  margem_alvo_pct numeric not null default 55,
  stock_baixo_limite numeric not null default 3,
  artigo_parado_dias numeric not null default 60,
  troca_janela_dias numeric not null default 14,
  troca_aviso_dias numeric not null default 5,
  sugestao_promover_dias numeric not null default 60,
  sugestao_liquidar_dias numeric not null default 90,
  sugestao_stock_alto_qtd numeric not null default 5,
  sugestao_margem_baixa_pct numeric not null default 25,
  conteudo_aviso_dias numeric not null default 10,
  pontos_boas_vindas numeric not null default 50,

  -- 🏪 Dados da empresa
  marca_nome text default 'R² (Rosa e Rita)',
  logo_url text,
  empresa_email text,
  instagram text,
  tiktok text,
  rosa_telefone text,
  rosa_morada text,
  rosa_nif text,
  rita_telefone text,
  rita_morada text,
  rita_nif text,

  -- 📦 Dados para encomendas
  transportadora_padrao text,
  portes_nacionais numeric,
  portes_internacionais numeric,
  portes_gratis_acima numeric,
  prazo_envio_dias numeric,

  -- 💳 Dados de pagamentos
  pagamento_mbway boolean not null default true,
  pagamento_transferencia boolean not null default true,
  pagamento_numerario boolean not null default true,
  pagamento_outros boolean not null default false,
  iban_rosa text,
  iban_rita text,
  mbway_rosa text,
  mbway_rita text,

  deleted_at timestamptz,
  updated_at timestamptz default now()
);

alter table settings enable row level security;
drop policy if exists "authenticated full access" on settings;
create policy "authenticated full access" on settings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'settings') then
    alter publication supabase_realtime add table settings;
  end if;
end $$;

-- ---------- CENTRO DE TAREFAS ----------
-- Tarefas "automáticas" são geradas sozinhas pela app a partir de regras sobre outros dados
-- (ex.: uma venda paga por preparar) — "chave" identifica essa regra+registo de forma estável,
-- para nunca duplicar a mesma tarefa. Tarefas "manuais" são criadas à mão e não têm chave.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  chave text unique, -- só para tarefas automáticas; null nas manuais
  tipo text not null default 'manual', -- 'auto' | 'manual'
  titulo text not null,
  origem_tab text, -- separador para onde navegar ao clicar (ex.: 'sales', 'articles')
  origem_id uuid, -- id do registo de origem, para pré-selecionar/abrir
  responsavel text, -- 'Rosa' | 'Rita' | null
  prazo date,
  estado text not null default 'Pendente', -- 'Pendente' | 'Concluída'
  notas text,
  concluida_at timestamptz,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table tasks enable row level security;
drop policy if exists "authenticated full access" on tasks;
create policy "authenticated full access" on tasks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table tasks;
  end if;
end $$;

-- ---------- DIRETOS ----------
-- Um direto (live) tem itens preparados (artigos ou conjuntos de artigos, com preço de
-- direto próprio), e regista comentários/pedidos durante a sessão (live_registos).
-- Cada item preparado fica guardado como jsonb dentro de `itens` — mais simples do que
-- normalizar em várias tabelas, já que a lista de itens de um direto é sempre editada em bloco.
create table if not exists lives (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nome text not null,
  data date default current_date,
  hora_inicio text,
  hora_fim text,
  redes_sociais text[] default '{}',
  itens jsonb not null default '[]', -- [{id, tipo:'artigo'|'conjunto', article_ids:[uuid], nome, preco_direto}]
  estado text not null default 'Preparação', -- 'Preparação' | 'Em curso' | 'Terminado'
  posicao_atual int not null default 0,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Log cronológico de cada "comentário/pedido" durante um direto. `live_item_id` é o id do
-- item dentro de `lives.itens`, ou "{itemId}::{articleId}" quando é só uma peça de um conjunto.
create table if not exists live_registos (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references lives(id) on delete cascade,
  live_item_id text not null,
  ordem int not null default 0,
  quantidade numeric not null default 1,
  quantidade_vendida numeric not null default 0,
  username text not null,
  client_id uuid references clients(id) on delete set null,
  rede_social text,
  estado text not null default 'Por validar', -- 'Por validar' | 'Vendido' | 'Lista de espera' | 'Cancelado'
  sale_id uuid references sales(id) on delete set null,
  -- artigo a usar em vez do artigo original do item, quando a reposição vem com outro SKU
  -- (só relevante enquanto estado = 'Lista de espera'); "Fazer nova venda" usa este em vez do original quando definido.
  artigo_substituto_id uuid references articles(id) on delete set null,
  -- sub-estado só usado enquanto estado = 'Lista de espera': 'Pendente' (ainda à espera) ou
  -- 'Encerrado — Artigo sem reposição' (já não vai ser reposto; sai da lista de espera ativa).
  estado_lista_espera text not null default 'Pendente',
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table lives enable row level security;
alter table live_registos enable row level security;
drop policy if exists "authenticated full access" on lives;
create policy "authenticated full access" on lives
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on live_registos;
create policy "authenticated full access" on live_registos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lives') then
    alter publication supabase_realtime add table lives;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_registos') then
    alter publication supabase_realtime add table live_registos;
  end if;
end $$;

-- ---------- COMUNICAÇÃO COM O CLIENTE ----------
-- Modelos de mensagem parametrizáveis por situação (ex: "Pagamento confirmado",
-- "Peça em lista de espera"). O corpo suporta variáveis {{cliente}}, {{artigo}},
-- {{quantidade}}, {{valor}}, {{codigo}}, {{codigo_envio}}, {{metodo_envio}},
-- {{direto}}, {{data}} — substituídas no momento de compor a mensagem, consoante
-- o contexto de onde é aberta (venda, cliente, ou registo de direto).
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- nome da situação, ex: "Pagamento confirmado"
  corpo text not null default '',
  ativo boolean not null default true,
  ordem int not null default 0,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table message_templates enable row level security;
drop policy if exists "authenticated full access" on message_templates;
create policy "authenticated full access" on message_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_templates') then
    alter publication supabase_realtime add table message_templates;
  end if;
end $$;

-- ---------- DATAS DE MARKETING (sugestões de conteúdo no Centro de Tarefas) ----------
-- Datas "fixas" (mês/dia todos os anos) geríveis pela Rosa/Rita nas Definições — Dia da Mãe
-- e Black Friday não entram aqui, porque mudam de dia todos os anos por fórmula (calculadas
-- diretamente no código, em vez de guardadas).
create table if not exists marketing_dates (
  id uuid primary key default gen_random_uuid(),
  mes int not null check (mes between 1 and 12),
  dia int not null check (dia between 1 and 31),
  nome text not null,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table marketing_dates enable row level security;
drop policy if exists "authenticated full access" on marketing_dates;
create policy "authenticated full access" on marketing_dates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'marketing_dates') then
    alter publication supabase_realtime add table marketing_dates;
  end if;
end $$;

insert into marketing_dates (mes, dia, nome) values
  (1, 1, 'Ano Novo'),
  (2, 14, 'Dia dos Namorados'),
  (3, 8, 'Dia Internacional da Mulher'),
  (3, 19, 'Dia do Pai'),
  (6, 1, 'Dia da Criança'),
  (10, 31, 'Halloween'),
  (12, 25, 'Natal')
on conflict do nothing;

-- ---------- TIPOS DE ARTIGO (totalmente parametrizável nas Definições) ----------
-- Substitui a antiga lista fixa de Tipos no código: cada Tipo (ex: "Blazer", "Saco de
-- plástico 10x10cm") pertence a um Grupo (ex: "Vestuário", "Embalagens") e diz à app se
-- é vendável a clientes ou só material interno (permite_venda), e se costuma ter Tamanho
-- (tem_tamanho). Geríveis livremente pela Rosa/Rita nas Definições — sem tocar no código.
create table if not exists article_tipos (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  peca text not null,
  codigo text not null, -- prefixo do SKU, ex: "BLZ"
  permite_venda boolean not null default true,
  tem_tamanho boolean not null default false,
  eh_etiqueta boolean not null default false, -- artigos deste Tipo servem para dar baixa ao marcar "Peça já etiquetada" noutro artigo
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table article_tipos enable row level security;
drop policy if exists "authenticated full access" on article_tipos;
create policy "authenticated full access" on article_tipos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'article_tipos') then
    alter publication supabase_realtime add table article_tipos;
  end if;
end $$;
drop trigger if exists trg_audit_article_tipos on article_tipos;
create trigger trg_audit_article_tipos after insert or update or delete on article_tipos for each row execute function audit_trigger();

insert into article_tipos (grupo, peca, codigo, permite_venda, tem_tamanho, eh_etiqueta)
select * from (values
  ('Vestuário', 'Blazer', 'BLZ', true, true, false),
  ('Vestuário', 'Blusa', 'BLU', true, true, false),
  ('Vestuário', 'Calças', 'CAL', true, true, false),
  ('Vestuário', 'Camisa', 'CAM', true, true, false),
  ('Vestuário', 'Camisola', 'CML', true, true, false),
  ('Vestuário', 'Casaco', 'CAS', true, true, false),
  ('Vestuário', 'Colete', 'CTE', true, true, false),
  ('Vestuário', 'Fato de banho', 'FDB', true, true, false),
  ('Vestuário', 'Jeans', 'JNS', true, true, false),
  ('Vestuário', 'Leggings', 'LEG', true, true, false),
  ('Vestuário', 'Pijama', 'PIJ', true, true, false),
  ('Vestuário', 'Roupa interior', 'RIN', true, true, false),
  ('Vestuário', 'Saia', 'SAI', true, true, false),
  ('Vestuário', 'Sweatshirt', 'SWT', true, true, false),
  ('Vestuário', 'T-shirt', 'TSH', true, true, false),
  ('Vestuário', 'Vestido', 'VES', true, true, false),
  ('Acessórios', 'Bijuteria', 'BIJ', true, false, false),
  ('Acessórios', 'Boné', 'BON', true, false, false),
  ('Acessórios', 'Cachecol', 'CCH', true, false, false),
  ('Acessórios', 'Carteira', 'CRT', true, false, false),
  ('Acessórios', 'Chapéu', 'CHP', true, false, false),
  ('Acessórios', 'Cinto', 'CIN', true, true, false),
  ('Acessórios', 'Lenço', 'LEN', true, false, false),
  ('Acessórios', 'Luvas', 'LUV', true, false, false),
  ('Acessórios', 'Mala', 'MAL', true, false, false),
  ('Acessórios', 'Óculos', 'OCL', true, false, false),
  ('Calçado', 'Botas', 'BOT', true, true, false),
  ('Calçado', 'Chinelos', 'CHL', true, true, false),
  ('Calçado', 'Sandálias', 'SAN', true, true, false),
  ('Calçado', 'Sapatos', 'SAP', true, true, false),
  ('Calçado', 'Saltos altos', 'SLT', true, true, false),
  ('Calçado', 'Ténis', 'TEN', true, true, false),
  ('Material Interno', 'Cabides', 'CAB', false, false, false),
  ('Material Interno', 'Caixas', 'CXA', false, false, false),
  ('Material Interno', 'Cartões', 'CTO', false, false, false),
  ('Material Interno', 'Etiquetas', 'ETQ', false, false, true),
  ('Material Interno', 'Manequins', 'MNQ', false, false, false),
  ('Material Interno', 'Material promocional', 'PRM', false, false, false),
  ('Material Interno', 'Sacos de envio', 'SCE', false, false, false),
  ('Material Interno', 'Outro (material interno)', 'OMI', false, false, false)
) as seed(grupo, peca, codigo, permite_venda, tem_tamanho, eh_etiqueta)
where not exists (select 1 from article_tipos);

-- ---------- CORES E PADRÕES (totalmente parametrizável nas Definições) ----------
-- A Cor e o Padrão de um artigo passam a ser dois campos independentes (antes eram um só
-- seletor combinado). Cada lista é gerível livremente pela Rosa/Rita nas Definições, tal
-- como os Tipos de Artigo — sem tocar em código.
create table if not exists article_cores (
  id uuid primary key default gen_random_uuid(),
  valor text not null,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
alter table article_cores enable row level security;
drop policy if exists "authenticated full access" on article_cores;
create policy "authenticated full access" on article_cores
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'article_cores') then
    alter publication supabase_realtime add table article_cores;
  end if;
end $$;
drop trigger if exists trg_audit_article_cores on article_cores;
create trigger trg_audit_article_cores after insert or update or delete on article_cores for each row execute function audit_trigger();

create table if not exists article_padroes (
  id uuid primary key default gen_random_uuid(),
  valor text not null,
  ativo boolean not null default true,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
alter table article_padroes enable row level security;
drop policy if exists "authenticated full access" on article_padroes;
create policy "authenticated full access" on article_padroes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'article_padroes') then
    alter publication supabase_realtime add table article_padroes;
  end if;
end $$;
drop trigger if exists trg_audit_article_padroes on article_padroes;
create trigger trg_audit_article_padroes after insert or update or delete on article_padroes for each row execute function audit_trigger();

-- "N/A" é sempre a cor por defeito de um artigo novo — tem de existir na lista.
insert into article_cores (valor)
select * from (values
  ('N/A'), ('Amarelo'), ('Amarelo mostarda'), ('Azul'), ('Azul bebé'), ('Azul claro'), ('Azul escuro'),
  ('Azul esverdeado'), ('Azul marinho'), ('Azul turquesa'), ('Bege'), ('Branco'), ('Caramelo'),
  ('Castanho'), ('Castanho claro'), ('Castanho escuro'), ('Cinzento'), ('Cinzento claro'),
  ('Cinzento escuro'), ('Coral'), ('Creme'), ('Dourado'), ('Grafite'), ('Laranja'), ('Lavanda'),
  ('Lilás'), ('Nude'), ('Prateado'), ('Preto'), ('Rosa'), ('Rosa choque'), ('Rosa claro'),
  ('Rosa velho'), ('Rosa vivo'), ('Roxo'), ('Terracota'), ('Verde'), ('Verde água'), ('Verde claro'),
  ('Verde escuro'), ('Verde esmeralda'), ('Verde lima'), ('Verde oliva'), ('Vermelho'), ('Vinho')
) as seed(valor)
where not exists (select 1 from article_cores);

-- "Liso" é sempre o padrão por defeito de um artigo novo — tem de existir na lista.
insert into article_padroes (valor)
select * from (values
  ('Liso'), ('Animal print'), ('Estampado'), ('Floral'), ('Multicolor'), ('Poás'), ('Riscas'), ('Xadrez')
) as seed(valor)
where not exists (select 1 from article_padroes);

-- ---------- CONSUMO DE ETIQUETAS FÍSICAS ----------
-- Ao assinalar "Peça já etiquetada" num artigo vendável, dá-se baixa de 1 unidade de stock
-- a um artigo do Tipo marcado como "eh_etiqueta" (article_tipos, ex: "Etiquetas") — cada
-- marcação cria uma linha aqui. Desmarcar elimina (soft-delete) a linha correspondente,
-- devolvendo a unidade ao stock da etiqueta. Conta como saída de stock no computeArticles,
-- tal como uma venda ou uma troca.
create table if not exists etiqueta_consumos (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade, -- artigo vendável que foi etiquetado
  etiqueta_article_id uuid references articles(id) on delete set null, -- artigo-etiqueta (Material Interno) de onde saiu a unidade
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
alter table etiqueta_consumos enable row level security;
drop policy if exists "authenticated full access" on etiqueta_consumos;
create policy "authenticated full access" on etiqueta_consumos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'etiqueta_consumos') then
    alter publication supabase_realtime add table etiqueta_consumos;
  end if;
end $$;
drop trigger if exists trg_audit_etiqueta_consumos on etiqueta_consumos;
create trigger trg_audit_etiqueta_consumos after insert or update or delete on etiqueta_consumos for each row execute function audit_trigger();

insert into settings (id) values (true) on conflict do nothing;

insert into message_templates (nome, corpo, ordem) values
  ('Pagamento confirmado', 'Olá {{cliente}}! 🎉 Recebemos o teu pagamento de {{valor}} referente a {{artigo}}. Vamos preparar o teu envio, obrigada pela compra!', 1),
  ('Encomenda enviada', 'Olá {{cliente}}! A tua encomenda ({{artigo}}) já foi enviada via {{metodo_envio}}. Código de envio: {{codigo_envio}}. Obrigada! 💛', 2),
  ('Reserva — aguarda pagamento', 'Olá {{cliente}}! Ficou reservad{{a_o}} {{artigo}} por {{valor}}. Envia-nos o comprovativo de pagamento para confirmarmos, se faz favor. 😊', 3),
  ('Peça em lista de espera', 'Olá {{cliente}}! De momento {{artigo}} está esgotad{{a_o}}, mas ficaste em lista de espera. Assim que houver disponibilidade avisamos-te! 🙏', 4),
  ('Boas-vindas', 'Olá {{cliente}}! Obrigada por nos contactares. Qualquer dúvida sobre os nossos artigos, estamos aqui! 💛', 5)
on conflict do nothing;

-- ---------- TROCAS ----------
-- Pedido de troca: encomenda original → artigo devolvido → motivo → novo artigo →
-- diferença a pagar/devolver → estado. A data limite para troca não é guardada aqui —
-- é calculada no cliente a partir da data de envio da encomenda (ou da venda, se não
-- tiver sido enviada) + uma janela de dias configurável (ver EXCHANGE_WINDOW_DAYS).
-- `stock_ajustado` garante que o efeito no stock (devolver o artigo antigo, retirar o
-- novo) só é aplicado uma única vez, no momento em que se confirma a receção da peça.
create table if not exists exchanges (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  sale_id uuid references sales(id) on delete set null,
  original_article_id uuid references articles(id) on delete set null,
  motivo text,
  motivo_notas text,
  novo_article_id uuid references articles(id) on delete set null,
  quantidade numeric not null default 1,
  diferenca numeric not null default 0, -- positivo = cliente paga; negativo = devolver ao cliente
  estado text not null default 'Pedido registado',
  -- 'Pedido registado' | 'Aguarda devolução do cliente' | 'Artigo devolvido recebido' | 'Novo artigo enviado' | 'Concluída' | 'Cancelada'
  stock_ajustado boolean not null default false,
  data_pedido date default current_date,
  data_rececao date,
  notas text,
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table exchanges enable row level security;
drop policy if exists "authenticated full access" on exchanges;
create policy "authenticated full access" on exchanges
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'exchanges') then
    alter publication supabase_realtime add table exchanges;
  end if;
end $$;

-- ---------- ITENS DE COMPRA ----------
-- A app gira à volta do artigo: uma compra a um fornecedor é composta por um ou mais
-- itens, cada um ligado a um artigo do catálogo. A quantidade e o valor de compra
-- definem-se AQUI, por item — nunca à mão no artigo. Sempre que um item de compra é
-- criado, editado ou eliminado (ou a compra é eliminada/restaurada), a "quantidade" e o
-- "preco_unitario" (valor da última compra) do artigo são recalculados automaticamente
-- pela base de dados (ver recompute_article_purchase_aggregates, mais abaixo) — nunca
-- editados diretamente na Ficha do Artigo.
create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0, -- custo unitário desta compra, s/IVA
  referencia text, -- referência/código do fornecedor para este artigo, se tiver
  notas text,
  is_test boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists purchase_items_purchase_idx on purchase_items(purchase_id);
create index if not exists purchase_items_article_idx on purchase_items(article_id);

alter table purchase_items enable row level security;
drop policy if exists "authenticated full access" on purchase_items;
create policy "authenticated full access" on purchase_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'purchase_items') then
    alter publication supabase_realtime add table purchase_items;
  end if;
end $$;

-- Recalcula, a partir dos itens de compra ainda ativos (compra não eliminada, mesmo
-- modo real/teste do artigo, e — importante — só compras já "Concluída") a quantidade
-- total adquirida, o valor da última compra (preço unitário do item de compra mais
-- recente) e o preço médio (custo médio, ponderado pela quantidade, de todas as compras
-- concluídas) de UM artigo. O stock de uma compra "Reservado" ou "Enviado" ainda NÃO
-- conta para o artigo — só passa a contar quando a compra fica "Concluída".
create or replace function recompute_article_purchase_aggregates(p_article_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_article_id is null then return; end if;
  update articles a set
    quantidade = coalesce((
      select sum(pi.quantidade) from purchase_items pi
      join purchases p on p.id = pi.purchase_id
      where pi.article_id = a.id and p.deleted_at is null and p.is_test = a.is_test and p.estado = 'Concluída'
    ), 0),
    preco_unitario = coalesce((
      select pi.valor_unitario from purchase_items pi
      join purchases p on p.id = pi.purchase_id
      where pi.article_id = a.id and p.deleted_at is null and p.is_test = a.is_test and p.estado = 'Concluída'
      order by p.data desc, pi.created_at desc
      limit 1
    ), a.preco_unitario),
    preco_medio = coalesce((
      select sum(pi.quantidade * pi.valor_unitario) / nullif(sum(pi.quantidade), 0) from purchase_items pi
      join purchases p on p.id = pi.purchase_id
      where pi.article_id = a.id and p.deleted_at is null and p.is_test = a.is_test and p.estado = 'Concluída'
    ), 0)
  where a.id = p_article_id;
end;
$$;

create or replace function trg_purchase_items_recompute_article() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform recompute_article_purchase_aggregates(old.article_id);
    return old;
  elsif (tg_op = 'UPDATE') then
    perform recompute_article_purchase_aggregates(old.article_id);
    if new.article_id is distinct from old.article_id then
      perform recompute_article_purchase_aggregates(new.article_id);
    end if;
    return new;
  else
    perform recompute_article_purchase_aggregates(new.article_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_purchase_items_aiud on purchase_items;
create trigger trg_purchase_items_aiud after insert or update or delete on purchase_items
for each row execute function trg_purchase_items_recompute_article();

-- Quando uma compra é eliminada (Lixeira) ou restaurada, os artigos dos seus itens
-- têm de ser recalculados (a compra deixa/passa a contar de novo para o stock).
create or replace function trg_purchases_soft_delete_recompute() returns trigger
language plpgsql
set search_path = public
as $$
declare r record;
begin
  if new.deleted_at is distinct from old.deleted_at then
    for r in select distinct article_id from purchase_items where purchase_id = new.id and article_id is not null loop
      perform recompute_article_purchase_aggregates(r.article_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchases_soft_delete on purchases;
create trigger trg_purchases_soft_delete after update of deleted_at on purchases
for each row execute function trg_purchases_soft_delete_recompute();

-- Quando o Estado de uma compra muda (ex: "Reservado" → "Concluída", ou vice-versa ao
-- corrigir), os artigos dos seus itens têm de ser recalculados — o stock só entra no
-- artigo quando a compra fica "Concluída", e sai de novo se deixar de o estar.
create or replace function trg_purchases_estado_recompute() returns trigger
language plpgsql
set search_path = public
as $$
declare r record;
begin
  if new.estado is distinct from old.estado then
    for r in select distinct article_id from purchase_items where purchase_id = new.id and article_id is not null loop
      perform recompute_article_purchase_aggregates(r.article_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchases_estado_change on purchases;
create trigger trg_purchases_estado_change after update of estado on purchases
for each row execute function trg_purchases_estado_recompute();

-- Mantém purchases.valor_aquisicao (o total da compra) sempre igual à soma dos seus itens.
create or replace function recompute_purchase_total(p_purchase_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_purchase_id is null then return; end if;
  update purchases set valor_aquisicao = coalesce((
    select sum(quantidade * valor_unitario) from purchase_items where purchase_id = p_purchase_id
  ), 0) where id = p_purchase_id;
end;
$$;

create or replace function trg_purchase_items_recompute_total() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform recompute_purchase_total(old.purchase_id);
    return old;
  else
    perform recompute_purchase_total(new.purchase_id);
    if tg_op = 'UPDATE' and new.purchase_id is distinct from old.purchase_id then
      perform recompute_purchase_total(old.purchase_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_purchase_items_total_aiud on purchase_items;
create trigger trg_purchase_items_total_aiud after insert or update or delete on purchase_items
for each row execute function trg_purchase_items_recompute_total();

-- ============================================================
-- Compras sem conflitos — grava a compra (cabeçalho) e os seus itens numa única
-- operação atómica. `p_items` é um array JSON de { id?, article_id, quantidade,
-- valor_unitario, notas? } — qualquer item já existente que deixe de vir na lista é
-- removido. Os triggers acima tratam de atualizar o artigo (quantidade/preco_unitario)
-- e o total da compra automaticamente a seguir.
-- ============================================================
create or replace function save_purchase_with_items(
  p_id uuid,
  p_codigo text,
  p_supplier_id uuid,
  p_desconto numeric,
  p_estado text,
  p_data_envio date,
  p_data_chegada date,
  p_codigo_rastreio text,
  p_fatura text,
  p_fatura_url text,
  p_quem_comprou text,
  p_data date,
  p_notas text,
  p_items jsonb,
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_keep_ids uuid[] := array[]::uuid[];
  v_is_test boolean;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_supplier_id is null then
    raise exception 'Indica o fornecedor da compra';
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  if not exists (select 1 from purchases where id = v_id) then
    insert into purchases (
      id, codigo, supplier_id, desconto, estado, data_envio, data_chegada,
      codigo_rastreio, fatura, fatura_url, quem_comprou, data, notas, is_test
    ) values (
      v_id, p_codigo, p_supplier_id, coalesce(p_desconto, 0), coalesce(p_estado, 'Reservado'),
      p_data_envio, p_data_chegada, p_codigo_rastreio, p_fatura, p_fatura_url, p_quem_comprou,
      coalesce(p_data, current_date), p_notas, coalesce(p_is_test, false)
    );
  else
    update purchases set
      codigo = p_codigo, supplier_id = p_supplier_id, desconto = coalesce(p_desconto, 0),
      estado = coalesce(p_estado, 'Reservado'), data_envio = p_data_envio, data_chegada = p_data_chegada,
      codigo_rastreio = p_codigo_rastreio, fatura = p_fatura, fatura_url = p_fatura_url,
      quem_comprou = p_quem_comprou, data = coalesce(p_data, current_date), notas = p_notas
      -- nota: is_test nunca se altera num update — fixo desde a criação
    where id = v_id;
  end if;

  -- itens novos herdam sempre o modo real/teste REAL da compra (nunca o do interruptor
  -- no momento da chamada) — importante ao editar uma compra já existente.
  select is_test into v_is_test from purchases where id = v_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if (v_item->>'article_id') is null or (v_item->>'article_id') = '' then
      raise exception 'Todos os itens da compra têm de ter um artigo escolhido';
    end if;
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_keep_ids := array_append(v_keep_ids, v_item_id);
    insert into purchase_items (id, purchase_id, article_id, quantidade, valor_unitario, referencia, notas, is_test)
    values (
      v_item_id, v_id, (v_item->>'article_id')::uuid,
      coalesce((v_item->>'quantidade')::numeric, 0),
      coalesce((v_item->>'valor_unitario')::numeric, 0),
      v_item->>'referencia', v_item->>'notas', coalesce(v_is_test, false)
    )
    on conflict (id) do update set
      article_id = excluded.article_id, quantidade = excluded.quantidade,
      valor_unitario = excluded.valor_unitario, referencia = excluded.referencia, notas = excluded.notas;
  end loop;

  delete from purchase_items
  where purchase_id = v_id
    and not (id = any(v_keep_ids));

  return v_id;
end;
$$;

-- ============================================================
-- Garante as colunas mais recentes mesmo que a tabela já existisse
-- de uma versão anterior deste ficheiro (seguro correr sempre que
-- houver uma atualização).
-- ============================================================
-- v3 — a app passa a girar à volta do artigo: a compra tem itens (quantidade + valor
-- definidos por item, ver purchase_items acima), e deixam de se editar à mão no artigo.
-- "purchase_id" no artigo (link único artigo→compra) deixa de existir — um artigo pode
-- agora ter várias compras associadas (histórico de reposições), via purchase_items.
alter table articles drop column if exists purchase_id;
-- v3b — o fornecedor deixa de se guardar no artigo: um artigo pode ser reposto por
-- fornecedores diferentes ao longo do tempo (cada compra já indica o seu próprio
-- fornecedor). O fornecedor de cada reposição fica visível no Histórico de compras.
alter table articles drop column if exists fornecedor_id;
-- v3c — o stock só entra no artigo quando a compra fica "Concluída" (ver
-- recompute_article_purchase_aggregates e trg_purchases_estado_change, mais acima) —
-- uma compra "Reservado" ou "Enviado" ainda não soma quantidade nem atualiza o preço.
-- v3d — novo campo "preco_medio", a média (ponderada pela quantidade) do custo unitário
-- de todas as compras concluídas do artigo — distinto do preco_unitario, que é sempre o
-- valor da compra concluída mais recente. IVA de um artigo novo passa a nascer a 0%.
alter table articles add column if not exists preco_medio numeric default 0;
alter table articles alter column iva set default 0;
-- v3e — novo campo "uso_interno": marca sozinho, a partir do Tipo, os artigos de material
-- interno (etiquetas, cartões, sacos de envio, caixas, material promocional, cabides,
-- manequins, etc.) — nunca à venda, só para controlar o stock desse material de apoio.
alter table articles add column if not exists uso_interno boolean not null default false;
-- v3f — Cor e Padrão passam a ser dois campos independentes (Padrão nasce sempre "Liso"
-- por defeito) e ambas as listas passam a ser parametrizáveis nas Definições, tal como os
-- Tipos de Artigo (ver article_cores e article_padroes, mais abaixo).
alter table articles add column if not exists padrao text default 'Liso';
update articles set padrao = 'Liso' where padrao is null;
-- v3g — o Tipo "Etiquetas" (ou outro escolhido) passa a poder marcar-se como "eh_etiqueta":
-- ao assinalar "Peça já etiquetada" num artigo vendável, dá-se baixa de 1 unidade a um
-- artigo desse Tipo (ver etiqueta_consumos, mais abaixo).
alter table article_tipos add column if not exists eh_etiqueta boolean not null default false;
update article_tipos set eh_etiqueta = true where peca = 'Etiquetas' and grupo = 'Material Interno' and not eh_etiqueta;
-- v3h — "N/A" passa a ser a Cor por defeito de um artigo novo — garante que existe na
-- lista mesmo em instalações onde article_cores já tinha sido semeada antes desta versão.
insert into article_cores (valor)
select 'N/A' where not exists (select 1 from article_cores where valor = 'N/A');
alter table articles add column if not exists foto_url text;
alter table articles add column if not exists publicado boolean not null default false;
alter table purchases add column if not exists fatura_url text;
alter table purchases add column if not exists estado text default 'Reservado';
alter table purchases add column if not exists data_envio date;
alter table purchases add column if not exists data_chegada date;
alter table purchases add column if not exists codigo_rastreio text;
alter table sales add column if not exists fatura_url text;
alter table sales add column if not exists comprovativo_url text;
alter table sales add column if not exists data_limite_reserva date;
alter table sales add column if not exists estado_envio text default 'Não Definido';
alter table sales add column if not exists metodo_envio text;
alter table sales add column if not exists valor_portes numeric;
alter table sales add column if not exists codigo_envio text;
alter table clients add column if not exists codigo_desconto text;
alter table clients add column if not exists data_inicio_desconto date;
alter table clients add column if not exists data_fim_desconto date;
alter table clients add column if not exists desconto_utilizado boolean not null default false;

-- favoritos e etiquetas coloridas (clientes, fornecedores, artigos)
alter table suppliers add column if not exists favorito boolean not null default false;
alter table suppliers add column if not exists etiqueta text;
alter table articles add column if not exists favorito boolean not null default false;
alter table articles add column if not exists etiqueta text;
alter table articles add column if not exists notas text;
alter table articles add column if not exists tamanho text;
alter table clients add column if not exists favorito boolean not null default false;
alter table clients add column if not exists etiqueta text;
alter table clients add column if not exists pontos_bonus integer not null default 0;

-- códigos únicos tipo SKU (suppliers/purchases/sales/content_items/lives), campo "etiquetado"
-- em articles, e "tipo" de publicação em content_items — seguro correr sempre que houver atualização.
alter table suppliers add column if not exists codigo text;
alter table purchases add column if not exists codigo text;
alter table sales add column if not exists codigo text;
alter table content_items add column if not exists codigo text;
alter table content_items add column if not exists tipo text default 'Reel';
alter table articles add column if not exists etiquetado boolean not null default false;
alter table articles add column if not exists estado text not null default 'Em stock';
alter table content_items add column if not exists titulo text;
alter table content_items add column if not exists link_onedrive text;
alter table live_registos add column if not exists artigo_substituto_id uuid references articles(id) on delete set null;
alter table live_registos add column if not exists estado_lista_espera text not null default 'Pendente';

-- Dados da empresa, encomendas e pagamentos (caso a tabela "settings" já existisse antes destas colunas)
alter table settings add column if not exists marca_nome text default 'R² (Rosa e Rita)';
alter table settings add column if not exists logo_url text;
alter table settings add column if not exists empresa_email text;
alter table settings add column if not exists instagram text;
alter table settings add column if not exists tiktok text;
alter table settings add column if not exists rosa_telefone text;
alter table settings add column if not exists rosa_morada text;
alter table settings add column if not exists rosa_nif text;
alter table settings add column if not exists rita_telefone text;
alter table settings add column if not exists rita_morada text;
alter table settings add column if not exists rita_nif text;
alter table settings add column if not exists transportadora_padrao text;
alter table settings add column if not exists portes_nacionais numeric;
alter table settings add column if not exists portes_internacionais numeric;
alter table settings add column if not exists portes_gratis_acima numeric;
alter table settings add column if not exists prazo_envio_dias numeric;
alter table settings add column if not exists pagamento_mbway boolean not null default true;
alter table settings add column if not exists pagamento_transferencia boolean not null default true;
alter table settings add column if not exists pagamento_numerario boolean not null default true;
alter table settings add column if not exists pagamento_outros boolean not null default false;
alter table settings add column if not exists iban_rosa text;
alter table settings add column if not exists iban_rita text;
alter table settings add column if not exists mbway_rosa text;
alter table settings add column if not exists mbway_rita text;

-- Modo de Teste — coluna is_test em todas as tabelas de negócio (não em settings/audit_log/sku_counters)
alter table suppliers add column if not exists is_test boolean not null default false;
alter table purchases add column if not exists is_test boolean not null default false;
alter table articles add column if not exists is_test boolean not null default false;
alter table clients add column if not exists is_test boolean not null default false;
alter table sales add column if not exists is_test boolean not null default false;
alter table content_items add column if not exists is_test boolean not null default false;
alter table tasks add column if not exists is_test boolean not null default false;
alter table lives add column if not exists is_test boolean not null default false;
alter table live_registos add column if not exists is_test boolean not null default false;
alter table message_templates add column if not exists is_test boolean not null default false;
alter table exchanges add column if not exists is_test boolean not null default false;
alter table content_items alter column article_id drop not null;

-- índices únicos parciais (ignoram linhas eliminadas e códigos vazios) — impedem duplicados
-- mesmo que dois pedidos cheguem em simultâneo; a validação na app é só a primeira camada.
-- Cada tabela tem dois índices — um para dados reais, outro para dados de teste — para nunca
-- haver conflito entre um código real e um código de teste que calhe a ser igual.
drop index if exists suppliers_codigo_uidx;
create unique index if not exists suppliers_codigo_real_uidx on suppliers (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists suppliers_codigo_teste_uidx on suppliers (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

drop index if exists purchases_codigo_uidx;
create unique index if not exists purchases_codigo_real_uidx on purchases (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists purchases_codigo_teste_uidx on purchases (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

drop index if exists sales_codigo_uidx;
create unique index if not exists sales_codigo_real_uidx on sales (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists sales_codigo_teste_uidx on sales (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

drop index if exists content_items_codigo_uidx;
create unique index if not exists content_items_codigo_real_uidx on content_items (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists content_items_codigo_teste_uidx on content_items (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

drop index if exists lives_codigo_uidx;
create unique index if not exists lives_codigo_real_uidx on lives (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists lives_codigo_teste_uidx on lives (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

drop index if exists exchanges_codigo_uidx;
create unique index if not exists exchanges_codigo_real_uidx on exchanges (lower(codigo)) where deleted_at is null and is_test = false and codigo is not null and codigo <> '';
create unique index if not exists exchanges_codigo_teste_uidx on exchanges (lower(codigo)) where deleted_at is null and is_test = true and codigo is not null and codigo <> '';

-- ============================================================
-- SEGURANÇA (RLS) — só utilizadores autenticados (Rosa e Rita)
-- conseguem ler/escrever. Ninguém de fora acede aos dados.
-- ============================================================
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table articles enable row level security;
alter table clients enable row level security;
alter table sales enable row level security;
alter table content_items enable row level security;

drop policy if exists "authenticated full access" on suppliers;
create policy "authenticated full access" on suppliers
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on purchases;
create policy "authenticated full access" on purchases
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on articles;
create policy "authenticated full access" on articles
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on clients;
create policy "authenticated full access" on clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on sales;
create policy "authenticated full access" on sales
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "authenticated full access" on content_items;
create policy "authenticated full access" on content_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- TEMPO REAL — para a Rosa ver ao vivo o que a Rita insere (e vice-versa)
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'suppliers') then
    alter publication supabase_realtime add table suppliers;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'purchases') then
    alter publication supabase_realtime add table purchases;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'articles') then
    alter publication supabase_realtime add table articles;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'clients') then
    alter publication supabase_realtime add table clients;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sales') then
    alter publication supabase_realtime add table sales;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'content_items') then
    alter publication supabase_realtime add table content_items;
  end if;
end $$;

-- ============================================================
-- 1) ELIMINAR REVERSÍVEL (soft delete)
-- A app nunca apaga uma linha a sério — marca `deleted_at` com a
-- data/hora. As listagens normais escondem essas linhas; a página
-- "Lixeira" mostra-as e permite restaurar ou eliminar em definitivo.
-- (As colunas deleted_at já estão criadas acima, nas tabelas.)
-- ============================================================

-- ============================================================
-- 2) HISTÓRICO DE ALTERAÇÕES (auditoria)
-- Regista automaticamente quem criou, editou ou eliminou cada
-- registo, com o antes/depois. Não pode ser desligado pela app.
-- ============================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  changed_by_email text,
  changed_at timestamptz default now(),
  old_data jsonb,
  new_data jsonb
);

alter table audit_log enable row level security;
drop policy if exists "authenticated read audit" on audit_log;
create policy "authenticated read audit" on audit_log
  for select using (auth.uid() is not null);
-- (não há policy de insert para utilizadores — só o trigger, via security definer, escreve aqui)

create or replace function audit_trigger() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into audit_log (table_name, record_id, action, changed_by_email, old_data)
    values (tg_table_name, old.id, 'delete', auth.email(), to_jsonb(old));
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into audit_log (table_name, record_id, action, changed_by_email, old_data, new_data)
    values (tg_table_name, new.id, 'update', auth.email(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'INSERT') then
    insert into audit_log (table_name, record_id, action, changed_by_email, new_data)
    values (tg_table_name, new.id, 'insert', auth.email(), to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_suppliers on suppliers;
create trigger trg_audit_suppliers after insert or update or delete on suppliers for each row execute function audit_trigger();
drop trigger if exists trg_audit_articles on articles;
create trigger trg_audit_articles after insert or update or delete on articles for each row execute function audit_trigger();
drop trigger if exists trg_audit_purchases on purchases;
create trigger trg_audit_purchases after insert or update or delete on purchases for each row execute function audit_trigger();
drop trigger if exists trg_audit_clients on clients;
create trigger trg_audit_clients after insert or update or delete on clients for each row execute function audit_trigger();
drop trigger if exists trg_audit_sales on sales;
create trigger trg_audit_sales after insert or update or delete on sales for each row execute function audit_trigger();
drop trigger if exists trg_audit_content_items on content_items;
create trigger trg_audit_content_items after insert or update or delete on content_items for each row execute function audit_trigger();
drop trigger if exists trg_audit_lives on lives;
create trigger trg_audit_lives after insert or update or delete on lives for each row execute function audit_trigger();
drop trigger if exists trg_audit_live_registos on live_registos;
create trigger trg_audit_live_registos after insert or update or delete on live_registos for each row execute function audit_trigger();
drop trigger if exists trg_audit_message_templates on message_templates;
create trigger trg_audit_message_templates after insert or update or delete on message_templates for each row execute function audit_trigger();
drop trigger if exists trg_audit_exchanges on exchanges;
create trigger trg_audit_exchanges after insert or update or delete on exchanges for each row execute function audit_trigger();
drop trigger if exists trg_audit_purchase_items on purchase_items;
create trigger trg_audit_purchase_items after insert or update or delete on purchase_items for each row execute function audit_trigger();
drop trigger if exists trg_audit_encomendas on encomendas;
create trigger trg_audit_encomendas after insert or update or delete on encomendas for each row execute function audit_trigger();
drop trigger if exists trg_audit_embalagens on embalagens;
create trigger trg_audit_embalagens after insert or update or delete on embalagens for each row execute function audit_trigger();
drop trigger if exists trg_audit_metodos_envio on metodos_envio;
create trigger trg_audit_metodos_envio after insert or update or delete on metodos_envio for each row execute function audit_trigger();
drop trigger if exists trg_audit_embalagem_itens on embalagem_itens;
create trigger trg_audit_embalagem_itens after insert or update or delete on embalagem_itens for each row execute function audit_trigger();
drop trigger if exists trg_audit_embalagem_consumos on embalagem_consumos;
create trigger trg_audit_embalagem_consumos after insert or update or delete on embalagem_consumos for each row execute function audit_trigger();
drop trigger if exists trg_audit_consumos_manuais on consumos_manuais;
create trigger trg_audit_consumos_manuais after insert or update or delete on consumos_manuais for each row execute function audit_trigger();
drop trigger if exists trg_audit_gastos_diversos on gastos_diversos;
create trigger trg_audit_gastos_diversos after insert or update or delete on gastos_diversos for each row execute function audit_trigger();
drop trigger if exists trg_audit_movimentos_capital on movimentos_capital;
create trigger trg_audit_movimentos_capital after insert or update or delete on movimentos_capital for each row execute function audit_trigger();
drop trigger if exists trg_audit_transformacoes on transformacoes;
create trigger trg_audit_transformacoes after insert or update or delete on transformacoes for each row execute function audit_trigger();
drop trigger if exists trg_audit_transformacao_itens on transformacao_itens;
create trigger trg_audit_transformacao_itens after insert or update or delete on transformacao_itens for each row execute function audit_trigger();
drop trigger if exists trg_audit_transformacao_execucoes on transformacao_execucoes;
create trigger trg_audit_transformacao_execucoes after insert or update or delete on transformacao_execucoes for each row execute function audit_trigger();
drop trigger if exists trg_audit_transformacao_execucao_itens on transformacao_execucao_itens;
create trigger trg_audit_transformacao_execucao_itens after insert or update or delete on transformacao_execucao_itens for each row execute function audit_trigger();

-- ============================================================
-- 3a) SKU sem conflitos — gerado pela base de dados, de forma
-- atómica, para que duas criações em simultâneo nunca repitam código.
-- ============================================================
create table if not exists sku_counters (
  code text primary key,
  last_number int not null default 0
);

alter table sku_counters enable row level security;
drop policy if exists "authenticated full access" on sku_counters;
create policy "authenticated full access" on sku_counters
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function next_sku(p_code text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into sku_counters (code, last_number) values (p_code, 1)
  on conflict (code) do update set last_number = sku_counters.last_number + 1
  returning last_number into v_next;
  return p_code || '-' || lpad(v_next::text, 3, '0');
end;
$$;

-- ============================================================
-- 3b) VENDAS sem conflitos — verifica e reserva o stock de forma
-- atómica (bloqueia a linha do artigo durante a operação), para
-- que a Rosa e a Rita nunca consigam vender a mesma última unidade.
-- Usa-se em vez de um INSERT/UPDATE direto na tabela `sales`.
-- ============================================================
drop function if exists save_sale(uuid, uuid, numeric, numeric, text, uuid, text, text, text, date, date, date, date, date, text);
drop function if exists save_sale(uuid, uuid, numeric, numeric, text, uuid, text, text, text, text, text, date, date, date, date, date, text);
drop function if exists save_sale(uuid, uuid, numeric, numeric, text, uuid, text, text, text, text, text, text, date, date, date, date, date, text);
drop function if exists save_sale(uuid, text, uuid, numeric, numeric, text, uuid, text, text, text, text, text, text, text, text, date, date, date, date, date, text);

create or replace function save_sale(
  p_id uuid,
  p_codigo text,
  p_article_id uuid,
  p_quantidade numeric,
  p_valor_venda numeric,
  p_quem_vendeu text,
  p_client_id uuid,
  p_forma_pagamento text,
  p_estado text,
  p_estado_envio text,
  p_metodo_envio text,
  p_codigo_envio text,
  p_fatura text,
  p_fatura_url text,
  p_comprovativo_url text,
  p_data_reserva date,
  p_data_limite_reserva date,
  p_data_pagamento date,
  p_data_envio date,
  p_data date,
  p_notas text,
  p_is_test boolean default false
) returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd_total numeric;
  v_ja_vendido numeric;
  v_stock numeric;
  v_result sales;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select quantidade into v_qtd_total from articles where id = p_article_id for update;
  if v_qtd_total is null then
    raise exception 'Artigo não encontrado';
  end if;

  -- o stock já vendido só conta vendas do MESMO modo (reais com reais, teste com teste) —
  -- para o Modo de Teste nunca mexer no stock disponível dos dados reais, e vice-versa.
  select coalesce(sum(quantidade), 0) into v_ja_vendido
  from sales
  where article_id = p_article_id
    and deleted_at is null
    and id <> p_id
    and estado <> 'Não pago'
    and is_test = p_is_test;

  v_stock := v_qtd_total - v_ja_vendido;

  if p_quantidade > v_stock then
    raise exception 'Stock insuficiente — disponível: %, pedido: %', v_stock, p_quantidade;
  end if;

  if not exists (select 1 from sales where id = p_id) then
    insert into sales (
      id, codigo, article_id, quantidade, valor_venda, quem_vendeu, client_id, forma_pagamento,
      estado, estado_envio, metodo_envio, codigo_envio, fatura, fatura_url, comprovativo_url,
      data_reserva, data_limite_reserva, data_pagamento, data_envio, data, notas, is_test
    ) values (
      p_id, p_codigo, p_article_id, p_quantidade, p_valor_venda, p_quem_vendeu, p_client_id, p_forma_pagamento,
      p_estado, p_estado_envio, p_metodo_envio, p_codigo_envio, p_fatura, p_fatura_url, p_comprovativo_url,
      p_data_reserva, p_data_limite_reserva, p_data_pagamento, p_data_envio, p_data, p_notas, p_is_test
    ) returning * into v_result;
  else
    update sales set
      codigo = p_codigo, article_id = p_article_id, quantidade = p_quantidade, valor_venda = p_valor_venda,
      quem_vendeu = p_quem_vendeu, client_id = p_client_id, forma_pagamento = p_forma_pagamento,
      estado = p_estado, estado_envio = p_estado_envio, metodo_envio = p_metodo_envio, codigo_envio = p_codigo_envio,
      fatura = p_fatura, fatura_url = p_fatura_url, comprovativo_url = p_comprovativo_url,
      data_reserva = p_data_reserva, data_limite_reserva = p_data_limite_reserva,
      data_pagamento = p_data_pagamento, data_envio = p_data_envio, data = p_data, notas = p_notas
      -- nota: is_test NUNCA se altera num update — o modo de um registo fica fixo desde a criação
    where id = p_id
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

-- ============================================================
-- 4) FOTOS DOS ARTIGOS (Supabase Storage)
-- Cria um "bucket" (espaço de armazenamento) público chamado
-- "article-photos". Público significa que quem tiver o link direto
-- da foto consegue vê-la (como a maioria das lojas online) — mas só
-- a Rosa e a Rita conseguem enviar, substituir ou remover fotos.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('article-photos', 'article-photos', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica de fotos de artigos" on storage.objects;
create policy "Leitura publica de fotos de artigos"
on storage.objects for select
using (bucket_id = 'article-photos');

drop policy if exists "Upload de fotos por utilizadores autenticados" on storage.objects;
create policy "Upload de fotos por utilizadores autenticados"
on storage.objects for insert
with check (bucket_id = 'article-photos' and auth.uid() is not null);

drop policy if exists "Substituir fotos por utilizadores autenticados" on storage.objects;
create policy "Substituir fotos por utilizadores autenticados"
on storage.objects for update
using (bucket_id = 'article-photos' and auth.uid() is not null);

drop policy if exists "Remover fotos por utilizadores autenticados" on storage.objects;
create policy "Remover fotos por utilizadores autenticados"
on storage.objects for delete
using (bucket_id = 'article-photos' and auth.uid() is not null);

-- ============================================================
-- 4b) LOGÓTIPO DA MARCA (Supabase Storage) — mesmo esquema do bucket de fotos
-- dos artigos acima, mas num bucket próprio ("brand-assets").
-- ============================================================
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica de brand-assets" on storage.objects;
create policy "Leitura publica de brand-assets"
on storage.objects for select
using (bucket_id = 'brand-assets');

drop policy if exists "Upload de brand-assets por utilizadores autenticados" on storage.objects;
create policy "Upload de brand-assets por utilizadores autenticados"
on storage.objects for insert
with check (bucket_id = 'brand-assets' and auth.uid() is not null);

drop policy if exists "Substituir brand-assets por utilizadores autenticados" on storage.objects;
create policy "Substituir brand-assets por utilizadores autenticados"
on storage.objects for update
using (bucket_id = 'brand-assets' and auth.uid() is not null);

drop policy if exists "Remover brand-assets por utilizadores autenticados" on storage.objects;
create policy "Remover brand-assets por utilizadores autenticados"
on storage.objects for delete
using (bucket_id = 'brand-assets' and auth.uid() is not null);

-- ============================================================
-- 5) DOCUMENTOS (faturas de compra, faturas de venda e
-- comprovativos de pagamento) — Supabase Storage
-- Mesmo esquema do bucket de fotos: leitura por quem tiver o link,
-- escrita só para a Rosa e a Rita.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "Leitura publica de documentos" on storage.objects;
create policy "Leitura publica de documentos"
on storage.objects for select
using (bucket_id = 'documents');

drop policy if exists "Upload de documentos por utilizadores autenticados" on storage.objects;
create policy "Upload de documentos por utilizadores autenticados"
on storage.objects for insert
with check (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "Substituir documentos por utilizadores autenticados" on storage.objects;
create policy "Substituir documentos por utilizadores autenticados"
on storage.objects for update
using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "Remover documentos por utilizadores autenticados" on storage.objects;
create policy "Remover documentos por utilizadores autenticados"
on storage.objects for delete
using (bucket_id = 'documents' and auth.uid() is not null);

-- ============================================================
-- 6) CENTRO DE CONTEÚDO — marca automaticamente "Publicado" no artigo
-- quando (e só quando) uma linha de conteúdo desse artigo tem Estado = 'Publicado'.
-- (Não desmarca sozinho se o estado da publicação mudar depois — é só um "assinalar".)
-- ============================================================
create or replace function mark_article_published() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.article_id is not null and new.estado = 'Publicado' then
    update articles set publicado = true where id = new.article_id and publicado = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_mark_published on content_items;
create trigger trg_content_mark_published after insert or update on content_items for each row execute function mark_article_published();
