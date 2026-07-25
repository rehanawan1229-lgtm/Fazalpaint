import { motion, useReducedMotion } from 'framer-motion';

// Wraps each routed page so switching between Home / Products / Checkout
// etc. fades + slides gently instead of hard-cutting. Used once per route
// in App.jsx via AnimatePresence.
function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
