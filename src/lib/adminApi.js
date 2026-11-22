const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
}

export function getApiBaseUrl() {
  return API_BASE;
}

export function logoutAdmin() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adminToken');
  }
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }

  return payload;
}

// ---------------------------------------------------------------------------
// SPEED: instant-load helpers for PUBLIC data (products, content, links).
// The Render free server can take 30-60 seconds to wake up. These helpers keep
// the last good answer in the browser so the page paints immediately, then
// refresh it quietly in the background.
// ---------------------------------------------------------------------------
const CACHE_PREFIX = 'apicache:v1:';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readCached(path) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + API_BASE + path);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < CACHE_MAX_AGE_MS ? d : null;
  } catch {
    return null;
  }
}

function writeCached(path, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + API_BASE + path, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // storage full or blocked — caching is only a bonus
  }
}

// Calls onUpdate(data) once with the saved copy (if any) and once with fresh
// data. Only rejects when there is NO saved copy and the network failed.
export async function apiCached(path, onUpdate) {
  const cached = readCached(path);
  if (cached !== null) onUpdate?.(cached, true);
  try {
    const fresh = await api(path);
    writeCached(path, fresh);
    onUpdate?.(fresh, false);
    return fresh;
  } catch (error) {
    if (cached !== null) return cached;
    throw error;
  }
}

// For code that just wants one value: returns the saved copy instantly (and
// refreshes it in the background) or waits for the network if nothing is saved.
export async function apiSwr(path) {
  const cached = readCached(path);
  if (cached !== null) {
    api(path).then((fresh) => writeCached(path, fresh)).catch(() => {});
    return cached;
  }
  const fresh = await api(path);
  writeCached(path, fresh);
  return fresh;
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  return api('/api/admin/upload', { method: 'POST', body: formData });
}

export async function uploadImages(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  return api('/api/admin/products/bulk-upload-images', { method: 'POST', body: formData });
}

// ---- Product Grouping (named collections: name/description/photo/brand) ----
// These are distinct from the existing "auto-group" variant linking
// (/api/admin/auto-group-products) — a catalog group is an admin-curated
// collection like "Berger Weathercoat Range" that arbitrary products can be
// filed into, independent of packaging/variant relationships.

export async function fetchCatalogGroups(brand) {
  const query = brand && brand !== 'All' ? `?brand=${encodeURIComponent(brand)}` : '';
  return api(`/api/admin/catalog-groups${query}`);
}

export async function createCatalogGroup(payload) {
  return api('/api/admin/catalog-groups', { method: 'POST', body: payload });
}

export async function assignProductsToGroup(groupId, productIds) {
  return api(`/api/admin/catalog-groups/${groupId}/products`, {
    method: 'POST',
    body: { product_ids: productIds }
  });
}

// Deletes the named collection itself (e.g. "hn", "Berger Weathercoat
// Range"). The backend cascades this to catalog_group_products, so the
// group ↔ product links are cleaned up too — the products themselves are
// completely unaffected and stay in the catalog.
export async function deleteCatalogGroup(groupId) {
  return api(`/api/admin/catalog-groups/${groupId}`, { method: 'DELETE' });
}

// Product/content images are uploaded to the backend server (port 5173)
// and stored as relative paths like "/uploads/xxx.jpg". The frontend runs
// on a different port (5173), so a plain relative path 404s. This resolves
// any relative image path against the backend's own origin.
export function resolveImageUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

// ---- Admin: Category visibility (Paint / Hardware show-hide eye toggle) ----
export async function fetchCategoryVisibility() {
  return api('/api/admin/category-visibility');
}

export async function updateCategoryVisibility(category, visible) {
  return api('/api/admin/category-visibility', { method: 'PUT', body: { category, visible } });
}

// ---- Admin: Category order (Paint / Hardware / Paint Additives display order) ----
export async function fetchCategoryOrder() {
  return api('/api/admin/category-order');
}

export async function updateCategoryOrder(order) {
  return api('/api/admin/category-order', { method: 'PUT', body: { order } });
}

// ---- Admin Orders ----
// Powers AdminOrders.jsx: the order list with its Gmail-style "unread dot"
// (viewed_by_admin), the single-order detail view, and marking an order as
// viewed the moment its detail is opened (so the dot disappears).

export async function fetchOrders() {
  return api('/api/admin/orders');
}

export async function fetchOrderDetail(orderId) {
  return api(`/api/admin/orders/${orderId}`);
}

export async function markOrderViewed(orderId) {
  return api(`/api/admin/orders/${orderId}/mark-viewed`, { method: 'PUT' });
}

export async function deleteOrder(orderId) {
  return api(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
}

export async function updateOrderStatus(orderId, status) {
  return api(`/api/admin/orders/${orderId}/status`, { method: 'PUT', body: { status } });
}

export async function fetchUnreadOrdersCount() {
  return api('/api/admin/orders/unread-count');
}

// ---- Admin: Support tickets (complaints/suggestions) ----
export async function fetchAdminSupportTickets() {
  return api('/api/admin/support-tickets');
}

export async function updateAdminSupportTicket(id, payload) {
  return api(`/api/admin/support-tickets/${id}`, { method: 'PUT', body: payload });
}

export async function markSupportTicketViewed(id) {
  return api(`/api/admin/support-tickets/${id}/mark-viewed`, { method: 'PUT' });
}

export async function fetchUnreadSupportTicketsCount() {
  return api('/api/admin/support-tickets/unread-count');
}

// ---- Admin: Bulk order (quotation) requests ----
export async function fetchAdminQuotationRequests() {
  return api('/api/admin/quotation-requests');
}

export async function updateAdminQuotationRequest(id, payload) {
  return api(`/api/admin/quotation-requests/${id}`, { method: 'PUT', body: payload });
}

export async function markQuotationRequestViewed(id) {
  return api(`/api/admin/quotation-requests/${id}/mark-viewed`, { method: 'PUT' });
}

export async function fetchUnreadQuotationRequestsCount() {
  return api('/api/admin/quotation-requests/unread-count');
}