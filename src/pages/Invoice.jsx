import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Printer, ArrowLeft } from 'lucide-react';
import { fetchMyOrder } from '../lib/accountApi';
import { formatCurrency } from '../lib/formatCurrency';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Invoice() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyOrder(orderId).then(setOrder).catch((err) => setError(err.message || 'Unable to load this invoice'));
  }, [orderId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-error">{error}</p>
        <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-accent">Back to My Account</Link>
      </div>
    );
  }

  if (!order) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-text-secondary">Loading invoice…</div>;
  }

  const items = order.items || [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Helmet>
        <title>Invoice {order.invoice_number} — Fazal Paint Hardware</title>
      </Helmet>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-accent">
          <ArrowLeft size={16} /> Back to My Account
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Fazal Paint Hardware and Trolley House</h1>
            <p className="text-sm text-text-secondary">Bannu Road, Dera Ismail Khan</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-text-primary">Invoice #{order.invoice_number}</p>
            <p className="text-xs text-text-secondary">{formatDate(order.created_at)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-b border-border pb-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Billed to</p>
            <p className="mt-1 text-sm text-text-primary">{order.customer_name}</p>
            <p className="text-sm text-text-secondary">{order.customer_phone}</p>
            {order.customer_email ? <p className="text-sm text-text-secondary">{order.customer_email}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Shipping address</p>
            <p className="mt-1 text-sm text-text-secondary">{order.shipping_address}</p>
            <p className="text-sm text-text-secondary">{[order.shipping_city, order.shipping_state, order.shipping_postal].filter(Boolean).join(', ')}</p>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-border/60">
                <td className="py-2 text-text-primary">{item.name}</td>
                <td className="py-2 text-center text-text-secondary">{item.quantity}</td>
                <td className="py-2 text-right text-text-secondary">{formatCurrency(item.price)}</td>
                <td className="py-2 text-right text-text-primary">{formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1">
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Payment method</span>
              <span>{order.payment_method}</span>
            </div>
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Status</span>
              <span className="font-semibold text-text-primary">{order.status}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-text-primary">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Invoice;
