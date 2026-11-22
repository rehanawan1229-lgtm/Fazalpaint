import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Home from './pages/Home';
// SPEED: every page except Home is loaded only when someone opens it.
// Before, the whole site — including the huge admin pages and the Excel
// library — was downloaded on the very first visit.
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/Account'));
const Invoice = lazy(() => import('./pages/Invoice'));
const AdminProducts = lazy(() => import('./pages/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminSupport = lazy(() => import('./pages/AdminSupport'));
const AdminBulkOrders = lazy(() => import('./pages/AdminBulkOrders'));
const AdminTools = lazy(() => import('./pages/AdminTools'));
import CartDrawer from './components/Cart/CartDrawer';
import { CartProvider } from './components/Cart/CartContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { WishlistProvider } from './contexts/WishlistContext';
import AdminEditToggle from './components/AdminEditToggle';
import PageTransition from './components/motion/PageTransition';
const ChatWidget = lazy(() => import('./components/ChatWidget/ChatWidget'));

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/products" element={<PageTransition><Products /></PageTransition>} />
        <Route path="/products/:productId" element={<PageTransition><ProductDetail /></PageTransition>} />
        <Route path="/checkout" element={<PageTransition><Checkout /></PageTransition>} />
        <Route path="/account" element={<PageTransition><Account /></PageTransition>} />
        <Route path="/account/invoice/:orderId" element={<PageTransition><Invoice /></PageTransition>} />
        <Route path="/about" element={<PageTransition><About /></PageTransition>} />
        <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
        <Route path="/admin/products" element={<PageTransition><AdminProducts /></PageTransition>} />
        <Route path="/admin/orders" element={<PageTransition><AdminOrders /></PageTransition>} />
        <Route path="/admin/support" element={<PageTransition><AdminSupport /></PageTransition>} />
        <Route path="/admin/bulk-orders" element={<PageTransition><AdminBulkOrders /></PageTransition>} />
        <Route path="/admin/tools" element={<PageTransition><AdminTools /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <html lang="en" />
      </Helmet>
      <AdminAuthProvider>
        <WishlistProvider>
        <CartProvider>
          <div className="min-h-screen bg-[var(--color-bg-light)] text-[var(--color-text-primary)]">
            <Header />
            <main>
              <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
                <AnimatedRoutes />
              </Suspense>
            </main>
            <CartDrawer />
            <Footer />
            <AdminEditToggle />
            <Suspense fallback={null}>
              <ChatWidget />
            </Suspense>
          </div>
        </CartProvider>
        </WishlistProvider>
      </AdminAuthProvider>
    </HelmetProvider>
  );
}

export default App;