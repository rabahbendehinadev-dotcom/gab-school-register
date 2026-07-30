import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface BrandLogo {
  id: number;
  name: string;
  imageUrl: string;
  website: string | null;
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

  // Duplicate for seamless infinite loop
  const items = [...logos, ...logos];

  return (
    <section className="py-14 bg-white border-t border-[#f5f5f5]">
      <div className="max-w-3xl mx-auto px-5 text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-[#111] mb-2">
          علامات تجارية <span className="text-gradient-orange">تكوّنت معنا</span>
        </h2>
        <p className="text-sm text-[#737373] max-w-md mx-auto leading-relaxed">
          نفخر بخريجينا الذين أسسوا علاماتهم التجارية وطوروا مشاريعهم بعد التكوين.
        </p>
      </div>

      {/* Slider container */}
      <div
        className="relative overflow-hidden"
        style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
      >
        <div
          className="brand-marquee flex gap-10 items-center w-max"
          style={{ animation: `brand-scroll ${logos.length * 3}s linear infinite` }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
        >
          {items.map((logo, i) => {
            const src = logo.imageUrl.startsWith("/api")
              ? `${BASE}${logo.imageUrl}`
              : logo.imageUrl;

            const inner = (
              <div
                key={`${logo.id}-${i}`}
                className="flex-shrink-0 h-14 px-5 flex items-center justify-center bg-white rounded-xl border border-[#e5e5e5] shadow-sm hover:shadow-md hover:border-[#f97316] transition-all duration-300 group"
                style={{ minWidth: 120 }}
              >
                <img
                  src={src}
                  alt={logo.name}
                  draggable={false}
                  className="max-h-9 max-w-[110px] object-contain group-hover:scale-105 transition-transform duration-300 select-none"
                  loading="lazy"
                />
              </div>
            );

            return logo.website ? (
              <a
                key={`${logo.id}-${i}`}
                href={logo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
                title={logo.name}
              >
                {inner}
              </a>
            ) : (
              <div key={`${logo.id}-${i}`} className="flex-shrink-0">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes brand-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
