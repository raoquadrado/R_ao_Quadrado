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
  fornecedor_id uuid references suppliers(id) on delete set null,
  owner text,
  preco_unitario numeric default 0,
  iva numeric default 23,
  quantidade numeric default 0,
  valor_venda numeric default 0,
  purchase_id uuid references purchases(id) on delete set null,
  foto_url text,
  publicado boolean not null default false,
  etiquetado boolean not null default false,
  estado text not null default 'Em stock', -- 'Em stock' | 'Esgotado — vai repor' | 'Sem Reposição' | 'Pausado'
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
  is_test boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

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
create policy "authenticated full access" on settings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table settings;

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
create policy "authenticated full access" on tasks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table tasks;

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
create policy "authenticated full access" on lives
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on live_registos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table lives;
alter publication supabase_realtime add table live_registos;

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
create policy "authenticated full access" on message_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table message_templates;

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
create policy "authenticated full access" on marketing_dates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table marketing_dates;

insert into marketing_dates (mes, dia, nome) values
  (1, 1, 'Ano Novo'),
  (2, 14, 'Dia dos Namorados'),
  (3, 8, 'Dia Internacional da Mulher'),
  (3, 19, 'Dia do Pai'),
  (6, 1, 'Dia da Criança'),
  (10, 31, 'Halloween'),
  (12, 25, 'Natal')
on conflict do nothing;

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
create policy "authenticated full access" on exchanges
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter publication supabase_realtime add table exchanges;

-- ============================================================
-- Garante as colunas mais recentes mesmo que a tabela já existisse
-- de uma versão anterior deste ficheiro (seguro correr sempre que
-- houver uma atualização).
-- ============================================================
alter table articles add column if not exists purchase_id uuid references purchases(id) on delete set null;
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

create policy "authenticated full access" on suppliers
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on purchases
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on articles
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on sales
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated full access" on content_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- TEMPO REAL — para a Rosa ver ao vivo o que a Rita insere (e vice-versa)
-- ============================================================
alter publication supabase_realtime add table suppliers;
alter publication supabase_realtime add table purchases;
alter publication supabase_realtime add table articles;
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table content_items;

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

-- ============================================================
-- 3a) SKU sem conflitos — gerado pela base de dados, de forma
-- atómica, para que duas criações em simultâneo nunca repitam código.
-- ============================================================
create table if not exists sku_counters (
  code text primary key,
  last_number int not null default 0
);

alter table sku_counters enable row level security;
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
