"use client";

import type { ConnectSection } from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import { CONNECT_SECTION_LABELS } from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import { MessageCircle, Files, UsersRound } from "lucide-react";
import { type ReactNode, useCallback } from "react";

const SECTIONS: ConnectSection[] = ["chat", "docs", "members"];

const ICONS: Record<ConnectSection, typeof MessageCircle> = {
  chat: MessageCircle,
  docs: Files,
  members: UsersRound,
};

type Props = {
  section: ConnectSection;
  onSectionChange: (next: ConnectSection) => void;
  chat: ReactNode;
  docs: ReactNode;
  members: ReactNode;
};

export default function TripConnectShell({
  section,
  onSectionChange,
  chat,
  docs,
  members,
}: Props) {
  const panels: Record<ConnectSection, ReactNode> = { chat, docs, members };

  const onPick = useCallback(
    (key: ConnectSection) => {
      if (key === section) return;
      onSectionChange(key);
    },
    [onSectionChange, section],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-1 px-1 pb-1 pt-0.5">
        <div
          className="flex rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
          role="tablist"
          aria-label="Connect sections"
        >
          {SECTIONS.map((key) => {
            const active = section === key;
            const Icon = ICONS[key];
            const label = CONNECT_SECTION_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`connect-panel-${key}`}
                id={`connect-tab-${key}`}
                onClick={() => onPick(key)}
                className={`flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-all sm:flex-row sm:gap-1.5 sm:text-xs ${
                  active
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${active ? "text-white" : "text-slate-400"}`} aria-hidden />
                <span className="leading-none">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-center text-[11px] leading-snug text-slate-400">
          Messages, trip files, and your crew — in one place.
        </p>
      </div>

      <div className="min-h-0">
        {SECTIONS.map((key) => {
          const visible = section === key;
          return (
            <div
              key={key}
              id={`connect-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`connect-tab-${key}`}
              hidden={!visible}
              className={visible ? "block" : "hidden"}
            >
              {panels[key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
