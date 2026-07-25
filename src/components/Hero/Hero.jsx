import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { api, uploadImage } from '../../lib/adminApi';

const defaultHeroTexts = [
  { label: 'Trusted Since 1982' },
  { label: 'Master Paint. Berger Paint. Choice Paint. All Under One Roof.' },
  { label: 'Four Floors of Hardware, One Address in D.I. Khan' },
  { label: 'Everything Your Project Needs — Shop Now' }
];

function Hero() {
  const { isAdmin, editMode } = useAdminAuth();
  const [heroContent, setHeroContent] = useState({});
  const [heroTexts, setHeroTexts] = useState(defaultHeroTexts);
  const [editingTextIndex, setEditingTextIndex] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [heroPosition, setHeroPosition] = useState('center center');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadContent = async () => {
      try {
        const content = await api('/api/content');
        setHeroContent(content || {});
        const savedTexts = defaultHeroTexts.map((item, index) => ({
          ...item,
          label: content?.[`hero_text_${index}`] || item.label
        }));
        setHeroTexts(savedTexts);
        if (content?.hero_image_position) {
          setHeroPosition(content.hero_image_position);
        }
        if (content?.hero_image_url) {
          setHeroContent((current) => ({ ...current, hero_image_url: content.hero_image_url }));
        }
      } catch {
        setHeroTexts(defaultHeroTexts);
      }
    };

    loadContent();
  }, []);

  const handleHeroTextSave = async (index, value) => {
    if (!isAdmin) return;
    const normalized = value.trim() || defaultHeroTexts[index].label;
    try {
      await api('/api/admin/content', { method: 'PUT', body: { key: `hero_text_${index}`, value: normalized } });
      setHeroTexts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: normalized } : item));
      setEditingTextIndex(null);
      setDraftText('');
    } catch {
      setMessage('Unable to save hero text');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadImage(file);
      await api('/api/admin/content', { method: 'PUT', body: { key: 'hero_image_url', value: result.url } });
      setHeroContent((current) => ({ ...current, hero_image_url: result.url }));
      setMessage('Hero photo updated');
    } catch {
      setMessage('Unable to upload hero image');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handlePositionDrag = (event, boundsElement) => {
    if (!boundsElement || !isAdmin || !editMode) return;
    const rect = boundsElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const nextPosition = `${Math.max(0, Math.min(100, x)).toFixed(0)}% ${Math.max(0, Math.min(100, y)).toFixed(0)}%`;
    setHeroPosition(nextPosition);
  };

  const saveHeroPosition = async () => {
    if (!isAdmin || !editMode) return;
    try {
      await api('/api/admin/content', { method: 'PUT', body: { key: 'hero_image_position', value: heroPosition } });
      setMessage('Hero image position saved');
    } catch {
      setMessage('Unable to save hero position');
    }
  };

  // Two prepared banner images live in /public: hero-banner.jpg (desktop/wide)
  // and hero-banner-for-mobile.jpg (pre-cropped for narrow screens). If the
  // admin has uploaded a custom photo via "Replace Photo", that one photo is
  // used everywhere (there's only one upload slot) — otherwise mobile and
  // desktop each get their own purpose-made image.
  const desktopImageUrl = heroContent.hero_image_url || '/hero-banner.jpg';
  const mobileImageUrl = heroContent.hero_image_url || '/hero-banner-mobile.jpg';

  return (
    <section className="relative bg-[#4A3527] text-white">
      {/* FIX: removed the old scroll-jacking wrapper (min-h-[300vh] track +
          sticky min-h-screen inner container). That setup added extra page
          height beyond one screen, so combined with the nav bar above it,
          the poster never fully fit inside a single 100% browser view —
          only shrinking everything via browser zoom-out made it visible.
          This is now a plain, static, full-width banner sized to the
          viewport height below the nav bar, so it always fits at 100% zoom
          with no scrolling or zooming required. */}
      {/* MOBILE FIX: the banner graphic is a wide poster (title text baked
          across its full width). At sm and up, sizing the box to the
          viewport height and using object-cover looks great because the
          box is roughly as wide as it is tall. On a narrow phone, that same
          viewport-height box is tall and skinny, so object-cover zoomed in
          and sliced the left/right edges off — cutting the title text.
          Below sm we now size the box by the poster's own aspect ratio and
          use object-contain, so the *entire* poster is always visible
          (letterboxed with the same dark background, never cropped). sm+
          keeps the original full-bleed viewport-height object-cover look. */}
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full overflow-hidden aspect-[3/2] sm:aspect-auto sm:h-[calc(100vh-88px)] sm:min-h-[420px]"
      >
        {isAdmin && editMode ? (
          <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-full border border-dashed border-[#F5B942] bg-[#4A3527]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFF9F4] backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            Admin image tools
          </div>
        ) : null}
        <picture>
          {/* Below the sm breakpoint (640px), load the dedicated mobile crop
              instead of the wide desktop banner. */}
          <source media="(max-width: 639px)" srcSet={mobileImageUrl} />
          <img
            src={desktopImageUrl}
            alt="Fazal Paint Hardware — Shop showcase"
            className={`h-full w-full bg-[#4A3527] object-contain sm:object-cover ${isAdmin && editMode ? 'cursor-grab' : ''}`}
            style={{ objectPosition: heroPosition }}
            onMouseDown={(event) => {
              if (!isAdmin || !editMode) return;
              setIsDragging(true);
              handlePositionDrag(event, event.currentTarget);
            }}
            onMouseMove={(event) => {
              if (!isAdmin || !editMode || !isDragging) return;
              handlePositionDrag(event, event.currentTarget);
            }}
            onMouseUp={() => {
              if (!isAdmin || !editMode) return;
              setIsDragging(false);
              saveHeroPosition();
            }}
            onMouseLeave={() => {
              if (!isAdmin || !editMode) return;
              if (isDragging) {
                setIsDragging(false);
                saveHeroPosition();
              }
            }}
          />
        </picture>
        {isAdmin && editMode ? (
          <div className="absolute right-4 top-4 z-20 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-full border border-dashed border-[#F5B942] bg-[#4A3527]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFF9F4] backdrop-blur">
              Replace Photo
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#4A3527]/90 via-transparent to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-8 hidden justify-center px-4 sm:flex">
          <div className="grid w-full max-w-3xl gap-3 text-center">
            {heroTexts.map((item, index) => (
              <motion.div
                key={`${item.label}-${index}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.25 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                {isAdmin && editMode ? (
                  <button
                    type="button"
                    className="pointer-events-auto mx-auto inline-flex rounded-full border border-dashed border-[#F5B942] bg-black/70 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#FFF9F4] shadow-soft sm:text-sm"
                    onClick={() => {
                      setEditingTextIndex(index);
                      setDraftText(item.label);
                    }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <div className="mx-auto inline-flex rounded-full bg-black/60 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#FFF9F4] shadow-soft sm:text-sm">
                    {item.label}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {editingTextIndex !== null ? (
        <div className="mx-auto mt-4 max-w-xl px-4">
          <input
            autoFocus
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleHeroTextSave(editingTextIndex, draftText);
              }
            }}
            onBlur={() => handleHeroTextSave(editingTextIndex, draftText)}
            className="w-full rounded-2xl border border-[#F5B942] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
          />
        </div>
      ) : null}
      {message ? <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-[#F5B942] px-4">{message}</p> : null}
      {uploadingImage ? <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-[#F5B942] px-4">Uploading image…</p> : null}
    </section>
  );
}

export default Hero;