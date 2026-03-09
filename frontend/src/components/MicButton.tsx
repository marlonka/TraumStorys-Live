import MoonCanvas from "./MoonCanvas";

interface MicButtonProps {
  state: "idle" | "connecting" | "listening" | "speaking";
  onClick: () => void;
}

export default function MicButton({ state, onClick }: MicButtonProps) {
  const isActive = state === "listening" || state === "speaking";
  const isConnecting = state === "connecting";
  const showMoon = state === "idle" || isConnecting;

  return (
    <div className="relative flex flex-col items-center">
      {/* Second ethereal glow ring (idle only) — large, very faint */}
      {showMoon && (
        <div
          className="absolute w-72 h-72 rounded-full -z-20"
          style={{
            background: "radial-gradient(circle, rgba(254, 243, 199, 0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
            animation: "moonBreathe 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      )}

      {/* Primary ambient glow behind button */}
      <div
        className={`absolute rounded-full blur-3xl transition-all duration-1000 -z-10 ${
          showMoon ? "w-56 h-56" : "w-44 h-44"
        }`}
        style={{
          background:
            showMoon
              ? "radial-gradient(circle, rgba(240, 230, 210, 0.18) 0%, transparent 70%)"
              : state === "speaking"
              ? "radial-gradient(circle, rgba(167, 139, 250, 0.2) 0%, rgba(125, 211, 252, 0.08) 50%, transparent 70%)"
              : "radial-gradient(circle, rgba(125, 211, 252, 0.15) 0%, transparent 70%)",
          opacity: isConnecting ? 0.5 : 1,
        }}
      />

      {/* Orbiting particle when listening */}
      {state === "listening" && (
        <div className="absolute w-36 h-36 listening-orbit">
          <div
            className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 rounded-full"
            style={{
              background: "var(--color-aurora-blue)",
              boxShadow: "0 0 8px var(--color-aurora-blue)",
            }}
          />
        </div>
      )}

      {/* Expanding rings when speaking */}
      {state === "speaking" && (
        <>
          <span className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-aurora-purple/25 moon-glow-ring" />
          <span className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-aurora-violet/15 moon-glow-ring" style={{ animationDelay: "1s" }} />
        </>
      )}

      {/* The Button */}
      <button
        onClick={onClick}
        disabled={isConnecting}
        className={`
          relative w-32 h-32 rounded-full transition-all duration-700
          flex items-center justify-center overflow-hidden
          focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20
          ${state === "idle" ? "cursor-pointer moon-breathe" : isConnecting ? "cursor-wait" : state === "speaking" ? "speaking-pulse cursor-pointer" : "cursor-pointer"}
        `}
        style={{
          background: showMoon
            ? "#06070f"
            : state === "listening"
            ? "radial-gradient(circle at 40% 40%, rgba(125, 211, 252, 0.12) 0%, rgba(10, 16, 32, 0.85) 60%, rgba(10, 16, 32, 0.95) 100%)"
            : "radial-gradient(circle at 40% 40%, rgba(167, 139, 250, 0.12) 0%, rgba(10, 16, 32, 0.85) 60%, rgba(10, 16, 32, 0.95) 100%)",
          boxShadow: showMoon
            ? "0 0 20px rgba(200, 200, 200, 0.15), 0 0 50px rgba(180, 180, 180, 0.06)"
            : state === "listening"
            ? "0 0 25px rgba(125, 211, 252, 0.15), inset 0 0 15px rgba(125, 211, 252, 0.05)"
            : undefined,
          border: isActive ? "2px solid rgba(167, 139, 250, 0.25)" : "none",
          opacity: isConnecting ? 0.6 : 1,
        }}
        aria-label={isActive ? "End story" : "Begin your story"}
      >
        {/* High-res canvas moon */}
        {showMoon && <MoonCanvas />}

        {/* Active state — mic bars */}
        {isActive && (
          <div className="flex items-center gap-[3px]">
            {[0.6, 1, 0.7, 0.9, 0.5].map((h, i) => (
              <div
                key={i}
                className="w-[4px] rounded-full transition-all duration-300"
                style={{
                  height: `${h * (state === "speaking" ? 28 : 14)}px`,
                  background: state === "speaking"
                    ? "linear-gradient(to top, var(--color-aurora-purple), var(--color-aurora-violet))"
                    : "linear-gradient(to top, var(--color-aurora-blue), var(--color-aurora-teal))",
                  opacity: 0.8,
                  animation: state === "speaking"
                    ? `floatGentle ${0.4 + i * 0.1}s ease-in-out ${i * 0.08}s infinite alternate`
                    : undefined,
                }}
              />
            ))}
          </div>
        )}
      </button>

      {/* Label */}
      <span
        className={`
          mt-5 text-sm tracking-wide transition-all duration-500
          ${showMoon ? "text-white/40" : "text-dreamy/50"}
        `}
        style={{
          fontFamily: showMoon ? "var(--font-display)" : "var(--font-sans)",
          fontWeight: showMoon ? 400 : 500,
        }}
      >
        {state === "idle" && "Touch the moon to begin your adventure..."}
        {isConnecting && "Waking up Traumi..."}
        {state === "listening" && "Traumi is listening"}
        {state === "speaking" && "Traumi is telling your story"}
      </span>
    </div>
  );
}
