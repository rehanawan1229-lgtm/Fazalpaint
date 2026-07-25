import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, NavLink } from 'react-router-dom';
import { Eye, EyeOff, Search, X, Phone, Mail, MapPin, CreditCard, Package, Trash2 } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import AdminSectionNav from '../components/AdminSectionNav';
import {
  fetchOrders,
  fetchOrderDetail,
  markOrderViewed,
  fetchUnreadOrdersCount,
  deleteOrder,
  updateOrderStatus,
  resolveImageUrl,
  fetchUnreadSupportTicketsCount,
  fetchUnreadQuotationRequestsCount
} from '../lib/adminApi';

// ---- Helpers ----

// Turns a stored phone number into a wa.me link. Handles local "03xx…"
// numbers (Pakistan) by swapping the leading 0 for the country code 92, and
// leaves already-international numbers alone.
function toWhatsAppLink(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = `92${normalized.slice(1)}`;
  } else if (!normalized.startsWith('92') && normalized.length === 10) {
    normalized = `92${normalized}`;
  }
  return `https://wa.me/${normalized}`;
}

function toMailLink(rawEmail) {
  const email = String(rawEmail || '').trim();
  if (!email) return null;
  return `mailto:${email}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

// Orders can come back from the API with slightly different field names
// depending on how the backend serializes them — these small getters try the
// common variants so the UI doesn't break if one is used over another.
function getCustomerName(order) {
  return order?.customer_name || order?.name || order?.customerName || 'Unnamed customer';
}
function getPhone(order) {
  return order?.phone || order?.customer_phone || order?.customerPhone || '';
}
function getEmail(order) {
  return order?.email || order?.customer_email || order?.customerEmail || '';
}
function getAddress(order) {
  return order?.address || order?.customer_address || order?.shipping_address || order?.customerAddress || '';
}
function getPaymentMethod(order) {
  return order?.payment_method || order?.paymentMethod || 'Not specified';
}
function getStatus(order) {
  return order?.status || 'pending';
}
function getTotal(order) {
  return order?.total ?? order?.total_amount ?? order?.totalAmount ?? 0;
}
function getItems(order) {
  return order?.items || order?.order_items || order?.orderItems || [];
}
function isUnread(order) {
  return Number(order?.viewed_by_admin) === 0;
}

const STATUS_STYLES = {
  pending: 'bg-[#FDE9DC] text-[var(--color-accent)]',
  confirmed: 'bg-[#EAF6F0] text-[#4E9C79]',
  processing: 'bg-[#EAF6F0] text-[#4E9C79]',
  shipped: 'bg-[#E7F0FB] text-[#2E67B0]',
  delivered: 'bg-[#EAF6F0] text-[#4E9C79]',
  cancelled: 'bg-[#FCEBEA] text-[#D64545]',
};

function statusBadgeClass(status) {
  return STATUS_STYLES[String(status || '').toLowerCase()] || 'bg-[#FFF9F4] text-[#8A7A6D]';
}

// Small pill-style nav so the admin can switch between Products and Orders
// without hunting for a link elsewhere. Mirrors the same nav shown on
// AdminProducts.jsx so both pages feel connected.
function AdminOrders() {
  const { user, isAdmin, loading, login, logout } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [unreadCount, setUnreadCount] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  const [selectedOrder, setSelectedOrder] = useState(null); // summary row that was clicked
  const [orderDetail, setOrderDetail] = useState(null); // full detail once fetched
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadOrders();
      loadUnreadCount();
      loadUnreadSupportCount();
      loadUnreadBulkOrdersCount();
    }
  }, [isAdmin]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetchOrders();
      const list = response || [];
      // Newest first
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setOrders(list);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load orders' });
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await fetchUnreadOrdersCount();
      setUnreadCount(response?.count ?? response?.unreadCount ?? 0);
    } catch (error) {
      // Non-fatal — badge just won't show a number
    }
  };

  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadBulkOrdersCount, setUnreadBulkOrdersCount] = useState(0);

  const loadUnreadSupportCount = async () => {
    try {
      const response = await fetchUnreadSupportTicketsCount();
      setUnreadSupportCount(response?.count ?? 0);
    } catch (error) {
      // Non-fatal — badge just won't show a number
    }
  };

  const loadUnreadBulkOrdersCount = async () => {
    try {
      const response = await fetchUnreadQuotationRequestsCount();
      setUnreadBulkOrdersCount(response?.count ?? 0);
    } catch (error) {
      // Non-fatal — badge just won't show a number
    }
  };

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(orders.map((o) => getStatus(o)).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = statusFilter === 'All' || getStatus(order).toLowerCase() === statusFilter.toLowerCase();
      const searchMatch =
        !query ||
        getCustomerName(order).toLowerCase().includes(query) ||
        String(order.id ?? '').toLowerCase().includes(query) ||
        getPhone(order).toLowerCase().includes(query) ||
        getEmail(order).toLowerCase().includes(query);
      return statusMatch && searchMatch;
    });
  }, [orders, searchQuery, statusFilter]);

  const handleClearFilters = () => {
    setStatusFilter('All');
    setSearchQuery('');
  };

  const openOrder = async (order) => {
    setSelectedOrder(order);
    setOrderDetail(null);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const detail = await fetchOrderDetail(order.id);
      setOrderDetail(detail);

      // Mark as viewed the moment the detail is opened, then reflect that in
      // the list (dot disappears) and refresh the unread badge — but only if
      // this order was actually unread, to avoid needless calls.
      if (isUnread(order)) {
        await markOrderViewed(order.id);
        setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, viewed_by_admin: 1 } : o)));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load order detail' });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeOrderModal = () => {
    setShowDetailModal(false);
    setSelectedOrder(null);
    setOrderDetail(null);
  };

  // Deletes an order permanently after a confirm prompt. Accepts the click
  // event so it can stopPropagation — the delete button always sits inside
  // (or beside) a row/card that itself opens the order on click, so without
  // this a delete click would also fire openOrder().
  const handleDeleteOrder = async (orderId, event) => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }

    const confirmed = window.confirm('Is order ko hamesha ke liye delete karna hai? Yeh wapis nahi ho sakta.');
    if (!confirmed) return;

    setDeletingId(orderId);
    try {
      await deleteOrder(orderId);
      setOrders((current) => current.filter((order) => order.id !== orderId));
      loadUnreadCount();
      if (selectedOrder?.id === orderId) {
        closeOrderModal();
      }
      setMessage({ type: 'success', text: 'Order delete ho gaya.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Order delete nahi ho saka' });
    } finally {
      setDeletingId(null);
    }
  };

  // Updates an order's status (Pending/Confirmed/Shipped/Delivered/
  // Cancelled…) and notifies the customer by email + WhatsApp — this is
  // what powers the "order status updates" account benefit on their side.
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const handleUpdateStatus = async (orderId, status) => {
    setStatusUpdatingId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status: updated.status } : order)));
      setSelectedOrder((current) => (current && current.id === orderId ? { ...current, status: updated.status } : current));
      setOrderDetail((current) => (current && current.id === orderId ? { ...current, status: updated.status } : current));
      setMessage({ type: 'success', text: 'Order status update ho gaya aur customer ko notify kar diya gaya.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Status update nahi ho saka' });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginPending(true);
    setLoginError('');
    try {
      await login(loginForm.email, loginForm.password);
    } catch (error) {
      setLoginError(error.message || 'Sign in failed');
    } finally {
      setLoginPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F4] px-4">
        <div className="rounded-3xl border border-[#F3E4D4] bg-white px-8 py-6 text-sm text-[#8A7A6D] shadow-soft">Checking access…</div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FFF9F4] px-4 py-20 text-[#4A3527]">
        <Helmet><title>Admin Sign In — Fazal Paint Hardware</title></Helmet>
        <div className="mx-auto max-w-md rounded-[32px] border border-[#F3E4D4] bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin access</p>
          <h1 className="mt-4 text-3xl font-semibold">Sign in to manage content</h1>
          <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Use your admin credentials to open the edit tools and order manager.</p>
          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold">Email</label>
              <input value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold">Password</label>
              <div className="relative mt-2">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7A6D]"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {loginError ? <p className="text-sm text-[var(--color-error)]">{loginError}</p> : null}
            <button type="submit" disabled={loginPending} className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:cursor-not-allowed disabled:opacity-70">
              {loginPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const detailPhone = orderDetail ? getPhone(orderDetail) : selectedOrder ? getPhone(selectedOrder) : '';
  const detailEmail = orderDetail ? getEmail(orderDetail) : selectedOrder ? getEmail(orderDetail) : '';
  const whatsappLink = toWhatsAppLink(detailPhone);
  const mailLink = toMailLink(detailEmail);

  return (
    <div className="min-h-screen animate-fade-in bg-[#FFF9F4] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Helmet><title>Admin Orders — Fazal Paint Hardware</title></Helmet>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin workspace</p>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#4A3527] sm:text-3xl">Orders</h1>
              {unreadCount > 0 ? (
                <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  {unreadCount} new
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Every order placed on the site shows up here. Unread orders have a blue dot — open one to see full details and mark it read.</p>
            <div className="mt-4">
              <AdminSectionNav unreadOrdersCount={unreadCount} unreadSupportCount={unreadSupportCount} unreadBulkOrdersCount={unreadBulkOrdersCount} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={logout} className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm font-semibold text-[#4A3527]">Sign out</button>
          </div>
        </div>

        {message.text ? (
          <div className={`rounded-3xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-[#4E9C79]/20 bg-[#EAF6F0] text-[#4E9C79]' : 'border-[#D64545]/20 bg-[#FCEBEA] text-[#D64545]'}`}>
            {message.text}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[32px] border border-[#F3E4D4] bg-white shadow-soft">
          <div className="border-b border-[#FFF1E6] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#4A3527]">All orders</h2>
              <span className="rounded-full bg-[#FFF9F4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                {filteredOrders.length} of {orders.length}
              </span>
            </div>

            <div className="relative mt-4">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B5A594]" />
              <input
                type="text"
                inputMode="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by customer name, phone, email, or order #"
                className="w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] py-3 pl-11 pr-11 text-sm text-[#4A3527] placeholder:text-[#B5A594] focus:border-[var(--color-accent)] focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#8A7A6D] hover:bg-[#FBE6D4] active:scale-90"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-2 text-sm"
              >
                <option value="All">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              {statusFilter !== 'All' || searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-sm font-semibold text-[#4A3527]"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {loadingOrders ? (
            <div className="p-6 text-sm text-[#8A7A6D]">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-sm text-[#8A7A6D]">No orders yet.</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-6 text-sm text-[#8A7A6D]">No orders match this filter. Try a different search or status, or clear the filter.</div>
          ) : (
            <>
              {/* Desktop / tablet: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#FFF9F4] text-[#8A7A6D]">
                    <tr>
                      <th className="px-4 py-3"></th>
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => openOrder(order)}
                        className="cursor-pointer border-t border-[#FFF1E6] align-middle hover:bg-[#FFF9F4]"
                      >
                        <td className="px-4 py-3">
                          {isUnread(order) ? (
                            <span className="block h-2.5 w-2.5 animate-pulse rounded-full bg-[#2E67B0]" title="Unread" />
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#8A7A6D]">#{order.id}</td>
                        <td className={`px-4 py-3 ${isUnread(order) ? 'font-bold text-[#4A3527]' : 'font-medium text-[#4A3527]'}`}>
                          {getCustomerName(order)}
                        </td>
                        <td className="px-4 py-3 text-[#8A7A6D]">{formatDateTime(order.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-[#4A3527]">Rs. {formatMoney(getTotal(order))}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(getStatus(order))}`}>
                            {getStatus(order)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(event) => handleDeleteOrder(order.id, event)}
                            disabled={deletingId === order.id}
                            aria-label="Delete order"
                            className="rounded-full p-2 text-[#8A7A6D] transition-colors hover:bg-[#FCEBEA] hover:text-[#D64545] disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="divide-y divide-[#FFF1E6] md:hidden">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => openOrder(order)}
                    className="relative flex w-full cursor-pointer items-start gap-3 p-4 text-left active:bg-[#FFF9F4]"
                  >
                    {isUnread(order) ? (
                      <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-[#2E67B0]" title="Unread" />
                    ) : (
                      <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate ${isUnread(order) ? 'font-bold text-[#4A3527]' : 'font-semibold text-[#4A3527]'}`}>
                          {getCustomerName(order)}
                        </p>
                        <span className="flex-shrink-0 font-mono text-[10px] text-[#B5A594]">#{order.id}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#8A7A6D]">{formatDateTime(order.created_at)}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(getStatus(order))}`}>
                          {getStatus(order)}
                        </span>
                        <span className="font-semibold text-[#4A3527]">Rs. {formatMoney(getTotal(order))}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => handleDeleteOrder(order.id, event)}
                      disabled={deletingId === order.id}
                      aria-label="Delete order"
                      className="flex-shrink-0 self-start rounded-full p-2 text-[#8A7A6D] transition-colors hover:bg-[#FCEBEA] hover:text-[#D64545] disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Order detail modal ---- */}
      {showDetailModal ? (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-[90dvh] w-full max-w-2xl animate-modal-pop overflow-y-auto rounded-[32px] bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Order #{selectedOrder?.id}</p>
                <h2 className="mt-1 text-xl font-semibold text-[#4A3527]">{getCustomerName(orderDetail || selectedOrder || {})}</h2>
              </div>
              <button type="button" onClick={closeOrderModal} aria-label="Close" className="rounded-full px-2 py-1 text-lg text-[#8A7A6D] hover:bg-[#FFF9F4]">✕</button>
            </div>

            {detailLoading ? (
              <div className="mt-8 text-sm text-[#8A7A6D]">Loading order details…</div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(getStatus(orderDetail || selectedOrder || {}))}`}>
                    {getStatus(orderDetail || selectedOrder || {})}
                  </span>
                  <span className="text-xs text-[#8A7A6D]">{formatDateTime((orderDetail || selectedOrder)?.created_at)}</span>
                </div>

                {/* Contact info — phone opens WhatsApp, email opens Gmail/mail client */}
                <div className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A7A6D]">Customer</p>
                  <div className="mt-3 space-y-2 text-sm text-[#4A3527]">
                    {whatsappLink ? (
                      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[var(--color-accent)]">
                        <Phone size={16} className="text-[#8A7A6D]" /> {detailPhone}
                      </a>
                    ) : (
                      <p className="flex items-center gap-2 text-[#8A7A6D]"><Phone size={16} /> Not provided</p>
                    )}
                    {mailLink ? (
                      <a href={mailLink} className="flex items-center gap-2 hover:text-[var(--color-accent)]">
                        <Mail size={16} className="text-[#8A7A6D]" /> {detailEmail}
                      </a>
                    ) : (
                      <p className="flex items-center gap-2 text-[#8A7A6D]"><Mail size={16} /> Not provided</p>
                    )}
                    <p className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 flex-shrink-0 text-[#8A7A6D]" />
                      <span>{getAddress(orderDetail || selectedOrder || {}) || 'Not provided'}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CreditCard size={16} className="text-[#8A7A6D]" />
                      {getPaymentMethod(orderDetail || selectedOrder || {})}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8A7A6D]">
                    <Package size={14} /> Items
                  </p>
                  <div className="mt-3 space-y-2">
                    {getItems(orderDetail || selectedOrder || {}).length === 0 ? (
                      <p className="text-sm text-[#8A7A6D]">No item details available.</p>
                    ) : (
                      getItems(orderDetail || selectedOrder || {}).map((item, index) => (
                        <div key={item.id ?? index} className="flex items-center gap-3 rounded-2xl border border-[#FFF1E6] bg-white px-4 py-3">
                          {item.swatch_hex ? (
                            <span
                              className="h-8 w-8 flex-shrink-0 rounded-full border border-[#F3E4D4]"
                              style={{ backgroundColor: item.swatch_hex }}
                              title={item.color_name || ''}
                            />
                          ) : item.image_url ? (
                            <img src={resolveImageUrl(item.image_url)} alt={item.name} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#4A3527]">{item.name || item.product_name || 'Item'}</p>
                            <p className="mt-0.5 text-xs text-[#8A7A6D]">
                              {[item.packaging, item.color_name, item.color_code].filter(Boolean).join(' · ') || null}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right text-sm">
                            <p className="text-[#8A7A6D]">Qty {item.quantity ?? item.qty ?? 1}</p>
                            <p className="font-semibold text-[#4A3527]">Rs. {formatMoney(item.price)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-[#FFF9F4] px-4 py-3">
                  <span className="text-sm font-semibold text-[#4A3527]">Total</span>
                  <span className="text-lg font-semibold text-[#4A3527]">Rs. {formatMoney(getTotal(orderDetail || selectedOrder || {}))}</span>
                </div>

                <div className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-3">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A6D]">
                    Update status (customer ko email + WhatsApp se batayein)
                  </label>
                  <select
                    value={getStatus(orderDetail || selectedOrder || {}) || 'Pending'}
                    onChange={(event) => handleUpdateStatus(selectedOrder.id, event.target.value)}
                    disabled={statusUpdatingId === selectedOrder?.id}
                    className="w-full rounded-xl border border-[#F3E4D4] bg-[#FFF9F4] px-3 py-2 text-sm font-semibold text-[#4A3527]"
                  >
                    {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={(event) => handleDeleteOrder(selectedOrder.id, event)}
                  disabled={deletingId === selectedOrder?.id}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D64545]/30 bg-[#FCEBEA] px-4 py-3 text-sm font-semibold text-[#D64545] transition-colors hover:bg-[#F8D7D5] disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {deletingId === selectedOrder?.id ? 'Deleting…' : 'Delete order'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminOrders;