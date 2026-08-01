import Link from "next/link";
import { Globe2 } from "lucide-react";

type Props = { tripId: string };

const linkClass =
  "flex min-h-11 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.98]";

export default function TripToolsPanel({ tripId }: Props) {
  const enc = encodeURIComponent(tripId);
  const tripBase = `/app/trip/${enc}`;

  const entries: Array<{
    href: string;
    label: string;
    icon: string;
    Icon?: typeof Globe2;
  }> = [
    { href: `${tripBase}?tab=language`, label: "Language Translator", icon: "🗣️" },
    { href: `${tripBase}/emergency`, label: "Emergency", icon: "🆘" },
    { href: `${tripBase}?tab=food&foodTab=discover`, label: "Restaurants", icon: "🍽️" },
    { href: `${tripBase}?tab=food&foodTab=menu`, label: "Menu Translator", icon: "📋" },
    { href: `/app/tools/visa3?trip=${enc}`, label: "Visa", icon: "", Icon: Globe2 },
    { href: `/app/esim?trip=${enc}`, label: "eSIM", icon: "📶" },
    { href: `/app/local-apps?trip=${enc}`, label: "Local Apps", icon: "📱" },
    { href: `/app/forex?trip=${enc}`, label: "Forex", icon: "💱" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
      {entries.map((tool) => (
        <Link key={tool.label} href={tool.href} prefetch className={linkClass}>
          {tool.Icon ? (
            <tool.Icon className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
          ) : (
            <span className="text-xl" aria-hidden>
              {tool.icon}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-800">{tool.label}</span>
        </Link>
      ))}
    </div>
  );
}
