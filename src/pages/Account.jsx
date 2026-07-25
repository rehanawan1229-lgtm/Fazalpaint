import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Package, MapPin, Heart, LifeBuoy, FileText, User, Plus, Trash2, Star, RotateCcw, Loader2
} from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useCart } from '../components/Cart/useCart';
import { formatCurrency } from '../lib/formatCurrency';
import { resolveImageUrl } from '../lib/adminApi';
import {
  fetchMyOrders,
  fetchAddresses, createAddress, updateAddress, deleteAddress,
  fetchWishlist, removeFromWishlist,
  fetchProfile, updateProfile,
  createSupportTicket, fetchMySupportTickets,
  createQuotationRequest, fetchMyQuotationRequests
} from '../lib/accountApi';

const TABS = [
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'quotation', label: 'Bulk Orders', icon: FileText },
  { id: 'profile', label: 'Profile', icon: User }
];

const paymentMethods = ['Cash on Delivery', 'Bank Transfer', 'Pay at Store'];

function StatusBadge({ status }) {
  const normalized = String(status || 'Pending').toLowerCase();
  const styles = {
    pending: 'bg-[#FFF1E6] text-[#8A7A6D]',
    confirmed: 'bg-success-light text-success',
    open: 'bg-[#FFF1E6] text-[#8A7A6D]',
    shipped: 'bg-[#EAF2FB] text-[#3B6FA8]',
    delivered: 'bg-success-light text-success',
    cancelled: 'bg-error-light text-error',
    closed: 'bg-success-light text-success',
    resolved: 'bg-success-light text-success'
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[normalized] || 'bg-surface-alt text-text-secondary'}`}>
      {status || 'Pending'}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---- Orders tab ----
function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const { addItem, openCart } = useCart();
  const [reorderingId, setReorderingId] = useState(null);

  useEffect(() => {
    fetchMyOrders().then(setOrders).catch((err) => setError(err.message || 'Unable to load orders'));
  }, []);

  const handleReorder = (order) => {
    setReorderingId(order.id);
    (order.items || []).forEach((item) => addItem({ ...item, quantity: item.quantity || 1 }));
    openCart();
    setReorderingId(null);
  };

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!orders) return <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your orders…</p>;
  if (orders.length === 0) {
    return <p className="text-sm text-text-secondary">Abhi tak koi order nahi hai. Jab aap login karke order place karenge, wo yahan dikhega.</p>;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Invoice #{order.invoice_number}</p>
              <p className="text-xs text-text-secondary">{formatDate(order.created_at)}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-3 space-y-1">
            {(order.items || []).map((item, index) => (
              <p key={index} className="text-sm text-text-secondary">
                {item.name} × {item.quantity}
              </p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-semibold text-text-primary">{formatCurrency(order.total)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReorder(order)}
                disabled={reorderingId === order.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-light px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-alt"
              >
                <RotateCcw size={14} /> Reorder
              </button>
              <Link
                to={`/account/invoice/${order.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                <FileText size={14} /> View Invoice
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Addresses tab ----
function AddressesTab() {
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', fullName: '', phone: '', address: '', city: '', state: '', postalCode: '', isDefault: false });

  const load = () => fetchAddresses().then(setAddresses).catch((err) => setError(err.message || 'Unable to load addresses'));

  useEffect(() => { load(); }, []);

  const handleChange = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.address.trim()) return;
    setSaving(true);
    try {
      await createAddress(form);
      setForm({ label: '', fullName: '', phone: '', address: '', city: '', state: '', postalCode: '', isDefault: false });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    await updateAddress(id, { isDefault: true });
    load();
  };

  const handleDelete = async (id) => {
    await deleteAddress(id);
    load();
  };

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!addresses) return <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your addresses…</p>;

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <p className="text-sm text-text-secondary">Abhi tak koi saved address nahi hai.</p>
      ) : (
        addresses.map((addr) => (
          <div key={addr.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary">{addr.label || 'Address'}</p>
                {addr.is_default ? <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">Default</span> : null}
              </div>
              <p className="mt-1 text-sm text-text-secondary">{addr.full_name} {addr.phone ? `· ${addr.phone}` : ''}</p>
              <p className="text-sm text-text-secondary">{addr.address}, {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-2">
              {!addr.is_default ? (
                <button type="button" onClick={() => handleSetDefault(addr.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-alt">
                  <Star size={12} /> Set default
                </button>
              ) : null}
              <button type="button" onClick={() => handleDelete(addr.id)} className="inline-flex items-center gap-1 rounded-lg border border-error/30 bg-error-light px-2 py-1.5 text-xs font-semibold text-error hover:bg-[#F8D7D5]">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.label} onChange={handleChange('label')} placeholder="Label (e.g. Home, Shop)" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
            <input value={form.fullName} onChange={handleChange('fullName')} placeholder="Full name" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
            <input value={form.phone} onChange={handleChange('phone')} placeholder="Phone" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
            <input value={form.postalCode} onChange={handleChange('postalCode')} placeholder="Postal code" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
          </div>
          <textarea value={form.address} onChange={handleChange('address')} placeholder="Street address" required rows={2} className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.city} onChange={handleChange('city')} placeholder="City" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
            <input value={form.state} onChange={handleChange('state')} placeholder="Province" className="rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} className="h-4 w-4 rounded border-border" />
            Set as default address
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              {saving ? 'Saving…' : 'Save address'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt">
          <Plus size={16} /> Add new address
        </button>
      )}
    </div>
  );
}

// ---- Wishlist tab ----
function WishlistTab() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const { addItem, openCart } = useCart();

  const load = () => fetchWishlist().then(setProducts).catch((err) => setError(err.message || 'Unable to load wishlist'));
  useEffect(() => { load(); }, []);

  const handleRemove = async (productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    await removeFromWishlist(productId);
  };

  const handleAddToCart = (product) => {
    addItem({ id: product.id, name: product.name, brand: product.brand, packaging: product.packaging || product.category || 'Standard', price: product.price, quantity: 1 });
    openCart();
  };

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!products) return <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your wishlist…</p>;
  if (products.length === 0) return <p className="text-sm text-text-secondary">Wishlist khali hai — product cards par dil ke icon se items save karein.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {products.map((product) => (
        <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          {product.image_url ? (
            <img src={resolveImageUrl(product.image_url)} alt={product.name} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-surface-alt" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{product.name}</p>
            <p className="text-sm text-text-secondary">{product.price == null ? 'Call for Price' : formatCurrency(product.price)}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => handleAddToCart(product)} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover">Add to cart</button>
              <button type="button" onClick={() => handleRemove(product.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-alt">Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Support tab ----
function SupportTab() {
  const [tickets, setTickets] = useState(null);
  const [form, setForm] = useState({ type: 'complaint', subject: '', message: '', orderInvoiceNumber: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const load = () => fetchMySupportTickets().then(setTickets).catch((err) => setError(err.message || 'Unable to load tickets'));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSending(true);
    setError('');
    setSuccessMessage('');
    try {
      await createSupportTicket(form);
      setForm({ type: form.type, subject: '', message: '', orderInvoiceNumber: '' });
      setSuccessMessage(form.type === 'suggestion' ? 'Suggestion bhej diya gaya, shukriya!' : 'Complaint darj kar li gayi hai, jald reply milega.');
      await load();
    } catch (err) {
      setError(err.message || 'Unable to submit ticket');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-text-primary">Naya complaint / suggestion</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'complaint' }))}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              form.type === 'complaint' ? 'border-accent bg-accent text-white' : 'border-border bg-bg-light text-text-primary'
            }`}
          >
            Complaint
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'suggestion' }))}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              form.type === 'suggestion' ? 'border-accent bg-accent text-white' : 'border-border bg-bg-light text-text-primary'
            }`}
          >
            Suggestion
          </button>
        </div>
        <input
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="Subject"
          required
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
        <input
          value={form.orderInvoiceNumber}
          onChange={(e) => setForm((prev) => ({ ...prev, orderInvoiceNumber: e.target.value }))}
          placeholder="Related invoice # (optional)"
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
        <textarea
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          placeholder={form.type === 'suggestion' ? 'Apna suggestion likhein…' : 'Apna masla tafseel se likhein…'}
          required
          rows={3}
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
        {successMessage ? <p className="text-sm text-success">{successMessage}</p> : null}
        <button type="submit" disabled={sending} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
          {sending ? 'Sending…' : 'Submit'}
        </button>
      </form>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {!tickets ? (
        <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-text-secondary">Abhi tak koi ticket submit nahi kiya.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="mb-1 inline-block rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                    {ticket.type === 'suggestion' ? 'Suggestion' : 'Complaint'}
                  </span>
                  <p className="text-sm font-semibold text-text-primary">{ticket.subject}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="mt-1 text-sm text-text-secondary">{ticket.message}</p>
              {ticket.admin_reply ? (
                <p className="mt-2 rounded-xl bg-bg-light px-3 py-2 text-sm text-text-primary"><strong>Reply:</strong> {ticket.admin_reply}</p>
              ) : null}
              <p className="mt-2 text-xs text-text-muted">{formatDate(ticket.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Quotation tab ----
function QuotationTab() {
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState({ details: '', quantityEstimate: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const load = () => fetchMyQuotationRequests().then(setRequests).catch((err) => setError(err.message || 'Unable to load requests'));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.details.trim()) return;
    setSending(true);
    setError('');
    setSuccessMessage('');
    try {
      await createQuotationRequest(form);
      setForm({ details: '', quantityEstimate: '' });
      setSuccessMessage('Bulk order request bhej diya gaya, shukriya!');
      await load();
    } catch (err) {
      setError(err.message || 'Unable to submit request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-text-primary">Bulk order ke liye request bhejein</p>
        <textarea
          value={form.details}
          onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
          placeholder="Kya chahiye — masalan poore ghar ki painting, kitne kamre, konsa brand…"
          required
          rows={3}
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
        <input
          value={form.quantityEstimate}
          onChange={(e) => setForm((prev) => ({ ...prev, quantityEstimate: e.target.value }))}
          placeholder="Andaza quantity (optional, e.g. 20 gallons)"
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
        {successMessage ? <p className="text-sm text-success">{successMessage}</p> : null}
        <button type="submit" disabled={sending} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
          {sending ? 'Sending…' : 'Request Bulk Order'}
        </button>
      </form>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {!requests ? (
        <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-text-secondary">Abhi tak koi bulk order request nahi hai.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">{req.quantity_estimate || 'Custom request'}</p>
                <StatusBadge status={req.status} />
              </div>
              <p className="mt-1 text-sm text-text-secondary">{req.details}</p>
              {req.admin_quote ? (
                <p className="mt-2 rounded-xl bg-bg-light px-3 py-2 text-sm text-text-primary"><strong>Quote:</strong> {req.admin_quote}</p>
              ) : null}
              <p className="mt-2 text-xs text-text-muted">{formatDate(req.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Profile tab ----
function ProfileTab() {
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile().then(setProfile).catch((err) => setError(err.message || 'Unable to load profile'));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updated = await updateProfile({ name: profile.name, defaultPaymentMethod: profile.default_payment_method });
      setProfile(updated);
      setMessage('Profile save ho gaya.');
    } catch (err) {
      setError(err.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!profile) return <p className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading your profile…</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Name</label>
        <input
          value={profile.name || ''}
          onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</label>
        <input value={profile.email || ''} disabled className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2.5 text-sm text-text-secondary" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Preferred payment method</label>
        <select
          value={profile.default_payment_method || ''}
          onChange={(e) => setProfile((prev) => ({ ...prev, default_payment_method: e.target.value }))}
          className="w-full rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm"
        >
          <option value="">Not set</option>
          {paymentMethods.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
      </div>
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <button type="submit" disabled={saving} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

function Account() {
  const { user, loading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('orders');

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-text-secondary">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">My Account</h1>
        <p className="mt-3 text-sm text-text-secondary">Apna order history, addresses aur wishlist dekhne ke liye pehle login karein.</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
          className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Login / Sign Up
        </button>
      </div>
    );
  }

  const ActiveComponent = {
    orders: OrdersTab,
    addresses: AddressesTab,
    wishlist: WishlistTab,
    support: SupportTab,
    quotation: QuotationTab,
    profile: ProfileTab
  }[activeTab];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Helmet>
        <title>My Account — Fazal Paint Hardware</title>
      </Helmet>
      <h1 className="text-2xl font-semibold text-text-primary">My Account</h1>
      <p className="mt-1 text-sm text-text-secondary">{user.email}</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-accent text-white' : 'bg-surface-alt text-text-primary hover:bg-border'
              }`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default Account;
