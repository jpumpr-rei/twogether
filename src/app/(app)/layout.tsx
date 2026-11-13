import BottomNav from "@/components/ui/BottomNav";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { AskProvider } from "@/components/shell/AskProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AskProvider>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <PullToRefresh>{children}</PullToRefresh>
        <BottomNav />
      </div>
    </AskProvider>
  );
}
