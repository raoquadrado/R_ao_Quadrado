# R² — Guia de configuração

App de gestão do negócio (fornecedores, artigos/stock, compras, clientes, vendas) com dados online partilhados entre a Rosa e a Rita, sincronizados em tempo real, responsiva para computador e telemóvel.

**Tecnologias:** React + Vite (frontend) · Supabase (base de dados, autenticação e tempo real, plano gratuito) · Tailwind CSS (estilo responsivo) · Vercel (alojamento gratuito).

**Também inclui, desde a base:**
- **Eliminar reversível** — nada se apaga em definitivo sem passar pela Lixeira (separador novo), onde dá para restaurar ou eliminar de vez.
- **Histórico de alterações** — separador novo que regista automaticamente quem criou, editou ou eliminou cada registo, com data e detalhes.
- **Proteção contra conflitos** — se a Rosa e a Rita tentarem vender a última unidade de um artigo ao mesmo tempo, a base de dados garante que só uma consegue; a outra recebe um aviso de "stock insuficiente". O mesmo para os códigos SKU dos artigos — nunca se repetem, mesmo com criações em simultâneo.
- **Painel completo** — KPIs com variação face ao período anterior, gráficos (compras/vendas/lucro por mês, stock por estado, artigos por categoria e por owner), listas rápidas, alertas automáticos (reservas expiradas, stock esgotado/baixo, stock parado, sem fatura, sem foto, clientes pendentes), ações rápidas e filtros por período/owner.
  - **Nota:** "reservado" corresponde a vendas com estado "Aguardar pagamento"; "vendido" a "Pago"/"Enviada". Ainda não existe uma funcionalidade de **devolução** (repor stock a partir de uma venda cancelada) — é o próximo passo natural, se quiseres.
- **Painel ainda mais completo** — além do que já lá estava, agora tem: um "pulso" com Compras/Vendas/Lucro de Hoje, Esta semana e Este mês lado a lado; indicadores de saúde do negócio (ticket médio, margem média, tempo médio até vender, artigos sem fotografia, publicados e por publicar); e mais duas listas rápidas (Últimos pagamentos, Últimos movimentos).
- **Vendas reorganizadas em 4 secções** — Informação, Pagamento, Encomenda e Parte fiscal. O antigo campo único "Estado" separou-se em dois: **Estado do pagamento** (Aguarda pagamento / Pago) e **Estado do envio** (Em Preparação / Preparado / Enviado), com Método de envio (CTT / Entrega em mão / Transportadora) e Código de envio novos. **Importante:** o que conta para o stock (reservado vs. vendido) passou a depender só do estado do pagamento — assim que uma venda fica "Pago", sai do stock disponível, independentemente da fase de envio.
- **Compras com acompanhamento de envio** — cada compra tem agora um **Estado** (Reservado / Enviado / Concluída), **Código de rastreio**, **Data de envio** e **Data de chegada** — igual ao que já existia nas vendas, mas do lado de receber dos fornecedores.
- **Clientes: última compra concluída** — "Última compra" passou a contar só vendas já "Pago" (não reservas por pagar), tal como o "Total gasto". Cada cliente mostra também quantas reservas tem por pagar.
- **Painel: reservas por concluir** — nova lista mostra quem fez reservas mas ainda não pagou, com o valor em aberto e a data da última reserva.
- **Aviso ao vender a cliente com reserva pendente** — ao registar uma venda nova para um cliente que já tem reserva(s) por pagar, aparece um aviso no formulário e uma confirmação antes de gravar ("ainda assim queres registar esta venda?").
- **Artigos publicados** — cada artigo tem agora um interruptor "Publicado nas redes sociais", visível na tabela e usado nos indicadores do painel.
- **Cores em toda a app** — bege, dourado e roxo vivo aplicam-se agora a todas as páginas (não só ao painel). Verde e vermelho mantêm-se só para estados universais (Ativo/Pago = verde, eliminar/alerta = vermelho), para não perderem clareza.
- **Sugestão de valor de venda** — ao inserir o preço de compra de um artigo, a app sugere um valor de venda com base numa margem alvo (55% por defeito — ajustável ali mesmo no formulário, campo ao lado da sugestão). Um clique em "usar" preenche o campo; nunca substitui automaticamente o que já escreveste. Se quiserem mudar a margem por omissão, é a constante `DEFAULT_MARGIN_PCT` em `src/lib/constants.js`.
- **Fotos dos artigos** — upload real no formulário de Artigos, guardado no Supabase Storage (não localmente). As fotos são redimensionadas automaticamente antes de enviar, para não pesarem. A ficha da Lixeira também limpa a foto do Storage quando um artigo é eliminado em definitivo.
- **Anexos de compras e vendas** — no formulário de Compras dá para anexar a fatura (PDF ou imagem); no de Vendas dá para anexar a fatura de venda e o comprovativo de pagamento, em separado. Aparece um 📎 na tabela quando há anexo(s), e o link fica também na exportação Excel. Tal como as fotos, ficam guardados no Storage e são limpos automaticamente ao eliminar em definitivo na Lixeira.
- **Forma de pagamento** — as vendas novas começam sem forma de pagamento definida ("— por definir —"), em vez de assumir uma por omissão.

---

## Novidades desta versão (v5)

Desde o guia anterior, a app cresceu bastante. Aqui fica o resumo, por tema:

### 👥 Fidelização de clientes
- **Estado automático do cliente** — cada cliente mostra um selo: **Novato** (1ª compra), **Regular** (comprou no último mês), **Top 5** (entre os 5 que mais gastaram) ou **Bloqueado** (ver pontos abaixo). Prioridade quando várias se aplicam: Bloqueado > Top 5 > Regular > Novato.
- **Pontos** — cada cliente novo começa com **50 pontos de bónus** de boas-vindas (editável na ficha, campo "Pontos de bónus"; não é retroativo — só se aplica a quem for criado a partir de agora). A esse bónus somam-se +1 ponto por cada 1€ gasto em vendas "Pago" e subtraem-se −1 ponto por cada 1€ de peça marcada "Não pago". Se o saldo total ficar negativo, o cliente fica automaticamente **Bloqueado** e passa a ser impossível registar-lhe uma venda nova (só depois de o saldo voltar a positivo).
  - **Nota sobre stock:** uma venda "Não pago" não retira a peça do stock disponível — como a venda não se concretizou, a peça continua livre para ser vendida a outra pessoa (isto aplica-se também à verificação de stock na base de dados, não só ao que aparece no ecrã).
  - **Filtro por pontos** — a coluna "Pontos" em Clientes tem filtro ▾, agrupado em faixas (Negativo/bloqueado, 0–49, 50–99, 100–199, 200+), já que o valor exato varia demasiado para um filtro de valores únicos.
- **"Avaliação" passou a chamar-se "Satisfação Cliente"** em toda a área de Clientes (tabela, formulário e exportação Excel), para não confundir com avaliação de fornecedores.
- **Painel:** duas listas novas, "Top 10 melhores clientes" e "Top 10 piores clientes", ordenadas por pontos.

### 💰 Painel financeiro
- KPIs novos: **Recebido** (só vendas já pagas no período), **Por receber** (saldo em aberto: reservas + peças não pagas) e **Lucro realizado** (lucro só das vendas já pagas).
- Gráfico novo: **Lucro por owner**, a comparar sempre Rosa vs. Rita.
- **Painel reorganizado em secções** que abrem/fecham (💰 Financeiro, 📦 Stock & Artigos, 👥 Clientes, 🚚 Compras & Fornecedores, 🧾 Vendas) — só a secção Financeiro começa aberta, para não sobrecarregar a vista. É só clicar no título de cada secção para expandir.
- **Saudação personalizada** no topo do Painel ("Bom dia, Rosa! ☀️"), com **data e hora** (atualiza-se sozinha) e uma **frase inspiradora** escolhida ao calhas a cada visita. O resumo do dia mostra encomendas **por preparar** (pagas, ainda em preparação) e **prontas para enviar** (pagas, já preparadas) — em vez de um simples "vendas hoje" pouco claro — mais reservas por concluir, artigos por publicar e aniversários de clientes.

### 🧮 Como se calculam os valores de stock do Painel
Na secção 💰 Financeiro, os 4 primeiros números partem sempre do **preço de compra sem IVA** e do **valor de venda** de cada artigo:
- **Valor investido em stock** = preço de compra × quantidade adquirida, somado por todos os artigos (inclui peças já vendidas — é tudo o que já compraram).
- **Valor atual do stock (custo)** = preço de compra × só o stock ainda disponível (livre para vender agora, sem contar reservas nem vendas já feitas).
- **Valor potencial de venda** = valor de venda × stock ainda disponível — quanto encaixariam se vendessem hoje tudo o que resta.
- **Lucro potencial** = Valor potencial de venda − Valor atual do stock (custo) — o lucro que ainda "está para fazer", só do que resta em stock.

Estes são diferentes do **Lucro realizado**, que é sobre o que já foi vendido e pago (não sobre o que ainda está em stock).

### 📦 Artigos
- **Tamanho** — campo novo, disponível só em artigos que costumam ter tamanho (toda a Vestuário e Calçado, mais Cinto em Acessórios — digam se querem alargar a outros acessórios). Quando o artigo tem tamanho, o SKU mostrado passa a incluir o tamanho no fim (ex: `BLZ-001-M`).
- **Botão "📏 Novo tamanho"** — como o Duplicar, mas mais restrito: mantém o mesmo SKU base e todos os dados do artigo original (tipo, cor, fornecedor, preço, etc.) bloqueados — só o Tamanho pode ser alterado (a quantidade, foto e "Publicado" ficam livres, por serem específicos de cada unidade física). Exemplo: de `BLZ-001-M`, "Novo tamanho" cria um artigo novo `BLZ-001-` + o tamanho que escolheres.
- **Duplicar artigo** — botão rápido (na tabela e na ficha) que cria um artigo novo com os mesmos dados, exceto SKU, foto, quantidade, tamanho e "Publicado", que ficam limpos para reeditares. Útil para repor stock do mesmo artigo a partir de uma compra nova.
- **Campo Notas** — cada artigo pode ter notas internas.
- **Ficha completa do artigo** — ecrã novo (clica na foto ou no nome do artigo) que junta tudo num só sítio: fotografia, stock disponível, margens, lucro já realizado, fornecedor, compra associada, notas (editáveis ali mesmo), todas as vendas e reservas desse artigo, publicações no Centro de Conteúdo e histórico de alterações. O modal de edição rápida continua a existir à parte, para alterações rápidas do dia a dia.

### 📱 Centro de Conteúdo (módulo novo)
- Separador novo para gerir as publicações nas redes sociais: cada linha liga-se a um artigo e tem Estado (Por fotografar / Fotografado / Editado / Publicado), Rede (Instagram / TikTok / Facebook), Link, Data de publicação e Observações.
- **Ligação nos dois sentidos:** a partir de um artigo vês/adicionas as suas publicações; a partir de uma publicação clicas no artigo e vais direto à sua ficha.
- Quando o Estado de uma publicação é (ou passa a ser) **"Publicado"**, o artigo ligado é **automaticamente marcado como "Publicado nas redes sociais"** (feito na própria base de dados, funciona sempre, para as duas). Os outros estados (Por fotografar, Fotografado, Editado) não marcam o artigo — só "Publicado" conta.

### ⭐ Pequenos detalhes que fazem diferença
- **Favoritos** — estrela em Clientes, Fornecedores e Artigos.
- **Etiquetas coloridas** — 5 etiquetas predefinidas (VIP, Urgente, Novo, Atenção, Sazonal) nessas mesmas 3 áreas.
- **Pesquisa global** — `Ctrl/⌘ + K` procura em clientes, fornecedores e artigos ao mesmo tempo, de qualquer separador.
- **Atalhos de teclado** — `Ctrl/⌘+K` pesquisa, `N` novo registo no separador atual, `Esc` fecha janelas, `?` mostra a lista de atalhos.
- **Toasts elegantes** — confirmações discretas no canto do ecrã em vez de alertas do browser.
- **Confirmação antes de apagar** — janela de confirmação em todas as eliminações, com atenção redobrada na eliminação definitiva (Lixeira).
- **Autosave** — o formulário de Venda (o mais longo) guarda um rascunho automaticamente; se fechares sem gravar, é restaurado ao reabrir.
- **Filtros por coluna, estilo Excel** — em Fornecedores, Artigos, Compras, Clientes e Vendas, clica no ▾ ao lado do nome de uma coluna para filtrar só pelos valores que te interessam.
- **Histórico em timeline** — o separador Histórico passou de tabela a linha do tempo vertical, agrupado por dia.

Todo o código já está pronto nesta pasta. Só precisas de seguir os passos abaixo — não é preciso saber programar, é copiar/colar.

---

## Passo 1 — Criar a conta e o projeto no Supabase

1. Vai a [supabase.com](https://supabase.com) e cria uma conta gratuita (podes usar o Google).
2. Clica em **New project**.
3. Escolhe um nome (ex: `rosa-rita`), define uma password para a base de dados (guarda-a nalgum lugar seguro) e a região mais próxima (Europe).
4. Espera 1-2 minutos até o projeto ficar pronto.

## Passo 2 — Criar as tabelas

1. No menu lateral do Supabase, abre **SQL Editor**.
2. Clica em **New query**.
3. Abre o ficheiro `supabase/schema.sql` (nesta pasta), copia todo o conteúdo e cola no editor.
4. Clica em **Run**. Isto cria as tabelas, ativa a segurança e o tempo real, configura a Lixeira, o Histórico, as proteções contra conflitos, **e o espaço de armazenamento (Storage) para as fotos dos artigos**.

Não precisas de criar os "buckets" de fotos e documentos manualmente no Storage — o próprio ficheiro SQL já faz isso (secções 4 e 5, no fim).

Se já tinhas corrido uma versão anterior deste ficheiro no Supabase, não há problema em correr esta versão completa outra vez — está escrita para ser segura de repetir (não duplica nem apaga o que já lá está).

> ⚠️ **Importante nesta versão:** o `schema.sql` tem uma tabela nova (`content_items`, para o Centro de Conteúdo) e colunas novas (favoritos, etiquetas, notas, pontos de bónus dos clientes) e correções a funções existentes (validação de stock, marcação automática de "Publicado"). Se já tinham a app a funcionar com uma versão anterior, **é preciso voltar a correr o ficheiro completo** no SQL Editor para estas novidades ficarem disponíveis — continua seguro de repetir.


## Passo 3 — Criar as duas contas de acesso (Rosa e Rita)

1. No menu lateral, abre **Authentication → Users**.
2. Clica em **Add user → Create new user**.
3. Cria uma conta para a Rosa (email + password) e repete para a Rita.
4. Não há registo público — só vocês as duas conseguem entrar, com estas credenciais.

## Passo 4 — Obter as chaves de ligação

1. No menu lateral, abre **Project Settings → API**.
2. Copia o **Project URL** e a chave **anon public**.

## Passo 5 — Preparar o projeto no teu computador

Precisas de ter o [Node.js](https://nodejs.org) instalado (versão 18 ou superior — o instalador do site é o mais simples).

1. Descarrega e extrai a pasta deste projeto.
2. Abre um terminal dentro da pasta `rosa-rita-app`.
3. Copia o ficheiro `.env.example` e renomeia a cópia para `.env`.
4. Abre o `.env` e substitui pelos valores que copiaste no Passo 4:
   ```
   VITE_SUPABASE_URL=https://o-teu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=a-tua-chave-anon-public
   ```
5. No terminal, corre:
   ```
   npm install
   npm run dev
   ```
6. Abre o link que aparece (normalmente `http://localhost:5173`) — deves ver o ecrã de login. Entra com uma das contas criadas no Passo 3.

Se isto funcionar localmente, está tudo certo — falta só publicar online.

## Passo 6 — Publicar online (gratuito) com Vercel

1. Cria uma conta em [vercel.com](https://vercel.com) (podes usar o GitHub).
2. A forma mais simples: instala o GitHub Desktop, cria um repositório novo a partir desta pasta, e faz *push* para o GitHub.
3. Em Vercel, clica **Add New → Project**, escolhe o repositório.
4. Em **Environment Variables**, adiciona as duas mesmas variáveis do `.env` (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
5. Clica **Deploy**. Em 1-2 minutos tens um link tipo `rosa-rita.vercel.app`, acessível de qualquer computador ou telemóvel.

*(Se preferires, qualquer developer ou o Claude Code fazem este passo 6 por vocês em minutos — é só ligar a conta GitHub à Vercel.)*

## Passo 7 — Instalar no telemóvel como app

No telemóvel, abre o link da Vercel no navegador (Safari no iPhone, Chrome no Android):
- **iPhone:** botão Partilhar → "Adicionar ao ecrã principal"
- **Android:** menu (⋮) → "Adicionar ao ecrã principal" / "Instalar app"

Fica com ícone próprio, abre em ecrã inteiro, como uma app normal.

---

## Como funciona o trabalho a duas

- Cada uma entra com a sua conta (Rosa / Rita).
- Tudo o que uma insere, edita ou apaga aparece **automaticamente** no ecrã da outra, sem precisar de atualizar a página — graças ao tempo real do Supabase.
- Os dados ficam guardados na cloud (Supabase), não no telemóvel ou computador — por isso não se perdem e estão sempre sincronizados.

## Como colocar o logótipo e o lema

Quando tiverem o logótipo e o lema definidos, é só isto — não é preciso mexer em mais nada:

1. Abre `src/lib/branding.js` e escreve o lema em `STORE_TAGLINE` (ex: `"Moda em segunda mão, com alma."`).
2. Coloca o ficheiro do logótipo em `public/logo.png` (fundo transparente fica melhor). Se preferires `.svg`, muda também `LOGO_PATH` em `branding.js`.
3. (Opcional) Coloca um ícone quadrado em `public/favicon.png` — é o que aparece no separador do browser.
4. (Opcional) Em `public/manifest.json`, muda `"name"` e `"short_name"` para o nome real da loja — é o que aparece quando alguém instala a app no telemóvel.
5. Em `index.html`, muda o `<title>` para o nome real da loja.

Até lá, a app mostra "R²" como texto em todo o lado (login e barra lateral) — nada fica partido.

## Estrutura do projeto

```
rosa-rita-app/
  supabase/schema.sql      → esquema da base de dados (correr uma vez no Supabase)
  src/
    supabaseClient.js      → ligação ao Supabase
    App.jsx                → gere o login e a navegação
    lib/                   → constantes, cálculos (stock, margens, SKU, pontos), exportação Excel, toasts/confirmação
    components/            → peças reutilizáveis (botões, modais, layout, pesquisa global)
    pages/                 → uma página por separador (Painel, Fornecedores, Artigos + Ficha completa, Compras,
                              Clientes, Vendas, Centro de Conteúdo, Histórico, Lixeira)
```

## Custos — quando é que deixa de ser gratuito?

- **Supabase gratuito:** até 500MB de base de dados e 50 000 utilizadores ativos/mês. Para um negócio pequeno com 2 pessoas, isto dura anos.
- **Vercel gratuito:** tráfego mais do que suficiente para uma app de gestão interna (não é uma loja pública com milhares de visitas).

Se um dia o negócio crescer muito, é só fazer upgrade do plano Supabase (a partir de $25/mês) — nada no código muda.

## Precisas de ajuda a meio do caminho?

Qualquer erro que aparecer no terminal ou no ecrã, copia o texto e traz para uma conversa — ajudo a resolver. Para a parte de correr comandos e publicar (passos 5 e 6), o **Claude Code** é a ferramenta mais indicada, porque tem acesso à internet e corre os comandos por ti.
