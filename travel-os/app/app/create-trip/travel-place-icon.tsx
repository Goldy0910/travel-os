import type { ComponentType, SVGProps } from "react";
import {
  Building2,
  Landmark,
  Mountain,
  ShoppingBag,
  Trees,
  Umbrella,
  Waves,
} from "lucide-react";

export type TravelPlaceIconKey =
  | "shopping"
  | "beach"
  | "island"
  | "culture"
  | "nature"
  | "city"
  | "heritage";

const STYLE: Record<
  TravelPlaceIconKey,
  { box: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  shopping: { box: "bg-orange-100 text-orange-700", Icon: ShoppingBag },
  beach: { box: "bg-teal-100 text-teal-700", Icon: Waves },
  island: { box: "bg-cyan-100 text-cyan-700", Icon: Umbrella },
  culture: { box: "bg-violet-100 text-violet-700", Icon: Landmark },
  nature: { box: "bg-emerald-100 text-emerald-700", Icon: Mountain },
  city: { box: "bg-slate-100 text-slate-700", Icon: Building2 },
  heritage: { box: "bg-rose-100 text-rose-800", Icon: Landmark },
};

export function TravelPlaceIcon({
  iconKey,
  className = "",
}: {
  iconKey: string;
  className?: string;
}) {
  const key = (STYLE[iconKey as TravelPlaceIconKey] ? iconKey : "city") as TravelPlaceIconKey;
  const { box, Icon } = STYLE[key] ?? STYLE.city;
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${box} ${className}`}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

export function isTravelPlaceIconKey(k: string): k is TravelPlaceIconKey {
  return k in STYLE;
}

/** Fallback for unknown keys from DB — Trees suggests broad “places / outdoors”. */
export function TravelPlaceIconLoose({ iconKey }: { iconKey: string }) {
  if (isTravelPlaceIconKey(iconKey)) {
    return <TravelPlaceIcon iconKey={iconKey} />;
  }
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
      aria-hidden
    >
      <Trees className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
