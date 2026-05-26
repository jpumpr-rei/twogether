"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard",    label: "Home",         icon: "🏠" },
  { href: "/transactions", label: "Transactions",  icon: "💳" },
  { href: "/accounts",     label: "Accounts",      icon: "🏦" },
  { href: "/budgets",      label: "Budgets",       icon: "📊" },
  { href: "/settings",     label: "Settings",      icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 pb-safe z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors cursor-pointer hover:opacity-80 ${
                active ? "text-orange-500" : "text-gray-400"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
