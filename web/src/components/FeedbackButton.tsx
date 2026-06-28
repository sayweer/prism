import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button style={fab} onClick={() => setOpen(true)} type="button">
        Share feedback
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const fab: React.CSSProperties = {
  position: "fixed", right: 18, bottom: 18, zIndex: 1500,
  padding: "11px 17px", borderRadius: 999, cursor: "pointer",
  background: "rgba(18,18,28,0.82)", border: "1px solid rgba(253,218,36,0.45)",
  color: "#FDDA24", fontWeight: 600, fontSize: 13.5, backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
};
