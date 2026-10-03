import { MONOGRAM_PATHS, MONOGRAM_VIEWBOX } from "@/components/motion/monogram-paths";

/**
 * THE OPENING — "the atelier doors".
 *
 * Deep olive, the client's orchid wallpaper glowing faintly behind and
 * drifting closer. The monogram blooms: its seven petals open outward into
 * place, one after another. A band of light passes across the finished mark
 * like light on embossed foil. The name arrives letter by letter, sharpening
 * into focus over a terracotta hairline; the line follows. Then the mark
 * recedes and two olive panels part from the centre like boutique doors —
 * the booth's own panels — and the page is there behind them.
 *
 * Once per visit (sessionStorage), on whichever page the visitor lands; a
 * tap goes straight to the doors. Pure CSS (`.brand-intro` in globals.css):
 * transform, opacity, filter and clip-path only. The two tiny scripts decide
 * before the overlay is parsed (so a returning visitor never sees a flash)
 * and retire it afterwards. Hidden by default — no JavaScript or reduced
 * motion means no intro. The page loads underneath the whole time, so the
 * intro delays nothing. Decorative, aria-hidden.
 */
const DECIDE = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("calanthe-intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)return;sessionStorage.setItem("calanthe-intro","1");d.classList.add("intro-playing");}catch(e){}})();`;

const FINISH = `(function(){var d=document.documentElement;if(!d.classList.contains("intro-playing"))return;var el=document.getElementById("brand-intro");function done(){d.classList.remove("intro-playing");}var t=setTimeout(done,3700);if(el)el.addEventListener("click",function(){if(el.classList.contains("is-skipping"))return;clearTimeout(t);el.classList.add("is-skipping");setTimeout(done,950);});})();`;

const NAME = "CALANTHE";

export function BrandIntro({ tagline }: { tagline: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: DECIDE }} />
      <div id="brand-intro" className="brand-intro" aria-hidden>
        {/* The doors: each half carries the olive and the printed orchids. */}
        <span className="brand-intro__door brand-intro__door--start" />
        <span className="brand-intro__door brand-intro__door--end" />
        {/* The seam where the doors meet, drawn just before they part. */}
        <span className="brand-intro__seam" />
        {/* A hairline frame, like the moulding on the booth's panels. */}
        <span className="brand-intro__frame" />

        <div className="brand-intro__stage">
          <svg viewBox={MONOGRAM_VIEWBOX} className="brand-intro__mark">
            <defs>
              <clipPath id="brand-intro-clip">
                {MONOGRAM_PATHS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </clipPath>
              <linearGradient id="brand-intro-glint" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {MONOGRAM_PATHS.map((d, i) => (
              <path key={i} d={d} className="brand-intro__petal" />
            ))}
            {/* The light, clipped to the mark, crossing it once. */}
            <g clipPath="url(#brand-intro-clip)">
              <rect className="brand-intro__glint" x="-400" y="0" width="360" height="1080" fill="url(#brand-intro-glint)" />
            </g>
          </svg>

          <p lang="en" dir="ltr" className="brand-intro__name">
            {NAME.split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${1.25 + i * 0.07}s` }}>
                {ch}
              </span>
            ))}
          </p>
          <span className="brand-intro__rule" />
          <p className="brand-intro__line">{tagline}</p>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: FINISH }} />
    </>
  );
}
