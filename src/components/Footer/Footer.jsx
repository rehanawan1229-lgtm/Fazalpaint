import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock3, MessageSquare, Edit2, Check, X, Instagram, Facebook, Youtube, Music2, Eye, EyeOff } from 'lucide-react';
import { api, apiCached } from '../../lib/adminApi';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { BRANCHES, SHOP } from '../../data/shopInfo';

// Every page of the website is reachable from the footer.
const SHOP_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/brands', label: 'Brands' },
  { to: '/branches', label: 'Branches' }
];
const HELP_LINKS = [
  { to: '/track-order', label: 'Track order' },
  { to: '/faq', label: 'FAQ' },
  { to: '/delivery', label: 'Delivery & payment' },
  { to: '/returns', label: 'Returns' },
  { to: '/contact', label: 'Contact' }
];
const COMPANY_LINKS = [
  { to: '/about', label: 'About us' },
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms & conditions' }
];
const ADMIN_LINKS = [
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/support', label: 'Support' },
  { to: '/admin/bulk-orders', label: 'Bulk orders' },
  { to: '/admin/tools', label: 'Tools' }
];

const footerLinkClass = 'block py-2 transition-colors hover:text-white';

function FooterGroup({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F5B942]">{title}</p>
      <ul className="mt-2 text-sm text-[#F3E4D4]">{children}</ul>
    </div>
  );
}

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
  const { isAdmin, editMode, user } = useAdminAuth();
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
    let alive = true;
    apiCached('/api/social-links', (data) => {
      if (alive && data) setSocialLinks(data);
    }).catch((err) => {
      console.error('Failed to load social links:', err);
    });
    return () => { alive = false; };
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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_2fr_1fr] lg:gap-12">
          {/* Shop details */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5B942]">Fazal Paint Hardware</p>
            <h2 className="mt-3 text-2xl font-semibold">Trusted since 1982</h2>
            <p className="mt-3 max-w-md text-sm text-[#F3E4D4]">
              Fazal Paint Hardware and Trolley House, Bannu Road, Dera Ismail Khan. Paints, hardware, tools and trolleys.
            </p>
            <ul className="mt-5 space-y-4 text-sm text-[#F3E4D4]">
              {BRANCHES.map((branch) => (
                <li key={branch.id} className="flex items-start gap-2">
                  <MapPin size={18} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {branch.name}: {branch.landmark}
                    <br />
                    <a href={branch.mobileHref} className="hover:text-white">{branch.mobile}</a>
                    {' · '}
                    <a href={branch.landlineHref} className="hover:text-white">{branch.landline}</a>
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <Clock3 size={18} className="mt-0.5 flex-shrink-0" />
                <span>{SHOP.hours}</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare size={18} className="mt-0.5 flex-shrink-0" />
                <a href={SHOP.whatsappLink} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp {SHOP.whatsappDisplay}</a>
              </li>
            </ul>
          </div>

          {/* All pages */}
          <div className="grid grid-cols-2 content-start gap-x-6 gap-y-8 sm:grid-cols-3">
            <FooterGroup title="Shop">
              {SHOP_LINKS.map((item) => (
                <li key={item.to}><Link to={item.to} className={footerLinkClass}>{item.label}</Link></li>
              ))}
            </FooterGroup>
            <FooterGroup title="Help">
              {HELP_LINKS.map((item) => (
                <li key={item.to}><Link to={item.to} className={footerLinkClass}>{item.label}</Link></li>
              ))}
            </FooterGroup>
            <FooterGroup title="Company">
              {COMPANY_LINKS.map((item) => (
                <li key={item.to}><Link to={item.to} className={footerLinkClass}>{item.label}</Link></li>
              ))}
            </FooterGroup>
            <FooterGroup title="My account">
              {user ? (
                <li><Link to="/account" className={footerLinkClass}>My account</Link></li>
              ) : (
                <li>
                  <button type="button" onClick={() => window.dispatchEvent(new Event('open-auth-modal'))} className={`${footerLinkClass} w-full text-left`}>
                    Login / Sign up
                  </button>
                </li>
              )}
              <li><Link to="/checkout" className={footerLinkClass}>Checkout</Link></li>
            </FooterGroup>
            {isAdmin ? (
              <FooterGroup title="Admin">
                {ADMIN_LINKS.map((item) => (
                  <li key={item.to}><Link to={item.to} className={footerLinkClass}>{item.label}</Link></li>
                ))}
              </FooterGroup>
            ) : null}
          </div>

          {/* Social */}
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
                          className={`flex items-center gap-2 py-1.5 transition-colors ${visible ? 'text-[#F3E4D4] hover:text-white' : 'text-[#A08D7D] line-through'}`}
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
        </div>
      </div>
      <div className="border-t border-[#3A2A1D] px-4 py-6 text-center text-xs text-[#DCC9B0]">
        © {new Date().getFullYear()} Fazal Paint Hardware and Trolley House. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
