// ProductGroupCatalog.jsx
//
// NEW FILE — no customer-facing catalog/storefront component was among the
// files provided, so this is a self-contained demonstration of requirement
// #4 ("Product Catalog: Visual Indicator"). Drop it into your storefront
// (e.g. src/pages/ProductGroupCatalog.jsx) and route to it, or lift the
// <ProductCard> pattern into your existing catalog component — the part
// that matters is the `isOutOfStock` check and the 🚫 overlay markup below.
//
// Data source: GET /api/catalog-groups (public, added in send-order-server.js)
// Each group looks like:
//   { id, name, description, image_url, brand, products: [ {..., in_stock, is_out_of_stock}, ... ] }

import { useEffect, useState } from 'react';
import { resolveImageUrl, getApiBaseUrl } from '../lib/adminApi';

function ProductCard({ product }) {
  // Either flag works — is_out_of_stock is computed server-side from
  // in_stock, so the two are always consistent with each other.
  const isOutOfStock = product.is_out_of_stock === 1 || product.is_out_of_stock === true || !product.in_stock;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F3E4D4] bg-white shadow-soft">
      <div className="relative h-40 w-full bg-[#FFF9F4]">
        {product.image_url ? (
          <img
            src={resolveImageUrl(product.image_url)}
            alt={product.name}
            className={`h-full w-full object-cover ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#8A7A6D]">No image</div>
        )}

        {/* 🚫 overlay — appears automatically whenever the product is out of stock */}
        {isOutOfStock ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35">
            <span className="text-4xl leading-none" aria-hidden="true">🚫</span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#4A3527]">
              Out of Stock
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <p className="truncate text-sm font-semibold text-[#4A3527]">{product.name}</p>
        <p className="text-xs text-[#8A7A6D]">{product.brand}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#4A3527]">
            {Number(product.price).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
          </span>
          <button
            type="button"
            disabled={isOutOfStock}
            className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
              isOutOfStock
                ? 'cursor-not-allowed bg-[#FFF1E6] text-[#8A7A6D]'
                : 'bg-[var(--color-accent)] text-white hover:bg-[#A83D24]'
            }`}
          >
            {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupSection({ group }) {
  return (
    <section className="mb-12">
      <div className="flex flex-col gap-4 rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft sm:flex-row sm:items-center">
        {group.image_url ? (
          <img
            src={resolveImageUrl(group.image_url)}
            alt={group.name}
            className="h-20 w-28 shrink-0 rounded-2xl object-cover"
          />
        ) : null}
        <div>
          <span className="rounded-full bg-[#FFF9F4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            {group.brand || 'General'}
          </span>
          <h2 className="mt-2 text-2xl font-semibold text-[#4A3527]">{group.name}</h2>
          {group.description ? <p className="mt-1 text-sm text-[#8A7A6D]">{group.description}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(group.products || []).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function ProductGroupCatalog() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/catalog-groups`);
        if (!response.ok) throw new Error('Unable to load groups');
        const data = await response.json();
        if (!cancelled) setGroups(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load groups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="px-6 py-16 text-center text-sm text-[#8A7A6D]">Loading catalog…</div>;
  }

  if (error) {
    return <div className="px-6 py-16 text-center text-sm text-[var(--color-error)]">{error}</div>;
  }

  if (groups.length === 0) {
    return <div className="px-6 py-16 text-center text-sm text-[#8A7A6D]">No product groups have been published yet.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {groups.map((group) => (
        <GroupSection key={group.id} group={group} />
      ))}
    </div>
  );
}

export default ProductGroupCatalog;
