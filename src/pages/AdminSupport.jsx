import { Helmet } from 'react-helmet-async';
import AdminGate from '../components/AdminGate';
import AdminSectionNav from '../components/AdminSectionNav';
import RequestManager from '../components/admin/RequestManager';
import {
  fetchAdminSupportTickets,
  markSupportTicketViewed,
  updateAdminSupportTicket
} from '../lib/adminApi';

function AdminSupport() {
  return (
    <AdminGate title="Admin Support">
      <div className="min-h-screen animate-fade-in bg-[#FFF9F4] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Helmet><title>Admin Support — Fazal Paint Hardware</title></Helmet>
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin workspace</p>
            <h1 className="mt-3 text-2xl font-semibold text-[#4A3527] sm:text-3xl">Support — Complaints &amp; Suggestions</h1>
            <p className="mt-2 text-sm text-[#8A7A6D]">Customer complaints and suggestions submitted from "My Account". Reply here — it shows up on their account instantly.</p>
            <div className="mt-6">
              <AdminSectionNav />
            </div>
          </div>

          <div className="rounded-[32px] border border-[#F3E4D4] bg-white p-5 shadow-soft sm:p-8">
            <RequestManager
              fetchList={fetchAdminSupportTickets}
              markViewed={markSupportTicketViewed}
              updateItem={(id, payload) => updateAdminSupportTicket(id, { status: payload.status, adminReply: payload.adminReply })}
              statusOptions={['Open', 'In Progress', 'Resolved', 'Closed']}
              replyFieldKey="adminReply"
              replyLabel="Reply"
              getSummary={(item) => item.subject}
              getBody={(item) => item.message}
              getBadge={(item) => (item.type === 'suggestion' ? 'Suggestion' : 'Complaint')}
              getExtraLine={(item) => (item.order_invoice_number ? `Related invoice: ${item.order_invoice_number}` : '')}
              getReplyValue={(item) => item.admin_reply}
              emptyMessage="Abhi tak koi complaint ya suggestion nahi aaya."
            />
          </div>
        </div>
      </div>
    </AdminGate>
  );
}

export default AdminSupport;
