import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Hero from '../components/Hero/Hero';
import EditableText from '../components/EditableText';
import Reveal from '../components/motion/Reveal';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { api } from '../lib/adminApi';
import { normalizeProductCatalog } from '../lib/productCatalog';

function Home() {
  const [featured, setFeatured] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    const loadFeatured = async () => {
      try {
        const response = await api('/api/products?inherit=1');
        setFeatured(normalizeProductCatalog(response).slice(0, 10));
      } catch {
        setFeatured([]);
      } finally {
        setLoadingFeatured(false);
      }
    };
    loadFeatured();
  }, []);

  return (
    <div className="space-y-20 pb-20">
      <Hero />
      <Helmet>
        <title>Fazal Paint Hardware and Trolley House — D.I. Khan</title>
        <meta
          name="description"
          content="Fazal Paint Hardware and Trolley House — Dera Ismail Khan's trusted source for Master Paint, Berger Paint, and Choice Paint since 1982. Four floors of paints, tools, and hardware on Bannu Road."
        />
      </Helmet>

      {/* Mobile-first: a swipeable shelf instead of a tall grid, so the
          homepage shows real products without a long scroll. */}
      <section className="px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Popular right now</p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">Shop the shelf</h2>
            </div>
            <Link to="/products" className="hidden items-center gap-1 text-sm font-semibold text-accent sm:flex">
              View all <ArrowRight size={15} />
            </Link>
          </Reveal>
          {loadingFeatured ? (
            <Carousel>
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </Carousel>
          ) : featured.length > 0 ? (
            <Carousel>
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </Carousel>
          ) : null}
          <Link to="/products" className="mt-5 flex items-center justify-center gap-1 text-sm font-semibold text-accent sm:hidden">
            View all products <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden bg-primary text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <motion.div
            className="max-w-3xl space-y-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } }
            }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <EditableText id="home_kicker" as="p" className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Trusted Since 1982</EditableText>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <EditableText id="home_title" as="h1" className="text-4xl font-semibold tracking-tight sm:text-5xl">Fazal Paint Hardware and Trolley House</EditableText>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <EditableText id="home_subtitle" as="p" className="text-base leading-8 text-border">
                Four floors of paints, tools, trolleys, and fittings at Bannu Road, opposite Kotli Imam Hussain. Master Paint, Berger Paint, Choice Paint, and general hardware for farmers, painters, and home projects across D.I. Khan.
              </EditableText>
            </motion.div>
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <a href="/products" className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-4 text-sm font-semibold text-white shadow-soft transition-all hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-lift sm:w-auto">
                Browse products
              </a>
              <a href="#location" className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-bg-light px-6 py-4 text-sm font-semibold text-text-primary transition-all hover:bg-surface-alt hover:-translate-y-0.5 sm:w-auto">
                Find us on the map
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[var(--color-bg-light)] px-4 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-10 py-16">
          <div className="-mx-4 flex snap-scroll gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
            {[
              {
                title: 'Trusted Since 1982',
                description: 'Four decades of honest service to the families, farmers, and tradespeople of Dera Ismail Khan.',
                label: 'History'
              },
              {
                title: 'Three Leading Paint Brands',
                description: 'From premium exterior emulsions to budget-friendly distempers, Master, Berger, and Choice Paint are all stocked and ready.',
                label: 'Brands'
              },
              {
                title: 'Four Floors of Hardware',
                description: 'A genuinely large selection — paints, tools, trolleys, and fittings, all in one four-story shop on Bannu Road.',
                label: 'Space'
              }
            ].map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 0.1}
                className="w-[82%] flex-shrink-0 snap-item rounded-3xl border border-border bg-surface p-8 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift sm:w-auto"
              >
                <span className="inline-flex rounded-full bg-[#FDE9DC] px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-accent">
                  {item.label}
                </span>
                <EditableText id={`home_feature_${item.label}_title`} as="h2" className="mt-5 text-xl font-semibold text-text-primary">{item.title}</EditableText>
                <EditableText id={`home_feature_${item.label}_desc`} as="p" className="mt-3 text-sm leading-7 text-text-secondary">{item.description}</EditableText>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="location" className="bg-bg-light px-4 sm:px-6">
        <div className="mx-auto max-w-7xl py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <Reveal className="rounded-3xl border border-border bg-surface p-8 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Location</p>
              <EditableText id="home_location_title" as="h2" className="mt-4 text-2xl font-semibold text-text-primary">Visit us on Bannu Road</EditableText>
              <EditableText id="home_location_desc" as="p" className="mt-4 text-sm leading-7 text-text-secondary">
                Opposite Kotli Imam Hussain, Dera Ismail Khan. Open Monday through Sunday, 6am to 6pm. Reach us by phone or WhatsApp for quick stock confirmations.
              </EditableText>
              <div className="mt-8 space-y-4 text-sm text-text-secondary">
                <p><strong className="text-text-primary">Phone:</strong> +92 342 9085556</p>
                <p><strong className="text-text-primary">Open Daily:</strong> 5:30 AM – 6:00 PM</p>
                <a
                  href="https://www.google.com/maps/place/RWR6%2BWH4+Fazal+paint+store,+Bannu+Road,+Dera+Ismail+Khan,+Pakistan/@31.8422554,70.9114546,16z/data=!4m6!3m5!1s0x39266faa94b2fcc3:0xdd332b314b46613a!8m2!3d31.8422554!4d70.9114546!16s%2Fg%2F11kqrg2wkh?utm_campaign=ml-ardi&g_ep=Eg1tbF8yMDI2MDYyOV8wIJvbDyoASAJQAQ%3D%3D"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:-translate-y-0.5"
                >
                  Get directions
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.12} className="overflow-hidden rounded-3xl border border-border bg-primary shadow-soft">
              <iframe
                title="Fazal Paint Hardware location"
                src="https://www.google.com/maps?cid=15939130996910612794&output=embed"
                className="h-96 w-full border-0"
                loading="lazy"
              />
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
