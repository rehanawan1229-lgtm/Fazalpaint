import { Helmet } from 'react-helmet-async';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import Reveal from '../components/motion/Reveal';
import { products as fallbackProducts } from '../data/products';
import { api } from '../lib/adminApi';
import { normalizeProductCatalog } from '../lib/productCatalog';

// Top-level categories. Every product's `category` field should be
// "Paint", "Hardware", or "Paint Additives" — this replaces the old
// brand-based pill row (All / Master Paints / Berger Paints / ...) with a
// simple type-level filter, independent of which brand the product
// belongs to. Display ORDER is admin-configurable (Category Visibility
// panel's up/down controls) and loaded from /api/category-order below;
// this is only the fallback used before that loads or if it fails.
const DEFAULT_DEPARTMENTS = ['Paint', 'Hardware', 'Paint Additives'];

// Curated Product Line options per brand — overrides the auto-derived
// list (which only shows lines that already exist in the database) for
// brands that need a fixed, hand-picked set. Berger Paints: only these 6
// lines should ever show, in this order, regardless of what's actually in
// stock right now — "General" is a deliberately-added catch-all line with
// no products in it yet.
const BRAND_PRODUCT_LINES = {
  'Berger Paints': [
    'Super 1 Plastic Emulsion',
    'Elegance Matt Emulsion',
    'VIP Super Gloss Enamel',
    'Weather Pro',
    'Wood Pro Range',
    'General'
  ],
  'Choice Paints': ['Enamel', 'Red Oxide Primer'],
  'Master Paints': [
    'Royal Matt Emulsion',
    'Master Super Emulsion',
    'Pearl Emulsion',
    'Master Synthetic Enamel',
    'Master Matt Enamel',
    'Weather Resistance',
    'General'
  ]
};

// Shown in the Product Line filter when browsing "All" paint brands
// together (Brand = All) — every brand's specific line names combined
// would be an unusably long list, so this uses the broad type the admin
// picks per product instead (the "Product Type" dropdown on the product
// form, stored as line_group / exposed here as product.lineGroup).
const ALL_BRANDS_LINE_GROUPS = ['Emulsion', 'Enamel', 'Weather Coat', 'General'];

function Products() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [lineFilter, setLineFilter] = useState('All');
  const [catalog, setCatalog] = useState(fallbackProducts);
  const [loading, setLoading] = useState(true);
  // Which departments (Paint/Hardware) the admin has left visible — a
  // hidden one's pill is dropped from the row below entirely.
  const [categoryVisibility, setCategoryVisibility] = useState({});
  // Display order for those departments — admin-configurable via the
  // up/down controls in the Category Visibility panel.
  const [categoryOrder, setCategoryOrder] = useState(DEFAULT_DEPARTMENTS);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await api('/api/products?inherit=1');
        setCatalog(normalizeProductCatalog(response));
      } catch {
        setCatalog(fallbackProducts);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    const loadCategoryVisibility = async () => {
      try {
        const response = await api('/api/category-visibility');
        setCategoryVisibility(response || {});
      } catch {
        // ignore — defaults to every category visible
      }
    };

    loadCategoryVisibility();
  }, []);

  useEffect(() => {
    const loadCategoryOrder = async () => {
      try {
        const response = await api('/api/category-order');
        setCategoryOrder(response?.order?.length ? response.order : DEFAULT_DEPARTMENTS);
      } catch {
        // ignore — falls back to the default Paint / Hardware / Paint Additives order
      }
    };

    loadCategoryOrder();
  }, []);

  const visibleDepartments = useMemo(
    () => categoryOrder.filter((department) => categoryVisibility[department] !== false),
    [categoryOrder, categoryVisibility]
  );

  // The pill row is only useful as a *choice*. If hiding a department
  // leaves just one (or zero) visible, "All" and that lone department
  // would show identical results, so the whole row disappears instead of
  // leaving a pointless single pill on screen.
  const showCategoryPills = visibleDepartments.length > 1;
  const CATEGORIES = useMemo(() => ['All', ...visibleDepartments], [visibleDepartments]);

  // If the department the customer had selected gets hidden mid-session,
  // fall back to "All" instead of leaving them stuck on an empty filter.
  useEffect(() => {
    if (categoryFilter !== 'All' && !CATEGORIES.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [CATEGORIES, categoryFilter]);

  // Which department is actually being browsed right now — either the
  // explicit pill selection, or (once the pill row itself has disappeared
  // because only one department is left) that one remaining department.
  const effectiveCategory =
    categoryFilter !== 'All' ? categoryFilter : visibleDepartments.length === 1 ? visibleDepartments[0] : 'All';

  // Brand (Master/Berger/Choice) only ever applies to Paint — Hardware
  // isn't organized by these brands, so the Brand filter is Paint-only and
  // drops out whenever Hardware is what's actually being browsed.
  const showBrandFilter = effectiveCategory !== 'Hardware';

  useEffect(() => {
    if (!showBrandFilter && brandFilter !== 'All') {
      setBrandFilter('All');
    }
  }, [showBrandFilter, brandFilter]);

  const brands = useMemo(
    () =>
      ['All', ...Array.from(new Set(catalog.map((product) => product.brand))).filter(Boolean).sort((a, b) => a.localeCompare(b))],
    [catalog]
  );
  // "All brands" together uses the broad line-group list instead of every
  // brand's specific line names combined. This only kicks in while Paint is
  // actually in view (showBrandFilter) — when Hardware-only is being
  // browsed, brandFilter also happens to sit at "All" internally, but that's
  // not the customer choosing "All paint brands", so it stays out of this.
  // Also excluded when Paint Additives is being browsed exclusively, since
  // these groups are Paint-specific.
  const usingLineGroups = showBrandFilter && brandFilter === 'All' && effectiveCategory !== 'Paint Additives';

  const lines = useMemo(() => {
    if (usingLineGroups) {
      return ['All', ...ALL_BRANDS_LINE_GROUPS];
    }
    // Paint's curated per-brand lists only apply while actually browsing
    // Paint — if a Paint Additive product happens to share a brand name
    // with a paint brand (e.g. "Berger Paints"), it shouldn't inherit
    // Paint's curated line list once Paint itself is out of view.
    const curated = effectiveCategory !== 'Paint Additives' ? BRAND_PRODUCT_LINES[brandFilter] : undefined;
    if (curated) {
      return ['All', ...curated];
    }
    // Fallback: auto-derived from whatever's actually in the catalog right
    // now — this is what Hardware (and Paint Additives) uses, so as new
    // products get added with a new Sub-Category, that value just starts
    // showing up here on its own. Scoped to the department/brand actually
    // being browsed so one department's lines never mix into another's.
    return [
      'All',
      ...Array.from(
        new Set(
          catalog
            .filter(
              (product) =>
                (effectiveCategory === 'All' || product.category === effectiveCategory) &&
                (brandFilter === 'All' || product.brand === brandFilter)
            )
            .map((product) => product.productLine)
        )
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    ];
  }, [catalog, brandFilter, usingLineGroups, effectiveCategory]);

  // If switching brands leaves the previously-picked product line off the
  // new list (e.g. Berger's curated list doesn't include it), fall back to
  // "All" instead of silently filtering on a line that's no longer shown.
  useEffect(() => {
    if (lineFilter !== 'All' && !lines.includes(lineFilter)) {
      setLineFilter('All');
    }
  }, [lines, lineFilter]);

  const filteredProducts = useMemo(() => {
    return catalog.filter((product) => {
      const matchesSearch = [product.name, product.productLine, product.colorName].some((value) =>
        value?.toLowerCase().includes(search.toLowerCase())
      );
      const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
      const matchesBrand = !showBrandFilter || brandFilter === 'All' || product.brand === brandFilter;
      const matchesLine =
        lineFilter === 'All' || (usingLineGroups ? product.lineGroup === lineFilter : product.productLine === lineFilter);
      return matchesSearch && matchesCategory && matchesBrand && matchesLine;
    });
  }, [catalog, search, categoryFilter, brandFilter, lineFilter, showBrandFilter, usingLineGroups]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Products — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="Browse Master Paint, Berger Paint, Choice Paint and hardware categories at Fazal Paint Hardware and Trolley House in Dera Ismail Khan."
        />
      </Helmet>
      <div className="space-y-10">
        <Reveal className="rounded-3xl border border-border bg-surface p-8 shadow-soft">
          <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">Product catalog</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
            Search by product line, packaging size, and color shade. The catalog is built to support Master Paints today and add Berger, Choice, and hardware categories later.
          </p>
        </Reveal>

        <div className="space-y-6">
          {/* Mobile-first: swipeable category pills (All / Paint / Hardware)
              for one-tap filtering, instead of forcing a dropdown open on a
              small screen. Hidden entirely when only one department is
              visible — "All" and that one department would be identical. */}
          {showCategoryPills ? (
            <Reveal className="-mx-4 flex snap-scroll gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`flex-shrink-0 snap-item whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    categoryFilter === category
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-accent'
                  }`}
                >
                  {category}
                </button>
              ))}
            </Reveal>
          ) : null}

          {/* Horizontal filter bar: Search, Brand, and Product line sit
              side-by-side in one row instead of a stacked vertical sidebar.
              Brand only applies to Paint (Master/Berger/Choice), so it
              drops out — and the grid collapses to 2 columns — whenever
              Hardware is what's actually being browsed. */}
          <Reveal delay={0.08} className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
            <div className={`grid gap-4 ${showBrandFilter ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <div>
                <label htmlFor="search" className="block text-sm font-semibold text-text-primary">Search</label>
                <input
                  id="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search paint, shade, or product line"
                  className="mt-3 w-full rounded-2xl border border-border bg-bg-light px-4 py-3 text-sm text-text-primary transition-colors focus:border-accent"
                />
              </div>
              {showBrandFilter ? (
                <div>
                  <label htmlFor="brand" className="block text-sm font-semibold text-text-primary">Brand</label>
                  <select
                    id="brand"
                    value={brandFilter}
                    onChange={(event) => setBrandFilter(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-border bg-bg-light px-4 py-3 text-sm text-text-primary transition-colors focus:border-accent"
                  >
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label htmlFor="productLine" className="block text-sm font-semibold text-text-primary">Product line</label>
                <select
                  id="productLine"
                  value={lineFilter}
                  onChange={(event) => setLineFilter(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-border bg-bg-light px-4 py-3 text-sm text-text-primary transition-colors focus:border-accent"
                >
                  {lines.map((line) => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                </select>
              </div>
            </div>
          </Reveal>

          <section className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.06 } }
                }}
              >
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={{
                      hidden: { opacity: 0, y: 24 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
                    }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>
            )}
            {!loading && filteredProducts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center text-sm text-text-secondary">
                No products match your filter. Try a different keyword or clear the filter selections.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Products;