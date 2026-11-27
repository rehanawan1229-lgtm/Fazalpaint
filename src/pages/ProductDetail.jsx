import { useEffect, useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronUp, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { apiSwr, resolveImageUrl } from '../lib/adminApi';
import { useCart } from '../components/Cart/useCart';
import { formatCurrency } from '../lib/formatCurrency';
import Accordion from '../components/Accordion';

// Product page: flat, black-and-white, minimal. One size row, one compact colour grid, quantity, full-width Add to Cart.
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
          const parent = products.find((p) => p.id === current.parent_product_id);
          if (parent) {
            setProduct(parent);
            setProductVariants(products.filter((p) => p.parent_product_id === current.parent_product_id));
          } else {
            setProduct(current);
            setProductVariants([current]);
          }
        } else if (current) {
          setProduct(current);
          const variants = products.filter((p) => p.parent_product_id === current.id);
          setProductVariants(variants.length > 0 ? variants : [current]);
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

  // Unique sizes from variants
  const sizes = useMemo(() => {
    if (!productVariants) return [];
    return Array.from(new Set(productVariants.map((v) => v.packaging).filter(Boolean)));
  }, [productVariants]);

  // A size is always selected (first one that has stock), so colours of different sizes never get mixed together.
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
        inStock: Boolean(v.in_stock)
      });
    }
    return list;
  }, [productVariants, selectedSize]);

  // A colour is always selected (like a shade card): keep the same shade code when the size changes, else the first in-stock one.
  useEffect(() => {
    if (colors.length === 0) return;
    if (colors.some((c) => c.id === selectedColorId)) return;
    setSelectedColorId((prev) => {
      const previous = productVariants?.find((v) => v.id === prev);
      const previousCode = previous ? previous.color_code || previous.colorCode : null;
      const sameShade = previousCode ? colors.find((c) => c.code === previousCode) : null;
      return (sameShade || colors.find((c) => c.inStock) || colors[0]).id;
    });
  }, [colors, selectedColorId, productVariants]);

  const hasColors = colors.filter((c) => c.name || c.code).length > 0;
  const showColorGrid = colors.length > 1;
  const selectedColor = colors.find((c) => c.id === selectedColorId) || null;

  const visibleColors = useMemo(() => {
    const q = colorQuery.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(q));
  }, [colors, colorQuery]);

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
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddToCart = () => {
    if (!currentVariant) {
      showMessage('Please select size and color', 'error');
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
        <p className="text-center text-[#6B6B6B]">Loading product...</p>
      </div>
    );
  }

  if (!product) {
    return <Navigate to="/products" replace />;
  }

  const outOfStock = !currentVariant?.in_stock;
  const unitPrice = currentVariant?.price;
  const imageSrc = product.image_url || product.image;
  const colorLabel = selectedColor ? `${selectedColor.name}${selectedColor.code ? ` ${selectedColor.code}` : ''}`.trim() : '';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-3 sm:px-6 sm:pt-12 lg:pb-16">
      <Helmet>
        <title>{product.name} — Fazal Paint Hardware</title>
        <meta name="description" content={product.description || product.name} />
      </Helmet>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-14">
        {/* Image: its background takes the selected colour (white parts of the photo blend into it) */}
        <div
          className="flex items-center justify-center overflow-hidden rounded-none transition-colors duration-300 sm:rounded-2xl lg:self-start"
          style={{ backgroundColor: selectedColor?.hex || '#F1F1EE' }}
        >
          {imageSrc ? (
            <img
              src={resolveImageUrl(imageSrc)}
              alt={product.name}
              decoding="async"
              className="h-56 w-full object-contain p-3 mix-blend-multiply sm:h-[26rem] sm:p-8"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center text-sm text-[#6B6B6B] sm:h-[26rem]">No image</div>
          )}
        </div>

        <div>
          {product.brand && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A8A8A]">{product.brand}</p>}
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#111] sm:text-4xl">{product.name}</h1>
          {product.description && <p className="mt-3 text-[15px] leading-7 text-[#6B6B6B]">{product.description}</p>}

          <p className="mt-5 text-[32px] font-normal leading-none text-[#222] sm:text-4xl">
            {unitPrice == null ? 'Call for price' : formatCurrency(unitPrice)}
          </p>

          {/* SIZE */}
          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="text-sm uppercase text-[#111]">
                <span className="font-bold">Size:</span> {selectedSize}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setSelectedSize(size);
                      setColorQuery('');
                    }}
                    aria-pressed={selectedSize === size}
                    className={`border-2 px-4 py-3 text-sm font-bold uppercase text-[#111] transition-colors ${
                      selectedSize === size ? 'border-[#111]' : 'border-[#D6D6D6] hover:border-[#8A8A8A]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* COLOR */}
          {hasColors && (
            <div className="mt-6">
              <p className="text-sm uppercase text-[#111]">
                <span className="font-bold">Color:</span> {colorLabel}
                {selectedColor && !selectedColor.inStock && <span className="ml-2 font-semibold normal-case text-[#C0392B]">Out of stock</span>}
              </p>

              {showColorGrid && colors.length >= 40 && (
                <input
                  type="text"
                  value={colorQuery}
                  onChange={(e) => setColorQuery(e.target.value)}
                  placeholder="Search color name or code"
                  aria-label="Search color name or code"
                  className="mt-3 w-full border-b-2 border-[#D6D6D6] bg-transparent py-2 text-base text-[#111] placeholder:text-[#9A9A9A] focus:border-[#111] focus:outline-none"
                />
              )}

              {showColorGrid && (
                <div className="mt-3 grid grid-cols-8 gap-2.5 sm:grid-cols-10">
                  {visibleColors.map((color) => {
                    const active = selectedColorId === color.id;
                    const label = `${color.name || 'Color'}${color.code ? ` ${color.code}` : ''}${color.inStock ? '' : ' (out of stock)'}`;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColorId(color.id)}
                        title={label}
                        aria-label={label}
                        aria-pressed={active}
                        className={`relative aspect-square border border-black/10 transition-transform ${
                          active ? 'ring-2 ring-[#111] ring-offset-2' : 'hover:scale-105'
                        } ${color.inStock ? '' : 'opacity-40'}`}
                        style={{ backgroundColor: color.hex || '#E8E8E8' }}
                      >
                        {!color.inStock && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                            <span className="h-px w-[135%] rotate-45 bg-[#111]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {visibleColors.length === 0 && <p className="col-span-full py-2 text-sm text-[#6B6B6B]">No color matches "{colorQuery}"</p>}
                </div>
              )}
            </div>
          )}

          {/* QUANTITY */}
          <div className="mt-7 flex items-center gap-6">
            <p className="text-sm font-bold uppercase text-[#111]">Quantity:</p>
            <div className="flex h-14 w-28 items-stretch border-2 border-[#D6D6D6]">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Quantity"
                className="w-full min-w-0 bg-transparent pl-4 text-base text-[#111] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <div className="flex w-9 flex-col items-center justify-center">
                <button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity" className="flex h-1/2 w-full items-center justify-center text-[#111] active:bg-black/5">
                  <ChevronUp size={18} />
                </button>
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity" className="flex h-1/2 w-full items-center justify-center text-[#111] active:bg-black/5">
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`mt-4 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold ${
                messageType === 'error' ? 'bg-[#FCEBEA] text-[#C0392B]' : 'bg-[#EAF6F0] text-[#2E7D5B]'
              }`}
            >
              {messageType === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{message}</span>
            </div>
          )}

          {/* ADD TO CART */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock}
            className={`mt-5 w-full py-5 text-sm font-bold uppercase tracking-wide transition-colors ${
              outOfStock ? 'cursor-not-allowed bg-[#D6D6D6] text-[#6B6B6B]' : 'bg-[#111] text-white active:bg-[#333] lg:hover:bg-[#333]'
            }`}
          >
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>

          <div className="mt-6">
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
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
