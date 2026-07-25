import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useCart } from '../components/Cart/useCart';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { formatCurrency } from '../lib/formatCurrency';
import { formatEmailPayload } from '../lib/emailPayload';
import { provinceCities } from '../data/locations';
import { fetchAddresses, fetchProfile } from '../lib/accountApi';

const paymentMethods = ['Cash on Delivery', 'Bank Transfer', 'Pay at Store'];
const emailServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const emailTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const emailPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const canSendViaEmailJS = Boolean(emailServiceId && emailTemplateId && emailPublicKey);

// Always resolves to the correct "/send-order" endpoint, no matter how
// VITE_ORDER_SERVER_URL is written in .env (with or without a trailing
// slash, with or without "/send-order" already on it). This was the
// actual cause of the 404 — .env had just "http://127.0.0.1:5173" with
// no path, so the POST was hitting the server root, which has no route.
function resolveOrderServerUrl() {
  // FIX: fall back to a RELATIVE path ('/send-order'), not an absolute
  // "http://localhost:5173" — an absolute localhost URL baked into the
  // page breaks the moment the page is opened from a phone (127.0.0.1 /
  // localhost on a phone means the phone itself). A relative path always
  // goes through Vite's dev proxy (or, in production, your real domain),
  // which resolves correctly no matter which device loaded the page.
  const base = (import.meta.env.VITE_ORDER_SERVER_URL || '').trim().replace(/\/+$/, '');
  return base.endsWith('/send-order') ? base : `${base}/send-order`;
}

function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAdminAuth();
  const [customer, setCustomer] = useState({
    fullName: '',
    email: '',
    phone: '',
    shippingAddress: '',
    shippingCity: '',
    shippingState: '',
    shippingPostal: '',
    billingSameAsShipping: true,
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingPostal: '',
    orderNotes: '',
    paymentMethod: paymentMethods[0]
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(null);

  const total = subtotal;

  // Pre-fill contact + shipping fields from the customer's saved default
  // address and profile, so a logged-in customer doesn't have to retype
  // details they already saved once. Guests (user is null) are skipped
  // entirely — they keep seeing the blank form as before. Uses the
  // functional setCustomer form and only fills fields that are still
  // empty, so it never overwrites anything the customer has already typed.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const [addresses, profile] = await Promise.all([
          fetchAddresses().catch(() => []),
          fetchProfile().catch(() => null)
        ]);
        if (cancelled) return;

        const defaultAddress = (addresses || []).find((addr) => addr.is_default) || (addresses || [])[0] || null;
        if (!defaultAddress && !profile) return;

        setCustomer((prev) => ({
          ...prev,
          fullName: prev.fullName || defaultAddress?.full_name || profile?.name || '',
          email: prev.email || profile?.email || user.email || '',
          phone: prev.phone || defaultAddress?.phone || '',
          shippingAddress: prev.shippingAddress || defaultAddress?.address || '',
          shippingCity: prev.shippingCity || defaultAddress?.city || '',
          shippingState: prev.shippingState || defaultAddress?.state || '',
          shippingPostal: prev.shippingPostal || defaultAddress?.postal_code || ''
        }));
      } catch (err) {
        // Silent fail — checkout still works as a blank form to fill manually.
        console.warn('Unable to prefill checkout from saved address:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const shippingCityOptions = useMemo(() => provinceCities[customer.shippingState] || [], [customer.shippingState]);
  const billingCityOptions = useMemo(() => provinceCities[customer.billingState] || [], [customer.billingState]);

  const validate = () => {
    const nextErrors = {};
    if (!customer.fullName.trim()) nextErrors.fullName = 'Full Name is required.';
    if (!customer.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) nextErrors.email = 'Please enter a valid email address.';
    if (!customer.phone.trim() || !/^03\d{9}$/.test(customer.phone)) nextErrors.phone = 'Please enter a valid Pakistani mobile number, e.g. 03001234567.';
    if (!customer.shippingAddress.trim()) nextErrors.shippingAddress = 'Street address is required.';
    if (!customer.shippingCity.trim()) nextErrors.shippingCity = 'City is required.';
    if (!customer.shippingState.trim()) nextErrors.shippingState = 'State / province is required.';
    if (!customer.shippingPostal.trim()) nextErrors.shippingPostal = 'Postal / ZIP code is required.';
    if (!customer.billingSameAsShipping) {
      if (!customer.billingAddress.trim()) nextErrors.billingAddress = 'Billing address is required.';
      if (!customer.billingCity.trim()) nextErrors.billingCity = 'Billing city is required.';
      if (!customer.billingState.trim()) nextErrors.billingState = 'Billing state is required.';
      if (!customer.billingPostal.trim()) nextErrors.billingPostal = 'Billing postal code is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setCustomer((prev) => {
      if (field === 'shippingState') {
        return { ...prev, shippingState: value, shippingCity: '' };
      }
      if (field === 'billingState') {
        return { ...prev, billingState: value, billingCity: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const sendOrder = async () => {
    if (!validate()) return;
    setSending(true);
    try {
      const orderPayload = {
        customer,
        items,
        total: formatCurrency(total),
        orderDate: new Date().toLocaleString('en-PK')
      };

      console.log('📦 Sending order payload:', orderPayload);

      if (canSendViaEmailJS) {
        console.log('📧 Using EmailJS to send order');
        await emailjs.send(emailServiceId, emailTemplateId, formatEmailPayload(orderPayload), emailPublicKey);
        console.log('✅ EmailJS sent successfully');
      } else {
        // fallback to local server (Vite exposes env via import.meta.env)
        const serverUrl = resolveOrderServerUrl();
        console.log('🔄 Using local server at:', serverUrl);
        const resp = await fetch(serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        
        console.log('📝 Server response status:', resp.status);
        
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          console.error('❌ Server error:', body);
          throw new Error(body.error || `Server responded with ${resp.status}`);
        }
        
        const responseData = await resp.json();
        console.log('✅ Server response:', responseData);
      }

      console.log('🎉 Order sent successfully!');

      // NEW: also record the order in the database so it gets an invoice
      // number and triggers the automated IVR confirmation call / WhatsApp
      // message. This runs IN ADDITION TO the email above, never instead
      // of it — if this fails for any reason, the order was still emailed
      // successfully, so the customer's order is not lost either way.
      try {
        const serverUrl = resolveOrderServerUrl().replace(/\/send-order$/, '/api/orders');
        // If the customer is logged in, send their token along so the
        // order gets linked to their account (for order history / reorder).
        // Guests simply won't have a token, and the order is still recorded.
        const authToken = localStorage.getItem('adminToken');
        const orderResp = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ customer, items, total, paymentMethod: customer.paymentMethod })
        });
        if (orderResp.ok) {
          const orderData = await orderResp.json();
          console.log('📋 Order recorded, invoice:', orderData.invoiceNumber);
          setInvoiceNumber(orderData.invoiceNumber);
        } else {
          console.warn('Order email sent, but recording the order for invoice/IVR/WhatsApp failed.');
        }
      } catch (orderRecordError) {
        console.warn('Order email sent, but recording the order for invoice/IVR/WhatsApp failed:', orderRecordError);
      }

      setSuccess(true);
      clearCart();
    } catch (error) {
      console.error('🚨 Order submission error:', error);
      setErrors({ submission: `Unable to send order. ${error?.message ?? 'Please check the server or EmailJS configuration.'}` });
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Helmet>
          <title>Order Confirmed — Fazal Paint Hardware</title>
        </Helmet>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-[#F3E4D4] bg-white p-6 text-center shadow-soft sm:p-10"
        >
          <div className="mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-[#EAF6F0]">
            <CheckCircle2 size={36} className="text-[#4E9C79]" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-[#4A3527]">Thank you, {customer.fullName}!</h1>
          {invoiceNumber ? (
            <p className="mt-2 text-sm font-semibold text-accent">Invoice #{invoiceNumber}</p>
          ) : null}
          <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">
            Your order has been sent to the shop. We will contact you soon at +92 342 9085556 to confirm details and {customer.paymentMethod === 'Cash on Delivery' ? 'prepare your pickup or delivery' : 'confirm the payment method'}.
          </p>
          {customer.paymentMethod === 'Cash on Delivery' ? (
            <p className="mt-3 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-xs leading-6 text-[#8A7A6D]">
              📞 You'll receive an automated confirmation call shortly.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-8 inline-flex rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift"
          >
            Back to home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-28 sm:px-6 sm:py-16 lg:pb-16">
      <Helmet>
        <title>Checkout — Fazal Paint Hardware</title>
      </Helmet>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
        <div className="order-2 rounded-3xl border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8 lg:order-1">
          <h1 className="text-2xl font-semibold text-[#4A3527] sm:text-3xl">Confirm your order</h1>
          <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Fill in your contact and delivery details so the shop can confirm your order without opening external mail apps.</p>

          <section className="mt-10 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-[#4A3527]">Contact information</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Full Name</label>
                  <input
                    type="text"
                    value={customer.fullName}
                    onChange={handleChange('fullName')}
                    className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                  />
                  {errors.fullName && <p className="mt-2 text-sm text-[#D64545]">{errors.fullName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Email address</label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={handleChange('email')}
                    className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                  />
                  {errors.email && <p className="mt-2 text-sm text-[#D64545]">{errors.email}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#4A3527]">Phone number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={customer.phone}
                    onChange={handleChange('phone')}
                    placeholder="03001234567"
                    className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                  />
                  {errors.phone && <p className="mt-2 text-sm text-[#D64545]">{errors.phone}</p>}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#4A3527]">Shipping address</h2>
              <div className="mt-5 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Street address</label>
                  <input
                    type="text"
                    value={customer.shippingAddress}
                    onChange={handleChange('shippingAddress')}
                    className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                  />
                  {errors.shippingAddress && <p className="mt-2 text-sm text-[#D64545]">{errors.shippingAddress}</p>}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">City</label>
                    <select
                      value={customer.shippingCity}
                      onChange={handleChange('shippingCity')}
                      className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                    >
                      <option value="" disabled>Select city</option>
                      {shippingCityOptions.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    {errors.shippingCity && <p className="mt-2 text-sm text-[#D64545]">{errors.shippingCity}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">State / Province</label>
                    <select
                      value={customer.shippingState}
                      onChange={handleChange('shippingState')}
                      className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                    >
                      <option value="" disabled>Select province</option>
                      {Object.keys(provinceCities).map((province) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                    {errors.shippingState && <p className="mt-2 text-sm text-[#D64545]">{errors.shippingState}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Postal / ZIP code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customer.shippingPostal}
                    onChange={handleChange('shippingPostal')}
                    className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                  />
                  {errors.shippingPostal && <p className="mt-2 text-sm text-[#D64545]">{errors.shippingPostal}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#F3E4D4] bg-[#FFF9F4] p-5">
              <label className="inline-flex items-center gap-3 text-sm font-semibold text-[#4A3527]">
                <input type="checkbox" checked={customer.billingSameAsShipping} onChange={handleChange('billingSameAsShipping')} className="h-5 w-5 rounded border-[#F3E4D4] bg-white" />
                Billing address same as shipping address
              </label>
            </div>

            {!customer.billingSameAsShipping && (
              <div>
                <h2 className="text-xl font-semibold text-[#4A3527]">Billing address</h2>
                <div className="mt-5 space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Street address</label>
                    <input
                      type="text"
                      value={customer.billingAddress}
                      onChange={handleChange('billingAddress')}
                      className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                    />
                    {errors.billingAddress && <p className="mt-2 text-sm text-[#D64545]">{errors.billingAddress}</p>}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-[#4A3527]">City</label>
                      <select
                        value={customer.billingCity}
                        onChange={handleChange('billingCity')}
                        className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                      >
                        <option value="" disabled>Select city</option>
                        {billingCityOptions.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                      {errors.billingCity && <p className="mt-2 text-sm text-[#D64545]">{errors.billingCity}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#4A3527]">State / Province</label>
                      <select
                        value={customer.billingState}
                        onChange={handleChange('billingState')}
                        className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                      >
                        <option value="" disabled>Select province</option>
                        {Object.keys(provinceCities).map((province) => (
                          <option key={province} value={province}>{province}</option>
                        ))}
                      </select>
                      {errors.billingState && <p className="mt-2 text-sm text-[#D64545]">{errors.billingState}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Postal / ZIP code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customer.billingPostal}
                      onChange={handleChange('billingPostal')}
                      className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                    />
                    {errors.billingPostal && <p className="mt-2 text-sm text-[#D64545]">{errors.billingPostal}</p>}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#4A3527]">Payment method</label>
              <select
                value={customer.paymentMethod}
                onChange={handleChange('paymentMethod')}
                className="mt-3 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#4A3527]">Order notes</label>
              <textarea
                value={customer.orderNotes}
                onChange={handleChange('orderNotes')}
                rows={4}
                className="mt-3 w-full rounded-3xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm text-[#4A3527]"
                placeholder="Add any special instructions or delivery notes"
              />
            </div>

            {errors.submission && <p className="text-sm text-[#D64545]">{errors.submission}</p>}
            <button
              type="button"
              onClick={sendOrder}
              disabled={sending}
              className={`mt-6 hidden w-full items-center justify-center rounded-2xl bg-accent px-6 py-4 text-sm font-semibold text-white shadow-soft transition-all active:scale-[0.98] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[#E8DDD0] disabled:shadow-none lg:inline-flex ${sending ? 'animate-pulse-soft' : ''}`}
            >
              {sending ? 'Sending order…' : 'Confirm Order'}
            </button>
          </section>
        </div>

        <aside className="order-1 rounded-3xl border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8 lg:order-2 lg:self-start">
          <h2 className="text-xl font-semibold text-[#4A3527]">Order summary</h2>

          {/* Mobile: items list collapses behind a toggle so the total +
              "Confirm Order" button are reachable without scrolling past
              every line item first. Desktop keeps the list always open. */}
          <details className="group mt-6 sm:hidden">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm font-semibold text-accent">
              <span>{items.length} item{items.length === 1 ? '' : 's'} in your order</span>
              <span className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl border border-[#FBE6D4] bg-[#FFF1E6] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#4A3527]">{item.name}</p>
                      <p className="text-sm text-[#8A7A6D]">{item.quantity} × {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-semibold text-[#4A3527]">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <div className="mt-6 hidden space-y-4 sm:block">
            {items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-[#FBE6D4] bg-[#FFF1E6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#4A3527]">{item.name}</p>
                    <p className="text-sm text-[#8A7A6D]">{item.quantity} × {formatCurrency(item.price)}</p>
                  </div>
                  <p className="font-semibold text-[#4A3527]">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-3xl bg-[#FFF9F4] p-5 text-sm text-[#8A7A6D]">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-[#4A3527]">{formatCurrency(subtotal)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-[#4A3527]">Calculated later</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-base font-semibold text-[#4A3527]">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile-only sticky checkout bar — total + Confirm Order stay
          reachable with one thumb, without scrolling back down through
          the whole form. Hidden on desktop where the inline button is
          already always visible in the two-column layout. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#F3E4D4] bg-white/95 px-4 py-3 shadow-lift backdrop-blur-sm lg:hidden" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#8A7A6D]">Total</p>
            <p className="truncate text-lg font-semibold text-[#4A3527]">{formatCurrency(total)}</p>
          </div>
          <button
            type="button"
            onClick={sendOrder}
            disabled={sending}
            className={`flex min-h-[48px] flex-shrink-0 items-center justify-center rounded-2xl bg-accent px-6 text-sm font-semibold text-white shadow-soft transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#E8DDD0] ${sending ? 'animate-pulse-soft' : ''}`}
          >
            {sending ? 'Sending…' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Checkout;