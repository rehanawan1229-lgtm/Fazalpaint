import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import { api } from '../../lib/adminApi';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Assalam-o-Alaikum! 👋 Main \"Ask Fazal\" hoon — aap mujhse kisi bhi product ka stock, price, ya shop ki details pooch sakte hain. Masalan: \"Master Enamel gallon available hai?\""
};

const SUGGESTIONS = ['Kya Berger Paint stock mein hai?', 'Shop kab tak khula hai?', 'Trolley available hai?'];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#C7B393]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

function ChatWidget() {
  const location = useLocation();
  const isCheckoutPage = location.pathname === '/checkout';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasNudge, setHasNudge] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) {
      setHasNudge(false);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const history = nextMessages
        .filter((m) => m !== WELCOME_MESSAGE)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const response = await api('/api/assistant', { method: 'POST', body: { message: trimmed, history } });
      setMessages((prev) => [...prev, { role: 'assistant', content: response?.reply || "Maazrat, mujhe abhi jawab nahi mil saka. Dobara koshish karein ya +92 342 9085556 par call karein." }]);
    } catch (err) {
      console.error('Assistant request failed:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Maazrat, is waqt assistant available nahi hai. Aap +92 342 9085556 par seedha rabta kar sakte hain. 🙏' }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating action button — fixed above the mobile safe area so it
          never collides with device home-bar gestures, and sits clear of
          the WhatsApp/cart buttons which live in the header, not here. */}
      <motion.button
        type="button"
        onClick={() => setOpen((value) => !value)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        whileTap={{ scale: 0.92 }}
        className={`fixed right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lift transition-colors hover:bg-accent-hover sm:h-16 sm:w-16 ${
          isCheckoutPage
            ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))]'
        }`}
        aria-label={open ? 'Close Ask Fazal assistant' : 'Open Ask Fazal assistant'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X size={24} />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Bot size={26} />
            </motion.span>
          )}
        </AnimatePresence>
        {hasNudge && !open && (
          <motion.span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F5B942] text-[10px] font-bold text-[#4A3527]"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <Sparkles size={10} />
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop only on mobile, where the panel is a full-screen sheet */}
            <motion.div
              className="fixed inset-0 z-[65] bg-primary/40 backdrop-blur-sm sm:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-[66] flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-light shadow-lift sm:inset-x-auto sm:bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:right-4 sm:h-[560px] sm:w-[380px] sm:rounded-3xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 bg-primary px-5 py-4 text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                  <Bot size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Ask Fazal</p>
                  <p className="flex items-center gap-1.5 text-xs text-[#F3E4D4]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4E9C79]" />
                    AI shop assistant
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 transition-colors hover:bg-white/10" aria-label="Close chat">
                  <X size={18} />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-soft ${
                        message.role === 'user'
                          ? 'rounded-br-sm bg-accent text-white'
                          : 'rounded-bl-sm border border-border bg-white text-text-primary'
                      }`}
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}
                {sending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-1.5 shadow-soft">
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
                {messages.length === 1 && !sending && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendMessage(suggestion)}
                        className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2 border-t border-border bg-white px-3 py-3"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Apna sawaal likhein..."
                  disabled={sending}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-bg-light px-4 py-3 text-sm text-text-primary transition-colors focus:border-accent"
                />
                <motion.button
                  type="submit"
                  disabled={sending || !input.trim()}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#E8DDD0]"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </motion.button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatWidget;
