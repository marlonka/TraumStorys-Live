interface TranscriptOverlayProps {
  lines: { text: string; type: "in" | "out" }[];
}

export default function TranscriptOverlay({ lines }: TranscriptOverlayProps) {
  if (lines.length === 0) return null;

  // Show last 3 lines with fading history
  const visible = lines.slice(-3);

  return (
    <div className="w-full max-w-sm px-6 space-y-2">
      {visible.map((line, i) => {
        const isLatest = i === visible.length - 1;
        const isChild = line.type === "in";
        const age = visible.length - 1 - i; // 0 = newest, 2 = oldest

        return (
          <p
            key={lines.length - visible.length + i}
            className={`
              text-center leading-relaxed tracking-wide transcript-enter
              ${isChild ? "italic" : "font-medium"}
            `}
            style={{
              fontSize: isLatest ? "0.9rem" : "0.8rem",
              color: isChild
                ? "var(--color-moon)"
                : "var(--color-narrator)",
              opacity: isLatest ? 0.85 : age === 1 ? 0.35 : 0.15,
              filter: !isLatest ? `blur(${age * 0.5}px)` : undefined,
              animationDelay: "0.05s",
              textShadow: isLatest
                ? "0 0 20px rgba(224, 231, 255, 0.15)"
                : undefined,
            }}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
