import Glass from "@/components/brand/Glass";
import { RAMPS } from "@/lib/brand/palette";

// Same dark glass as the finished screen, so there is no flash of light between navigation
// and content, and block shapes that match the layout they're standing in for.
export default function Loading() {
  return (
    <>
      <Glass ramp={RAMPS.us} />
      <div className="relative z-10 animate-pulse space-y-2.5 px-3 pb-40 pt-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 rounded-full bg-white/15" />
          <div className="size-9 rounded-full bg-white/15" />
        </div>
        <div className="h-[52px] rounded-full bg-card" />
        <div className="h-[168px] rounded-hero bg-white/90" />
        <div className="h-[132px] rounded-card bg-card" />
        <div className="h-[132px] rounded-card bg-card" />
        <div className="h-[72px] rounded-card bg-card" />
      </div>
    </>
  );
}
