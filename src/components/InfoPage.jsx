import { Helmet } from 'react-helmet-async';
import Reveal from './motion/Reveal';

// Shared layout for the text pages (Delivery, Returns, Privacy, Terms).
// Each section is { heading, paragraphs?: string[], items?: string[] }.
function InfoPage({ metaTitle, metaDescription, eyebrow, title, intro, updated, sections = [], children }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>{metaTitle} — Fazal Paint Hardware and Trolley House</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
      </Helmet>

      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">{title}</h1>
        {intro && <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">{intro}</p>}
        {updated && <p className="mt-4 text-xs text-[#8A7A6D]">Last updated: {updated}</p>}
      </Reveal>

      <div className="mt-8 space-y-6">
        {sections.map((section, index) => (
          <Reveal
            key={section.heading}
            delay={Math.min(index, 4) * 0.05}
            className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft"
          >
            <h2 className="text-xl font-semibold text-[#4A3527]">{section.heading}</h2>
            {(section.paragraphs || []).map((text) => (
              <p key={text} className="mt-3 text-sm leading-7 text-[#8A7A6D]">{text}</p>
            ))}
            {section.items && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#8A7A6D]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </Reveal>
        ))}
      </div>

      {children}
    </div>
  );
}

export default InfoPage;
