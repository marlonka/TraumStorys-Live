interface StoryCanvasProps {
  image: string | null;
  mime: string;
  title: string;
}

export default function StoryCanvas({ image, mime, title }: StoryCanvasProps) {
  if (!image) return null;

  return (
    <div className="relative w-full max-w-[340px] mx-auto">
      {/* Ethereal glow behind the illustration */}
      <div
        className="absolute -inset-6 rounded-[2rem] blur-3xl opacity-40 -z-10"
        style={{
          background: "radial-gradient(ellipse at center, rgba(167, 139, 250, 0.3), rgba(125, 211, 252, 0.1) 50%, transparent 80%)",
        }}
      />

      {/* Storybook frame — warm border, rounded like a picture book */}
      <div
        className="relative rounded-[1.5rem] overflow-hidden illustration-glow"
        style={{ border: "1px solid rgba(254, 243, 199, 0.08)" }}
      >
        {/* Book spine shimmer along the left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-3 z-10 book-spine-shimmer" />

        {/* The illustration itself */}
        <img
          key={image.slice(0, 40)}
          src={`data:${mime};base64,${image}`}
          alt={title}
          className="illustration-enter w-full aspect-square object-cover"
          draggable={false}
        />

        {/* Vignette overlay for storybook feel */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at center, transparent 50%, rgba(10, 14, 26, 0.3) 100%),
              linear-gradient(to bottom, transparent 70%, rgba(10, 14, 26, 0.6) 100%)
            `,
          }}
        />

        {/* Scene title — like a storybook caption */}
        {title && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-10 bg-gradient-to-t from-night-950/80 via-night-950/40 to-transparent">
            <p
              className="text-moon/90 text-sm font-semibold text-center tracking-wide drop-shadow-lg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </p>
          </div>
        )}
      </div>

      {/* Decorative stars around the frame — 4 total, asymmetric */}
      <div
        className="absolute -top-2 -right-2 w-3 h-3 rounded-full"
        style={{
          background: "var(--color-star)",
          boxShadow: "0 0 8px var(--color-star)",
          animation: "twinkle 3s ease-in-out 0.5s infinite",
        }}
      />
      <div
        className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full"
        style={{
          background: "var(--color-aurora-blue)",
          boxShadow: "0 0 6px var(--color-aurora-blue)",
          animation: "twinkle 4s ease-in-out 1.5s infinite",
        }}
      />
      <div
        className="absolute top-[15%] -left-2.5 w-1.5 h-1.5 rounded-full"
        style={{
          background: "var(--color-aurora-violet)",
          boxShadow: "0 0 5px var(--color-aurora-violet)",
          animation: "twinkle 3.5s ease-in-out 2s infinite",
        }}
      />
      <div
        className="absolute bottom-[20%] -right-1.5 w-2 h-2 rounded-full"
        style={{
          background: "var(--color-moon-warm)",
          boxShadow: "0 0 6px rgba(252, 211, 77, 0.5)",
          animation: "twinkle 4.5s ease-in-out 0.8s infinite",
        }}
      />
    </div>
  );
}
