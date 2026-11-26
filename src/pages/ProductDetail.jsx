import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ShoppingCart, AlertCircle, Check, Search, X } from 'lucide-react';
import { apiSwr, resolveImageUrl } from '../lib/adminApi';
import { useCart } from '../components/Cart/useCart';
import { formatCurrency } from '../lib/formatCurrency';
import Accordion from '../components/Accordion';

function ProductDetail() {
  const { productId } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [productVariants, setProductVariants] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [colorQuery, setColorQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const colorBoxRef = useRef(null);
  const messageTimer = useRef(null);

  useEffect(() => {
    setSelectedSize(null);
    setSelectedColorId(null);
    setColorQuery('');
    setQuantity(1);
    setMessage('');

    const loadProduct = async () => {
      try {
        const products = await apiSwr('/api/products?inherit=1');
        const current = products.find((p) => String(p.id) === String(productId));

        if (current && current.parent_product_id) {
          // Load parent product and its variants
          const parent = products.find((p) => p.id === current.parent_product_id);
          if (parent) {
            setProduct(parent);
            const variants = products.filter((p) => p.parent_product_id === current.parent_product_id);
            setProductVariants(variants);
          } else {
            setProduct(current);
            setProductVariants([current]);
          }
        } else if (current) {
          setProduct(current);
          // Get variants if this is a parent product
          const variants = products.filter((p) => p.parent_product_id === current.id);
          if (variants.length > 0) {
            setProductVariants(variants);
          } else {
            setProductVariants([current]);
          }
        } else {
          setProduct(null);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load product:', err);
        setProduct(null);
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  // Get unique sizes from variants
  const sizes = useMemo(() => {
    if (!productVariants) return [];
    return Array.from(new Set(productVariants.map((v) => v.packaging).filter(Boolean)));
  }, [productVariants]);

  // Always have a size selected when sizes exist. Before, no size meant EVERY size's colours were listed at
  // once (the same shade repeated for each pack size), which made the colour list huge and caused endless scrolling.
  useEffect(() => {
    if (!productVariants || selectedSize || sizes.length === 0) return;
    const firstInStock = sizes.find((size) => productVariants.some((v) => v.packaging === size && v.in_stock));
    setSelectedSize(firstInStock || sizes[0]);
  }, [productVariants, sizes, selectedSize]);

  // Colours of the selected size, one swatch per variant.
  const colors = useMemo(() => {
    if (!productVariants) return [];
    const filtered = selectedSize ? productVariants.filter((v) => v.packaging === selectedSize) : productVariants;
    const seen = new Set();
    const list = [];
    for (const v of filtered) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      list.push({
        id: v.id,
        code: v.color_code || v.colorCode || '',
        name: v.color_name || v.colorName || '',
        hex: v.swatch_hex || v.swatchHex || '',
        price: v.price,
        inStock: Boolean(v.in_stock)
      });
    }
    return list;
  }, [productVariants, selectedSize]);

  const needsColor = colors.filter((c) => c.name || c.code).length > 1;
  const selectedColor = colors.find((c) => c.id === selectedColorId) || null;

  const visibleColors = useMemo(() => {
    const q = colorQuery.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(q));
  }, [colors, colorQuery]);

  // Current variant based on selections
  const currentVariant = useMemo(() => {
    if (!productVariants) return null;
    if (selectedColorId) {
      const exact = productVariants.find((v) => v.id === selectedColorId && (!selectedSize || v.packaging === selectedSize));
      if (exact) return exact;
    }
    const filtered = selectedSize ? productVariants.filter((v) => v.packaging === selectedSize) : productVariants;
    return filtered[0] || null;
  }, [productVariants, selectedSize, selectedColorId]);

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 3000);
  };

  const handleAddToCart = () => {
    if (!currentVariant) {
      showMessage('Please select size and colour', 'error');
      return;
    }

    if (needsColor && !selectedColor) {
      showMessage('Please choose a colour first', 'error');
      colorBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!currentVariant.in_stock) {
      showMessage('This item is currently out of stock', 'error');
      return;
    }

    try {
      addItem({
        id: currentVariant.id,
        name: currentVariant.name || product.name,
        price: currentVariant.price,
        quantity,
        brand: currentVariant.brand || product.brand,
        packaging: currentVariant.packaging,
        colorName: currentVariant.color_name || currentVariant.colorName,
        // colorCode is passed so order emails/invoices show the shade-card number too.
        colorCode: currentVariant.color_code || currentVariant.colorCode,
        swatchHex: currentVariant.swatch_hex || currentVariant.swatchHex
      });

      showMessage('✓ Added to cart', 'success');
    } catch (err) {
      showMessage('Failed to add to cart', 'error');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <p className="text-[#8A7A6D]">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return <Navigate to="/products" replace />;
  }

  // Until a colour is picked the button just asks for one (it must not claim "Out of Stock" because of some other shade).
  const colorPending = needsColor && !selectedColor;
  const outOfStock = !colorPending && !currentVariant?.in_stock;
  const unitPrice = currentVariant?.price;
  const totalText = unitPrice == null ? 'Call for price' : formatCurrency(unitPrice * quantity);
  const buttonLabel = colorPending ? 'Choose a colour' : outOfStock ? 'Out of Stock' : 'Add to Cart';

  const quantityControl = (
    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] p-0.5">
      <button
        type="button"
        onClick={() => setQuantity(Math.max(1, quantity - 1))}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg text-[#8A7A6D] transition-colors hover:bg-white hover:text-[#4A3527] active:scale-90"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        className="w-10 bg-transparent text-center text-base text-[#4A3527]"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => setQuantity(quantity + 1)}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg text-[#8A7A6D] transition-colors hover:bg-white hover:text-[#4A3527] active:scale-90"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );

  const addButton = (extra = '') => (
    <motion.button
      type="button"
      onClick={handleAddToCart}
      disabled={outOfStock}
      whileTap={!outOfStock ? { scale: 0.97 } : {}}
      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-soft transition-colors ${
        !outOfStock ? 'bg-[#C94A2E] text-white hover:bg-[#A83D24]' : 'cursor-not-allowed bg-[#E8DDD0] text-[#8A7A6D]'
      } ${extra}`}
    >
      <ShoppingCart size={18} />
      <span>{buttonLabel}</span>
      {!outOfStock && !colorPending && <span className="font-normal opacity-90">· {totalText}</span>}
    </motion.button>
  );

  const messageBox = message && (
    <div
      className={`flex animate-pop-in items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
        messageType === 'error' ? 'border border-[#F9D9D3] bg-[#FCEBEA] text-[#D64545]' : 'border border-[#DCEFE5] bg-[#EAF6F0] text-[#4E9C79]'
      }`}
    >
      {messageType === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
      <span>{message}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 sm:px-6 sm:pt-16 lg:pb-16">
      <Helmet>
        <title>{product.name} — Fazal Paint Hardware</title>
        <meta name="description" content={product.description || product.name} />
      </Helmet>

      <motion.div
        className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:gap-12"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Product Image (kept short on mobile so colours + Add to Cart come into view quickly) */}
        <div className="overflow-hidden rounded-3xl border border-[#F3E4D4] bg-[#FFF9F4] p-3 shadow-soft sm:p-8 lg:self-start">
          {product.image_url || product.image ? (
            <div className="overflow-hidden rounded-2xl">
              <img
                src={resolveImageUrl(product.image_url || product.image)}
                alt={product.name}
                decoding="async"
                className="h-40 w-full rounded-2xl object-cover transition-transform duration-500 ease-out hover:scale-105 sm:h-96"
              />
            </div>
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-[#FBE6D4] sm:h-96">
              <p className="text-[#8A7A6D]">No image</p>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-4 sm:space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F5B942] sm:text-sm">{product.brand || 'Premium Paint'}</p>
            <h1 className="mt-1 text-xl font-semibold text-[#4A3527] sm:mt-2 sm:text-4xl">{product.name}</h1>
            {product.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#8A7A6D] sm:mt-4 sm:line-clamp-none sm:leading-7">{product.description}</p>}
          </div>

          {/* Size Selection */}
          {sizes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#4A3527]">Packaging Size</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setSelectedSize(size);
                      setSelectedColorId(null);
                      setColorQuery('');
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedSize === size ? 'bg-[#4A3527] text-white' : 'border border-[#F3E4D4] bg-white text-[#4A3527] hover:border-[#4A3527]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colour picker: ONE compact box. Selected colour + code are shown at the top of the box. */}
          {colors.length > 0 && (
            <div ref={colorBoxRef} className="scroll-mt-24 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] p-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-11 w-11 flex-shrink-0 rounded-xl border border-black/10"
                  style={{ background: selectedColor?.hex || 'repeating-linear-gradient(45deg,#F3E4D4,#F3E4D4 6px,#FFF9F4 6px,#FFF9F4 12px)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A7A6D]">Colour{needsColor ? ` · ${colors.length} shades` : ''}</p>
                  {selectedColor ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-[#4A3527]">
                      <span className="truncate">{selectedColor.name || 'Selected colour'}</span>
                      {selectedColor.code && <span className="rounded-md bg-[#4A3527] px-1.5 py-0.5 text-xs font-semibold text-white">Code {selectedColor.code}</span>}
                      {!selectedColor.inStock && <span className="rounded-md bg-[#FCEBEA] px-1.5 py-0.5 text-xs font-semibold text-[#D64545]">Out of stock</span>}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-[#C94A2E]">{needsColor ? 'Tap a colour below' : colors[0]?.name || 'Standard'}</p>
                  )}
                </div>
              </div>

              {colors.length >= 16 && (
                <div className="relative mt-3">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7A6D]" />
                  <input
                    type="text"
                    value={colorQuery}
                    onChange={(e) => setColorQuery(e.target.value)}
                    placeholder="Search colour name or code"
                    className="w-full rounded-xl border border-[#F3E4D4] bg-white py-2 pl-9 pr-9 text-base text-[#4A3527] sm:text-sm"
                    aria-label="Search colour name or code"
                  />
                  {colorQuery && (
                    <button type="button" onClick={() => setColorQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8A7A6D]" aria-label="Clear search">
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {needsColor && (
                <div className="thin-scroll mt-3 grid max-h-[290px] grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1.5 overflow-y-auto p-1">
                  {visibleColors.map((color) => {
                    const active = selectedColorId === color.id;
                    const label = `${color.name || 'Colour'}${color.code ? ` (code ${color.code})` : ''}${color.inStock ? '' : ' - out of stock'}`;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColorId(color.id)}
                        title={label}
                        aria-label={label}
                        aria-pressed={active}
                        className={`relative aspect-square rounded-lg border transition-transform ${
                          active ? 'z-10 scale-110 border-[#4A3527] ring-2 ring-[#F5B942] ring-offset-1' : 'border-black/10 hover:scale-105'
                        } ${color.inStock ? '' : 'opacity-40'}`}
                        style={{ backgroundColor: color.hex || '#E8DDD0' }}
                      >
                        {active && <Check size={15} strokeWidth={3} className="absolute inset-0 m-auto text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.85))' }} />}
                        {!color.inStock && <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><span className="h-px w-[130%] rotate-45 bg-[#4A3527]" /></span>}
                      </button>
                    );
                  })}
                  {visibleColors.length === 0 && <p className="col-span-full py-3 text-center text-sm text-[#8A7A6D]">No colour matches "{colorQuery}"</p>}
                </div>
              )}
            </div>
          )}

          {/* Desktop: quantity, price and button inline. Mobile uses the sticky bar below. */}
          <div className="hidden space-y-4 lg:block">
            <div className="flex items-end gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-[#4A3527]">Quantity</p>
                {quantityControl}
              </div>
              {currentVariant && (
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#F5B942]">Price</p>
                  <p className="text-3xl font-semibold text-[#4A3527]">{unitPrice == null ? 'Call for price' : formatCurrency(unitPrice)}</p>
                </div>
              )}
            </div>
            {messageBox}
            {addButton('w-full')}
          </div>

          {/* Price line on mobile (the sticky bar only shows the total) */}
          {currentVariant && (
            <div className="flex items-baseline justify-between rounded-2xl bg-[#FFF9F4] px-4 py-2.5 lg:hidden">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#F5B942]">Price</span>
              <span className="text-xl font-semibold text-[#4A3527]">{unitPrice == null ? 'Call for price' : formatCurrency(unitPrice)}</span>
            </div>
          )}

          {/* Product Info */}
          <div className="space-y-2 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] p-4 sm:p-6">
            {product.brand && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-[#8A7A6D]">Brand:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{product.brand}</span>
              </div>
            )}
            {product.category && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-[#8A7A6D]">Category:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{product.category}</span>
              </div>
            )}
            {(product.sub_category || product.subCategory) && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-[#8A7A6D]">Sub Category:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{product.sub_category || product.subCategory}</span>
              </div>
            )}
            {currentVariant?.packaging && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-[#8A7A6D]">Packaging:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{currentVariant.packaging}</span>
              </div>
            )}
            {(!needsColor || selectedColor) && currentVariant?.color_name && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-[#8A7A6D]">Colour:</span>
                <span className="text-sm font-semibold text-[#4A3527]">
                  {currentVariant.color_name}
                  {currentVariant.color_code ? ` (${currentVariant.color_code})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Collapsed by default: keeps the page short on mobile */}
          <Accordion>
            <Accordion.Item title="Delivery & pickup">
              We deliver across Pakistan, or you can pick up your order directly from Bannu Road, Opposite Kotli Imam Hussain. Delivery is confirmed by phone after checkout.
            </Accordion.Item>
            <Accordion.Item title="Returns & exchanges">
              <div className="space-y-2">
                <p>All sales are final — we do not accept standard returns or exchanges. However, if your item is defective or damaged, please contact us for support:</p>
                <p>📲 WhatsApp: +92 342 9085556</p>
                <p>✉️ Email: fazalpainthardware@gmail.com</p>
              </div>
            </Accordion.Item>
            <Accordion.Item title="Why shop at Fazal Paint Hardware">
              Four floors of genuine Master, Berger, and Choice Paint plus hardware, trusted by D.I. Khan families and tradespeople since 1982.
            </Accordion.Item>
          </Accordion>
        </div>
      </motion.div>

      {/* Mobile sticky bar: quantity + Add to Cart always in view */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#F3E4D4] bg-white/95 px-3 pt-2.5 shadow-lift backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        {message && <div className="mb-2">{messageBox}</div>}
        <div className="flex items-center gap-2">
          {quantityControl}
          {addButton('min-w-0 flex-1')}
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
