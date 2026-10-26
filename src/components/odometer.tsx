const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Text whose digits roll like an odometer to their value, on first show and whenever they change. Still under reduced motion. */
export function Odometer({ text }: { text: string }) {
  // "2 months, 1 week" → ["", "2", " months, ", "1", " week"]: numbers at odd indexes.
  const parts = text.split(/(\d+)/);
  return (
    <span className="tabular-nums">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex whitespace-pre">
        {parts.flatMap((part, i) => {
          if (i % 2 === 0) return part && <span key={part}>{part}</span>;
          // Keyed by unit and place ("day-1"), so "2 days" → "1 day" rolls the same digit down.
          const unit = parts[i + 1]?.match(/[a-z]+/i)?.[0].replace(/s$/, "");
          return [...part].map((digit, j) => (
            <Digit key={`${unit}-${part.length - j}`} value={Number(digit)} />
          ));
        })}
      </span>
    </span>
  );
}

function Digit({ value }: { value: number }) {
  return (
    <span className="inline-block h-[1lh] overflow-hidden">
      <span
        className="flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:animate-odometer-in motion-reduce:transition-none"
        style={{ transform: `translateY(-${value * 10}%)` }}
      >
        {DIGITS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </span>
    </span>
  );
}
