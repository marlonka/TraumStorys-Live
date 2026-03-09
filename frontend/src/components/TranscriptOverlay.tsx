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
          <div key={lines.length - visible.length + i}>
            {/* Golden dot separator between lines */}
            {i > 0 && (
              <div className="flex justify-center mb-2">
                <div
                  className="w-[3px] h-[3px] rounded-full"
                  style={{
                    background: "var(--color-moon-warm)",
                    boxShadow: "0 0 4px rgba(252, 211, 77, 0.3)",
                    opacity: isLatest ? 0.5 : 0.2,
                  }}
                />
              </div>
            )}
            <p
              className={`
                text-center leading-relaxed tracking-wide transcript-enter
                ${isChild ? "italic" : ""}
              `}
              style={{
                fontSize: isLatest ? "0.9rem" : "0.8rem",
                fontWeight: isChild ? 400 : 500,
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
              {isChild ? `\u201C${line.text}\u201D` : line.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
