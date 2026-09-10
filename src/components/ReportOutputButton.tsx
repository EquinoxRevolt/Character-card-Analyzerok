import { Flag } from "lucide-react";

// Where "Report Output" emails are sent. This ships in the public bundle and
// in the public repo's source, so it must never be a personal address — use
// a dedicated project/support address. Left blank until one is set: the
// button hides itself rather than risk shipping someone's personal inbox.
const REPORT_EMAIL = "";

interface ReportOutputButtonProps {
  mode: "audit" | "comparison" | "group" | "multichar";
}

// In-app reporting path for offensive or broken AI output, required by
// Google Play's AI-Generated Content policy. Opens the user's mail app with
// a prefilled report — no backend needed.
export default function ReportOutputButton({ mode }: ReportOutputButtonProps) {
  if (!REPORT_EMAIL) return null;
  const subject = encodeURIComponent(`[Character Card Analyzer] Report AI output (${mode} mode)`);
  const body = encodeURIComponent(
    "What was wrong with the AI's output? (offensive, unsafe, broken, etc.)\n\n\n" +
      "If possible, paste the problematic part of the report below:\n\n"
  );

  return (
    <a
      href={`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`}
      title="Report offensive or broken AI output to the developer"
      className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] text-zinc-400 hover:text-zinc-200 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-all shadow-sm"
    >
      <Flag size={13} className="text-rose-500" />
      Report Output
    </a>
  );
}
