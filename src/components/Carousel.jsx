import { useRef, useState, useEffect, Children } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// A horizontal, swipe-to-scroll carousel — native touch scrolling on
// mobile (with snap-to-card), plus optional arrow buttons on larger
// screens where there's no touch gesture. Used for product/category rows
// so a whole shelf of items fits in one compact strip instead of a tall,
// endlessly-scrolling grid.
function Carousel({ children, className = '', itemClassName = 'w-[72%] xs:w-[60%] sm:w-[42%] lg:w-[30%]', showArrows = true }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrowState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrowState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrowState, { passive: true });
    window.addEventListener('resize', updateArrowState);
    return () => {
      el.removeEventListener('scroll', updateArrowState);
      window.removeEventListener('resize', updateArrowState);
    };
  }, [children]);

  const scrollByAmount = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width || 280;
    el.scrollBy({ left: direction * (cardWidth + 16), behavior: 'smooth' });
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollRef} className="snap-scroll flex gap-4 overflow-x-auto pb-2">
        {Children.map(children, (child, index) => (
          <div key={index} className={`snap-item flex-shrink-0 ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>
      {showArrows && (canScrollLeft || canScrollRight) ? (
        <>
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            disabled={!canScrollLeft}
            className="absolute -left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-text-primary shadow-soft transition-opacity disabled:opacity-0 sm:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            disabled={!canScrollRight}
            className="absolute -right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-text-primary shadow-soft transition-opacity disabled:opacity-0 sm:flex"
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </>
      ) : null}
    </div>
  );
}

export default Carousel;
