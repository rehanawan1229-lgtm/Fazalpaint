import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, MessageSquare, Clock3 } from 'lucide-react';
import Reveal from '../components/motion/Reveal';
import { BRANCHES, SHOP } from '../data/shopInfo';

function Branches() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Our Branches — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="Two Fazal Paint Hardware and Trolley House branches on Bannu Road, Dera Ismail Khan: opposite Rehman Terminal and opposite Kotli Imam Hussain."
        />
      </Helmet>

      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Branches</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">Visit us on Bannu Road</h1>
        <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">
          Two branches in Dera Ismail Khan, both with the same paints, hardware and trolleys. {SHOP.hours}.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {BRANCHES.map((branch, index) => (
          <Reveal key={branch.id} delay={index * 0.1} className="space-y-4">
            <div className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">{branch.name}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#4A3527]">{branch.landmark}</h2>
              <div className="mt-6 space-y-5 text-sm text-[#8A7A6D]">
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="mt-1 flex-shrink-0 text-accent" />
                  <p>{branch.address}</p>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={20} className="mt-1 flex-shrink-0 text-accent" />
                  <p>
                    <a href={branch.mobileHref} className="text-accent transition-colors hover:text-accent-hover">{branch.mobile}</a>
                    {' · '}
                    <a href={branch.landlineHref} className="text-accent transition-colors hover:text-accent-hover">{branch.landline}</a>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <MessageSquare size={20} className="mt-1 flex-shrink-0 text-accent" />
                  <a href={branch.whatsappHref} target="_blank" rel="noreferrer" className="text-accent transition-colors hover:text-accent-hover">Chat on WhatsApp</a>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 size={20} className="mt-1 flex-shrink-0 text-accent" />
                  <p>{SHOP.hours}</p>
                </div>
              </div>
              <a
                href={branch.mapsHref}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift"
              >
                Open in Google Maps
              </a>
            </div>
            {branch.embedSrc && (
              <div className="overflow-hidden rounded-3xl border border-[#F3E4D4] bg-[#4A3527] shadow-soft">
                <iframe title={`${branch.landmark} location`} src={branch.embedSrc} className="h-72 w-full border-0" loading="lazy" />
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export default Branches;
