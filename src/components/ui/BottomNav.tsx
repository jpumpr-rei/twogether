"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard",    label: "Home",         icon: "🏠" },
  { href: "/transactions", label: "Transactions",  icon: "💳" },
  { href: "/accounts",     label: "Accounts",      icon: "🏦" },
  { href: "/budgets",      label: "Budgets",       icon: "📊" },
  { href: "/settings",     label: "Settings",      icon: "⚙️" },
];

// Rendered inside the <Link> so it can see that link's pending state. A tap lights
// the tab up and shows a progress bar right away, even if the page behind it is
// still loading, instead of the screen appearing frozen.
function TabContent({ active, icon, label }: { active: boolean; icon: string; label: string }) {
  const { pending } = useLinkStatus();
  const highlighted = active || pending;

  return (
    <>
      <span
        aria-hidden
        className={`absolute top-0 inset-x-4 h-0.5 rounded-full bg-orange-400 transition-opacity duration-150 ${
          pending ? "opacity-100 animate-pulse" : "opacity-0"
        }`}
      />
      <span className="text-xl leading-none">{icon}</span>
      <span className={highlighted ? "text-orange-500" : "text-gray-400"}>{label}</span>
    </>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 pb-safe z-50">
      <div className="flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium cursor-pointer hover:opacity-80"
          >
            <TabContent
              active={pathname.startsWith(tab.href)}
              icon={tab.icon}
              label={tab.label}
            />
          </Link>
        ))}
      </div>
    </nav>
  );
}
