"use client";

import dynamic from "next/dynamic";

const FindReplaceEditor = dynamic(
  () => import("./FindReplaceEditor"),
  {
    ssr: false,
    // 스켈레톤 UI
    loading: () => (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="h-[76px] rounded-2xl border border-white/10 bg-[#1b1f25] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          <div className="flex h-full items-center gap-3">
            <div className="h-6 w-6 rounded-md bg-white/10" />
            <div className="h-7 flex-1 rounded-md bg-white/10" />
            <div className="h-6 w-[170px] rounded-md bg-white/10" />
          </div>
        </div>
        <div className="min-h-[520px] rounded-3xl border border-white/10 bg-[#0f1115] shadow-[0_25px_60px_rgba(15,23,42,0.45)]">
          <div className="h-[520px] animate-pulse bg-white/5" />
        </div>
      </div>
    ),
  }
);

export default function EditorSection() {
  return <FindReplaceEditor />;
}
