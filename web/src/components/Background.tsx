// Flat solid background. The animated blurred aurora was straining the page; the
// full redesign (Bekir + Gemini) will replace this. A single cheap fixed div = zero
// per-frame GPU cost.
export default function Background() {
  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: -1, background: "#0a0a12" }}
    />
  );
}
