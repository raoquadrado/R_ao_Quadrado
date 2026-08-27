import * as XLSX from "xlsx";
import { money, todayISO, fmtDate, displaySku } from "./computations";
import { computeFullDashboard } from "./dashboardStats";
import { getTestMode } from "./testMode";

export function exportExcel({ articles, suppliers, articlesComputed, purchases, purchaseItems, clientsComputed, clients, sales, contentItems, encomendas, embalagens, embalagemItens, transformacoes, transformacaoItens, gastosDiversos, supplierName, articleName, clientName, tipos }) {
  const wb = XLSX.utils.book_new();
  const emTeste = getTestMode();

  const dash = computeFullDashboard({
    articles, articlesComputed, purchases, purchaseItems, sales, suppliers, clients, clientsComputed, tipos,
    periodKey: "month", customStart: "", customEnd: "", owner: "Todos",
  });
  const kpiRows = [
    ["R² — Painel geral", ""], [`Gerado em ${fmtDate(todayISO())}`, ""],
    ...(emTeste ? [["⚠ MODO DE TESTE — estes dados são fictícios, não são o negócio real", ""]] : []),
    ["", ""],
    ["Indicador", "Valor"],
    ...[...dash.kpis.row1, ...dash.kpis.row2, ...dash.kpis.row3].map((k) => [
      k.label, k.kind === "money" ? money(k.value) : `${Math.round(k.value)}${k.suffix || ""}`,
    ]),
    ["", ""], ["Alertas", ""],
    ...(dash.alerts.length ? dash.alerts.map((a) => [a.text, ""]) : [["Sem alertas de momento", ""]]),
  ];
  const wsPainel = XLSX.utils.aoa_to_sheet(kpiRows);
  wsPainel["!cols"] = [{ wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsPainel, "Painel");

  const wsSuppliers = XLSX.utils.json_to_sheet(
    suppliers.map((s) => ({
      Nome: s.nome, NIF: s.nif, Localidade: s.localidade, "Redes sociais": s.redes_sociais, Site: s.site,
      Contacto: s.contacto, Email: s.email, Estado: s.status,
      "Avaliação (1-5)": (s.avaliacao || 0) === 0 ? "Não avaliado" : s.avaliacao, Notas: s.notas,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Fornecedores");

  const wsArticles = XLSX.utils.json_to_sheet(
    articlesComputed.map((a) => ({
      SKU: displaySku(a), Tipo: a.tipo, Artigo: a.artigo, Tamanho: a.tamanho || "—", Cor: a.cor, "Padrão": a.padrao || "Liso", Owner: a.owner,
      "Preço unitário (€)": a.preco_unitario, "Preço médio (€)": a.preco_medio, "IVA (%)": a.iva, Quantidade: a.quantidade,
      "Valor total s/IVA (€)": Number(a.valorTotalSemIVA.toFixed(2)), "Valor total c/IVA (€)": Number(a.valorTotalComIVA.toFixed(2)),
      "Valor de venda (€)": a.valor_venda, "Margem (€)": Number(a.margemUnit.toFixed(2)), "Margem (%)": Number(a.margemPct.toFixed(1)),
      "Stock atual": a.stockAtual, "Valor stock s/IVA (€)": Number(a.valorStockSemIVA.toFixed(2)), "Valor stock c/IVA (€)": Number(a.valorStockComIVA.toFixed(2)),
      Publicado: a.publicado ? "Sim" : "Não",
      "Material interno": a.uso_interno ? "Sim" : "Não",
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsArticles, "Artigos e Stock");

  const wsPurchases = XLSX.utils.json_to_sheet(
    purchases.map((p) => ({
      Data: p.data, Fornecedor: supplierName(p.supplier_id),
      "Valor aquisição (€)": p.valor_aquisicao, "Desconto (€)": p.desconto,
      "Valor total (€)": Number(p.valor_aquisicao || 0) - Number(p.desconto || 0),
      Estado: p.estado || "Reservado", "Código de rastreio": p.codigo_rastreio || "—",
      "Data de envio": p.data_envio || "—", "Data de chegada": p.data_chegada || "—",
      Fatura: p.fatura, "Link da fatura": p.fatura_url || "—", "Quem comprou": p.quem_comprou, Notas: p.notas,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsPurchases, "Compras");

  if (purchaseItems) {
    const wsPurchaseItems = XLSX.utils.json_to_sheet(
      purchaseItems.map((it) => {
        const p = purchases.find((x) => x.id === it.purchase_id);
        return {
          "Código da compra": p?.codigo || "—", Data: p?.data || "—", Fornecedor: p ? supplierName(p.supplier_id) : "—",
          Artigo: articleName(it.article_id), "Referência fornecedor": it.referencia || "—", Quantidade: it.quantidade, "Custo unitário (€)": it.valor_unitario,
          "Subtotal (€)": Number((Number(it.quantidade || 0) * Number(it.valor_unitario || 0)).toFixed(2)), Notas: it.notas || "—",
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, wsPurchaseItems, "Itens de Compra");
  }

  const wsClients = XLSX.utils.json_to_sheet(
    clientsComputed.map((c) => ({
      Nome: c.nome, Estado: c.estadoCliente || "—", Pontos: c.pontos, "Pontos de bónus": c.pontosBonus ?? 0, Plataforma: c.plataforma, "Rede social": c.rede_social, NIF: c.nif,
      "Morada faturação": c.morada_faturacao, "Morada entrega": c.morada_entrega, Email: c.email, Telefone: c.telefone,
      Aniversário: c.aniversario, "Satisfação Cliente (1-5)": (c.avaliacao || 0) === 0 ? "Não avaliado" : c.avaliacao,
      "Nº compras": c.nCompras, "Nº peças não pagas": c.nNaoPagas, "Total gasto (€)": Number(c.totalGasto.toFixed(2)), "Total gasto último ano (€)": Number(c.totalGastoAno.toFixed(2)),
      "Última compra": c.dataUltimaCompra || "—",
      "Código de desconto": c.codigo_desconto || "—", "Início desconto": c.data_inicio_desconto || "—",
      "Fim desconto": c.data_fim_desconto || "—", "Desconto utilizado": c.desconto_utilizado ? "Sim" : "Não",
      Notas: c.notas,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");

  const wsSales = XLSX.utils.json_to_sheet(
    sales.map((s) => ({
      Data: s.data, Artigo: articleName(s.article_id), "Quantidade vendida": s.quantidade,
      "Valor da venda (€)": s.valor_venda, "Quem vendeu": s.quem_vendeu, Cliente: clientName(s.client_id),
      "Estado do pagamento": s.estado, "Forma de pagamento": s.forma_pagamento || "por definir", "Data pagamento": s.data_pagamento || "—",
      "Estado do envio": s.estado_envio || "Em Preparação", "Método de envio": s.metodo_envio || "—", "Código de envio": s.codigo_envio || "—", "Data envio": s.data_envio || "—",
      "Nº fatura": s.fatura || "por emitir", "Link da fatura": s.fatura_url || "—", "Link do comprovativo": s.comprovativo_url || "—",
      "Data reserva": s.data_reserva || "—", "Data limite reserva": s.data_limite_reserva || "—", Notas: s.notas,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsSales, "Vendas");

  if (encomendas) {
    const wsEncomendas = XLSX.utils.json_to_sheet(
      encomendas.map((e) => {
        const nVendas = sales.filter((s) => s.encomenda_id === e.id).length;
        const embalagem = embalagens?.find((emb) => emb.id === e.embalagem_id);
        return {
          Código: e.codigo || "—", Cliente: clientName(e.client_id), "Nº de vendas": nVendas,
          "Estado do envio": e.estado_envio || "Não Definido", "Método de envio": e.metodo_envio || "—", "Código de envio": e.codigo_envio || "—", "Data de envio": e.data_envio || "—",
          Embalagem: embalagem?.nome || "—",
          "Fatura Rosa": e.fatura_rosa || "por emitir", "Fatura Rita": e.fatura_rita || "por emitir", Notas: e.notas || "—",
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, wsEncomendas, "Encomendas");
  }

  if (embalagens) {
    const wsEmbalagens = XLSX.utils.json_to_sheet(
      embalagens.map((e) => ({
        Nome: e.nome, Ativo: e.ativo === false ? "Não" : "Sim",
        Receita: (embalagemItens || []).filter((it) => it.embalagem_id === e.id).map((it) => `${articleName(it.article_id)} ×${it.quantidade}`).join(", ") || "sem itens",
        Notas: e.notas || "—",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEmbalagens, "Embalagens");
  }

  if (transformacoes) {
    const wsTransformacoes = XLSX.utils.json_to_sheet(
      transformacoes.map((t) => ({
        Nome: t.nome, Ativo: t.ativo === false ? "Não" : "Sim",
        Produz: `${articleName(t.output_article_id)} ×${t.output_quantidade}`,
        Consome: (transformacaoItens || []).filter((it) => it.transformacao_id === t.id).map((it) => `${articleName(it.article_id)} ×${it.quantidade}`).join(", ") || "sem itens",
        Notas: t.notas || "—",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsTransformacoes, "Transformações");
  }

  if (gastosDiversos) {
    const wsGastos = XLSX.utils.json_to_sheet(
      gastosDiversos.filter((g) => !g.deleted_at).map((g) => ({
        Descrição: g.descricao, "Valor (€)": Number(g.valor || 0), Owner: g.owner || "—",
        Fornecedor: g.supplier_id ? supplierName(g.supplier_id) : "—", Data: g.data || "—", Notas: g.notas || "—",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos Diversos");
  }

  if (contentItems) {
    const wsContent = XLSX.utils.json_to_sheet(
      contentItems.map((c) => ({
        Artigo: articleName(c.article_id), Estado: c.estado || "Por fotografar", Rede: c.rede || "— por definir —",
        Link: c.link || "—", "Data de publicação": c.data_publicacao || "—", Observações: c.observacoes || "—",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsContent, "Centro de Conteúdo");
  }

  const nomeFicheiro = `${emTeste ? "TESTE-" : ""}gestao-negocio-${todayISO()}.xlsx`;
  try {
    // Blob + link manual, em vez de XLSX.writeFile() — mais fiável em ambientes mais
    // restritos (ex.: dentro de uma pré-visualização em iframe), tal como já é feito na
    // Cópia de Segurança.
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeFicheiro;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    throw new Error("Não foi possível descarregar o ficheiro Excel — o browser pode estar a bloquear a descarga neste ambiente. " + (err?.message || ""));
  }
}
