import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface BrandLogo {
  id: number;
  name: string;
  imageUrl: string;
  website: string | null;
  sortOrder: number;
}

async function fetchActiveLogos(): Promise<BrandLogo[]> {
  const res = await fetch(`${BASE}/api/brand-logos`);
  if (!res.ok) return [];
  return res.json();
}

export default function BrandLogosSlider() {
  const { data: logos = [] } = useQuery({
    queryKey: ["brand-logos"],
    queryFn: fetchActiveLogos,
    staleTime: 60_000,
  });

  if (logos.length === 0) return null;

  // Sort by sortOrder, then duplicate for seamless infinite loop
  const sorted = [...logos].sort((a, b) => a.sortOrder - b.sortOrder);
  const track = [...sorted, ...sorted]; // duplicate only in UI

  // Duration scales with count: 4s per logo, clamped 25–40s
  const duration = Math.min(40, Math.max(25, sorted.length * 4));

  return (
    <section
      style={{
        background: "#ffffff",
        paddingTop: "70px",
        paddingBottom: "70px",
        overflow: "hidden",
        width: "100%",
      }}
      className="brand-logos-section"
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "40px",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 900,
            color: "#111111",
            margin: "0 0 10px 0",
            lineHeight: 1.3,
            direction: "rtl",
          }}
        >
          علامات تجارية{" "}
          <span style={{ color: "#f97316" }}>تكوّنت معنا</span>
        </h2>
        <p
          style={{
            fontSize: "clamp(13px, 2vw, 15px)",
            color: "#9ca3af",
            margin: 0,
            lineHeight: 1.6,
            direction: "rtl",
          }}
        >
          نفخر بخريجينا الذين أسسوا علاماتهم التجارية وطوروا مشاريعهم بعد التكوين.
        </p>
      </div>

      {/* Marquee wrapper */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
        }}
      >
        {/* Left fade */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "120px",
            height: "100%",
            background: "linear-gradient(to right, #ffffff, transparent)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
        {/* Right fade */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "120px",
            height: "100%",
            background: "linear-gradient(to left, #ffffff, transparent)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Track */}
        <div
          className="brand-marquee-track"
          style={{
            display: "flex",
            alignItems: "center",
            width: "max-content",
            animation: `brand-marquee-scroll ${duration}s linear infinite`,
            gap: "65px",
            padding: "8px 0",
          }}
          onMouseEnter={e =>
            ((e.currentTarget as HTMLDivElement).style.animationPlayState = "paused")
          }
          onMouseLeave={e =>
            ((e.currentTarget as HTMLDivElement).style.animationPlayState = "running")
          }
        >
          {track.map((logo, i) => {
            const src = logo.imageUrl.startsWith("/api")
              ? `${BASE}${logo.imageUrl}`
              : logo.imageUrl;

            const img = (
              <img
                src={src}
                alt={logo.name}
                draggable={false}
                className="brand-logo-img"
                style={{
                  height: "85px",
                  width: "auto",
                  maxWidth: "150px",
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none",
                  opacity: 1,
                  filter: "none",
                  mixBlendMode: "normal",
                  transition: "transform 0.3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLImageElement).style.transform = "scale(1.05)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLImageElement).style.transform = "scale(1)";
                }}
                loading="lazy"
              />
            );

            return logo.website ? (
              <a
                key={`${logo.id}-${i}`}
                href={logo.website}
                target="_blank"
                rel="noopener noreferrer"
                title={logo.name}
                style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                {img}
              </a>
            ) : (
              <div
                key={`${logo.id}-${i}`}
                style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                {img}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keyframes + responsive */}
      <style>{`
        @keyframes brand-marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @media (max-width: 640px) {
          .brand-logos-section {
            padding-top: 45px !important;
            padding-bottom: 45px !important;
          }
          .brand-marquee-track {
            gap: 35px !important;
          }
          .brand-logo-img {
            height: 55px !important;
            max-width: 110px !important;
          }
        }
      `}</style>
    </section>
  );
}
