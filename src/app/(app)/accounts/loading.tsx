export default function Loading() {
  return (
    <div className="px-4 pt-12 pb-24 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-8 w-28 bg-gray-200 rounded" />
        <div className="h-9 w-32 bg-gray-200 rounded-xl" />
      </div>

      {/* Net balance */}
      <div className="h-3.5 w-48 bg-gray-100 rounded mb-6" />

      {/* Institution group */}
      <div>
        <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-5 w-16 bg-gray-200 rounded mr-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
