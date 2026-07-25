import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from './useCart';
import { formatCurrency } from '../../lib/formatCurrency';

function CartDrawer() {
  const navigate = useNavigate();
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, hasCallForPrice } = useCart();

  const totalText = useMemo(() => {
    if (hasCallForPrice) return 'Final total to be confirmed by phone';
    return formatCurrency(subtotal);
  }, [hasCallForPrice, subtotal]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm"
          onClick={closeCart}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            onClick={(event) => event.stopPropagation()}
            className="thin-scroll absolute right-0 top-0 h-full w-full max-w-xl bg-bg-light shadow-soft sm:w-[420px]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Your cart</p>
                <p className="text-sm text-text-secondary">{items.length} item(s)</p>
              </div>
              <button type="button" onClick={closeCart} className="rounded-full p-2.5 text-text-primary transition hover:bg-surface-alt active:scale-90">
                <X size={20} />
              </button>
            </div>
            <div className="thin-scroll max-h-[calc(100dvh-200px)] overflow-y-auto px-6 py-6">
              {items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
                  <p className="text-sm font-semibold text-text-primary">Your cart is empty</p>
                  <p className="mt-3 text-sm text-text-secondary">Browse products to add paint, tools, and trolleys for your next project.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden rounded-3xl border border-border bg-surface p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-text-secondary">{item.brand}</p>
                            <p className="mt-2 text-sm text-text-secondary">{item.packaging} • {item.colorName || 'Standard'}</p>
                          </div>
                          <button type="button" onClick={() => removeItem(item.id)} className="rounded-full p-1.5 text-error transition hover:bg-error-light active:scale-90">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-text-secondary">
                          <div className="inline-flex items-center rounded-full border border-border bg-bg-light">
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-9 w-9 rounded-l-full text-text-primary transition-colors hover:bg-surface-alt">
                              <Minus size={16} />
                            </button>
                            <motion.span key={item.quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} className="px-4 inline-block">
                              {item.quantity}
                            </motion.span>
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-9 w-9 rounded-r-full text-text-primary transition-colors hover:bg-surface-alt">
                              <Plus size={16} />
                            </button>
                          </div>
                          <p className="font-semibold text-text-primary">{item.price == null ? 'Call for Price' : formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            <div className="border-t border-border px-6 py-5">
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Order total</span>
                <span className="font-semibold text-text-primary">{totalText}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate('/checkout');
                }}
                disabled={items.length === 0}
                className="mt-5 w-full rounded-2xl bg-accent px-4 py-4 text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#E8DDD0] disabled:active:scale-100 hover:bg-accent-hover"
              >
                Proceed to checkout
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CartDrawer;
