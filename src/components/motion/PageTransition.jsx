import { motion, useReducedMotion } from 'framer-motion';

// Wraps each routed page so switching between Home / Products / Checkout
// etc. fades in gently instead of hard-cutting.
//
// SPEED: the old version also animated the page OUT (exit) while App.jsx used
// AnimatePresence mode="wait" — so every click waited for the old page to
// finish fading before the new one could even start. Now the old page leaves
// instantly and the new one fades in quickly.
function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
