import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Generic list+detail+reply panel for both "Support" (complaints/
// suggestions) and "Bulk Orders" admin pages — they're structurally the
// same feature (customer submits something, admin reads it and replies),
// just with different field names, so this one component powers both.
function RequestManager({
  fetchList,
  markViewed,
  updateItem,
  statusOptions,
  replyFieldKey, // 'adminReply' | 'adminQuote' — key sent to updateItem
  replyLabel, // 'Reply' | 'Quote'
  getSummary, // (item) => short title line
  getBody, // (item) => full message/details text
  getBadge, // (item) => small label string or null (e.g. "Complaint"/"Suggestion")
  getExtraLine, // (item) => optional secondary line (e.g. invoice #, quantity)
  getReplyValue, // (item) => existing reply text
  emptyMessage
}) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchList()
      .then((rows) => setItems(rows || []))
      .catch((err) => setError(err.message || 'Unable to load requests'));

  useEffect(() => { load(); }, []);

  const selected = items?.find((item) => item.id === selectedId) || null;

  const openItem = async (item) => {
    setSelectedId(item.id);
    setReplyDraft(getReplyValue(item) || '');
    setStatusDraft(item.status);
    if (!item.viewed_by_admin) {
      try {
        await markViewed(item.id);
        setItems((current) => current.map((row) => (row.id === item.id ? { ...row, viewed_by_admin: 1 } : row)));
      } catch {
        // non-fatal — pending badge just won't flip immediately
      }
    }
  };

  const handleSaveReply = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateItem(selected.id, { status: statusDraft, [replyFieldKey]: replyDraft, viewed_by_admin: 1 });
      setItems((current) => current.map((row) => (row.id === selected.id ? { ...row, ...updated, viewed_by_admin: 1 } : row)));
    } catch (err) {
      setError(err.message || 'Unable to save reply');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-[var(--color-error)]">{error}</p>;
  if (!items) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#8A7A6D]">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-[#8A7A6D]">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            className={`w-full rounded-2xl border p-4 text-left transition-colors ${
              selectedId === item.id ? 'border-[var(--color-accent)] bg-[#FFF3EA]' : 'border-[#F3E4D4] bg-white hover:bg-[#FFF9F4]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {getBadge(item) ? (
                  <span className="mb-1 inline-block rounded-full bg-[#F3E4D4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4A3527]">
                    {getBadge(item)}
                  </span>
                ) : null}
                <p className="truncate text-sm font-semibold text-[#4A3527]">{getSummary(item)}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[#8A7A6D]">
                  <Mail size={11} /> {item.user_email}
                </p>
              </div>
              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                item.viewed_by_admin ? 'bg-[#E4F5E9] text-[#2F8F53]' : 'bg-[var(--color-accent)] text-white'
              }`}>
                {item.viewed_by_admin ? 'Received' : 'Pending'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#8A7A6D]">{formatDate(item.created_at)}</p>
          </button>
        ))}
      </div>

      <div>
        {!selected ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[#F3E4D4] p-6 text-center text-sm text-[#8A7A6D]">
            Ek request select karein detail dekhne ke liye
          </div>
        ) : (
          <div className="rounded-2xl border border-[#F3E4D4] bg-white p-5">
            {getBadge(selected) ? (
              <span className="mb-2 inline-block rounded-full bg-[#F3E4D4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4A3527]">
                {getBadge(selected)}
              </span>
            ) : null}
            <h3 className="text-base font-semibold text-[#4A3527]">{getSummary(selected)}</h3>
            <p className="mt-1 text-xs text-[#8A7A6D]">{selected.user_email} · {formatDate(selected.created_at)}</p>
            {getExtraLine(selected) ? <p className="mt-2 text-sm text-[#8A7A6D]">{getExtraLine(selected)}</p> : null}
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#FFF9F4] p-3 text-sm text-[#4A3527]">{getBody(selected)}</p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A6D]">Status</label>
              <select
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
                className="w-full rounded-xl border border-[#F3E4D4] bg-[#FFF9F4] px-3 py-2 text-sm font-semibold text-[#4A3527]"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A6D]">{replyLabel} (customer ko website par nazar aayega)</label>
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[#F3E4D4] bg-[#FFF9F4] px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveReply}
              disabled={saving}
              className="mt-4 w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save & Send Reply'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestManager;
