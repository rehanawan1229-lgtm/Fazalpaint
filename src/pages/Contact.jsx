import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, MessageSquare, Clock3 } from 'lucide-react';
import Reveal from '../components/motion/Reveal';

function Contact() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Contact — Fazal Paint Hardware and Trolley House</title>
        <meta
          name="description"
          content="Contact Fazal Paint Hardware and Trolley House in Dera Ismail Khan for Master Paint, Berger Paint, Choice Paint, tools, and trolleys."
        />
      </Helmet>
      <div className="grid gap-10 lg:grid-cols-2 items-start">
        <Reveal className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Contact</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">Reach Fazal Paint Hardware</h1>
          <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">
            Whether you need paint advice, trolley recommendations, or a quick stock check before visiting, our team is ready to help by phone or WhatsApp.
          </p>
          <div className="mt-8 space-y-6 text-sm text-[#8A7A6D]">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="mt-1 text-accent" />
              <div>
                <p className="font-semibold text-[#4A3527]">Address</p>
                <p>Bannu Road, Opposite Kotli Imam Hussain, Dera Ismail Khan, KPK, Pakistan</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={20} className="mt-1 text-accent" />
              <div>
                <p className="font-semibold text-[#4A3527]">Phone</p>
                {/* FIX: link previously turned white on hover (hover:text-white),
                    which made it invisible against the light card background. */}
                <a href="tel:+923429085556" className="text-accent transition-colors hover:text-accent-hover">+92 342 9085556</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare size={20} className="mt-1 text-accent" />
              <div>
                <p className="font-semibold text-[#4A3527]">WhatsApp</p>
                <a href="https://wa.me/923429085556" target="_blank" rel="noreferrer" className="text-accent transition-colors hover:text-accent-hover">Chat on WhatsApp</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 size={20} className="mt-1 text-accent" />
              <div>
                <p className="font-semibold text-[#4A3527]">Open Daily</p>
                <p>6:00 AM – 6:00 PM</p>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.12} className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-[#F3E4D4] bg-[#4A3527] shadow-soft">
            <iframe
              title="Fazal Paint Hardware location"
              src="https://www.google.com/maps?cid=15939130996910612794&output=embed"
              className="h-96 w-full border-0"
              loading="lazy"
            />
          </div>
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=31.8422554,70.9114546"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift"
          >
            Get directions
          </a>
        </Reveal>
      </div>
    </div>
  );
}

export default Contact;
