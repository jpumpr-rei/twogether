export default function Loading() {
  return (
    <div className="px-4 pt-12 space-y-6 animate-pulse">
      {/* Greeting */}
      <div>
        <div className="h-4 w-32 bg-gray-200 rounded mb-1.5" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
      </div>

      {/* Recent activity */}
      <div>
        <div className="h-4 w-36 bg-gray-200 rounded mb-3" />
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {[0, 1, 2, 3, 4].map((i) => (
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
