import { MONOGRAM_PATHS, MONOGRAM_VIEWBOX } from "@/components/motion/monogram-paths";

/**
 * THE OPENING — the monogram draws itself, the name settles, the olive lifts.
 *
 * Once per visit (sessionStorage), on whichever page the visitor lands on;
 * never again while they browse. Pure CSS (see `.brand-intro` in
 * globals.css); the only script is the tiny one below, which runs before the
 * overlay is parsed so a returning visitor never sees a flash of it, and
 * which lets a tap skip it.
 *
 * Hidden by default: without JavaScript, or with reduced motion asked for,
 * it never shows. It sits over the page while the page loads underneath, so
 * it delays nothing — the hero is already painted when the curtain lifts.
 * Decorative and aria-hidden; the page's own content is what is announced.
 */
const DECIDE = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("calanthe-intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)return;sessionStorage.setItem("calanthe-intro","1");d.classList.add("intro-playing");}catch(e){}})();`;

const FINISH = `(function(){var d=document.documentElement;if(!d.classList.contains("intro-playing"))return;var el=document.getElementById("brand-intro");function done(){d.classList.remove("intro-playing");}var t=setTimeout(done,3100);if(el)el.addEventListener("click",function(){clearTimeout(t);el.classList.add("is-skipping");setTimeout(done,480);});})();`;

export function BrandIntro({ tagline }: { tagline: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: DECIDE }} />
      <div id="brand-intro" className="brand-intro" aria-hidden>
        <svg viewBox={MONOGRAM_VIEWBOX} className="brand-intro__mark">
          {MONOGRAM_PATHS.map((d, i) => (
            <path key={i} d={d} pathLength={1} />
          ))}
        </svg>
        <p lang="en" className="brand-intro__name">
          Calanthe
        </p>
        <span className="brand-intro__rule" />
        <p className="brand-intro__line">{tagline}</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: FINISH }} />
    </>
  );
}
