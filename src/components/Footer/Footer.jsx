import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock3, MessageSquare, Edit2, Check, X, Instagram, Facebook, Youtube, Music2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/adminApi';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

// FIX: Pinterest replaced with YouTube (matches how the shop actually
// promotes itself). Icons added per platform for a more polished footer.
const PLATFORM_META = {
  instagram: { label: 'Instagram', icon: Instagram },
  facebook: { label: 'Facebook', icon: Facebook },
  tiktok: { label: 'TikTok', icon: Music2 },
  youtube: { label: 'YouTube', icon: Youtube }
};
const PLATFORM_ORDER = ['instagram', 'facebook', 'tiktok', 'youtube'];

function Footer() {
  const { isAdmin, editMode } = useAdminAuth();
  // Public-facing list: only platforms the admin has left visible.
  const [socialLinks, setSocialLinks] = useState({});
  // Admin-only full list (includes hidden platforms) so edit mode can
  // still show + toggle them back on.
  const [adminSocialLinks, setAdminSocialLinks] = useState([]);
  const [editingSocial, setEditingSocial] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [togglingPlatform, setTogglingPlatform] = useState(null);

  useEffect(() => {
    const loadSocialLinks = async () => {
      try {
        const data = await api('/api/social-links');
        if (data) setSocialLinks(data);
      } catch (err) {
        console.error('Failed to load social links:', err);
      }
    };
    loadSocialLinks();
  }, []);

  // When an admin enters edit mode, also load the full (including hidden)
  // list so they can re-enable a platform they previously hid.
  useEffect(() => {
    if (!isAdmin || !editMode) return;
    const loadAdminSocialLinks = async () => {
      try {
        const data = await api('/api/admin/social-links');
        setAdminSocialLinks(data || []);
      } catch (err) {
        console.error('Failed to load admin social links:', err);
      }
    };
    loadAdminSocialLinks();
  }, [isAdmin, editMode]);

  const handleEditSocial = (platform, currentUrl) => {
    setEditingSocial(platform);
    setEditUrl(currentUrl || '');
  };

  const handleSaveSocial = async (platform) => {
    if (!editUrl.trim()) return;
    setLoading(true);
    try {
      await api(`/api/admin/social-links/${platform}`, { method: 'PUT', body: { url: editUrl } });
      setSocialLinks((prev) => ({ ...prev, [platform]: editUrl }));
      setAdminSocialLinks((prev) => prev.map((row) => (row.platform === platform ? { ...row, url: editUrl } : row)));
      setEditingSocial(null);
    } catch (err) {
      console.error('Failed to save social link:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSocial(null);
    setEditUrl('');
  };

  // NEW: admin can hide a social link from the public footer (e.g. no
  // TikTok yet) without losing the saved URL, and turn it back on later.
  const handleToggleVisibility = async (platform, nextVisible) => {
    setTogglingPlatform(platform);
    try {
      await api(`/api/admin/social-links/${platform}/visibility`, {
        method: 'PUT',
        body: { visible: nextVisible }
      });
      setAdminSocialLinks((prev) => prev.map((row) => (row.platform === platform ? { ...row, visible: nextVisible } : row)));
      setSocialLinks((prev) => {
        const updated = { ...prev };
        if (nextVisible) {
          const row = adminSocialLinks.find((entry) => entry.platform === platform);
          if (row) updated[platform] = row.url;
        } else {
          delete updated[platform];
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to toggle social link visibility:', err);
    } finally {
      setTogglingPlatform(null);
    }
  };

  // In edit mode, admins see every known platform (so hidden ones can be
  // re-enabled). Everyone else only sees platforms that are visible.
  const platformsToRender = isAdmin && editMode
    ? PLATFORM_ORDER.map((platform) => {
        const adminRow = adminSocialLinks.find((row) => row.platform === platform);
        return { platform, url: adminRow?.url || socialLinks[platform] || '', visible: adminRow ? adminRow.visible : Boolean(socialLinks[platform]) };
      })
    : PLATFORM_ORDER.filter((platform) => socialLinks[platform]).map((platform) => ({ platform, url: socialLinks[platform], visible: true }));

  return (
    <footer className="border-t border-border bg-primary text-bg-light">
      <motion.div
        className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:gap-8"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">Fazal Paint Hardware</p>
          <h2 className="mt-4 text-2xl font-semibold">Bannu Road, Opposite Kotli Imam Hussain</h2>
          <p className="mt-4 max-w-md text-sm text-[#F3E4D4]">Fazal Paint Hardware and Trolley House — Bannu Road, Opposite Kotli Imam Hussain, Dera Ismail Khan. Trusted since 1982.</p>
        </div>

        <div className="grid gap-2 sm:hidden">
          {/* Mobile: native <details> accordion — zero extra JS state,
              free keyboard/accessibility support, and it means the footer
              doesn't dump four always-open lists into one long scroll. */}
          <details className="group border-b border-[#5C4433] py-1">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">
              Quick links
              <span className="text-[#F3E4D4] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <ul className="space-y-3 pb-4 pt-2 text-sm text-[#F3E4D4]">
              <li><Link to="/" className="block min-h-[44px] py-1 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/products" className="block min-h-[44px] py-1 hover:text-white transition-colors">Products</Link></li>
              <li><Link to="/about" className="block min-h-[44px] py-1 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="block min-h-[44px] py-1 hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </details>
          <details className="group border-b border-[#5C4433] py-1">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">
              Contact
              <span className="text-[#F3E4D4] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <ul className="space-y-4 pb-4 pt-2 text-sm text-[#F3E4D4]">
              <li className="flex items-start gap-2"><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span>Bannu Road, Opposite Kotli Imam Hussain, D.I. Khan</span></li>
              <li className="flex items-start gap-2"><Phone size={18} className="mt-0.5 flex-shrink-0" /><span>+92 342 9085556</span></li>
              <li className="flex items-start gap-2"><MessageSquare size={18} className="mt-0.5 flex-shrink-0" /><span>WhatsApp available</span></li>
              <li className="flex items-start gap-2"><Clock3 size={18} className="mt-0.5 flex-shrink-0" /><span>Mon–Sun 6am–6pm</span></li>
            </ul>
          </details>
        </div>

        <div className="hidden gap-6 sm:grid sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">Quick links</p>
            <ul className="mt-4 space-y-3 text-sm text-[#F3E4D4]">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Products</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">Contact</p>
            <ul className="mt-4 space-y-4 text-sm text-[#F3E4D4]">
              <li className="flex items-start gap-2"><MapPin size={18} className="mt-0.5 flex-shrink-0" /><span>Bannu Road, Opposite Kotli Imam Hussain, D.I. Khan</span></li>
              <li className="flex items-start gap-2"><Phone size={18} className="mt-0.5 flex-shrink-0" /><span>+92 342 9085556</span></li>
              <li className="flex items-start gap-2"><MessageSquare size={18} className="mt-0.5 flex-shrink-0" /><span>WhatsApp available</span></li>
              <li className="flex items-start gap-2"><Clock3 size={18} className="mt-0.5 flex-shrink-0" /><span>Mon–Sun 6am–6pm</span></li>
            </ul>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">Follow us</p>
          <ul className="mt-4 space-y-3 text-sm">
            {platformsToRender.map(({ platform, url, visible }) => {
              const meta = PLATFORM_META[platform];
              const Icon = meta?.icon;
              const linkUrl = url || 'https://example.com';
              return (
                <li key={platform} className="flex items-center justify-between gap-2 group">
                  {editingSocial === platform ? (
                    <div className="flex w-full gap-2">
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="Enter URL"
                        className="flex-1 rounded border border-[#F5B942] bg-[#3A2A1D] px-2 py-1 text-xs text-white"
                      />
                      <button onClick={() => handleSaveSocial(platform)} disabled={loading} className="rounded p-1 transition-colors hover:bg-[#5C4433]">
                        <Check size={16} className="text-[#4E9C79]" />
                      </button>
                      <button onClick={handleCancelEdit} className="rounded p-1 transition-colors hover:bg-[#5C4433]">
                        <X size={16} className="text-[#D64545]" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 transition-colors ${visible ? 'text-[#F3E4D4] hover:text-white' : 'text-[#A08D7D] line-through'}`}
                      >
                        {Icon ? <Icon size={16} /> : null}
                        {meta?.label || platform}
                        {!visible && isAdmin && editMode ? <span className="text-[10px] uppercase tracking-wide text-[#D9A653]">(hidden)</span> : null}
                      </a>
                      {isAdmin && editMode && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(platform, !visible)}
                            disabled={togglingPlatform === platform}
                            title={visible ? 'Hide from public footer' : 'Show on public footer'}
                            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#5C4433] active:scale-90"
                          >
                            {visible ? <Eye size={16} className="text-[#F5B942]" /> : <EyeOff size={16} className="text-[#D9A653]" />}
                          </button>
                          <button type="button" onClick={() => handleEditSocial(platform, url)} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#5C4433] active:scale-90">
                            <Edit2 size={16} className="text-[#F5B942]" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>
      <div className="border-t border-[#3A2A1D] py-6 text-center text-xs text-[#DCC9B0]">
        © {new Date().getFullYear()} Fazal Paint Hardware and Trolley House. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
