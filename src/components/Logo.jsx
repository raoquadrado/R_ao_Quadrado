import { useState } from "react";
import { STORE_NAME, STORE_TAGLINE, LOGO_PATH } from "../lib/branding";

/**
 * Mostra o logótipo (público em /public/logo.png) se existir.
 * Se ainda não houver ficheiro, mostra "R²" como texto — nunca fica
 * partido nem com um ícone de imagem em falta.
 */
/**
 * Mostra o logótipo (público em /public/logo.png) se existir.
 * Se ainda não houver ficheiro, mostra "R²" como texto — nunca fica
 * partido nem com um ícone de imagem em falta. O lema só aparece em
 * texto no modo de recurso (sem imagem) — o logótipo real já o tem
 * desenhado dentro da própria imagem.
 */
export default function Logo({ size = "md", showTagline = false, light = false }) {
  const [failed, setFailed] = useState(false);
  const heights = { sm: "h-6", md: "h-9", lg: "h-14" };

  return (
    <div className="flex flex-col">
      {!failed ? (
        <img
          src={LOGO_PATH}
          alt={STORE_NAME}
          className={`${heights[size]} w-auto object-contain`}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span className={`font-display font-semibold ${light ? "text-paper" : "text-ink"} ${size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg"}`}>
            R<sup className="text-[0.6em]">2</sup>
          </span>
          {showTagline && STORE_TAGLINE && (
            <span className={`text-xs mt-1 ${light ? "text-[#C9CBD6]" : "text-stone"}`}>{STORE_TAGLINE}</span>
          )}
        </>
      )}
    </div>
  );
}
