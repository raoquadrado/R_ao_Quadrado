// Exportação dos artigos marcados "Publicar no site" para o CSV de importação de produtos do Shopify.
// - Um produto por SKU base (os tamanhos são as variantes, "Option1 = Tamanho").
// - Composição e Cuidados vão para metafields (colunas "... (product.metafields.custom.composicao)").
//   Para o Shopify os aceitar, as definições custom.composicao e custom.cuidados têm de existir no Shopify
//   (Definições → Dados personalizados → Produtos), tipo "Texto de várias linhas".
// - A tabela de medidas (cm, por tamanho) vai dentro da descrição (Body HTML), a seguir ao "Porque a escolhemos".
import { FAMILIAS_MEDIDAS, familiaMedidasDoTipo } from "./constants";
import { displaySku } from "./computations";

const ORDEM_TAMANHOS = ["XXS", "XS", "S", "SM", "M", "ML", "L", "XL", "XXL", "XXXL", "3XL", "4XL", "U", "UNICO", "ÚNICO"];

function ordenarTamanhos(a, b) {
  const ta = String(a.tamanho || "").trim().toUpperCase();
  const tb = String(b.tamanho || "").trim().toUpperCase();
  const na = parseFloat(ta.replace(",", ".")), nb = parseFloat(tb.replace(",", "."));
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  const ia = ORDEM_TAMANHOS.indexOf(ta), ib = ORDEM_TAMANHOS.indexOf(tb);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return ta.localeCompare(tb, "pt");
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slug(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function fmtMedida(v) {
  if (v === "" || v === null || v === undefined) return "—";
  return String(v).replace(".", ",");
}

// Tabela HTML das medidas: uma linha por tamanho, só com as colunas que têm algum valor.
export function tabelaMedidasHtml(variantes, familia) {
  const fam = FAMILIAS_MEDIDAS[familia];
  if (!fam) return "";
  const cols = fam.campos.filter(([k]) => variantes.some((v) => String(v.medidas?.[k] ?? "").trim() !== ""));
  if (cols.length === 0) return "";
  const linhas = variantes.filter((v) => cols.some(([k]) => String(v.medidas?.[k] ?? "").trim() !== ""));
  const th = cols.map(([, l]) => `<th>${esc(l)}</th>`).join("");
  const trs = linhas.map((v) => `<tr><td>${esc(v.tamanho || "Único")}</td>${cols.map(([k]) => `<td>${esc(fmtMedida(v.medidas?.[k]))}</td>`).join("")}</tr>`).join("");
  return `<h4>Medidas (cm)</h4><table><thead><tr><th>Tamanho</th>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function construirCsvShopify(articlesComputed, tipos) {
  const elegiveis = (articlesComputed || []).filter((a) => a.publicar_site && !a.uso_interno && !a.deleted_at);
  const grupos = new Map();
  elegiveis.forEach((a) => {
    const chave = a.sku || a.id;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(a);
  });

  const cabecalho = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value",
    "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
    "Variant Fulfillment Service", "Variant Price", "Variant Requires Shipping", "Variant Taxable",
    "Image Src", "Image Position", "Image Alt Text",
    "Composição (product.metafields.custom.composicao)", "Cuidados (product.metafields.custom.cuidados)",
    "Status",
  ];
  const linhas = [];
  const avisos = { semPreco: [], semFoto: [], semComposicao: [], semMedidas: [] };
  let nVariantes = 0;

  for (const [chave, lista] of grupos) {
    const variantes = [...lista].sort(ordenarTamanhos);
    const base = variantes[0];
    const rotulo = base.artigo || chave;
    const primeiroCom = (campo) => variantes.map((v) => v[campo]).find((x) => String(x ?? "").trim() !== "") || "";
    const composicao = primeiroCom("composicao");
    const cuidados = primeiroCom("cuidados");
    const porque = primeiroCom("porque_escolhemos");
    const escolha = primeiroCom("escolha");
    const familia = familiaMedidasDoTipo(base.tipo, tipos);
    const preco = variantes.map((v) => Number(v.valor_venda) || 0).find((x) => x > 0) || 0;
    const fotos = [...new Set(variantes.map((v) => v.foto_url).filter(Boolean))];
    const temTamanho = variantes.some((v) => String(v.tamanho || "").trim());

    const partes = [];
    if (porque) partes.push(`<h4>Porque a escolhemos</h4>${String(porque).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}`);
    const tabela = familia ? tabelaMedidasHtml(variantes, familia) : "";
    if (tabela) partes.push(tabela);
    const corTxt = base.cor && base.cor !== "N/A" ? base.cor : "";
    const tags = [
      base.tipo,
      corTxt,
      base.padrao && base.padrao !== "Liso" ? base.padrao : "",
      escolha === "Rosa" || escolha === "Das duas" ? "Escolha da Rosa" : "",
      escolha === "Rita" || escolha === "Das duas" ? "Escolha da Rita" : "",
    ].filter(Boolean).join(", ");
    const handle = slug(`${rotulo}-${chave}`);

    if (!preco) avisos.semPreco.push(rotulo);
    if (fotos.length === 0) avisos.semFoto.push(rotulo);
    if (!composicao) avisos.semComposicao.push(rotulo);
    if (familia && !tabela) avisos.semMedidas.push(rotulo);

    variantes.forEach((v, i) => {
      nVariantes++;
      const primeira = i === 0;
      linhas.push([
        handle,
        primeira ? `${rotulo}${corTxt ? ` — ${corTxt}` : ""}` : "",
        primeira ? partes.join("") : "",
        primeira ? "R²" : "",
        primeira ? base.tipo || "" : "",
        primeira ? tags : "",
        primeira ? "TRUE" : "",
        primeira ? (temTamanho ? "Tamanho" : "Title") : "",
        temTamanho ? (v.tamanho || "Único") : "Default Title",
        displaySku(v),
        0,
        "shopify",
        Math.max(0, Number(v.stockAtual) || 0),
        "deny",
        "manual",
        preco ? preco.toFixed(2) : "",
        "TRUE",
        "TRUE",
        primeira ? (fotos[0] || "") : "",
        primeira && fotos[0] ? 1 : "",
        primeira && fotos[0] ? rotulo : "",
        primeira ? composicao : "",
        primeira ? cuidados : "",
        primeira ? "active" : "",
      ]);
    });
    // fotos adicionais: linhas só com Handle + imagem
    fotos.slice(1).forEach((url, k) => {
      const l = new Array(cabecalho.length).fill("");
      l[0] = handle; l[18] = url; l[19] = k + 2; l[20] = rotulo;
      linhas.push(l);
    });
  }

  const csv = "﻿" + [cabecalho, ...linhas].map((l) => l.map(csvCell).join(",")).join("\r\n");
  return { csv, nProdutos: grupos.size, nVariantes, avisos };
}

export function descarregarCsvShopify(articlesComputed, tipos) {
  const r = construirCsvShopify(articlesComputed, tipos);
  if (r.nProdutos === 0) return r;
  const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopify-produtos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return r;
}
