import { useEffect, useRef, useState } from 'react';

// Four individual boxes (not one text field) — the standard, easy-to-scan
// pattern for a 4-digit code. Auto-advances focus as each digit is typed,
// supports backspace-to-previous-box, and supports pasting a full 4-digit
// code copied from an email/SMS app.
function OtpInput({ length = 4, onComplete, resetKey }) {
  const [digits, setDigits] = useState(Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    setDigits(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  }, [resetKey, length]);

  const updateDigits = (next) => {
    setDigits(next);
    const code = next.join('');
    if (code.length === length && next.every((d) => d !== '')) {
      onComplete(code);
    }
  };

  const handleChange = (index, rawValue) => {
    const value = rawValue.replace(/\D/g, '');
    if (!value) {
      const next = [...digits];
      next[index] = '';
      updateDigits(next);
      return;
    }
    // Handles both a single keystroke and a full paste landing in one box.
    const chars = value.split('');
    const next = [...digits];
    let cursor = index;
    for (const char of chars) {
      if (cursor >= length) break;
      next[cursor] = char;
      cursor += 1;
    }
    updateDigits(next);
    const focusIndex = Math.min(cursor, length - 1);
    inputRefs.current[focusIndex]?.focus();
    inputRefs.current[focusIndex]?.select();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={length}
          value={digits[index]}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className="h-14 w-14 rounded-2xl border-2 border-[#F3E4D4] bg-[#FFF9F4] text-center text-2xl font-semibold text-[#4A3527] outline-none transition-colors focus:border-accent"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default OtpInput;
