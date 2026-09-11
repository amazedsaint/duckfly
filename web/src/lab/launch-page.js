const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const spark = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/></svg>';
const pause = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
const play = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7Z" fill="currentColor"/></svg>';

/** The launch artwork is deliberately separate from the running simulation. */
export function launchPageMarkup() {
  return `<section id="launch-page" class="launch-page launch-is-still" data-motion="paused" aria-labelledby="launch-title" tabindex="-1" hidden>
    <div class="launch-topline"><span class="launch-edition"><span aria-hidden="true">✳</span> A playground for curious minds</span><button id="launch-motion" type="button">${pause}<span>Pause motion</span></button></div>
    <div class="launch-hero">
      <div class="launch-copy">
        <p class="launch-kicker"><span class="launch-live-dot" aria-hidden="true"></span> SMALL ROBOT. BIG WHAT IF.</p>
        <h1 id="launch-title" class="launch-title" aria-label="DuckFly"><span>DUCK</span><span>FLY<span class="launch-title-star" aria-hidden="true">✳</span></span></h1>
        <h2>Tiny brain.<br>Wild ideas.</h2>
        <p class="launch-description">Give a robot duck a fly’s neural circuit. Change what it sees and watch what happens next.</p>
        <div class="launch-actions"><button id="launch-enter" type="button">Open playground ${arrow}</button><button id="launch-beacon" type="button" disabled>Try the beacon <span aria-hidden="true">↗</span></button></div>
        <p id="launch-status" class="launch-status" role="status">Preparing your experiments…</p>
      </div>
      <figure class="launch-art" aria-label="Animated robot duck and fly illustration">
        <div class="launch-art-disc" aria-hidden="true"></div>
        <div class="launch-art-orbit" aria-hidden="true"></div>
        <div class="launch-art-dots" aria-hidden="true"></div>
        <svg class="launch-signal" viewBox="0 0 600 620" fill="none" aria-hidden="true"><path class="launch-signal-shadow" d="M467 120c75 59 21 125-51 113s-44-74-2-46c64 42 5 144-110 168"/><path class="launch-signal-wire" d="M467 120c75 59 21 125-51 113s-44-74-2-46c64 42 5 144-110 168"/><path class="launch-signal-tip" d="m315 337-14 20 25 5"/></svg>
        <div class="launch-duck-shadow" data-launch-animation aria-hidden="true"></div>
        <div class="launch-duck" data-launch-animation><img src="/launch/duck-hero.png" alt="A colorful little robot duck with mechanical legs" width="1024" height="1024" fetchpriority="high" decoding="async"></div>
        <div class="launch-fly" data-launch-animation><img src="/launch/fly-hero.png" alt="A fly with bright eyes and translucent wings" width="1024" height="1024" fetchpriority="high" decoding="async"></div>
        <span class="launch-art-label launch-fly-label">a fly’s circuit <span aria-hidden="true">↗</span></span>
        <span class="launch-art-label launch-duck-label">a duck’s world <span aria-hidden="true">↗</span></span>
        <span class="launch-art-star launch-art-star-one" aria-hidden="true">✳</span><span class="launch-art-star launch-art-star-two" aria-hidden="true">✦</span>
        <div class="launch-spark-control"><button id="launch-spark" type="button">${spark} Send a spark</button><span id="launch-spark-status" role="status">Make the illustration react</span></div>
        <figcaption>Illustration here. Live vision &amp; physics in the playground.</figcaption>
      </figure>
    </div>
    <div class="launch-tape" aria-hidden="true"><span>FOLLOW YOUR CURIOSITY</span><span>✳</span><span>MAKE A LITTLE TROUBLE</span><span>✳</span><span>FOLLOW YOUR CURIOSITY</span><span>✳</span></div>
    <section class="launch-connection" aria-labelledby="launch-connection-title">
      <div class="launch-connection-copy"><p class="launch-kicker">MEET THE CONNECTION</p><h2 id="launch-connection-title">A small signal.<br>A real reaction.</h2><p>Inside each experiment, the duck’s camera feeds a modeled vision adapter. A 668-neuron fly circuit sends commands to the duck’s movement policy.</p></div>
      <div class="launch-connection-demo" aria-label="Duck camera to modeled vision to fly circuit to duck movement">
        <div class="launch-camera-node"><svg viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="M6 32s12-23 34-23 34 23 34 23-12 23-34 23S6 32 6 32Z" stroke="currentColor" stroke-width="4"/><circle cx="40" cy="32" r="12" fill="currentColor"/><circle cx="44" cy="28" r="4" fill="#fff7df"/></svg><strong>See</strong><span>Duck camera</span></div>
        <span class="launch-node-arrow" aria-hidden="true">→</span>
        <div class="launch-brain-node"><svg viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="M40 13c-10-14-23-4-21 5C6 15 1 34 13 40c-5 12 8 22 17 14 0 5 10 6 10-2V13Zm0 0c10-14 23-4 21 5 13-3 18 16 6 22 5 12-8 22-17 14 0 5-10 6-10-2" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m22 26 10 7-8 10m34-17-10 7 8 10M32 33h16" stroke="currentColor" stroke-width="2.5"/><circle cx="32" cy="33" r="4" fill="currentColor"/><circle cx="48" cy="33" r="4" fill="currentColor"/></svg><strong>Signal</strong><span>Fly circuit</span></div>
        <span class="launch-node-arrow" aria-hidden="true">→</span>
        <div class="launch-body-node"><svg viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="M22 13h33l-5 15H26l-4-15ZM29 29l-6 12 10 9m13-21 7 12-9 9M18 53h22m1 0h22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="40" r="5" fill="currentColor"/><circle cx="52" cy="40" r="5" fill="currentColor"/></svg><strong>Move</strong><span>Duck body</span></div>
        <span class="launch-feedback-label">Movement changes the next view <span aria-hidden="true">↶</span></span>
      </div>
    </section>
    <footer class="launch-footer"><span>Built for experiments, big and small.</span><span>Runs on your device · No account needed</span></footer>
  </section>`;
}

/** Presentation-only controls; callbacks own all scene and simulator state. */
export function mountLaunchPage({ enterPlayground, startScenario }) {
  const root = document.querySelector("#launch-page");
  if (!root) throw new Error("The launch page must be mounted before its controls.");
  const motionButton = root.querySelector("#launch-motion");
  const beaconButton = root.querySelector("#launch-beacon");
  const sparkStatus = root.querySelector("#launch-spark-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let storedMotion = null;
  try { storedMotion = localStorage.getItem("duckfly.launch-motion.v1"); } catch { /* Storage is optional in embedded browsers. */ }
  let paused = storedMotion === "paused" || (storedMotion !== "playing" && reducedMotion.matches);
  let visible = !root.hidden;
  let ready = false;
  let sparkTimer;

  function syncMotion() {
    const stopped = paused || !visible || document.hidden;
    root.classList.toggle("launch-is-still", stopped);
    root.dataset.motion = stopped ? "paused" : "playing";
    motionButton.innerHTML = `${paused ? play : pause}<span>${paused ? "Play motion" : "Pause motion"}</span>`;
    motionButton.setAttribute("aria-label", paused ? "Play illustration motion" : "Pause illustration motion");
    motionButton.setAttribute("aria-pressed", String(paused));
  }

  root.querySelector("#launch-enter").addEventListener("click", () => enterPlayground());
  beaconButton.addEventListener("click", () => { if (ready) startScenario("target"); });
  motionButton.addEventListener("click", () => {
    paused = !paused;
    storedMotion = paused ? "paused" : "playing";
    try { localStorage.setItem("duckfly.launch-motion.v1", storedMotion); } catch { /* The preference still applies for this visit. */ }
    syncMotion();
  });
  root.querySelector("#launch-spark").addEventListener("click", () => {
    clearTimeout(sparkTimer);
    root.classList.remove("launch-sparking");
    // Restart only this short, decorative response. It never stimulates a real circuit.
    void root.offsetWidth;
    root.classList.add("launch-sparking");
    sparkStatus.textContent = "Spark sent. Your duck has an idea!";
    sparkTimer = setTimeout(() => {
      root.classList.remove("launch-sparking");
      sparkStatus.textContent = "Make the illustration react";
    }, 1800);
  });
  document.addEventListener("visibilitychange", syncMotion);
  reducedMotion.addEventListener("change", () => {
    if (storedMotion === null) paused = reducedMotion.matches;
    syncMotion();
  });
  syncMotion();

  return {
    setVisible(value) {
      visible = Boolean(value);
      root.hidden = !visible;
      if (!visible) {
        clearTimeout(sparkTimer);
        root.classList.remove("launch-sparking");
        sparkStatus.textContent = "Make the illustration react";
      }
      syncMotion();
    },
    setReady(value) {
      ready = Boolean(value);
      beaconButton.disabled = !ready;
      root.querySelector("#launch-status").textContent = ready
        ? "Your playground is ready. No account needed."
        : "Preparing your experiments…";
    },
    setError(message) {
      ready = false;
      beaconButton.disabled = true;
      root.querySelector('#launch-status').textContent = `Experiments could not load. ${message} Reload to try again.`;
    },
  };
}
