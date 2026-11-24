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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
