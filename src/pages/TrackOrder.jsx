import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import { Check } from 'lucide-react';
import Reveal from '../components/motion/Reveal';
import { api } from '../lib/adminApi';
import { formatCurrency } from '../lib/formatCurrency';
import { SHOP } from '../data/shopInfo';
import { describeItemSpecs } from '../lib/itemSpecs';

const STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

const STEP_TEXT = {
  Pending: 'We received your order and will contact you shortly to confirm it.',
  Confirmed: 'Your order is confirmed and is being prepared.',
  Shipped: 'Your order is on its way, or ready for pickup.',
  Delivered: 'Your order has been delivered. Thank you for shopping with us!'
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TrackOrder() {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const result = await api('/api/orders/track', {
        method: 'POST',
        body: { invoiceNumber: invoiceNumber.trim(), phone: phone.trim() }
      });
      setOrder(result);
    } catch (err) {
      setError(err.message || 'Could not find your order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const status = order?.status || 'Pending';
  const cancelled = status === 'Cancelled';
  const stepIndex = Math.max(0, STEPS.indexOf(status));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Track Your Order — Fazal Paint Hardware and Trolley House</title>
        <meta name="description" content="Track your Fazal Paint Hardware order with your invoice number and phone number." />
      </Helmet>

      <Reveal as="section" className="rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Track order</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#4A3527]">Where is my order?</h1>
        <p className="mt-4 text-sm leading-7 text-[#8A7A6D]">
          Enter the invoice number from your order and the phone number you used when ordering.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="track-invoice" className="block text-sm font-semibold text-[#4A3527]">Invoice number</label>
            <input
              id="track-invoice"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="FPH-20260723-0001"
              required
              autoCapitalize="characters"
              className="mt-2 w-full rounded-2xl border border-[#F3E4D4] px-4 py-3 text-sm text-[#4A3527] outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="track-phone" className="block text-sm font-semibold text-[#4A3527]">Phone number</label>
            <input
              id="track-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0342 9085556"
              required
              className="mt-2 w-full rounded-2xl border border-[#F3E4D4] px-4 py-3 text-sm text-[#4A3527] outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? 'Checking...' : 'Track order'}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl bg-error-light px-4 py-3 text-sm text-error">{error}</p>
        )}
      </Reveal>

      {order && (
        <Reveal className="mt-8 rounded-3xl border border-[#F3E4D4] bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#4A3527]">Invoice #{order.invoiceNumber}</p>
              <p className="text-xs text-[#8A7A6D]">Placed on {formatDate(order.createdAt)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cancelled ? 'bg-error-light text-error' : 'bg-success-light text-success'}`}>
              {status}
            </span>
          </div>

          {cancelled ? (
            <p className="mt-6 rounded-2xl bg-error-light px-4 py-3 text-sm text-error">
              This order was cancelled. If this is a surprise, please message us on WhatsApp ({SHOP.whatsappDisplay}).
            </p>
          ) : (
            <>
              <ol className="mt-6 grid grid-cols-4 gap-2">
                {STEPS.map((step, index) => {
                  const done = index <= stepIndex;
                  return (
                    <li key={step} className="text-center">
                      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-success text-white' : 'bg-surface-alt text-[#8A7A6D]'}`}>
                        {done ? <Check size={16} /> : index + 1}
                      </div>
                      <p className={`mt-2 text-xs font-semibold ${done ? 'text-[#4A3527]' : 'text-[#8A7A6D]'}`}>{step}</p>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-5 text-sm leading-7 text-[#8A7A6D]">{STEP_TEXT[status] || STEP_TEXT.Pending}</p>
            </>
          )}

          <div className="mt-6 space-y-1 border-t border-[#F3E4D4] pt-5">
            {(order.items || []).map((item, index) => (
              <p key={index} className="text-sm text-[#8A7A6D]">
                {item.name}
                {describeItemSpecs(item) ? ` (${describeItemSpecs(item)})` : ''} × {item.quantity}
              </p>
            ))}
            <p className="pt-3 text-base font-semibold text-[#4A3527]">Total: {formatCurrency(order.total)}</p>
            {order.paymentMethod && <p className="text-xs text-[#8A7A6D]">Payment: {order.paymentMethod}</p>}
          </div>
        </Reveal>
      )}
    </div>
  );
}

export default TrackOrder;
