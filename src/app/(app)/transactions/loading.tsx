export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="h-8 w-36 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded-xl" />
        </div>
        {/* Search bar */}
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Filter chips */}
        <div className="flex gap-2">
          <div className="h-7 w-28 bg-gray-200 rounded-full" />
          <div className="h-7 w-24 bg-gray-200 rounded-full" />
        </div>

        {/* Date group label */}
        <div className="h-3 w-12 bg-gray-200 rounded mt-2" />

        {/* Transaction rows */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
              <div className="h-4 w-14 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
