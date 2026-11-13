"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChartPie, House, Landmark, ReceiptText, type LucideIcon } from "lucide-react";
import Mark from "@/components/brand/Mark";
import { useAsk } from "@/components/shell/AskProvider";

type Tab = { href: string; label: string; Icon: LucideIcon };

// Settings is no longer a tab: it lives behind the pair of avatars on Home.
const LEFT: Tab[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/transactions", label: "Spend", Icon: ReceiptText },
];
const RIGHT: Tab[] = [
  { href: "/budgets", label: "Budgets", Icon: ChartPie },
  { href: "/accounts", label: "Accounts", Icon: Landmark },
];

// Rendered inside the <Link> so it can see that link's pending state. A tap lights the tab up and
// pulses its marker right away, even if the page behind it is still loading, instead of the
// screen appearing frozen.
function TabContent({ Icon, label, active }: { Icon: LucideIcon; label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  const tone = on ? "text-white" : "text-nav-off";

  return (
    <>
      <Icon
        size={22}
        strokeWidth={on ? 2.4 : 2}
        aria-hidden
        className={`transition-colors duration-150 ${tone}`}
      />
      <span className={`transition-colors duration-150 ${tone}`}>{label}</span>
      <span
        aria-hidden
        className={`absolute bottom-1 h-[3px] w-4 rounded-full bg-lime transition-opacity duration-150 ${
          pending ? "animate-pulse opacity-100" : active ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

function Capsule({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <div className="pointer-events-auto flex rounded-full bg-nav px-1.5">
      {tabs.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="relative flex w-[62px] cursor-pointer flex-col items-center gap-0.5 pb-3 pt-2 text-[11px] font-medium"
        >
          <TabContent Icon={Icon} label={label} active={pathname.startsWith(href)} />
        </Link>
      ))}
    </div>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { open } = useAsk();

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <Capsule tabs={LEFT} pathname={pathname} />

      {/* The mark is the centre button. It opens Ask. (It does not yet reflect sync health.) */}
      <button
        type="button"
        onClick={open}
        aria-label="Ask about your money"
        className="pointer-events-auto flex size-[58px] items-center justify-center rounded-full bg-white ring-1 ring-black/10 transition-transform duration-150 active:scale-95"
      >
        <Mark width={36} intro />
      </button>

      <Capsule tabs={RIGHT} pathname={pathname} />
    </nav>
  );
}
