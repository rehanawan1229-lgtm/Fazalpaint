import { motion, useReducedMotion } from 'framer-motion';

// Generic "fade up on scroll into view" wrapper used across Home, Products,
// ProductDetail, Footer, etc. Keeps every scroll-reveal on the site using
// the exact same timing/easing so motion feels consistent, not scattered.
// Respects prefers-reduced-motion by skipping the transform entirely.
function Reveal({
  children,
  as = 'div',
  delay = 0,
  y = 28,
  duration = 0.6,
  once = true,
  amount = 0.2,
  className = '',
  ...rest
}) {
  const shouldReduceMotion = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  if (shouldReduceMotion) {
    const Tag = as;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export default Reveal;
