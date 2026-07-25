// Shared between Products.jsx and Home.jsx so both pages compute the same
// "does this product have size/color variants" (hasVariants) and "what
// packaging sizes does it come in" (packagingLabel) the same way — this is
// what previously only Products.jsx did, which is why the Home page kept
// showing "Add to cart" + a single packaging size instead of "View options"
// + every size the product actually comes in (e.g. "Gallon • Quarter").
export function normalizeProductCatalog(rawProducts) {
  const normalized = (rawProducts || []).map((product) => ({
    ...product,
    productLine: product.sub_category || product.category || 'Featured product',
    packaging: product.packaging || product.category || 'Standard',
    colorName: product.color_name || product.description || '',
    image: product.image_url || null,
    // Broad type (Emulsion/Enamel/Weather Coat/General) the admin picks
    // per product — separate from productLine above. Powers the Product
    // Line filter when the customer is browsing "All" brands together.
    lineGroup: product.line_group || ''
  }));

  // Only top-level products (no parent_product_id) get their own card;
  // variants are reachable via the size/color picker on the product page.
  const topLevelOnly = normalized.filter((product) => !product.parent_product_id);

  // Index every variant by the parent it belongs to, so we can look up "all
  // the sibling packagings" for a given top-level product in one pass.
  const childrenByParent = new Map();
  normalized.forEach((product) => {
    if (!product.parent_product_id) return;
    const list = childrenByParent.get(product.parent_product_id) || [];
    list.push(product);
    childrenByParent.set(product.parent_product_id, list);
  });

  return topLevelOnly.map((product) => {
    const children = childrenByParent.get(product.id) || [];
    const hasVariants = children.length > 0;

    // Collect every distinct packaging size across the parent + its
    // variants (Quarter, Gallon, Drum, Dabbi, whatever admin entered) and
    // join them for display, e.g. "Gallon • Quarter".
    let packagingLabel = product.packaging;
    if (hasVariants) {
      const sizes = [];
      const seen = new Set();
      const addSize = (value) => {
        const trimmed = String(value || '').trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          sizes.push(trimmed);
        }
      };
      addSize(product.packaging);
      children.forEach((child) => addSize(child.packaging));
      packagingLabel = sizes.length > 0 ? sizes.join(' • ') : product.packaging;
    }

    return { ...product, hasVariants, packagingLabel };
  });
}
