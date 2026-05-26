export default function Loading() {
  return (
    <div className="px-4 pt-12 pb-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-24 bg-gray-200 rounded mb-1.5" />
      {/* Month */}
      <div className="h-4 w-28 bg-gray-100 rounded mb-1.5" />
      {/* Total budget */}
      <div className="h-9 w-40 bg-gray-200 rounded mb-6" />

      {/* Budget rows */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                <div className="h-3.5 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full w-full">
                <div
                  className="h-1.5 bg-gray-200 rounded-full"
                  style={{ width: `${30 + i * 10}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
