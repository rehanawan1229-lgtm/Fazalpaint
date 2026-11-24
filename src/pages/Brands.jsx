import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Reveal from '../components/motion/Reveal';
import { products as fallbackProducts } from '../data/products';
import { apiCached } from '../lib/adminApi';
import { normalizeProductCatalog } from '../lib/productCatalog';
import { SHOP } from '../data/shopInfo';

const BRAND_CARDS = [
  { key: 'Master Paints', title: 'Master Paints', text: 'Enamels, emulsions, distempers and finishing products from Master Paints.' },
  { key: 'Berger Paints', title: 'Berger Paints', text: 'Trusted Berger paints and recommended finishing systems for homes and shops.' },
  { key: 'Choice Paints', title: 'Choice Paints', text: 'Value-for-money Choice Paints for everyday painting jobs.' }
];

function Brands() {
  const [catalog, setCatalog] = useState(fallbackProducts);

  useEffect(() => {
    let alive = true;
    apiCached('/api/products?inherit=1', (response) => {
      if (alive) setCatalog(normalizeProductCatalog(response));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const countByBrand = (brand) => catalog.filter((product) => product.brand === brand).length;
  const hardwareCount = catalog.filter((product) => product.category === 'Hardware').length;

  const cards = [
    ...BRAND_CARDS.map((card) => ({
      ...card,
      count: countByBrand(card.key),
      to: `/products?brand=${encodeURIComponent(card.key)}`
    })),
    {
      key: 'Hardware',
      title: 'Hardware & Trolleys',
      text: 'Tools, fittings, fasteners and heavy-duty trolleys for contractors, farmers and households.',
      count: hardwareCount,
      to: '/products?category=Hardware'
    }
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Brands — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="Shop Master Paints, Berger Paints and Choice Paints, plus hardware and trolleys, at Fazal Paint Hardware and Trolley House in Dera Ismail Khan."
        />
      </Helmet>

      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Brands</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">Brands we carry</h1>
        <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">Pick a brand to see what we have online. Not listed yet? Ask us, the shop may have it in stock.</p>
      </Reveal>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <Reveal key={card.key} delay={index * 0.07} className="flex flex-col rounded-3xl border border-[#F3E4D4] bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
            <h2 className="text-xl font-semibold text-[#4A3527]">{card.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-7 text-[#8A7A6D]">{card.text}</p>
            {card.count > 0 ? (
              <Link to={card.to} className="mt-6 inline-flex w-fit rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover">
                Browse {card.count} products
              </Link>
            ) : (
              <a href={SHOP.whatsappLink} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-fit rounded-2xl border border-[#F3E4D4] px-4 py-2.5 text-sm font-semibold text-[#4A3527] transition-all hover:shadow-soft">
                Ask about availability
              </a>
            )}
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export default Brands;
