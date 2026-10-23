import { useEffect, useRef } from "react";

const CARD_COUNT = 10;
const LOOP_WIDTH = CARD_COUNT * 196;

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function Hero() {
  const carouselRef = useRef(null);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // Add your own image/video paths here. The carousel still renders as a styled placeholder without them.
    const POSTER_SRC = "";
    const VIDEO_SRC = "";
    const tiles = Array.from({ length: CARD_COUNT }, (_, index) => ({
      row: Math.floor(index / 5),
      col: index % 5,
    }));

    container.replaceChildren();
    const cards = tiles.map((tile, index) => {
      const card = document.createElement("div");
      card.className = "carousel-card";

      if (POSTER_SRC) {
        const poster = document.createElement("img");
        poster.src = POSTER_SRC;
        poster.alt = `Creator reel tile ${index + 1}`;
        poster.className = "carousel-tile-media";
        poster.addEventListener("load", () => {
          if (!card.querySelector("video.ready")) poster.classList.add("ready");
        });
        card.appendChild(poster);
      }

      if (VIDEO_SRC) {
        const video = document.createElement("video");
        video.src = VIDEO_SRC;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.className = "carousel-tile-media";
        video.addEventListener("loadeddata", () => video.classList.add("ready"));
        card.appendChild(video);
      }

      const playBadge = document.createElement("div");
      playBadge.className = "play-badge";
      playBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="#08482D" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      card.appendChild(playBadge);
      container.appendChild(card);
      return { el: card, tile, index };
    });

    let scrollOffset = 0;
    let isDragging = false;
    let lastX = 0;
    let lastTime = performance.now();
    let velocity = -50;
    let previousFrameTime = performance.now();
    let rafId = 0;

    const getScaleX = () => window.innerWidth / 1440;
    const getScaleY = () => window.innerWidth <= 820 ? getScaleX() : window.innerHeight / 1080;

    const onPointerDown = (event) => {
      isDragging = true;
      lastX = event.clientX;
      lastTime = performance.now();
      velocity = 0;
      container.classList.add("is-dragging");
    };
    const onPointerMove = (event) => {
      if (!isDragging) return;
      const currentX = event.clientX;
      const deltaPx = currentX - lastX;
      const scaleX = getScaleX();
      const deltaUnit = deltaPx / Math.max(scaleX, 0.001);
      scrollOffset += deltaUnit;
      const now = performance.now();
      velocity = deltaUnit / Math.max((now - lastTime) / 1000, 0.001);
      lastX = currentX;
      lastTime = now;
    };
    const onPointerUp = () => {
      isDragging = false;
      container.classList.remove("is-dragging");
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const render = (time) => {
      const dt = Math.min((time - previousFrameTime) / 1000, 0.1);
      previousFrameTime = time;
      const scaleX = getScaleX();
      const scaleY = getScaleY();

      if (!isDragging) {
        velocity += (-50 - velocity) * (1 - Math.pow(0.05, dt));
        scrollOffset += velocity * dt;
      }
      scrollOffset = ((scrollOffset % LOOP_WIDTH) + LOOP_WIDTH) % LOOP_WIDTH;

      cards.forEach((card) => {
        let nominalX = (card.index * 196 + scrollOffset) % LOOP_WIDTH;
        let t = nominalX - 720;
        if (t > LOOP_WIDTH / 2) t -= LOOP_WIDTH;
        if (t < -LOOP_WIDTH / 2) t += LOOP_WIDTH;

        const tNorm = t / 706;
        const xCenter = 720 + t * (1 + 0.083 * tNorm * tNorm);
        const distance = Math.min(Math.abs(xCenter - 720) / 706, 1.3);
        const cardWidth = 170 + 48 * distance * distance;
        const xLeft = xCenter - cardWidth / 2;
        const xRight = xCenter + cardWidth / 2;
        const qLeft = Math.min(Math.abs(xLeft - 720) / 706, 1.4);
        const qRight = Math.min(Math.abs(xRight - 720) / 706, 1.4);
        const hLeft = 280 + 92 * Math.pow(qLeft, 2.6);
        const hRight = 280 + 92 * Math.pow(qRight, 2.6);
        const yCenter = 687 - 12 * distance * distance;
        const maxHeight = Math.max(hLeft, hRight);

        if (xRight < -80 || xLeft > 1520) {
          card.el.style.display = "none";
          return;
        }
        card.el.style.display = "block";

        const left = xLeft * scaleX;
        const top = (yCenter - maxHeight / 2) * scaleY;
        const width = cardWidth * scaleX;
        const height = maxHeight * scaleY;
        card.el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        card.el.style.width = `${width}px`;
        card.el.style.height = `${height}px`;

        const radius = 15 * scaleX;
        const topLeft = ((maxHeight - hLeft) / 2) * scaleY;
        const bottomLeft = topLeft + hLeft * scaleY;
        const topRight = ((maxHeight - hRight) / 2) * scaleY;
        const bottomRight = topRight + hRight * scaleY;
        const safeWidth = Math.max(width, 1);
        const path = `M 0 ${topLeft + radius} Q 0 ${topLeft} ${radius} ${topLeft + (topRight - topLeft) * (radius / safeWidth)} L ${width - radius} ${topRight - (topRight - topLeft) * (radius / safeWidth)} Q ${width} ${topRight} ${width} ${topRight + radius} L ${width} ${bottomRight - radius} Q ${width} ${bottomRight} ${width - radius} ${bottomRight + (bottomLeft - bottomRight) * (radius / safeWidth)} L ${radius} ${bottomLeft - (bottomLeft - bottomRight) * (radius / safeWidth)} Q 0 ${bottomLeft} 0 ${bottomLeft - radius} Z`;
        card.el.style.clipPath = `path('${path.replace(/\\s+/g, " ")}')`;

        const tileWidth = width;
        const tileHeight = Math.max(height, width / 0.7111);
        const mediaTransform = `translate3d(${-card.tile.col * tileWidth}px, ${-card.tile.row * tileHeight}px, 0)`;
        card.el.querySelectorAll(".carousel-tile-media").forEach((media) => {
          media.style.transform = mediaTransform;
          media.style.width = `${tileWidth * 5}px`;
          media.style.height = `${tileHeight * 2}px`;
        });
      });

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    const onResize = () => {
      const unit = window.innerWidth <= 820
        ? "100vw / 640"
        : "min(100vw / 1440, 100svh / 1080)";
      document.documentElement.style.setProperty("--u", unit);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      container.querySelectorAll("video").forEach((video) => video.pause());
      container.replaceChildren();
    };
  }, []);

  return (
    <main id="stage-frame" className="relative mx-auto overflow-hidden">
      <header className="hero-header absolute left-0 top-0 z-30 flex w-full items-center justify-between anim-drop">
        <a href="#" className="brand absolute flex items-center gap-2.5" aria-label="Reelmark home">
          <span className="brand-mark flex items-center justify-center rounded-full"><LeafIcon /></span>
          <span className="brand-name font-headline font-bold tracking-tight">Reelmark</span>
        </a>
        <nav className="desktop-nav absolute flex items-center" aria-label="Main navigation">
          <a className="nav-item" href="#brands">Brands</a>
          <a className="nav-item" href="#creators">Creators</a>
          <a className="nav-item" href="#pricing">Pricing</a>
          <a className="nav-item" href="#use-cases">Use Cases</a>
          <a className="nav-item" href="#contact">Contact</a>
        </nav>
        <div className="desktop-actions absolute flex items-center gap-1.5">
          <button className="login-button rounded-full border bg-white font-medium shadow-sm transition hover:bg-neutral-50" type="button">Log in</button>
          <button className="signup-button rounded-full font-medium text-white shadow-md transition hover:opacity-95" type="button">Sign up</button>
        </div>
        <div className="mobile-header hidden w-full items-center justify-between">
          <a href="#" className="mobile-brand flex items-center gap-2"><span className="brand-mark"><LeafIcon /></span><span className="brand-name font-headline">Reelmark</span></a>
          <a className="mobile-cta rounded-full text-white" href="#make-reel">Get started <ArrowIcon /></a>
        </div>
      </header>

      <div className="trust-badge anim-badge absolute z-20 flex items-center justify-center rounded-full font-medium tracking-tight">
        <span className="star-icon"><StarIcon /></span>
        Trusted by 120,000+ indie makers
      </div>

      <div className="hero-title absolute left-0 z-20 w-full text-center">
        <h1 className="font-headline text-[var(--ink-dark)]">
          <span className="headline-line anim-headline-1">Captivate Crowds</span>
          <span className="headline-line anim-headline-2">with Snackable Reels</span>
        </h1>
      </div>

      <div className="hero-subline anim-subline absolute left-0 z-20 w-full text-center">
        <p className="mx-auto font-normal">
          Grow your brand with short, snappy product clips by<br className="desktop-break" />
          our handpicked video makers. Our crew is ready to<br className="desktop-break" />
          lift your next launch higher.
        </p>
      </div>

      <div className="doodle doodle-slashes absolute z-20 anim-note" aria-hidden="true">
        <svg viewBox="0 0 50 50" fill="none" stroke="#08482D" strokeLinecap="round" strokeWidth="4.5">
          <path className="draw-stroke" d="M12 42 L24 8" />
          <path className="draw-stroke" d="M28 42 L40 8" style={{ animationDelay: "0.8s" }} />
        </svg>
      </div>

      <div className="doodle-note absolute z-20 anim-note" aria-hidden="true">
        <div className="font-notes whitespace-nowrap">Be seen<br />&nbsp;&nbsp;with clips</div>
        <svg className="note-arrow" viewBox="0 0 120 160" fill="none">
          <path className="draw-stroke" d="M 28 4 C 18 42, -4 95, -60 148" stroke="#08482D" strokeLinecap="round" strokeWidth="3" />
          <path className="draw-stroke" d="M -60 148 L -48 140 M -60 148 L -55 130" stroke="#08482D" strokeLinecap="round" strokeWidth="3" style={{ animationDelay: "1.4s" }} />
        </svg>
      </div>

      <div className="zero-note absolute z-20 anim-note" aria-hidden="true">
        <div className="font-notes whitespace-nowrap">Zero cost</div>
        <svg viewBox="0 0 60 45" fill="none">
          <path className="draw-stroke" d="M 4 20 C 22 24, 38 18, 48 4" stroke="#08482D" strokeLinecap="round" strokeWidth="2.5" />
          <path className="draw-stroke" d="M 48 4 L 38 5 M 48 4 L 46 14" stroke="#08482D" strokeLinecap="round" strokeWidth="2.5" style={{ animationDelay: "1.2s" }} />
        </svg>
      </div>

      <div ref={carouselRef} id="carousel-container" aria-label="Interactive video reel showcase" />

      <div id="make-reel" className="make-reel-wrap anim-button-scale absolute z-30 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-dashed opacity-70" />
        <button className="make-reel-button relative flex items-center justify-center rounded-full font-semibold text-white shadow-xl transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]" type="button">
          Make a Reel <span className="button-arrow"><ArrowIcon /></span>
        </button>
      </div>

      <section className="mobile-content hidden">
        <div className="mobile-badge"><StarIcon /> Trusted by 120,000+ indie makers</div>
        <h1 className="mobile-headline font-headline">Captivate Crowds<br />with Snackable Reels</h1>
        <p className="mobile-subline">Grow your brand with short, snappy product clips by our handpicked video makers. Our crew is ready to lift your next launch higher.</p>
      </section>
    </main>
  );
}