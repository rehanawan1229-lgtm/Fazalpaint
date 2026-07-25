import { Helmet } from 'react-helmet-async';
import Reveal from '../components/motion/Reveal';

function About() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>About — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="About Fazal Paint Hardware and Trolley House — a four-story paint and hardware store on Bannu Road serving Dera Ismail Khan since 1982."
        />
      </Helmet>
      <div className="space-y-10">
        <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Our story</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">A trusted local paint and hardware store since 1982</h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-[#8A7A6D]">
            Fazal Paint Hardware and Trolley House has served Dera Ismail Khan since 1982, from our location on Bannu Road, opposite Kotli Imam Hussain. What started as a neighborhood paint and hardware shop has grown into a four-story store carrying three of the country's most trusted paint brands — Master Paint, Berger Paint, and Choice Paint — alongside a full range of general hardware, tools, and trolleys. Generations of local families, farmers, and craftspeople have relied on us not just for stock, but for straight advice.
          </p>
        </Reveal>
        <section className="grid gap-8 lg:grid-cols-2">
          <Reveal className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
            <h2 className="text-2xl font-semibold text-[#4A3527]">What we carry</h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-[#8A7A6D]">
              <li>Master Paint, Berger Paint, Choice Paint, and recommended finishing systems.</li>
              <li>Distempers, primers, enamels, emulsions, varnishes, and painting accessories.</li>
              <li>Tools, fittings, fasteners, and heavy-duty trolleys for contractors and farmers.</li>
              <li>Delivery and pickup options for D.I. Khan customers.</li>
            </ul>
          </Reveal>
          <Reveal delay={0.12} className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
            <h2 className="text-2xl font-semibold text-[#4A3527]">Why choose us</h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-[#8A7A6D]">
              <li>Local expertise from a shop that has grown with D.I. Khan for over 40 years.</li>
              <li>Four floors of stock, so professional teams and homeowners find what they need in one visit.</li>
              <li>Real brands, honest service, and product advice tailored for farmers, tradespeople, and households.</li>
            </ul>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

export default About;
