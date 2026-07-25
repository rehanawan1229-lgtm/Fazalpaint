import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// A single collapsible row. Used for product-detail info (delivery,
// returns, etc.) so a phone screen shows a compact list of section
// titles instead of long paragraphs pushing the "Add to Cart" button
// out of the fold.
function AccordionItem({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0 text-text-secondary">
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm leading-6 text-text-secondary">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Accordion({ children, className = '' }) {
  return <div className={`rounded-3xl border border-border bg-surface px-5 ${className}`}>{children}</div>;
}

Accordion.Item = AccordionItem;

export default Accordion;
