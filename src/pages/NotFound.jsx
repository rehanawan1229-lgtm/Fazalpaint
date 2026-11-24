import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Reveal from '../components/motion/Reveal';
import { SHOP } from '../data/shopInfo';

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Helmet>
        <title>Page not found — Fazal Paint Hardware and Trolley House</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-10 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Error 404</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">This page could not be found</h1>
        <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">
          The link may be old or mistyped. You can go back to the home page, browse our products, or ask us on WhatsApp and we will help you find what you need.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift">
            Back to home
          </Link>
          <Link to="/products" className="rounded-2xl border border-[#F3E4D4] px-5 py-3 text-sm font-semibold text-[#4A3527] transition-all hover:-translate-y-0.5 hover:shadow-soft">
            Browse products
          </Link>
          <a href={SHOP.whatsappLink} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#F3E4D4] px-5 py-3 text-sm font-semibold text-[#4A3527] transition-all hover:-translate-y-0.5 hover:shadow-soft">
            WhatsApp us
          </a>
        </div>
      </Reveal>
    </div>
  );
}

export default NotFound;
