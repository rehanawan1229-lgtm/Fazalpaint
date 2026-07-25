import { Helmet } from 'react-helmet-async';
import AdminGate from '../components/AdminGate';
import AdminSectionNav from '../components/AdminSectionNav';
import RequestManager from '../components/admin/RequestManager';
import {
  fetchAdminQuotationRequests,
  markQuotationRequestViewed,
  updateAdminQuotationRequest
} from '../lib/adminApi';

function AdminBulkOrders() {
  return (
    <AdminGate title="Admin Bulk Orders">
      <div className="min-h-screen animate-fade-in bg-[#FFF9F4] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Helmet><title>Admin Bulk Orders — Fazal Paint Hardware</title></Helmet>
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin workspace</p>
            <h1 className="mt-3 text-2xl font-semibold text-[#4A3527] sm:text-3xl">Bulk Orders</h1>
            <p className="mt-2 text-sm text-[#8A7A6D]">Custom bulk-order requests submitted from "My Account". Reply with a quote here — it shows up on their account instantly.</p>
            <div className="mt-6">
              <AdminSectionNav />
            </div>
          </div>

          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8">
            <RequestManager
              fetchList={fetchAdminQuotationRequests}
              markViewed={markQuotationRequestViewed}
              updateItem={(id, payload) => updateAdminQuotationRequest(id, { status: payload.status, adminQuote: payload.adminQuote })}
              statusOptions={['Pending', 'Quoted', 'Confirmed', 'Declined']}
              replyFieldKey="adminQuote"
              replyLabel="Quote"
              getSummary={(item) => item.quantity_estimate || 'Bulk order request'}
              getBody={(item) => item.details}
              getBadge={() => null}
              getExtraLine={(item) => (item.quantity_estimate ? `Estimated quantity: ${item.quantity_estimate}` : '')}
              getReplyValue={(item) => item.admin_quote}
              emptyMessage="Abhi tak koi bulk order request nahi aaya."
            />
          </div>
        </div>
      </div>
    </AdminGate>
  );
}

export default AdminBulkOrders;
