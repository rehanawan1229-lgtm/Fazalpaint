import { api } from './adminApi';

// ---- Order history / reorder / invoice ----
export async function fetchMyOrders() {
  return api('/api/orders/mine');
}

export async function fetchMyOrder(orderId) {
  return api(`/api/orders/${orderId}`);
}

// ---- Saved addresses ----
export async function fetchAddresses() {
  return api('/api/addresses');
}

export async function createAddress(payload) {
  return api('/api/addresses', { method: 'POST', body: payload });
}

export async function updateAddress(id, payload) {
  return api(`/api/addresses/${id}`, { method: 'PUT', body: payload });
}

export async function deleteAddress(id) {
  return api(`/api/addresses/${id}`, { method: 'DELETE' });
}

// ---- Wishlist ----
export async function fetchWishlist() {
  return api('/api/wishlist');
}

export async function addToWishlist(productId) {
  return api('/api/wishlist', { method: 'POST', body: { productId } });
}

export async function removeFromWishlist(productId) {
  return api(`/api/wishlist/${productId}`, { method: 'DELETE' });
}

// ---- Profile (saved payment method / preferred contact) ----
export async function fetchProfile() {
  return api('/api/profile');
}

export async function updateProfile(payload) {
  return api('/api/profile', { method: 'PUT', body: payload });
}

// ---- Support / complaint tickets ----
export async function createSupportTicket(payload) {
  return api('/api/support-tickets', { method: 'POST', body: payload });
}

export async function fetchMySupportTickets() {
  return api('/api/support-tickets/mine');
}

// ---- Custom quotation requests ----
export async function createQuotationRequest(payload) {
  return api('/api/quotation-requests', { method: 'POST', body: payload });
}

export async function fetchMyQuotationRequests() {
  return api('/api/quotation-requests/mine');
}
