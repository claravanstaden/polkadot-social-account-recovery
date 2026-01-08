"use client";

import Tooltip from "./Tooltip";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  label: string;
  hint?: string;
  tooltip?: string;
}

export default function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  label,
  hint,
  tooltip,
}: NumberInputProps) {
  const handleIncrement = () => {
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (newValue >= min) {
      onChange(newValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || min;
    if (newValue >= min && (max === undefined || newValue <= max)) {
      onChange(newValue);
    }
  };

  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  return (
    <div>
      <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </label>
      <div className="focus-parent flex items-center border border-[var(--border-color)] rounded-lg focus-within:border-[var(--polkadot-accent)] transition-colors">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={!canDecrement}
          className="flex items-center justify-center w-10 h-11 bg-[var(--surface)] border-r border-[var(--border-color)] rounded-l-lg text-[var(--foreground-muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            className="w-full h-11 px-3 bg-[var(--surface)] text-center text-[var(--foreground)] outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--foreground-muted)] pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={!canIncrement}
          className="flex items-center justify-center w-10 h-11 bg-[var(--surface)] border-l border-[var(--border-color)] rounded-r-lg text-[var(--foreground-muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      {hint && (
        <p className="text-xs text-[var(--foreground-muted)] mt-1">{hint}</p>
      )}
    </div>
  );
}
