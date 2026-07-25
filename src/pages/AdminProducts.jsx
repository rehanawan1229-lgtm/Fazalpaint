import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, NavLink } from 'react-router-dom';
import { Eye, EyeOff, Plus, Search, X } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import AdminSectionNav from '../components/AdminSectionNav';
import {
  api,
  uploadImage,
  resolveImageUrl,
  fetchCatalogGroups,
  assignProductsToGroup,
  fetchUnreadOrdersCount,
  fetchUnreadSupportTicketsCount,
  fetchUnreadQuotationRequestsCount
} from '../lib/adminApi';

const emptyForm = {
  name: '',
  brand: '',
  category: '',
  sub_category: '',
  price: '',
  description: '',
  in_stock: true,
  image_url: '',
  packaging: '',
  color_code: '',
  color_name: '',
  swatch_hex: '',
  line_group: ''
};

// Broad grouping the admin picks when adding a product — separate from the
// specific, brand-curated Sub-Category (e.g. "Royal Matt Emulsion"). This
// coarser bucket is what powers the customer-facing Product Line filter
// when they're browsing "All" brands together, where listing every brand's
// specific line names at once would be an unusably long list.
const LINE_GROUP_OPTIONS = ['Emulsion', 'Enamel', 'Weather Coat', 'General'];

// Fixed brand list for the product form's Brand field — a dropdown instead
// of free text so it always exactly matches the brand names the customer
// site's curated Product Line lists are keyed on (a typo here would quietly
// break that matching). "General" covers paint products that aren't tied
// to one of the three main brands.
const PRODUCT_BRAND_OPTIONS = ['Master Paints', 'Berger Paints', 'Choice Paints', 'General'];

// Fixed packaging options used for the admin "Sort by packaging" filter.
const PACKAGING_FILTER_OPTIONS = ['Quarter', 'Gallon', 'Drummy', 'Dabbi', 'Box', 'Packet'];

// Preset brand choices for the "Add to Group" modal's brand filter. Admins
// can still type a custom brand via the "Other" option.
const GROUP_BRAND_OPTIONS = ['Master Paints', 'Berger Paints', 'Choice Paint', 'General'];

// The admin PUT endpoint (`/api/admin/products/:id`) validates a full
// product record on every save (e.g. it requires `name`), the same way the
// single Add/Edit form does. Several bulk actions below only *intend* to
// change one field (price, in_stock, image_url) and fall back to calling
// this same per-product endpoint one row at a time when there is no bulk
// endpoint available. Sending only `{ price: ... }` (or similar) to an
// endpoint that expects the whole record fails validation with "Product
// name is required" for every single row. This helper rebuilds the full
// payload from the existing product data and merges in just the field(s)
// that actually changed, so partial bulk updates stop failing.
function buildFullProductPayload(product, overrides = {}) {
  return {
    name: product?.name || '',
    brand: product?.brand || '',
    category: product?.category || '',
    sub_category: product?.sub_category || '',
    price: Number(product?.price) || 0,
    description: product?.description || '',
    in_stock: Boolean(product?.in_stock),
    image_url: product?.image_url || '',
    packaging: product?.packaging || '',
    color_code: product?.color_code || '',
    color_name: product?.color_name || '',
    swatch_hex: product?.swatch_hex || '',
    line_group: product?.line_group || '',
    ...overrides
  };
}

function AdminProducts() {
  const { user, isAdmin, loading, login, logout } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Unread orders count — shown as a badge on the "Orders" nav tab above.
  const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadBulkOrdersCount, setUnreadBulkOrdersCount] = useState(0);

  // Products table filter state (Brand -> Product line cascading filter, plus Packaging)
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPackaging, setFilterPackaging] = useState('All');
  // Free-text search — matches product name OR a number (product ID / color code / price)
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection + bulk price update state
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPriceMode, setBulkPriceMode] = useState('increase_percent'); // 'increase_percent' | 'increase_amount' | 'set_amount'
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPriceUpdating, setBulkPriceUpdating] = useState(false);
  const [bulkPriceSummary, setBulkPriceSummary] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState(null);
  const [bulkStockUpdating, setBulkStockUpdating] = useState(false);
  const [bulkStockSummary, setBulkStockSummary] = useState(null);
  const [bulkPhotoForSelectedUploading, setBulkPhotoForSelectedUploading] = useState(false);
  const [bulkPhotoForSelectedSummary, setBulkPhotoForSelectedSummary] = useState(null);

  // ---- Manual Product Groups (named collections: name/description/photo/brand) ----
  // Separate from the existing "Auto-Group Paint Products" variant-linking
  // feature above — a catalog group is an admin-curated collection that any
  // selection of products can be filed into.
  const [catalogGroups, setCatalogGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignBrandFilter, setAssignBrandFilter] = useState('All');
  const [assigningGroupId, setAssigningGroupId] = useState(null);

  const productCountLabel = useMemo(() => `${products.length} product${products.length === 1 ? '' : 's'}`, [products.length]);

  // Unique brand list derived from current products (e.g. Master Paints, Berger Paints, Choice Paints, General)
  const brandOptions = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => (p.brand || '').trim()).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [products]);

  // Unique sub-category ("Sort by") list, scoped to the selected brand (cascading dropdown)
  const categoryOptions = useMemo(() => {
    const scoped = filterBrand === 'All' ? products : products.filter((p) => (p.brand || '').trim() === filterBrand);
    const unique = Array.from(new Set(scoped.map((p) => (p.sub_category || '').trim()).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [products, filterBrand]);

  // Reset the product-line filter whenever the brand changes and the current
  // selection no longer applies to the newly selected brand.
  useEffect(() => {
    if (filterCategory !== 'All' && !categoryOptions.includes(filterCategory)) {
      setFilterCategory('All');
    }
  }, [categoryOptions, filterCategory]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const brandMatch = filterBrand === 'All' || (product.brand || '').trim() === filterBrand;
      const categoryMatch = filterCategory === 'All' || (product.sub_category || '').trim() === filterCategory;
      const packagingMatch =
        filterPackaging === 'All' ||
        (product.packaging || '').trim().toLowerCase() === filterPackaging.toLowerCase();

      // Search box: matches the product name (text) OR any "number" field —
      // product ID, shade/color code, and price — so staff can search either
      // "Synthetic Enamel" or just type a number like "29".
      const searchMatch =
        !query ||
        (product.name || '').toLowerCase().includes(query) ||
        String(product.id ?? '').toLowerCase().includes(query) ||
        String(product.color_code ?? '').toLowerCase().includes(query) ||
        String(product.color_name ?? '').toLowerCase().includes(query) ||
        String(product.price ?? '').toLowerCase().includes(query);

      return brandMatch && categoryMatch && packagingMatch && searchMatch;
    });
  }, [products, filterBrand, filterCategory, filterPackaging, searchQuery]);

  const filteredCountLabel = useMemo(
    () => `${filteredProducts.length} of ${products.length} product${products.length === 1 ? '' : 's'}`,
    [filteredProducts.length, products.length]
  );

  // Brand options for the "Sort by Brand" filter inside the Add to Group
  // modal — derived from groups that actually exist, plus the fixed presets,
  // so the filter is never empty even before any custom-brand groups exist.
  const assignModalBrandOptions = useMemo(() => {
    const fromGroups = catalogGroups.map((g) => (g.brand || '').trim()).filter(Boolean);
    return Array.from(new Set([...GROUP_BRAND_OPTIONS, ...fromGroups])).sort((a, b) => a.localeCompare(b));
  }, [catalogGroups]);

  const filteredAssignGroups = useMemo(() => {
    if (assignBrandFilter === 'All') return catalogGroups;
    return catalogGroups.filter((g) => (g.brand || '').trim() === assignBrandFilter);
  }, [catalogGroups, assignBrandFilter]);

  const handleFilterBrandChange = (value) => {
    setFilterBrand(value);
    setFilterCategory('All');
  };

  const handleClearFilters = () => {
    setFilterBrand('All');
    setFilterCategory('All');
    setFilterPackaging('All');
    setSearchQuery('');
  };

  // ---- Bulk selection + bulk price update ----

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.includes(p.id));
  const someVisibleSelected = filteredProducts.some((p) => selectedIds.includes(p.id));

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkPriceUpdate = async () => {
    const value = Number(bulkPriceValue);
    if (!Number.isFinite(value) || selectedIds.length === 0) {
      setMessage({ type: 'error', text: 'Enter a valid number and select at least one product first.' });
      return;
    }

    if (bulkPriceMode !== 'set_amount' && value <= 0) {
      setMessage({ type: 'error', text: 'Increase value must be greater than 0.' });
      return;
    }

    const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

    // Calculate the new price for every selected product based on the chosen mode
    const updates = selectedProducts.map((p) => {
      const currentPrice = Number(p.price) || 0;
      let newPrice = currentPrice;
      if (bulkPriceMode === 'increase_percent') {
        newPrice = currentPrice + (currentPrice * value) / 100;
      } else if (bulkPriceMode === 'increase_amount') {
        newPrice = currentPrice + value;
      } else if (bulkPriceMode === 'set_amount') {
        newPrice = value;
      }
      return { id: p.id, price: Math.round(newPrice * 100) / 100 };
    });

    setBulkPriceUpdating(true);
    setBulkPriceSummary(null);
    try {
      // Prefer a single bulk endpoint if the backend has one; fall back to per-product PUT calls otherwise.
      let result;
      try {
        result = await api('/api/admin/products/bulk-update-price', { method: 'PUT', body: { updates } });
      } catch (bulkEndpointError) {
        const failed = [];
        let updatedCount = 0;
        for (const update of updates) {
          try {
            // The per-product PUT endpoint validates a full record (it needs
            // `name`, etc.), so we must send the existing product's data
            // merged with the new price — not just { price } on its own.
            const existingProduct = products.find((p) => p.id === update.id);
            const body = buildFullProductPayload(existingProduct, { price: update.price });
            await api(`/api/admin/products/${update.id}`, { method: 'PUT', body });
            updatedCount += 1;
          } catch (rowError) {
            failed.push({ id: update.id, reason: rowError.message || 'Update failed' });
          }
        }
        result = { updatedCount, failed };
      }

      setBulkPriceSummary(result);
      setMessage({ type: 'success', text: `${result.updatedCount ?? updates.length} product price(s) updated.` });
      setBulkPriceValue('');
      clearSelection();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Bulk price update failed' });
    } finally {
      setBulkPriceUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected product(s)? This cannot be undone.`);
    if (!confirmed) return;

    setBulkDeleting(true);
    setBulkDeleteSummary(null);
    try {
      let result;
      try {
        // Prefer a single bulk endpoint if the backend has one
        result = await api('/api/admin/products/bulk-delete', { method: 'DELETE', body: { ids: selectedIds } });
      } catch (bulkEndpointError) {
        // Fall back to deleting one by one if there is no bulk endpoint yet
        const failed = [];
        let deletedCount = 0;
        for (const id of selectedIds) {
          try {
            await api(`/api/admin/products/${id}`, { method: 'DELETE' });
            deletedCount += 1;
          } catch (rowError) {
            failed.push({ id, reason: rowError.message || 'Delete failed' });
          }
        }
        result = { deletedCount, failed };
      }

      setBulkDeleteSummary(result);
      setMessage({ type: 'success', text: `${result.deletedCount ?? selectedIds.length} product(s) deleted.` });
      clearSelection();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Bulk delete failed' });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Mark every selected product as "In stock" in one go (e.g. after new stock arrives)
  const handleBulkMarkInStock = async () => {
    if (selectedIds.length === 0) return;

    setBulkStockUpdating(true);
    setBulkStockSummary(null);
    try {
      let result;
      try {
        // Prefer a single bulk endpoint if the backend has one
        result = await api('/api/admin/products/bulk-update-stock', { method: 'PUT', body: { ids: selectedIds, in_stock: true } });
      } catch (bulkEndpointError) {
        // Fall back to updating one by one if there is no bulk endpoint yet
        const failed = [];
        let updatedCount = 0;
        for (const id of selectedIds) {
          try {
            // Same issue as bulk price: the per-product PUT endpoint needs
            // the full record, so merge in_stock into the existing product
            // instead of sending { in_stock: true } alone.
            const existingProduct = products.find((p) => p.id === id);
            const body = buildFullProductPayload(existingProduct, { in_stock: true });
            await api(`/api/admin/products/${id}`, { method: 'PUT', body });
            updatedCount += 1;
          } catch (rowError) {
            failed.push({ id, reason: rowError.message || 'Update failed' });
          }
        }
        result = { updatedCount, failed };
      }

      setBulkStockSummary(result);
      setMessage({ type: 'success', text: `${result.updatedCount ?? selectedIds.length} product(s) marked in stock.` });
      clearSelection();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Bulk stock update failed' });
    } finally {
      setBulkStockUpdating(false);
    }
  };

  // Upload a single photo and apply it to every currently selected product
  const handleBulkPhotoForSelectedChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (selectedIds.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one product first, then choose a photo.' });
      event.target.value = '';
      return;
    }

    setBulkPhotoForSelectedUploading(true);
    setBulkPhotoForSelectedSummary(null);
    try {
      const uploadResult = await uploadImage(file);
      const imageUrl = uploadResult.url;

      let result;
      try {
        // Prefer a single bulk endpoint if the backend has one
        result = await api('/api/admin/products/bulk-set-image', { method: 'PUT', body: { ids: selectedIds, image_url: imageUrl } });
      } catch (bulkEndpointError) {
        // Fall back to updating one by one if there is no bulk endpoint yet
        const failed = [];
        let updatedCount = 0;
        for (const id of selectedIds) {
          try {
            // Same issue again: send the full existing product record with
            // just image_url overridden, instead of { image_url } alone,
            // otherwise the backend rejects it for missing `name`.
            const existingProduct = products.find((p) => p.id === id);
            const body = buildFullProductPayload(existingProduct, { image_url: imageUrl });
            await api(`/api/admin/products/${id}`, { method: 'PUT', body });
            updatedCount += 1;
          } catch (rowError) {
            failed.push({ id, reason: rowError.message || 'Update failed' });
          }
        }
        result = { updatedCount, failed };
      }

      setBulkPhotoForSelectedSummary(result);
      setMessage({ type: 'success', text: `Photo applied to ${result.updatedCount ?? selectedIds.length} selected product(s).` });
      clearSelection();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Bulk photo upload failed' });
    } finally {
      setBulkPhotoForSelectedUploading(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadCatalogGroups();
      loadUnreadOrdersCount();
      loadUnreadSupportCount();
      loadUnreadBulkOrdersCount();
    }
  }, [isAdmin]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api('/api/products');
      const nextProducts = response || [];
      setProducts(nextProducts);
      const validIds = new Set(nextProducts.map((p) => p.id));
      setSelectedIds((current) => current.filter((id) => validIds.has(id)));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load products' });
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadCatalogGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await fetchCatalogGroups();
      setCatalogGroups(response || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load product groups' });
    } finally {
      setLoadingGroups(false);
    }
  };

  // Powers the badge on the "Orders" nav tab — non-fatal if it fails, the
  // tab just won't show a count.
  const loadUnreadOrdersCount = async () => {
    try {
      const response = await fetchUnreadOrdersCount();
      setUnreadOrdersCount(response?.count ?? response?.unreadCount ?? 0);
    } catch (error) {
      // ignore — badge simply stays hidden
    }
  };

  const loadUnreadSupportCount = async () => {
    try {
      const response = await fetchUnreadSupportTicketsCount();
      setUnreadSupportCount(response?.count ?? 0);
    } catch (error) {
      // ignore — badge simply stays hidden
    }
  };

  const loadUnreadBulkOrdersCount = async () => {
    try {
      const response = await fetchUnreadQuotationRequestsCount();
      setUnreadBulkOrdersCount(response?.count ?? 0);
    } catch (error) {
      // ignore — badge simply stays hidden
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

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const validateForm = (draft) => {
    const nextErrors = {};
    if (!String(draft.name || '').trim()) nextErrors.name = 'Name is required';
    const priceValue = Number(draft.price);
    if (!Number.isFinite(priceValue) || priceValue < 0) nextErrors.price = 'Price must be a valid number';
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      const payload = {
        ...form,
        name: String(form.name).trim(),
        brand: String(form.brand || '').trim(),
        category: String(form.category || '').trim(),
        sub_category: String(form.sub_category || '').trim(),
        description: String(form.description || '').trim(),
        price: Number(form.price),
        in_stock: Boolean(form.in_stock),
        image_url: form.image_url || '',
        packaging: String(form.packaging || '').trim(),
        color_code: String(form.color_code || '').trim(),
        color_name: String(form.color_name || '').trim(),
        swatch_hex: String(form.swatch_hex || '').trim(),
        line_group: String(form.line_group || '').trim()
      };

      if (editingId) {
        await api(`/api/admin/products/${editingId}`, { method: 'PUT', body: payload });
        setMessage({ type: 'success', text: 'Product updated successfully.' });
      } else {
        await api('/api/admin/products', { method: 'POST', body: payload });
        setMessage({ type: 'success', text: 'Product created successfully.' });
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save product' });
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) {
      return;
    }

    try {
      await api(`/api/admin/products/${productId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Product deleted.' });
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to delete product' });
    }
  };

  const handleToggleStock = async (productId, currentStock) => {
    try {
      await api(`/api/admin/products/toggle-stock/${productId}`, { method: 'POST' });
      setMessage({ type: 'success', text: `Product marked as ${currentStock ? 'out of stock' : 'in stock'}.` });
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to update stock status' });
    }
  };

  // ---- Manual Product Groups: "Add to Group" modal (assign selected products) ----

  const openAssignModal = () => {
    if (selectedIds.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one product first, then click Add to Group.' });
      return;
    }
    setAssignBrandFilter('All');
    setShowAssignModal(true);
    loadCatalogGroups();
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
  };

  const handleAssignToGroup = async (groupId) => {
    setAssigningGroupId(groupId);
    try {
      const result = await assignProductsToGroup(groupId, selectedIds);
      setMessage({ type: 'success', text: `${result.assignedCount ?? selectedIds.length} product(s) added to the group.` });
      clearSelection();
      setShowAssignModal(false);
      await loadCatalogGroups();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to assign products to group' });
    } finally {
      setAssigningGroupId(null);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadImage(file);
      setForm((current) => ({ ...current, image_url: result.url }));
      setMessage({ type: 'success', text: 'Image uploaded successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Image upload failed' });
    } finally {
      setUploadingImage(false);
      event.target.value = '';
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
          <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Use your admin credentials to open the edit tools and product manager.</p>
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

  return (
    <div className="min-h-screen animate-fade-in bg-[#FFF9F4] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Helmet><title>Admin Products — Fazal Paint Hardware</title></Helmet>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin workspace</p>
            <h1 className="mt-3 text-2xl font-semibold text-[#4A3527] sm:text-3xl">Product manager</h1>
            <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Create, edit, and remove products from the public catalog. {productCountLabel} currently available.</p>
            <div className="mt-4">
              <AdminSectionNav unreadOrdersCount={unreadOrdersCount} unreadSupportCount={unreadSupportCount} unreadBulkOrdersCount={unreadBulkOrdersCount} />
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

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-[32px] border border-dashed border-[#F3E4D4] bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-[#4A3527]">{editingId ? 'Edit product' : 'Add product'}</h2>
              {editingId ? <span className="rounded-full bg-[#FFF9F4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">Editing</span> : null}
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#4A3527]">Name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                {errors.name ? <p className="mt-1 text-sm text-[var(--color-error)]">{errors.name}</p> : null}
              </div>
              <div className={form.category !== 'Hardware' ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
                {form.category !== 'Hardware' ? (
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Brand</label>
                    <select
                      value={form.brand}
                      onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                    >
                      <option value="">Select brand</option>
                      {PRODUCT_BRAND_OPTIONS.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Department</label>
                  <select
                    value={form.category}
                    onChange={(event) => {
                      const nextCategory = event.target.value;
                      setForm((current) => ({
                        ...current,
                        category: nextCategory,
                        // Brand (Master/Berger/Choice) and Product Type
                        // (Emulsion/Enamel/...) only apply to Paint — clear
                        // them out when switching to Hardware so a stale
                        // value from a previous Paint entry never gets
                        // saved on a hardware product.
                        ...(nextCategory === 'Hardware' ? { brand: '', line_group: '' } : {})
                      }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                  >
                    <option value="">Select department</option>
                    <option value="Paint">Paint</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Paint Additives">Paint Additives</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Sub-Category</label>
                  <input value={form.sub_category} onChange={(event) => setForm((current) => ({ ...current, sub_category: event.target.value }))} placeholder="e.g. Synthetic Enamel" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Packaging</label>
                  <input value={form.packaging} onChange={(event) => setForm((current) => ({ ...current, packaging: event.target.value }))} placeholder="e.g. Quarter, Gallon, Drumi" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                </div>
              </div>
              {form.category !== 'Hardware' ? (
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Product Type</label>
                  <select
                    value={form.line_group}
                    onChange={(event) => setForm((current) => ({ ...current, line_group: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                  >
                    <option value="">Select product type</option>
                    {LINE_GROUP_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[#8A7A6D]">
                    Broad type, separate from Sub-Category — powers the Product Line filter customers see when browsing "All" brands together.
                  </p>
                </div>
              ) : null}
              {form.category !== 'Hardware' ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Color Code</label>
                    <input value={form.color_code} onChange={(event) => setForm((current) => ({ ...current, color_code: event.target.value }))} placeholder="e.g. #7001" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Color Name</label>
                    <input value={form.color_name} onChange={(event) => setForm((current) => ({ ...current, color_name: event.target.value }))} placeholder="e.g. White" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4A3527]">Swatch Hex</label>
                    <input value={form.swatch_hex} onChange={(event) => setForm((current) => ({ ...current, swatch_hex: event.target.value }))} placeholder="e.g. #FFF9F4" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-semibold text-[#4A3527]">Price</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
                {errors.price ? <p className="mt-1 text-sm text-[var(--color-error)]">{errors.price}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#4A3527]">Description</label>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="4" className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm">
                <input type="checkbox" checked={Boolean(form.in_stock)} onChange={(event) => setForm((current) => ({ ...current, in_stock: event.target.checked }))} />
                <span>In stock</span>
              </label>
              <div>
                <label className="block text-sm font-semibold text-[#4A3527]">Photo</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="mt-2 block w-full text-sm text-[#8A7A6D]" />
                {uploadingImage ? <p className="mt-2 text-sm text-[var(--color-accent)]">Uploading image…</p> : null}
                {form.image_url ? <img src={resolveImageUrl(form.image_url)} alt="Selected product preview" className="mt-3 h-24 w-full rounded-2xl object-cover" /> : null}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#A83D24]">{editingId ? 'Save changes' : 'Create product'}</button>
                <button type="button" onClick={resetForm} className="rounded-2xl border border-[#F3E4D4] bg-white px-5 py-3 text-sm font-semibold text-[#4A3527]">Reset</button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-[32px] border border-[#F3E4D4] bg-white shadow-soft">
            <div className="border-b border-[#FFF1E6] p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#4A3527]">Products</h2>
                <span className="rounded-full bg-[#FFF9F4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">{filteredCountLabel}</span>
              </div>

              {/* Free-text search — type a product name or a number (ID / shade
                  code / price) to filter the list below. */}
              <div className="relative mt-4">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B5A594]" />
                <input
                  type="text"
                  inputMode="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or number (e.g. 29 or Synthetic Enamel)"
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

              {/* Brand -> Product line cascading filter, plus a Packaging filter
                  (Quarter / Gallon / Drummy / Dabbi / Box / Packet). */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  value={filterBrand}
                  onChange={(event) => handleFilterBrandChange(event.target.value)}
                  className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-2 text-sm"
                >
                  <option value="All">All Brands</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(event) => setFilterCategory(event.target.value)}
                  className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-2 text-sm"
                  disabled={categoryOptions.length === 0}
                >
                  <option value="All">All Products</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  value={filterPackaging}
                  onChange={(event) => setFilterPackaging(event.target.value)}
                  className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-2 text-sm"
                >
                  <option value="All">All Packaging</option>
                  {PACKAGING_FILTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                {(filterBrand !== 'All' || filterCategory !== 'All' || filterPackaging !== 'All' || searchQuery) ? (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-sm font-semibold text-[#4A3527]"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {/* Bulk price update bar — appears once at least one product is selected */}
              {selectedIds.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                  <span className="text-sm font-semibold text-[#4A3527]">{selectedIds.length} selected</span>

                  <select
                    value={bulkPriceMode}
                    onChange={(event) => setBulkPriceMode(event.target.value)}
                    className="rounded-2xl border border-[#F3E4D4] bg-white px-3 py-2 text-sm"
                  >
                    <option value="increase_percent">Increase by %</option>
                    <option value="increase_amount">Increase by Rs.</option>
                    <option value="set_amount">Set exact price</option>
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPriceValue}
                    onChange={(event) => setBulkPriceValue(event.target.value)}
                    placeholder={bulkPriceMode === 'increase_percent' ? 'e.g. 10' : 'e.g. 200'}
                    className="w-32 rounded-2xl border border-[#F3E4D4] bg-white px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={handleBulkPriceUpdate}
                    disabled={bulkPriceUpdating}
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:opacity-70"
                  >
                    {bulkPriceUpdating ? 'Updating…' : 'Apply to selected'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkMarkInStock}
                    disabled={bulkStockUpdating}
                    className="rounded-2xl bg-[#4E9C79] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2F6B4F] disabled:opacity-70"
                  >
                    {bulkStockUpdating ? 'Updating…' : 'Mark in stock'}
                  </button>

                  <button
                    type="button"
                    onClick={openAssignModal}
                    className="rounded-2xl border border-[var(--color-accent)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-accent)] hover:bg-[#FDE9DC]"
                  >
                    Add to Group
                  </button>

                  <label
                    className={`cursor-pointer rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-sm font-semibold text-[#4A3527] ${bulkPhotoForSelectedUploading ? 'pointer-events-none opacity-70' : ''}`}
                  >
                    {bulkPhotoForSelectedUploading ? 'Uploading…' : 'Upload photo for selected'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleBulkPhotoForSelectedChange}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="rounded-2xl bg-[#D64545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B23A28] disabled:opacity-70"
                  >
                    {bulkDeleting ? 'Deleting…' : 'Delete selected'}
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-sm font-semibold text-[#4A3527]"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}

              {bulkPriceSummary ? (
                <div className="mt-4 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
                  <p className="font-semibold text-[#4A3527]">{bulkPriceSummary.updatedCount} price{bulkPriceSummary.updatedCount === 1 ? '' : 's'} updated.</p>
                  {bulkPriceSummary.failed?.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-semibold text-[var(--color-error)]">{bulkPriceSummary.failed.length} failed:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8A7A6D]">
                        {bulkPriceSummary.failed.map((failure, index) => (
                          <li key={index}>Product #{failure.id}: {failure.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkDeleteSummary ? (
                <div className="mt-4 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
                  <p className="font-semibold text-[#4A3527]">{bulkDeleteSummary.deletedCount} product{bulkDeleteSummary.deletedCount === 1 ? '' : 's'} deleted.</p>
                  {bulkDeleteSummary.failed?.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-semibold text-[var(--color-error)]">{bulkDeleteSummary.failed.length} failed:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8A7A6D]">
                        {bulkDeleteSummary.failed.map((failure, index) => (
                          <li key={index}>Product #{failure.id}: {failure.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkStockSummary ? (
                <div className="mt-4 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
                  <p className="font-semibold text-[#4A3527]">{bulkStockSummary.updatedCount} product{bulkStockSummary.updatedCount === 1 ? '' : 's'} marked in stock.</p>
                  {bulkStockSummary.failed?.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-semibold text-[var(--color-error)]">{bulkStockSummary.failed.length} failed:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8A7A6D]">
                        {bulkStockSummary.failed.map((failure, index) => (
                          <li key={index}>Product #{failure.id}: {failure.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkPhotoForSelectedSummary ? (
                <div className="mt-4 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
                  <p className="font-semibold text-[#4A3527]">Photo applied to {bulkPhotoForSelectedSummary.updatedCount} product{bulkPhotoForSelectedSummary.updatedCount === 1 ? '' : 's'}.</p>
                  {bulkPhotoForSelectedSummary.failed?.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-semibold text-[var(--color-error)]">{bulkPhotoForSelectedSummary.failed.length} failed:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8A7A6D]">
                        {bulkPhotoForSelectedSummary.failed.map((failure, index) => (
                          <li key={index}>Product #{failure.id}: {failure.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {loadingProducts ? (
              <div className="p-6 text-sm text-[#8A7A6D]">Loading products…</div>
            ) : products.length === 0 ? (
              <div className="p-6 text-sm text-[#8A7A6D]">No products yet. Create your first one with the form on the left.</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-sm text-[#8A7A6D]">No products match this filter. Try a different brand or product line, or clear the filter.</div>
            ) : (
              <>
                {/* Desktop / tablet: full data table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#FFF9F4] text-[#8A7A6D]">
                      <tr>
                        <th className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                            }}
                            onChange={toggleSelectAllVisible}
                          />
                        </th>
                        <th className="px-4 py-3">Image</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-t border-[#FFF1E6] align-middle">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(product.id)}
                              onChange={() => toggleSelectOne(product.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {product.image_url ? <img src={resolveImageUrl(product.image_url)} alt={product.name} className="h-14 w-20 rounded-xl object-cover" /> : <div className="flex h-14 w-20 items-center justify-center rounded-xl bg-[#FFF9F4] text-xs text-[#8A7A6D]">No img</div>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#4A3527]">{product.name}</td>
                          <td className="px-4 py-3">{product.brand || '—'}</td>
                          <td className="px-4 py-3">{Number(product.price).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleStock(product.id, product.in_stock)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${product.in_stock ? 'bg-[#EAF6F0] text-[#4E9C79] hover:bg-[#FCEBEA] hover:text-[#D64545]' : 'bg-[#FCEBEA] text-[#D64545] hover:bg-[#EAF6F0] hover:text-[#4E9C79]'}`}
                              title={product.in_stock ? 'Currently in stock — click to mark out of stock' : 'Currently out of stock — click to mark in stock'}
                            >
                              {/* Label is the ACTION the admin can take, not the current status:
                                  in stock -> offer "Out of Stock"; out of stock -> offer "Mark In-Stock" */}
                              {product.in_stock ? 'Out of Stock' : 'Mark In-Stock'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => {
                                setEditingId(product.id);
                                setForm({
                                  name: product.name || '',
                                  brand: product.brand || '',
                                  category: product.category || '',
                                  sub_category: product.sub_category || '',
                                  price: product.price ?? '',
                                  description: product.description || '',
                                  in_stock: Boolean(product.in_stock),
                                  image_url: product.image_url || '',
                                  packaging: product.packaging || '',
                                  color_code: product.color_code || '',
                                  color_name: product.color_name || '',
                                  swatch_hex: product.swatch_hex || '',
                                  line_group: product.line_group || ''
                                });
                                setMessage({ type: '', text: '' });
                              }} className="rounded-2xl border border-[#F3E4D4] bg-white px-3 py-2 text-xs font-semibold text-[#4A3527]">Edit</button>
                              <button type="button" onClick={() => handleDelete(product.id)} className="rounded-2xl bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: stacked cards — the data table above is unusable on a phone
                    (7 columns won't fit), so under md we swap to one card per product
                    with the same actions, sized for thumbs instead of a mouse. */}
                <div className="divide-y divide-[#FFF1E6] md:hidden">
                  <label className="flex items-center gap-3 px-4 py-3 text-sm text-[#8A7A6D]">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      className="h-5 w-5"
                    />
                    Select all visible
                  </label>
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="flex gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelectOne(product.id)}
                        className="mt-1 h-5 w-5 flex-shrink-0"
                      />
                      {product.image_url ? (
                        <img src={resolveImageUrl(product.image_url)} alt={product.name} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF9F4] text-[10px] text-[#8A7A6D]">No img</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#4A3527]">{product.name}</p>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[#8A7A6D]">{product.brand || '—'}</p>
                        <p className="mt-1 text-sm font-semibold text-[#4A3527]">
                          {Number(product.price).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                        </p>
                        <button
                          onClick={() => handleToggleStock(product.id, product.in_stock)}
                          className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors active:scale-95 ${product.in_stock ? 'bg-[#EAF6F0] text-[#4E9C79]' : 'bg-[#FCEBEA] text-[#D64545]'}`}
                        >
                          {product.in_stock ? 'Out of Stock' : 'Mark In-Stock'}
                        </button>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(product.id);
                              setForm({
                                name: product.name || '',
                                brand: product.brand || '',
                                category: product.category || '',
                                sub_category: product.sub_category || '',
                                price: product.price ?? '',
                                description: product.description || '',
                                in_stock: Boolean(product.in_stock),
                                image_url: product.image_url || '',
                                packaging: product.packaging || '',
                                color_code: product.color_code || '',
                                color_name: product.color_name || '',
                                swatch_hex: product.swatch_hex || '',
                                line_group: product.line_group || ''
                              });
                              setMessage({ type: '', text: '' });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex-1 rounded-2xl border border-[#F3E4D4] bg-white px-3 py-2.5 text-xs font-semibold text-[#4A3527] active:scale-[0.97]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="flex-1 rounded-2xl bg-[var(--color-accent)] px-3 py-2.5 text-xs font-semibold text-white active:scale-[0.97]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- "Add to Group" modal (assign currently-selected products) ---- */}
        {showAssignModal ? (
          <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 px-4 py-8">
            <div className="max-h-[90dvh] w-full max-w-lg animate-modal-pop overflow-y-auto rounded-[32px] bg-white p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-[#4A3527]">Add to Group</h2>
                <button type="button" onClick={closeAssignModal} aria-label="Close" className="rounded-full px-2 py-1 text-lg text-[#8A7A6D] hover:bg-[#FFF9F4]">✕</button>
              </div>
              <p className="mt-2 text-sm text-[#8A7A6D]">
                {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected. Choose a group to add {selectedIds.length === 1 ? 'it' : 'them'} to.
              </p>

              {/* Sort/filter by Brand so the right group is easy to find */}
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#8A7A6D]">Sort by Brand</label>
                <select
                  value={assignBrandFilter}
                  onChange={(event) => setAssignBrandFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-2 text-sm"
                >
                  <option value="All">All Brands</option>
                  {assignModalBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {loadingGroups ? (
                  <p className="text-sm text-[#8A7A6D]">Loading groups…</p>
                ) : filteredAssignGroups.length === 0 ? (
                  <p className="text-sm text-[#8A7A6D]">No groups match this brand yet.</p>
                ) : (
                  filteredAssignGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-3 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-3 py-2">
                      {group.image_url ? (
                        <img src={resolveImageUrl(group.image_url)} alt={group.name} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[10px] text-[#8A7A6D]">No img</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#4A3527]">{group.name}</p>
                        <p className="text-xs text-[#8A7A6D]">{group.brand || 'General'} · {group.product_count} product{Number(group.product_count) === 1 ? '' : 's'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssignToGroup(group.id)}
                        disabled={assigningGroupId === group.id}
                        className="rounded-2xl bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[#A83D24] disabled:opacity-70"
                      >
                        {assigningGroupId === group.id ? 'Adding…' : 'Assign'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <NavLink
                  to="/admin/tools"
                  onClick={() => setShowAssignModal(false)}
                  className="flex items-center gap-1 rounded-2xl border border-[#F3E4D4] bg-white px-4 py-3 text-sm font-semibold text-[#4A3527]"
                >
                  <Plus size={14} /> Create new group in Tools
                </NavLink>
                <button type="button" onClick={closeAssignModal} className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-3 text-sm font-semibold text-[#4A3527]">
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdminProducts;