import { createContext, useContext, useEffect, useReducer, useState } from 'react';

export const CartContext = createContext(null);
const STORAGE_KEY = 'fazal-paint-cart';

const initialCartState = { items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const qtyToAdd = action.payload.quantity && action.payload.quantity > 0 ? action.payload.quantity : 1;
      const existing = state.items.find((item) => item.id === action.payload.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === action.payload.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
          )
        };
      }
      return { items: [...state.items, { ...action.payload, quantity: qtyToAdd }] };
    }
    case 'UPDATE_QUANTITY':
      return {
        items: state.items
          .map((item) => (item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item))
          .filter((item) => item.quantity > 0)
      };
    case 'REMOVE_ITEM':
      return { items: state.items.filter((item) => item.id !== action.payload.id) };
    case 'CLEAR_CART':
      return initialCartState;
    default:
      return state;
  }
}

function CartProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, dispatch] = useReducer(cartReducer, initialCartState, (initial) => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // localStorage may be restricted in embedded browsers
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [state]);

  const addItem = (item) => dispatch({ type: 'ADD_ITEM', payload: item });
  const updateQuantity = (id, quantity) => dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  const removeItem = (id) => dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  const clearCart = () => dispatch({ type: 'CLEAR_CART' });
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const hasCallForPrice = state.items.some((item) => item.price == null);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        hasCallForPrice,
        isOpen,
        openCart,
        closeCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export { CartProvider, useCart };
