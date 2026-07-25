import { NavLink } from 'react-router-dom';

// Small pill-style nav so the admin can switch between the different admin
// sections without hunting for a link elsewhere. Shows unread-count badges
// next to Orders/Support/Bulk Orders so new activity is noticeable no
// matter which admin page they're currently on.
function AdminSectionNav({ unreadOrdersCount = 0, unreadSupportCount = 0, unreadBulkOrdersCount = 0 }) {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
        : 'border-[#F3E4D4] bg-[#FFF9F4] text-[#4A3527] hover:bg-[#FDE9DC]'
    }`;

  const Badge = ({ count }) =>
    count > 0 ? (
      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-[var(--color-accent)]">
        {count}
      </span>
    ) : null;

  return (
    <div className="flex flex-wrap gap-2">
      <NavLink to="/admin/products" className={linkClass}>
        Products
      </NavLink>
      <NavLink to="/admin/orders" className={linkClass}>
        Orders
        <Badge count={unreadOrdersCount} />
      </NavLink>
      <NavLink to="/admin/support" className={linkClass}>
        Support
        <Badge count={unreadSupportCount} />
      </NavLink>
      <NavLink to="/admin/bulk-orders" className={linkClass}>
        Bulk Orders
        <Badge count={unreadBulkOrdersCount} />
      </NavLink>
      <NavLink to="/admin/tools" className={linkClass}>
        Tools
      </NavLink>
    </div>
  );
}

export default AdminSectionNav;