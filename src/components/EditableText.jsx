import { useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { api } from '../lib/adminApi';

// Simple in-memory cache so every EditableText on a page doesn't each
// fire its own /api/content request.
let contentCache = null;
let contentPromise = null;

function loadAllContent() {
  if (contentCache) return Promise.resolve(contentCache);
  if (!contentPromise) {
    contentPromise = api('/api/content')
      .then((data) => {
        contentCache = data || {};
        return contentCache;
      })
      .catch(() => ({}));
  }
  return contentPromise;
}

/**
 * Wrap any piece of text with this component to make it editable
 * by the logged-in admin when Edit Mode is ON.
 *
 * Usage: <EditableText id="home_hero_title" as="h1" className="...">Default text</EditableText>
 *
 * `id` must be unique across the whole site — it's the key used to
 * save/load the text from the backend (/api/admin/content).
 */
function EditableText({ id, as = 'span', className = '', children }) {
  const { isAdmin, editMode } = useAdminAuth();
  const [text, setText] = useState(children);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadAllContent().then((content) => {
      if (mounted && content[id] != null && content[id] !== '') {
        setText(content[id]);
      }
    });
    return () => {
      mounted = false;
    };
  }, [id]);

  const startEditing = () => {
    if (!isAdmin || !editMode) return;
    setEditing(true);
    requestAnimationFrame(() => {
      ref.current?.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  };

  const save = async () => {
    const newText = ref.current?.innerText?.trim() || text;
    setEditing(false);
    if (newText === text) return;
    setText(newText);
    setSaving(true);
    try {
      await api('/api/admin/content', { method: 'PUT', body: { key: id, value: newText } });
      contentCache = { ...(contentCache || {}), [id]: newText };
    } catch {
      // Keep the locally edited text even if saving failed, but let the admin know.
      console.error(`Failed to save content for "${id}"`);
    } finally {
      setSaving(false);
    }
  };

  const Tag = as;

  if (!isAdmin || !editMode) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      className={`${className} cursor-text rounded outline-dashed outline-2 outline-offset-2 outline-[#F5B942] transition ${editing ? 'bg-[#FDF3E4]' : 'hover:bg-[#FDF3E4]/60'} ${saving ? 'opacity-60' : ''}`}
      contentEditable={editing}
      suppressContentEditableWarning
      onClick={startEditing}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          ref.current?.blur();
        }
        if (event.key === 'Escape') {
          setText(text);
          setEditing(false);
        }
      }}
    >
      {text}
    </Tag>
  );
}

export default EditableText;
