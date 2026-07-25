import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShoppingCart, Heart } from 'lucide-react';
import { useCart } from './Cart/useCart';
import { formatCurrency } from '../lib/formatCurrency';
import { resolveImageUrl } from '../lib/adminApi';
import { useWishlist } from '../contexts/WishlistContext';
import { Link } from 'react-router-dom';

function ProductCard({ product }) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const wishlisted = isWishlisted(product.id);
  const isOutOfStock = product.in_stock === 0 || product.in_stock === false;

  const onToggleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await toggleWishlist(product.id);
    if (result?.requiresLogin) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
    }
  };

  const onAdd = () => {
    if (isOutOfStock) return;

    addItem({
      id: product.id,
      name: product.name,
      brand: product.brand,
      packaging: product.packaging || product.category || 'Standard',
      colorName: product.colorName || product.category || 'Standard',
      price: product.price,
      quantity: 1
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  const imageUrl = resolveImageUrl(product.image_url || product.image);
  const productLine = product.productLine || product.category || 'Featured product';
  const description = product.description || product.colorName || 'Ready for your next project.';
  // FIX: show the shared sub-category name (e.g. "Synthetic Enamel") as the
  // card heading instead of the specific product name (which often has the
  // color baked in, e.g. "Master Synthetic # 1 (Off White)"). Falls back to
  // the product name if sub_category is blank.
  const displayTitle = product.sub_category || product.name;

  return (
    <motion.article
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition-shadow duration-300 hover:shadow-lift"
    >
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-surface-alt p-2.5 sm:p-4 relative">
          <button
            type="button"
            onClick={onToggleWishlist}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="absolute right-2 top-2 sm:right-3 sm:top-3 z-10 inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 text-primary shadow-soft transition-transform hover:scale-110 active:scale-95"
          >
            <Heart size={15} fill={wishlisted ? 'currentColor' : 'none'} className={wishlisted ? 'text-accent' : 'text-text-secondary'} />
          </button>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayTitle}
              className="h-full w-full rounded-[24px] object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-text-secondary">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-alt-2 text-accent">Img</div>
              <p>{productLine}</p>
              <p className="text-xs text-text-muted">{description}</p>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-primary/40 flex items-center justify-center rounded-[24px]">
              <span className="text-white font-semibold text-sm bg-error px-3 py-1.5 rounded-full">Out of Stock</span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-5">
        <div className="mb-2 sm:mb-4 flex items-center justify-between gap-2 sm:gap-3">
          <span className="rounded-full bg-bg-light px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.1em] sm:tracking-[0.22em] text-accent">{product.brand}</span>
          <span className="text-xs sm:text-sm text-text-secondary truncate">{product.packagingLabel || product.packaging || product.category || 'Standard'}</span>
        </div>
        <Link to={`/products/${product.id}`}>
          <h2 className="line-clamp-2 text-sm sm:text-base font-semibold text-text-primary transition-colors group-hover:text-accent">{displayTitle}</h2>
        </Link>
        <p className="mt-1.5 sm:mt-3 line-clamp-2 text-xs sm:text-sm leading-5 sm:leading-6 text-text-secondary">{description}</p>
        {product.hasVariants ? (
          // Grouped product (has size/color variants) — a single price here
          // would be misleading since it depends on which variant the
          // customer picks, so send them to the product page to choose.
          <div className="mt-3 sm:mt-5">
            <Link
              to={`/products/${product.id}`}
              className="flex w-full items-center justify-center rounded-2xl bg-accent px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.96]"
            >
              View options
            </Link>
          </div>
        ) : (
          <div className="mt-3 sm:mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-sm sm:text-lg font-semibold text-text-primary">{product.price == null ? 'Call for Price' : formatCurrency(product.price)}</span>
            <button
              type="button"
              onClick={onAdd}
              disabled={isOutOfStock}
              className={`relative overflow-hidden rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold transition-all active:scale-[0.96] w-full sm:w-auto ${
                isOutOfStock
                  ? 'bg-[#E8DDD0] text-text-secondary cursor-not-allowed active:scale-100'
                  : 'bg-accent text-white hover:bg-accent-hover'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {justAdded ? (
                  <motion.span
                    key="added"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} /> Added
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center gap-1.5"
                  >
                    {isOutOfStock ? 'Out of Stock' : (<><ShoppingCart size={15} /> Add to cart</>)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

export default ProductCard;