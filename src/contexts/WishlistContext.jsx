import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '../lib/accountApi';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAdminAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    fetchWishlist()
      .then((rows) => setIds(new Set((rows || []).map((row) => row.id))))
      .catch(() => setIds(new Set()));
  }, [user]);

  const isWishlisted = (productId) => ids.has(productId);

  const toggleWishlist = async (productId) => {
    if (!user) {
      return { requiresLogin: true };
    }
    if (ids.has(productId)) {
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      try {
        await removeFromWishlist(productId);
      } catch {
        // revert on failure
        setIds((prev) => new Set(prev).add(productId));
      }
    } else {
      setIds((prev) => new Set(prev).add(productId));
      try {
        await addToWishlist(productId);
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    }
    return { requiresLogin: false };
  };

  const value = useMemo(() => ({ isWishlisted, toggleWishlist, wishlistCount: ids.size }), [ids]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  return useContext(WishlistContext);
}
