// Shimmer placeholder shown in the catalog grid while /api/products loads,
// so the page never flashes a blank white screen — it shows the shape of
// the content that's about to arrive.
function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft" aria-hidden="true">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-4 w-14 rounded-full" />
        </div>
        <div className="skeleton h-4 w-4/5 rounded-full" />
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="skeleton h-3 w-2/3 rounded-full" />
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-10 w-28 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default ProductCardSkeleton;
