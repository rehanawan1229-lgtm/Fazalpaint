import { motion } from 'framer-motion';
import { useAdminAuth } from '../contexts/AdminAuthContext';

function AdminEditToggle() {
  const { isAdmin, editMode, toggleEditMode } = useAdminAuth();

  if (!isAdmin) return null;

  return (
    <motion.button
      type="button"
      onClick={toggleEditMode}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-4 z-[60] rounded-full border px-4 py-3 text-sm font-semibold shadow-soft transition-colors ${editMode ? 'border-[#F5B942] bg-[#4A3527] text-[#FFF9F4]' : 'border-dashed border-[#F3E4D4] bg-[#FFF9F4] text-[#4A3527]'}`}
    >
      <span className="mr-2 inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      Edit Mode: {editMode ? 'ON' : 'OFF'}
    </motion.button>
  );
}

export default AdminEditToggle;
