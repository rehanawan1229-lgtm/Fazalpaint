import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import AdminSectionNav from '../components/AdminSectionNav';
import {
  api,
  uploadImage,
  resolveImageUrl,
  fetchCatalogGroups,
  createCatalogGroup,
  deleteCatalogGroup,
  fetchUnreadOrdersCount,
  fetchUnreadSupportTicketsCount,
  fetchUnreadQuotationRequestsCount,
  fetchCategoryVisibility,
  updateCategoryVisibility,
  fetchCategoryOrder,
  updateCategoryOrder
} from '../lib/adminApi';

// Preset brand choices for the "Add Group" modal's Brand field. Admins can
// still type a custom brand via the "Other" option.
const GROUP_BRAND_OPTIONS = ['Master Paints', 'Berger Paints', 'Choice Paint', 'General'];

// ---- Bulk Excel Import helpers ----

const EXCEL_COLUMN_MAP = {
  name: 'name',
  brand: 'brand',
  category: 'category',
  'sub category': 'sub_category',
  subcategory: 'sub_category',
  packaging: 'packaging',
  'color code': 'color_code',
  colorcode: 'color_code',
  'color name': 'color_name',
  colorname: 'color_name',
  'swatch hex': 'swatch_hex',
  swatchhex: 'swatch_hex',
  price: 'price',
  description: 'description',
  'in stock': 'in_stock',
  instock: 'in_stock'
};

// Fields the admin can map an Excel column to. `required: true` fields must
// be mapped (or have a value) before the import can proceed.
const IMPORT_FIELD_DEFINITIONS = [
  { key: 'name', label: 'Item Name', required: true },
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Department / Category' },
  { key: 'sub_category', label: 'Sub-Category' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'color_code', label: 'Color Code' },
  { key: 'color_name', label: 'Color Name' },
  { key: 'swatch_hex', label: 'Swatch Hex' },
  { key: 'price', label: 'Price', required: true },
  { key: 'description', label: 'Description' },
  { key: 'in_stock', label: 'In Stock' }
];

function parseInStockValue(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'in stock'].includes(text)) return true;
  if (['false', '0', 'no', 'out of stock', ''].includes(text)) return false;
  return true;
}

// Given the raw Excel headers, guess which header best matches each DB field.
// This is only ever used as a *suggestion* — the admin must confirm (or
// change) every mapping via the dropdowns before rows are generated.
function guessColumnMapping(headers) {
  const guess = {};
  headers.forEach((header) => {
    const cleanKey = String(header).trim().toLowerCase();
    const mappedField = EXCEL_COLUMN_MAP[cleanKey];
    if (mappedField && !guess[mappedField]) {
      guess[mappedField] = header;
    }
  });

  // Ensure every field key exists (even if unmapped) so the UI has a
  // predictable shape to render dropdowns from.
  const complete = {};
  IMPORT_FIELD_DEFINITIONS.forEach((field) => {
    complete[field.key] = guess[field.key] || '';
  });
  return complete;
}

// Build the normalized row objects used for preview + import, based on the
// user-confirmed column mapping (not a silent auto-guess).
function applyColumnMapping(rawRows, mapping) {
  return rawRows
    .map((rawRow) => {
      const getValue = (fieldKey) => {
        const header = mapping[fieldKey];
        if (!header) return '';
        return rawRow[header];
      };

      const row = {
        name: String(getValue('name') ?? '').trim(),
        brand: String(getValue('brand') ?? '').trim(),
        category: String(getValue('category') ?? '').trim(),
        sub_category: String(getValue('sub_category') ?? '').trim(),
        packaging: String(getValue('packaging') ?? '').trim(),
        color_code: String(getValue('color_code') ?? '').trim(),
        color_name: String(getValue('color_name') ?? '').trim(),
        swatch_hex: String(getValue('swatch_hex') ?? '').trim(),
        price: (() => {
          const raw = getValue('price');
          return raw === '' || raw === undefined ? '' : Number(raw);
        })(),
        description: String(getValue('description') ?? '').trim(),
        in_stock: parseInStockValue(getValue('in_stock'))
      };
      return row;
    })
    .filter((row) => row.name || row.price !== '');
}

function isExcelRowValid(row) {
  const priceValue = Number(row.price);
  return Boolean(row.name) && Number.isFinite(priceValue) && priceValue >= 0;
}

function AdminTools() {
  const { user, isAdmin, loading, login, logout } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Unread counts — shown as badges on the Orders/Support/Bulk Orders nav tabs above.
  const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadBulkOrdersCount, setUnreadBulkOrdersCount] = useState(0);

  // Paint/Hardware show-hide eye toggle — { Paint: true, Hardware: true }
  // by default (nothing hidden until the admin flips one off).
  const [categoryVisibility, setCategoryVisibility] = useState({});
  const [togglingCategory, setTogglingCategory] = useState(null);

  // Display order for those same departments — the up/down arrows in the
  // Category Visibility panel move a row within this list.
  const [categoryOrder, setCategoryOrder] = useState(['Paint', 'Hardware', 'Paint Additives']);
  const [reorderingCategory, setReorderingCategory] = useState(null);

  // Email Order Parser
  const [emailContent, setEmailContent] = useState('');
  const [parsedItems, setParsedItems] = useState(null);
  const [parsingEmail, setParsingEmail] = useState(false);

  // ---- Manual Product Groups (named collections: name/description/photo/brand) ----
  const [catalogGroups, setCatalogGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', image_url: '', image_urls: [], brand: GROUP_BRAND_OPTIONS[0], customBrand: '' });
  const [groupFormBrandMode, setGroupFormBrandMode] = useState('preset'); // 'preset' | 'custom'
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  // Bulk Excel Import state
  const [excelFileName, setExcelFileName] = useState('');
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelRawRows, setExcelRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState(null);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelImportSummary, setExcelImportSummary] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadCatalogGroups();
      loadUnreadOrdersCount();
      loadUnreadSupportCount();
      loadUnreadBulkOrdersCount();
      loadCategoryVisibility();
      loadCategoryOrder();
    }
  }, [isAdmin]);

  // Needed for the Category Visibility product counts and for the Bulk
  // Excel Import "Export All Products" button.
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api('/api/products');
      setProducts(response || []);
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

  const loadCategoryVisibility = async () => {
    try {
      const response = await fetchCategoryVisibility();
      setCategoryVisibility(response || {});
    } catch (error) {
      // ignore — defaults to everything visible, same as if nothing was ever hidden
    }
  };

  const loadCategoryOrder = async () => {
    try {
      const response = await fetchCategoryOrder();
      if (response?.order?.length) setCategoryOrder(response.order);
    } catch (error) {
      // ignore — defaults to Paint / Hardware / Paint Additives, same as before this existed
    }
  };

  // Swaps a department with its neighbor above ('up') or below ('down') and
  // saves the full new order. Updates the list on screen immediately, then
  // persists — if the save fails, the row snaps back to its old position so
  // the screen never shows an order that isn't actually saved.
  const handleMoveCategory = async (category, direction) => {
    const fromIndex = categoryOrder.indexOf(category);
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= categoryOrder.length) return;

    const previousOrder = categoryOrder;
    const nextOrder = [...categoryOrder];
    [nextOrder[fromIndex], nextOrder[toIndex]] = [nextOrder[toIndex], nextOrder[fromIndex]];

    setReorderingCategory(category);
    setCategoryOrder(nextOrder);
    try {
      await updateCategoryOrder(nextOrder);
    } catch (error) {
      setCategoryOrder(previousOrder);
      setMessage({ type: 'error', text: error.message || `Unable to move ${category}` });
    } finally {
      setReorderingCategory(null);
    }
  };

  // Flips a whole department (Paint/Hardware) show/hide. This only ever
  // updates a settings flag on the server — no product is touched, edited,
  // or deleted, so clicking the eye back on always brings every product in
  // that department back exactly as it was, instantly.
  const handleToggleCategoryVisibility = async (category, nextVisible) => {
    setTogglingCategory(category);
    try {
      await updateCategoryVisibility(category, nextVisible);
      setCategoryVisibility((current) => ({ ...current, [category]: nextVisible }));
      setMessage({
        type: 'success',
        text: nextVisible
          ? `${category} is visible to customers again.`
          : `${category} is now hidden from customers. Nothing was deleted — unhide it anytime to bring it all back.`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || `Unable to update ${category} visibility` });
    } finally {
      setTogglingCategory(null);
    }
  };

  const handleParseEmail = async () => {
    if (!emailContent.trim()) {
      setMessage({ type: 'error', text: 'Please paste email content to parse' });
      return;
    }

    setParsingEmail(true);
    try {
      const result = await api('/api/admin/parse-order-email', {
        method: 'POST',
        body: { emailContent }
      });
      setParsedItems(result);
      setMessage({ type: 'success', text: `Parsed ${result.itemCount} items from email` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to parse email' });
    } finally {
      setParsingEmail(false);
    }
  };

  // ---- Manual Product Groups: "Add Group" modal ----

  const resetGroupForm = () => {
    setGroupForm({ name: '', description: '', image_url: '', image_urls: [], brand: GROUP_BRAND_OPTIONS[0], customBrand: '' });
    setGroupFormBrandMode('preset');
    setGroupFormError('');
  };

  const openCreateGroupModal = () => {
    resetGroupForm();
    setShowCreateGroupModal(true);
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupModal(false);
  };

  const handleGroupBrandSelect = (value) => {
    if (value === '__custom__') {
      setGroupFormBrandMode('custom');
    } else {
      setGroupFormBrandMode('preset');
      setGroupForm((current) => ({ ...current, brand: value }));
    }
  };

  const handleGroupImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setGroupImageUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const result = await uploadImage(file);
        uploaded.push(result.url);
      }
      setGroupForm((current) => {
        const nextUrls = [...current.image_urls, ...uploaded];
        return { ...current, image_urls: nextUrls, image_url: current.image_url || nextUrls[0] };
      });
    } catch (error) {
      setGroupFormError(error.message || 'Image upload failed');
    } finally {
      setGroupImageUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveGroupImage = (urlToRemove) => {
    setGroupForm((current) => {
      const nextUrls = current.image_urls.filter((url) => url !== urlToRemove);
      return { ...current, image_urls: nextUrls, image_url: nextUrls[0] || '' };
    });
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    const resolvedBrand = groupFormBrandMode === 'custom' ? groupForm.customBrand.trim() : groupForm.brand;

    if (!groupForm.name.trim()) {
      setGroupFormError('Group name is required.');
      return;
    }
    if (!resolvedBrand) {
      setGroupFormError('Please choose or enter a brand.');
      return;
    }

    setGroupFormError('');
    setCreatingGroup(true);
    try {
      await createCatalogGroup({
        name: groupForm.name.trim(),
        description: groupForm.description.trim(),
        image_url: groupForm.image_url,
        image_urls: groupForm.image_urls,
        brand: resolvedBrand
      });
      setMessage({ type: 'success', text: 'Product group created.' });
      setShowCreateGroupModal(false);
      resetGroupForm();
      await loadCatalogGroups();
    } catch (error) {
      setGroupFormError(error.message || 'Unable to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Deletes only the named collection — the products that were filed into
  // it stay exactly where they are in the catalog, untouched.
  const handleDeleteGroup = async (group) => {
    const confirmed = window.confirm(
      `Delete the "${group.name}" group? This only removes the collection — its ${group.product_count} product(s) will stay in your catalog.`
    );
    if (!confirmed) return;

    setDeletingGroupId(group.id);
    try {
      await deleteCatalogGroup(group.id);
      setCatalogGroups((current) => current.filter((g) => g.id !== group.id));
      setMessage({ type: 'success', text: `"${group.name}" group deleted.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to delete group' });
    } finally {
      setDeletingGroupId(null);
    }
  };

  // ---- Bulk Excel Import handlers ----

  // Step 1: read the file, detect headers, and produce a *guessed* mapping.
  // Nothing is imported yet — the admin must review/confirm the mapping first.
  const handleExcelFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setExcelImportSummary(null);
    setExcelRows([]);
    setMappingConfirmed(false);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) {
          setExcelHeaders([]);
          setExcelRawRows([]);
          setColumnMapping(null);
          setMessage({ type: 'error', text: 'That file has no rows. Please check the file and try again.' });
          return;
        }

        const headers = Object.keys(rawRows[0]);
        setExcelHeaders(headers);
        setExcelRawRows(rawRows);
        setColumnMapping(guessColumnMapping(headers));
        setMessage({ type: '', text: '' });
      } catch (error) {
        setExcelHeaders([]);
        setExcelRawRows([]);
        setColumnMapping(null);
        setMessage({ type: 'error', text: 'Could not read that file. Please use the Excel template format.' });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleMappingFieldChange = (fieldKey, headerValue) => {
    setColumnMapping((current) => ({ ...current, [fieldKey]: headerValue }));
  };

  // Step 2: admin has reviewed/adjusted the mapping and confirms it. Only now
  // do we actually build the preview rows used for import.
  const handleConfirmMapping = () => {
    const missingRequired = IMPORT_FIELD_DEFINITIONS.filter(
      (field) => field.required && !columnMapping?.[field.key]
    );

    if (missingRequired.length > 0) {
      setMessage({
        type: 'error',
        text: `Please map a column for: ${missingRequired.map((f) => f.label).join(', ')} before continuing.`
      });
      return;
    }

    const rows = applyColumnMapping(excelRawRows, columnMapping);
    setExcelRows(rows);
    setMappingConfirmed(true);

    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No usable rows found with this mapping. Please check your selections.' });
    } else {
      setMessage({ type: '', text: '' });
    }
  };

  const handleChangeMapping = () => {
    setMappingConfirmed(false);
    setExcelRows([]);
    setExcelImportSummary(null);
  };

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Brand', 'Category', 'Sub Category', 'Packaging', 'Color Code', 'Color Name', 'Swatch Hex', 'Price', 'Description', 'In Stock'];
    const exampleRow = ['Master Wall Putty', 'Master Paint', 'Putty', 'Wall Putty', '20kg Bag', 'WP-01', 'White', '#FFF9F4', '1450', 'Premium interior wall putty', 'TRUE'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    worksheet['!cols'] = headers.map(() => ({ wch: 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'fazal-paint-product-template.xlsx');
  };

  // Exports every product currently loaded (all brands/categories — paint,
  // hardware, everything), sorted Category -> Brand -> Sub-Category -> Name
  // so the file reads in a sensible, organized order. Uses the same column
  // layout as the import template, so the exported file can be re-imported
  // later if needed.
  const handleExportProducts = () => {
    const headers = ['Name', 'Brand', 'Category', 'Sub Category', 'Packaging', 'Color Code', 'Color Name', 'Swatch Hex', 'Price', 'Description', 'In Stock'];

    const sorted = [...products].sort((a, b) => {
      const category = (a.category || '').trim().localeCompare((b.category || '').trim());
      if (category !== 0) return category;

      const brand = (a.brand || '').trim().localeCompare((b.brand || '').trim());
      if (brand !== 0) return brand;

      const subCategory = (a.sub_category || '').trim().localeCompare((b.sub_category || '').trim());
      if (subCategory !== 0) return subCategory;

      return (a.name || '').trim().localeCompare((b.name || '').trim());
    });

    const rows = sorted.map((product) => [
      product.name || '',
      product.brand || '',
      product.category || '',
      product.sub_category || '',
      product.packaging || '',
      product.color_code || '',
      product.color_name || '',
      product.swatch_hex || '',
      product.price ?? '',
      product.description || '',
      product.in_stock ? 'TRUE' : 'FALSE'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = headers.map(() => ({ wch: 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `fazal-paint-products-export-${dateStamp}.xlsx`);
  };

  const handleClearExcel = () => {
    setExcelFileName('');
    setExcelHeaders([]);
    setExcelRawRows([]);
    setColumnMapping(null);
    setMappingConfirmed(false);
    setExcelRows([]);
    setExcelImportSummary(null);
  };

  const handleConfirmImport = async () => {
    if (excelRows.length === 0) return;

    setExcelImporting(true);
    setExcelImportSummary(null);
    try {
      const result = await api('/api/admin/products/bulk-import', { method: 'POST', body: { rows: excelRows } });
      setExcelImportSummary(result);
      setMessage({ type: 'success', text: `${result.insertedCount} product(s) imported.` });
      handleClearExcel();
      await loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Bulk import failed' });
    } finally {
      setExcelImporting(false);
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
      <Helmet><title>Admin Tools — Fazal Paint Hardware</title></Helmet>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin workspace</p>
            <h1 className="mt-3 text-2xl font-semibold text-[#4A3527] sm:text-3xl">Tools</h1>
            <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Category visibility, order-email parsing, group collections, and bulk product import/export.</p>
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Category Visibility — eye toggle to show/hide a whole
              department from the public catalog without deleting any product */}
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-[#4A3527]">Category Visibility</h2>
            <p className="mt-2 text-sm text-[#8A7A6D]">
              Hide a department from customers without deleting anything. Every product stays saved and comes right back the moment you unhide it.
            </p>
            <p className="mt-1 text-xs text-[#8A7A6D]">Use the arrows to change the order departments appear in on the Products page.</p>
            <div className="mt-4 space-y-3">
              {categoryOrder.map((category, index) => {
                const isVisible = categoryVisibility[category] !== false;
                const count = products.filter((p) => (p.category || '').trim() === category).length;
                const isFirst = index === 0;
                const isLast = index === categoryOrder.length - 1;
                return (
                  <div key={category} className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF9F4] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex flex-shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(category, 'up')}
                          disabled={isFirst || reorderingCategory !== null}
                          title={`Move ${category} up`}
                          className="flex h-5 w-5 items-center justify-center rounded text-[#8A7A6D] hover:bg-[#F3E4D4] hover:text-[#4A3527] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(category, 'down')}
                          disabled={isLast || reorderingCategory !== null}
                          title={`Move ${category} down`}
                          className="flex h-5 w-5 items-center justify-center rounded text-[#8A7A6D] hover:bg-[#F3E4D4] hover:text-[#4A3527] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#4A3527]">{category}</p>
                        <p className="text-xs text-[#8A7A6D]">
                          {count} product{count === 1 ? '' : 's'} · {isVisible ? 'Visible to customers' : 'Hidden from customers'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryVisibility(category, !isVisible)}
                      disabled={togglingCategory === category}
                      title={isVisible ? `Hide ${category} from the public catalog` : `Show ${category} on the public catalog`}
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isVisible
                          ? 'bg-[#EAF6F0] text-[#4E9C79] hover:bg-[#FCEBEA] hover:text-[#D64545]'
                          : 'bg-[#FCEBEA] text-[#D64545] hover:bg-[#EAF6F0] hover:text-[#4E9C79]'
                      }`}
                    >
                      {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Email Order Parser */}
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-[#4A3527]">Email Order Parser</h2>
            <p className="mt-2 text-sm text-[#8A7A6D]">Paste raw email content to extract and format ordered items as a numbered list.</p>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Paste email body here..."
              rows={5}
              className="mt-4 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm font-mono"
            />
            <button
              onClick={handleParseEmail}
              disabled={parsingEmail}
              className="mt-4 w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:opacity-70"
            >
              {parsingEmail ? 'Parsing...' : 'Parse Email'}
            </button>
            {parsedItems && (
              <div className="mt-4 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
                <p className="font-semibold text-[#4A3527]">Formatted Items ({parsedItems.itemCount}):</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-[#8A7A6D]">{parsedItems.formattedList}</pre>
              </div>
            )}
          </div>

          {/* Group Collections — manual "Add Group" feature. Products are
              filed into a group from the Products page (select rows in the
              table there, then click "Add to Group"); this card is for
              creating/naming/deleting the collections themselves. */}
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#4A3527]">Group Collections</h2>
              <button
                type="button"
                onClick={openCreateGroupModal}
                className="flex items-center gap-1 rounded-2xl bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[#A83D24]"
              >
                <Plus size={14} /> Add Group
              </button>
            </div>
            <p className="mt-2 text-sm text-[#8A7A6D]">
              Create a named collection (e.g. "Berger Weathercoat Range") with its own photo and brand. To file products into it, go to the Products page, select them in the table, then click "Add to Group".
            </p>

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
              {loadingGroups ? (
                <p className="text-xs text-[#8A7A6D]">Loading groups…</p>
              ) : catalogGroups.length === 0 ? (
                <p className="text-xs text-[#8A7A6D]">No groups yet — click "Add Group" to create one.</p>
              ) : (
                catalogGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-3 rounded-2xl bg-[#FFF9F4] px-3 py-2">
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
                      onClick={() => handleDeleteGroup(group)}
                      disabled={deletingGroupId === group.id}
                      title="Delete this group (products stay in your catalog)"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[#D64545] transition-colors hover:bg-[#FCEBEA] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stock Management Info */}
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-[#4A3527]">Stock Management</h2>
            <p className="mt-2 text-sm text-[#8A7A6D]">Toggle product availability from the product table on the Products page. Out-of-stock items will show a label on the frontend and disable the Add to Cart button.</p>
            <div className="mt-6 space-y-2 rounded-2xl bg-[#FFF9F4] p-4 text-xs text-[#8A7A6D]">
              <p>✓ Click stock status to toggle immediately</p>
              <p>✓ Changes appear on frontend instantly</p>
              <p>✓ Shows "Out of Stock" overlay on product cards</p>
            </div>
          </div>
        </div>

        {/* Bulk Excel Import */}
        <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#4A3527]">Bulk Excel Import</h2>
              <p className="mt-2 text-sm text-[#8A7A6D]">Upload an Excel/CSV file, confirm which column maps to which field, then review the preview before importing.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleExportProducts} className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm font-semibold text-[#4A3527]">
                Export All Products
              </button>
              <button type="button" onClick={handleDownloadTemplate} className="rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm font-semibold text-[#4A3527]">
                Download Excel Template
              </button>
              <label className="cursor-pointer rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24]">
                Choose File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFileChange} className="hidden" />
              </label>
            </div>
          </div>

          {excelFileName ? (
            <p className="mt-4 text-sm text-[#8A7A6D]">Selected file: <span className="font-semibold text-[#4A3527]">{excelFileName}</span></p>
          ) : null}

          {/* STEP 1 — Column mapping. Shown right after a file is chosen, before
              any rows are generated. The admin must confirm every mapping. */}
          {excelHeaders.length > 0 && !mappingConfirmed ? (
            <div className="mt-6 rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] p-4 sm:p-6">
              <p className="text-sm font-semibold text-[#4A3527]">Step 1 — Confirm column mapping</p>
              <p className="mt-1 text-xs text-[#8A7A6D]">
                We've guessed a match for each field below based on your column headers — but nothing is imported yet.
                Please check every dropdown and correct any that are wrong before continuing.
              </p>

              <div className="mt-4 space-y-3">
                {IMPORT_FIELD_DEFINITIONS.map((field) => (
                  <div key={field.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[220px_1fr]">
                    <label className="text-sm font-semibold text-[#4A3527]">
                      {field.required ? <span className="mr-1 text-[var(--color-accent)]">★</span> : null}
                      {field.label}
                      {field.required ? <span className="text-[var(--color-error)]"> *</span> : null}
                    </label>
                    <select
                      value={columnMapping?.[field.key] || ''}
                      onChange={(event) => handleMappingFieldChange(field.key, event.target.value)}
                      className="w-full rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-sm"
                    >
                      <option value="">— Skip / Use default —</option>
                      {excelHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={handleConfirmMapping} className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24]">
                  Confirm Mapping &amp; Preview
                </button>
                <button type="button" onClick={handleClearExcel} className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-3 text-sm font-semibold text-[#4A3527]">
                  Cancel
                </button>
              </div>
              <p className="mt-3 text-xs text-[#8A7A6D]">* Item Name and Price must be mapped before you can continue.</p>
            </div>
          ) : null}

          {/* STEP 2 — Preview, generated only after the mapping is confirmed. */}
          {mappingConfirmed && excelRows.length > 0 ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#4A3527]">Step 2 — Preview — {excelRows.length} row{excelRows.length === 1 ? '' : 's'} found</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleChangeMapping} className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-xs font-semibold text-[#4A3527]">
                    Change Mapping
                  </button>
                  <button type="button" onClick={handleConfirmImport} disabled={excelImporting} className="rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[#A83D24] disabled:opacity-70">
                    {excelImporting ? 'Importing…' : 'Confirm Import'}
                  </button>
                  <button type="button" onClick={handleClearExcel} className="rounded-2xl border border-[#F3E4D4] bg-white px-4 py-2 text-xs font-semibold text-[#4A3527]">
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-[#FFF1E6]">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#FFF9F4] text-[#8A7A6D]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Brand</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Sub Category</th>
                      <th className="px-3 py-2">Packaging</th>
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">In Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelRows.map((row, index) => (
                      <tr key={index} className={`border-t border-[#FFF1E6] ${isExcelRowValid(row) ? '' : 'bg-[#FCEBEA]'}`}>
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2">{isExcelRowValid(row) ? '✓ Ready' : '⚠ Check'}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.brand}</td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{row.sub_category}</td>
                        <td className="px-3 py-2">{row.packaging}</td>
                        <td className="px-3 py-2">{row.color_name}</td>
                        <td className="px-3 py-2">{row.price}</td>
                        <td className="max-w-[160px] truncate px-3 py-2" title={row.description}>{row.description}</td>
                        <td className="px-3 py-2">{row.in_stock ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {excelImportSummary ? (
            <div className="mt-6 rounded-2xl bg-[#FFF9F4] p-4 text-sm">
              <p className="font-semibold text-[#4A3527]">Import finished — {excelImportSummary.insertedCount} product{excelImportSummary.insertedCount === 1 ? '' : 's'} added.</p>
              {excelImportSummary.skippedRows?.length > 0 ? (
                <div className="mt-3">
                  <p className="font-semibold text-[var(--color-error)]">{excelImportSummary.skippedRows.length} row{excelImportSummary.skippedRows.length === 1 ? '' : 's'} skipped:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8A7A6D]">
                    {excelImportSummary.skippedRows.map((skip, index) => (
                      <li key={index}>Row {skip.row - 1} (matches # in the preview table above): {skip.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ---- "Add Group" modal ---- */}
        {showCreateGroupModal ? (
          <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 px-4 py-8">
            <div className="max-h-[90dvh] w-full max-w-lg animate-modal-pop overflow-y-auto rounded-[32px] bg-white p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-[#4A3527]">Add Group</h2>
                <button type="button" onClick={closeCreateGroupModal} aria-label="Close" className="rounded-full px-2 py-1 text-lg text-[#8A7A6D] hover:bg-[#FFF9F4]">✕</button>
              </div>

              <form onSubmit={handleCreateGroup} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Group Name</label>
                  <input
                    value={groupForm.name}
                    onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Berger Weathercoat Range"
                    className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Group Description</label>
                  <textarea
                    value={groupForm.description}
                    onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))}
                    rows="3"
                    placeholder="Short description shown on the group's catalog page"
                    className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Brand</label>
                  <select
                    value={groupFormBrandMode === 'custom' ? '__custom__' : groupForm.brand}
                    onChange={(event) => handleGroupBrandSelect(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                  >
                    {GROUP_BRAND_OPTIONS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                    <option value="__custom__">Other (type below)…</option>
                  </select>
                  {groupFormBrandMode === 'custom' ? (
                    <input
                      value={groupForm.customBrand}
                      onChange={(event) => setGroupForm((current) => ({ ...current, customBrand: event.target.value }))}
                      placeholder="Enter brand name"
                      className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm"
                    />
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#4A3527]">Group Photos</label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleGroupImageUpload} className="mt-2 block w-full text-sm text-[#8A7A6D]" />
                  {groupImageUploading ? <p className="mt-2 text-sm text-[var(--color-accent)]">Uploading image…</p> : null}
                  {groupForm.image_urls.length > 0 ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {groupForm.image_urls.map((url) => (
                        <div key={url} className="relative">
                          <img src={resolveImageUrl(url)} alt="Group preview" className="h-16 w-full rounded-xl object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupImage(url)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-error)] text-[10px] font-bold text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {groupFormError ? <p className="text-sm text-[var(--color-error)]">{groupFormError}</p> : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="submit" disabled={creatingGroup} className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:opacity-70">
                    {creatingGroup ? 'Creating…' : 'Create Group'}
                  </button>
                  <button type="button" onClick={closeCreateGroupModal} className="rounded-2xl border border-[#F3E4D4] bg-white px-5 py-3 text-sm font-semibold text-[#4A3527]">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdminTools;
