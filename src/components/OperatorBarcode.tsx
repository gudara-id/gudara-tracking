"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renders a scannable Code128 barcode (SVG) for the given value. */
export default function OperatorBarcode({
  value,
  height = 46,
  width = 1.8,
  fontSize = 12,
  margin = 10,
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  margin?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const svg = svgRef.current;
    try {
      JsBarcode(svg, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        margin,
        displayValue: true,
        background: "transparent",
        lineColor: "#0f172a",
      });
      // JsBarcode sets fixed pixel width/height attributes on the <svg>,
      // which can make longer codes wider than their container (overflowing
      // the card, as seen when printing operator cards). Convert those fixed
      // dimensions into a viewBox instead, then let CSS (width: 100%, height:
      // auto) scale the whole barcode down proportionally to fit its parent
      // — the barcode stays fully proportioned and scannable, just smaller.
      //
      // Don't trust JsBarcode's own width/height attributes for the viewBox
      // though: it derives them from bar height + margin + fontSize as
      // separate numbers, not from the text's actual rendered glyph metrics.
      // When that estimate comes in a couple px short, the top of the
      // number (e.g. "GDR-OP-0001") pokes above y=0 of the viewBox — and
      // since a non-root <svg> is `overflow: hidden` by default in every
      // browser, that sliver gets clipped instead of shown. Measure the
      // real rendered bounding box instead, with a small safety pad.
      const bbox = svg.getBBox();
      const pad = 2;
      svg.setAttribute(
        "viewBox",
        `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`
      );
      svg.removeAttribute("width");
      svg.removeAttribute("height");
    } catch {
      // Ignore invalid values (e.g. empty string during initial render)
    }
  }, [value, height, width, fontSize, margin]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Barcode ${value}`}
      className="h-auto w-full max-w-full"
      style={{ maxHeight: height + 24 }}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
