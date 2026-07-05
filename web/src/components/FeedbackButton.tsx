import type { CSSProperties } from "react";

// Feedback funnels to ONE channel — the Google Form (name + email + wallet + rating) — so
// every response lands in a single sheet (risein Level 5 evidence) instead of splitting
// between Supabase and the form. The in-app Supabase modal (FeedbackModal / lib/feedback) is
// retired; the existing Supabase rows are kept as early feedback.
const FEEDBACK_FORM_URL = "https://forms.gle/7gzJWwte52SmbXei7";

export default function FeedbackButton() {
  return (
    <button
      style={fab}
      onClick={() => window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer")}
      type="button"
    >
      Share feedback
    </button>
  );
}

const fab: CSSProperties = {
  position: "fixed", right: 18, bottom: 18, zIndex: 1500,
  padding: "11px 17px", borderRadius: 999, cursor: "pointer",
  background: "rgba(18,18,28,0.82)", border: "1px solid rgba(253,218,36,0.45)",
  color: "#FDDA24", fontWeight: 600, fontSize: 13.5, backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
};
