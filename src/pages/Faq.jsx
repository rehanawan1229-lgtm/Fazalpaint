import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Accordion from '../components/Accordion';
import Reveal from '../components/motion/Reveal';
import { BRANCHES, SHOP } from '../data/shopInfo';

function Faq() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>FAQ — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="Answers to common questions about ordering, delivery, payment, returns and stock at Fazal Paint Hardware and Trolley House, Dera Ismail Khan."
        />
      </Helmet>

      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">FAQ</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">Frequently asked questions</h1>
        <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">Quick answers to what customers ask us most. Cannot find yours? Message us on WhatsApp.</p>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <Accordion>
          <Accordion.Item title="Do you deliver outside Dera Ismail Khan?" defaultOpen>
            Yes, we deliver across Pakistan. Charges and timing depend on your city and order, and our team confirms them with you after you order. You can also pick up from either of our branches. See <Link to="/delivery" className="text-accent hover:text-accent-hover">Delivery & Payment</Link>.
          </Accordion.Item>
          <Accordion.Item title="Which payment methods do you accept?">
            Cash on Delivery, Bank Transfer and Pay at Store.
          </Accordion.Item>
          <Accordion.Item title="How can I track my order?">
            Open <Link to="/track-order" className="text-accent hover:text-accent-hover">Track Order</Link> and enter your invoice number (it looks like FPH-20260723-0001) and the phone number you used when ordering. If you have an account, your orders are also listed there.
          </Accordion.Item>
          <Accordion.Item title="Can I return or exchange something?">
            All sales are final. If an item is defective or damaged, contact us on WhatsApp ({SHOP.whatsappDisplay}) with your invoice number and photos and we will help. Details on the <Link to="/returns" className="text-accent hover:text-accent-hover">Returns</Link> page.
          </Accordion.Item>
          <Accordion.Item title="Which brands do you sell?">
            We carry Master Paint, Berger Paint and Choice Paint, plus general hardware, tools and trolleys. See the <Link to="/brands" className="text-accent hover:text-accent-hover">Brands</Link> page.
          </Accordion.Item>
          <Accordion.Item title="Can I check if something is in stock before I visit?">
            Yes. Call or WhatsApp us and we will check for you. {BRANCHES.map((b) => `${b.name}: ${b.mobile}`).join(' · ')}.
          </Accordion.Item>
          <Accordion.Item title="Will the colour match what I see on screen?">
            Screens can show colours slightly differently. For a big job, we suggest checking the shade in person at our shop before ordering.
          </Accordion.Item>
          <Accordion.Item title="Do I need an account to order?">
            An account lets you see your order history and invoices, save addresses, keep a wishlist and contact support. You can create one with your email or with Google.
          </Accordion.Item>
          <Accordion.Item title="I am a contractor. Can I get a quotation for a big order?">
            Yes. Send a quotation request from your account, or message us on WhatsApp with the items and quantities.
          </Accordion.Item>
          <Accordion.Item title="Where are your branches and what are your timings?">
            We have two branches on Bannu Road, Dera Ismail Khan. {SHOP.hours}. See the <Link to="/branches" className="text-accent hover:text-accent-hover">Branches</Link> page for addresses and maps.
          </Accordion.Item>
        </Accordion>
      </Reveal>

      <div className="mt-8">
        <a href={SHOP.whatsappLink} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift">
          Still have a question? WhatsApp us
        </a>
      </div>
    </div>
  );
}

export default Faq;
