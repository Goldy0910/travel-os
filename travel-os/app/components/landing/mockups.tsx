function StatusBar({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold ${
        light ? "text-white/90" : "text-slate-500"
      }`}
    >
      <span>9:41</span>
      <span className="tracking-tight">●●● LTE</span>
    </div>
  );
}

export function HomeMockup() {
  return (
    <div className="min-h-[420px] bg-gradient-to-b from-sky-50 via-white to-amber-50">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Travel Till 99
        </p>
        <h3 className="mt-1 text-[1.05rem] font-bold leading-tight text-slate-900">
          Where should we go?
        </h3>
        <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] leading-relaxed text-slate-600">
            4 days · ₹25,000 each · beaches + nightlife
          </p>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="relative h-24 overflow-hidden bg-sky-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/landing-goa-sunset.png"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
            <p className="absolute bottom-2 left-3 text-sm font-bold text-white">
              Goa
            </p>
          </div>
          <p className="px-3 py-2 text-[11px] leading-snug text-slate-600">
            Beaches, nightlife, and an easy 4-day trip.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-800">
            5 going
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
            Aug 14–18
          </span>
        </div>
      </div>
    </div>
  );
}

export function TripHubMockup() {
  return (
    <div className="min-h-[400px] bg-slate-50">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
          Group trip
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-slate-900">Goa</h3>
        <p className="text-[11px] text-slate-500">Aug 14–18 · 5 travelers</p>
        <ul className="mt-3 space-y-2">
          {[
            ["Flights", "Booked", true],
            ["Stay", "Villa confirmed", true],
            ["Food", "2 spots saved", false],
            ["Activities", "3 planned", false],
          ].map(([label, detail, done]) => (
            <li
              key={label}
              className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
            >
              <div>
                <p className="text-[12px] font-semibold text-slate-900">{label}</p>
                <p className="text-[10px] text-slate-500">{detail}</p>
              </div>
              <span
                className={`text-[11px] font-bold ${
                  done ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {done ? "✓" : "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <p className="text-[10px] text-slate-500">Expenses</p>
            <p className="text-sm font-bold text-slate-900">₹18,450</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <p className="text-[10px] text-slate-500">Documents</p>
            <p className="text-sm font-bold text-slate-900">7 files</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItineraryMockup() {
  const items = [
    ["10:30", "Arrive in Goa", "✈️"],
    ["12:00", "Check-in", "🏨"],
    ["14:00", "Lunch in Calangute", "🍴"],
    ["17:00", "Baga Beach", "🏖️"],
    ["20:00", "Dinner", "🍽️"],
  ];
  return (
    <div className="min-h-[400px] bg-white">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
          Day 1 — Arrival
        </p>
        <h3 className="mt-0.5 text-base font-bold text-slate-900">Saturday</h3>
        <ol className="mt-3 space-y-0">
          {items.map(([time, title, icon], i) => (
            <li key={title} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-xs">
                  {icon}
                </span>
                {i < items.length - 1 ? (
                  <span className="my-0.5 w-px flex-1 bg-slate-200" />
                ) : null}
              </div>
              <div className="pb-3">
                <p className="text-[10px] font-semibold text-slate-400">{time}</p>
                <p className="text-[12px] font-semibold text-slate-800">{title}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ExpensesMockup() {
  return (
    <div className="min-h-[380px] bg-gradient-to-b from-emerald-50 to-white">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <h3 className="text-base font-bold text-slate-900">Trip expenses</h3>
        <ul className="mt-3 space-y-2">
          {[
            ["Hotel", "₹12,000"],
            ["Cab", "₹2,400"],
            ["Dinner", "₹3,200"],
            ["Activities", "₹4,500"],
          ].map(([label, amt]) => (
            <li
              key={label}
              className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-100/80"
            >
              <span className="text-[12px] font-medium text-slate-700">{label}</span>
              <span className="text-[12px] font-bold text-slate-900">{amt}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1.5 rounded-2xl bg-slate-900 px-3.5 py-3 text-white">
          <p className="flex justify-between text-[12px]">
            <span className="text-slate-300">You paid</span>
            <span className="font-bold">₹6,400</span>
          </p>
          <p className="flex justify-between text-[12px]">
            <span className="text-slate-300">You owe</span>
            <span className="font-bold text-amber-300">₹1,200</span>
          </p>
          <p className="flex justify-between text-[12px]">
            <span className="text-slate-300">You are owed</span>
            <span className="font-bold text-emerald-300">₹2,800</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function DocsMockup() {
  return (
    <div className="min-h-[360px] bg-slate-50">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <h3 className="text-base font-bold text-slate-900">Trip folder</h3>
        <p className="text-[11px] text-slate-500">Goa · 7 documents</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["Boarding pass", "PDF"],
            ["Hotel voucher", "PDF"],
            ["Scooter rental", "IMG"],
            ["Insurance", "PDF"],
          ].map(([name, type]) => (
            <div
              key={name}
              className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
            >
              <div className="mb-2 flex h-10 items-center justify-center rounded-lg bg-amber-50 text-lg">
                📄
              </div>
              <p className="text-[11px] font-semibold leading-tight text-slate-800">
                {name}
              </p>
              <p className="text-[10px] text-slate-400">{type}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdvisorMockup() {
  return (
    <div className="min-h-[430px] bg-gradient-to-b from-sky-100 to-white">
      <StatusBar />
      <div className="px-3 pb-4 pt-5">
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-sky-800">
          AI Travel Advisor
        </p>
        <div className="mt-3 ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3 py-2.5 text-[11px] leading-relaxed text-white">
          We have 4 days, ₹25,000 each, and want beaches + nightlife. Where
          should we go?
        </div>
        <div className="mt-2 max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100">
          <p className="font-semibold text-slate-900">I&apos;d recommend Goa.</p>
          <p className="mt-1">
            Beaches, nightlife, and plenty to do in 4 days — without long travel
            between places.
          </p>
          <p className="mt-2 text-[10px] font-medium text-teal-800">
            My pick: North Goa for nightlife.
          </p>
        </div>
        <div className="relative mt-3 h-[88px] overflow-hidden rounded-2xl bg-sky-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/landing-goa-sunset.png"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-900/70 to-transparent px-3 py-2">
            <span className="text-xs font-bold text-white">Explore Goa →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdjustMockup() {
  return (
    <div className="min-h-[360px] bg-white">
      <StatusBar />
      <div className="px-3.5 pb-4 pt-5">
        <p className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
          Arrival is 3 hours later
        </p>
        <h3 className="mt-2 text-sm font-bold text-slate-900">
          Let&apos;s rethink the day
        </h3>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            ❌ 2 PM activity → move to tomorrow
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900">
            ✓ Cafe near your hotel
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900">
            ✓ Sunset viewpoint
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900">
            ✓ Dinner nearby
          </div>
        </div>
      </div>
    </div>
  );
}
