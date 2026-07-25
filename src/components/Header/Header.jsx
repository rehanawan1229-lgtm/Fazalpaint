import { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ShoppingCart, MessageSquare, UserCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../Cart/useCart';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import AuthModal from '../AuthModal';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' }
];

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [cartBounce, setCartBounce] = useState(false);
  const { itemCount, openCart } = useCart();
  const { isAdmin, user, logout } = useAdminAuth();
  const previousCount = useRef(itemCount);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Small bounce on the cart icon whenever an item is added (itemCount goes
  // up), giving instant visual confirmation without an intrusive toast.
  useEffect(() => {
    if (itemCount > previousCount.current) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 550);
      previousCount.current = itemCount;
      return () => clearTimeout(timer);
    }
    previousCount.current = itemCount;
  }, [itemCount]);

  const openLogin = () => {
    setAuthMode('login');
    setAuthOpen(true);
  };

  // Lets other parts of the app (e.g. the wishlist heart on a product
  // card) ask the header to open the login modal for a guest, without
  // needing to lift auth-modal state up through every component.
  useEffect(() => {
    const handler = () => openLogin();
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
  }, []);

  const openSignup = () => {
    setAuthMode('signup');
    setAuthOpen(true);
  };

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-bg-light/95 shadow-soft backdrop-blur-sm' : 'bg-transparent'} `}>
      <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 transition-all duration-300 ${isScrolled ? 'py-2.5' : 'py-4'}`}>
        <Link to="/" className="flex items-center gap-3 text-sm font-semibold text-text-primary transition-transform hover:scale-[1.02]">
          <div className={`flex items-center justify-center overflow-hidden rounded-2xl bg-bg-light border border-border transition-all duration-300 ${isScrolled ? 'h-10 w-10' : 'h-14 w-14'}`}>
            {logoLoaded ? (
              <img
                src="/logo.png"
                alt="Fazal Paint Hardware logo"
                className="h-full w-full object-contain"
                onError={() => setLogoLoaded(false)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
                F
              </div>
            )}
          </div>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="text-base normal-case">Fazal Paint Hardware</span>
            <span className="text-xs text-text-secondary">Since 1982, D.I. Khan</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-underline text-sm font-semibold ${isActive ? 'is-active text-accent' : 'text-text-primary hover:text-accent'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <NavLink
              to="/account"
              className={({ isActive }) =>
                `nav-underline text-sm font-semibold ${isActive ? 'is-active text-accent' : 'text-text-primary hover:text-accent'}`
              }
            >
              My Account
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink
              to="/admin/products"
              className={({ isActive }) =>
                `nav-underline text-sm font-semibold ${isActive ? 'is-active text-accent' : 'text-text-primary hover:text-accent'}`
              }
            >
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="hidden items-center gap-2 rounded-xl border border-border bg-bg-light px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt sm:flex"
            >
              <UserCircle2 size={18} />
              Logout
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={openLogin}
                className="hidden rounded-xl border border-border bg-bg-light px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt sm:block"
              >
                Login
              </button>
              <button
                type="button"
                onClick={openSignup}
                className="hidden rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:block"
              >
                Sign Up
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => window.open('https://wa.me/923429085556', '_blank')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-all hover:bg-primary-light hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="WhatsApp contact"
          >
            <MessageSquare size={20} />
          </button>
          <motion.button
            type="button"
            onClick={openCart}
            animate={cartBounce ? { scale: [1, 1.3, 0.9, 1.08, 1], rotate: [0, -8, 6, -2, 0] } : {}}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bg-light border border-border text-text-primary transition-colors hover:bg-surface-alt"
            aria-label="Open cart"
          >
            <ShoppingCart size={20} />
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bg-light border border-border text-text-primary md:hidden"
            aria-label="Open navigation menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border bg-bg-light md:hidden"
          >
            <div className="space-y-3 px-4 py-5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `block rounded-2xl px-4 py-3 text-base font-semibold transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-primary hover:bg-surface-alt'}`}
                >
                  {item.label}
                </NavLink>
              ))}
              {user ? (
                <NavLink
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `block rounded-2xl px-4 py-3 text-base font-semibold transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-primary hover:bg-surface-alt'}`}
                >
                  My Account
                </NavLink>
              ) : null}
              {isAdmin ? (
                <NavLink
                  to="/admin/products"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `block rounded-2xl px-4 py-3 text-base font-semibold transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-primary hover:bg-surface-alt'}`}
                >
                  Admin
                </NavLink>
              ) : null}
              <button
                type="button"
                onClick={openCart}
                className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.97]"
              >
                View Cart ({itemCount})
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary"
                >
                  Logout
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { openLogin(); setMobileOpen(false); }}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => { openSignup(); setMobileOpen(false); }}
                    className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </header>
  );
}

export default Header;
