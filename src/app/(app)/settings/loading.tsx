export default function Loading() {
  return (
    <div className="px-4 pt-12 pb-4 space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-gray-200 rounded" />

      {/* Profile section */}
      <div>
        <div className="h-3 w-14 bg-gray-200 rounded mb-2" />
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              <div className="h-3.5 w-12 bg-gray-200 rounded" />
              <div className="h-3.5 w-36 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Household section */}
      <div>
        <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
        <div className="bg-white rounded-2xl shadow-sm px-4 py-4 space-y-4">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-4/5 bg-gray-100 rounded" />
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
            <div className="flex-1 h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
