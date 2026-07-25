import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Checkout from './pages/Checkout';
import Account from './pages/Account';
import Invoice from './pages/Invoice';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';
import AdminSupport from './pages/AdminSupport';
import AdminBulkOrders from './pages/AdminBulkOrders';
import AdminTools from './pages/AdminTools';
import CartDrawer from './components/Cart/CartDrawer';
import { CartProvider } from './components/Cart/CartContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { WishlistProvider } from './contexts/WishlistContext';
import AdminEditToggle from './components/AdminEditToggle';
import PageTransition from './components/motion/PageTransition';
import ChatWidget from './components/ChatWidget/ChatWidget';

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
              <AnimatedRoutes />
            </main>
            <CartDrawer />
            <Footer />
            <AdminEditToggle />
            <ChatWidget />
          </div>
        </CartProvider>
        </WishlistProvider>
      </AdminAuthProvider>
    </HelmetProvider>
  );
}

export default App;