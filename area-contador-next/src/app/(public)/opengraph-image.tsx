import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Olá, Contador — Atendimento contábil sob demanda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f172a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#E25B38" }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Olá, Contador</div>
        </div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.15, maxWidth: 980 }}>
          Um contador de verdade, dedicado ao seu caso
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#cbd5e1", marginTop: 28, maxWidth: 900 }}>
          Preço fixo, contador com registro CRC ativo, chat seguro e relatório assinado.
        </div>
      </div>
    ),
    { ...size },
  );
}
