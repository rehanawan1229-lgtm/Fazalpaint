import { useEffect, useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, AlertCircle, Check } from 'lucide-react';
import { api, resolveImageUrl } from '../lib/adminApi';
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
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const products = await api('/api/products?inherit=1');
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

  // Get unique sizes from variants
  const sizes = useMemo(() => {
    if (!productVariants) return [];
    const unique = Array.from(new Set(productVariants.map((v) => v.packaging).filter(Boolean)));
    return unique;
  }, [productVariants]);

  // Get colors for selected size (or all if no size selected)
  const colors = useMemo(() => {
    if (!productVariants) return [];
    const filtered = selectedSize
      ? productVariants.filter((v) => v.packaging === selectedSize)
      : productVariants;
    
    return filtered.map((v) => ({
      code: v.color_code || v.colorCode,
      name: v.color_name || v.colorName,
      hex: v.swatch_hex || v.swatchHex,
      id: v.id,
      price: v.price,
      inStock: v.in_stock
    }));
  }, [productVariants, selectedSize]);

  // Get current variant based on selections
  const currentVariant = useMemo(() => {
    if (!productVariants) return null;
    
    let filtered = productVariants;
    
    if (selectedSize) {
      filtered = filtered.filter((v) => v.packaging === selectedSize);
    }
    
    if (selectedColor) {
      filtered = filtered.filter((v) => (v.color_code || v.colorCode) === selectedColor);
    }
    
    return filtered[0] || null;
  }, [productVariants, selectedSize, selectedColor]);

  const handleAddToCart = () => {
    if (!currentVariant) {
      setMessage('Please select size and color');
      setMessageType('error');
      return;
    }

    if (!currentVariant.in_stock) {
      setMessage('This item is currently out of stock');
      setMessageType('error');
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
        // FIX: colorCode was never being passed to the cart item, so the
        // order confirmation email (which reads item.colorCode) always
        // showed the color name but never its shade-card number.
        colorCode: currentVariant.color_code || currentVariant.colorCode
      });
      
      setMessage(`✓ Added to cart`);
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to add to cart');
      setMessageType('error');
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-16 sm:px-6">
      <Helmet>
        <title>{product.name} — Fazal Paint Hardware</title>
        <meta name="description" content={product.description || product.name} />
      </Helmet>

      <motion.div
        className="grid gap-12 lg:grid-cols-[1fr_1fr]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Product Image */}
        <div className="overflow-hidden rounded-3xl border border-[#F3E4D4] bg-[#FFF9F4] p-8 shadow-soft">
          {product.image_url || product.image ? (
            <div className="overflow-hidden rounded-2xl">
              <img
                src={resolveImageUrl(product.image_url || product.image)}
                alt={product.name}
                className="h-64 w-full object-cover rounded-2xl transition-transform duration-500 ease-out hover:scale-105 sm:h-96"
              />
            </div>
          ) : (
            <div className="h-64 w-full rounded-2xl bg-[#FBE6D4] flex items-center justify-center sm:h-96">
              <p className="text-[#8A7A6D]">No image</p>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">
              {product.brand || 'Premium Paint'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#4A3527] sm:text-4xl">{product.name}</h1>
            {product.description && (
              <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">{product.description}</p>
            )}
          </div>

          {/* Size Selection */}
          {sizes.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#4A3527]">Packaging Size</label>
              <div className="mt-3 flex flex-wrap gap-3">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      setSelectedColor(null);
                    }}
                    className={`rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${
                      selectedSize === size
                        ? 'bg-[#4A3527] text-white'
                        : 'border border-[#F3E4D4] bg-white text-[#4A3527] hover:border-[#4A3527]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {colors.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#4A3527]">Color</label>
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {colors.map((color) => (
                  <div key={color.id} className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setSelectedColor(color.code)}
                        disabled={!color.inStock}
                        className={`h-12 w-12 rounded-full border-2 transition-all ${
                          selectedColor === color.code
                            ? 'border-[#4A3527] ring-2 ring-offset-2 ring-[#F5B942]'
                            : 'border-[#F3E4D4] hover:border-[#4A3527]'
                        } ${!color.inStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        title={color.inStock ? color.name : `${color.name} — Out of stock`}
                      />
                      {!color.inStock && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base" aria-hidden="true">
                          🚫
                        </span>
                      )}
                    </div>
                    {selectedColor === color.code && (
                      <Check size={14} className="animate-pop-in text-[#F5B942]" />
                    )}
                    {/* FIX: show the color's code/number in brackets next to
                        its name, e.g. "White (29)", so customers and staff
                        can match colors to the physical shade card number. */}
                    <p className="text-xs text-center text-[#8A7A6D] max-w-[76px]">
                      {color.name}
                      {color.code ? ` (${color.code})` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Price */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#4A3527]">Quantity</label>
                <div className="mt-3 flex items-center gap-1 border border-[#F3E4D4] rounded-2xl bg-[#FFF9F4] px-1 py-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg text-[#8A7A6D] transition-colors hover:bg-white hover:text-[#4A3527] active:scale-90"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-12 text-center bg-transparent text-[#4A3527]"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg text-[#8A7A6D] transition-colors hover:bg-white hover:text-[#4A3527] active:scale-90"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
              {currentVariant && (
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#F5B942]">Price</p>
                  <p className="text-3xl font-semibold text-[#4A3527]">{formatCurrency(currentVariant.price)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div
              className={`flex animate-pop-in items-center gap-3 rounded-3xl p-4 ${
                messageType === 'error'
                  ? 'bg-[#FCEBEA] text-[#D64545] border border-[#F9D9D3]'
                  : 'bg-[#EAF6F0] text-[#4E9C79] border border-[#DCEFE5]'
              }`}
            >
              {messageType === 'error' && <AlertCircle size={18} />}
              {messageType === 'success' && <Check size={18} />}
              <span className="text-sm font-semibold">{message}</span>
            </div>
          )}

          {/* Add to Cart Button — uses the accent-strong terracotta (not
              gold) with white text, since gold+white text fails WCAG AA
              contrast at this font size/weight. */}
          <motion.button
            onClick={handleAddToCart}
            disabled={!currentVariant || !currentVariant.in_stock}
            whileHover={currentVariant?.in_stock ? { y: -2 } : {}}
            whileTap={currentVariant?.in_stock ? { scale: 0.97 } : {}}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold shadow-soft transition-colors ${
              currentVariant && currentVariant.in_stock
                ? 'bg-[#C94A2E] text-white hover:bg-[#A83D24] hover:shadow-lift'
                : 'bg-[#E8DDD0] text-[#8A7A6D] cursor-not-allowed'
            }`}
          >
            <ShoppingCart size={18} />
            {currentVariant?.in_stock ? 'Add to Cart' : 'Out of Stock'}
          </motion.button>

          {/* Product Info */}
          <div className="space-y-3 rounded-3xl border border-[#F3E4D4] bg-[#FFF9F4] p-6">
            {product.brand && (
              <div className="flex justify-between">
                <span className="text-sm text-[#8A7A6D]">Brand:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{product.brand}</span>
              </div>
            )}
            {product.category && (
              <div className="flex justify-between">
                <span className="text-sm text-[#8A7A6D]">Category:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{product.category}</span>
              </div>
            )}
            {(product.sub_category || product.subCategory) && (
              <div className="flex justify-between">
                <span className="text-sm text-[#8A7A6D]">Sub Category:</span>
                <span className="text-sm font-semibold text-[#4A3527]">
                  {product.sub_category || product.subCategory}
                </span>
              </div>
            )}
            {currentVariant?.packaging && (
              <div className="flex justify-between">
                <span className="text-sm text-[#8A7A6D]">Packaging:</span>
                <span className="text-sm font-semibold text-[#4A3527]">{currentVariant.packaging}</span>
              </div>
            )}
            {currentVariant?.color_name && (
              <div className="flex justify-between">
                <span className="text-sm text-[#8A7A6D]">Color:</span>
                <span className="text-sm font-semibold text-[#4A3527]">
                  {currentVariant.color_name}
                  {currentVariant.color_code ? ` (${currentVariant.color_code})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Compact accordion instead of long always-visible paragraphs —
              keeps the "Add to Cart" button close to the top of the
              screen on mobile. */}
          <Accordion>
            <Accordion.Item title="Delivery & pickup" defaultOpen>
              We deliver across Pakistan, or you can pick up your order directly from Bannu Road, Opposite Kotli Imam Hussain. Delivery is confirmed by phone after checkout.
            </Accordion.Item>
            <Accordion.Item title="Returns & exchanges">
  <div className="space-y-2">
    <p>
      All sales are final — we do not accept standard returns or exchanges. However, if your item is defective or damaged, please contact us for support:
    </p>
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
    </div>
  );
}

export default ProductDetail;