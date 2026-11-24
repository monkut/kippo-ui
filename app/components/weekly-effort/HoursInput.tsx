import { useState, type InputHTMLAttributes } from "react";
import { normalizeDigits } from "./utils";

type HoursInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "onCompositionStart" | "onCompositionEnd"
> & {
  value: string;
  /** Called with half-width digits only (full-width digits converted, other chars stripped). */
  onValueChange: (digits: string) => void;
};

/**
 * Numeric hours input that is safe for Japanese IME entry.
 *
 * While an IME composition is active the raw composing text is shown untouched;
 * normalizing (and re-rendering) mid-composition makes the browser re-insert the
 * committed text, so typing `８` produced `88`. The value is normalized once the
 * composition ends.
 */
export function HoursInput({ value, onValueChange, ...rest }: HoursInputProps) {
  const [composingValue, setComposingValue] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={composingValue ?? value}
      onChange={(e) => {
        if ((e.nativeEvent as InputEvent).isComposing) {
          setComposingValue(e.target.value);
          return;
        }
        onValueChange(normalizeDigits(e.target.value));
      }}
      onCompositionStart={(e) => setComposingValue(e.currentTarget.value)}
      onCompositionEnd={(e) => {
        setComposingValue(null);
        onValueChange(normalizeDigits(e.currentTarget.value));
      }}
    />
  );
}
