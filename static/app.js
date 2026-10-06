const prizes = [10, 20, 30, 40, 50, 88],
  canvas = document.getElementById("wheel"),
  ctx = canvas.getContext("2d"),
  btn = document.getElementById("spin"),
  statusEl = document.getElementById("status"),
  result = document.getElementById("result");

let rotation = 0,
  busy = false;

const arc = Math.PI * 2 / prizes.length;

function draw() {
  const c = 450,
    r = 414;

  ctx.clearRect(0, 0, 900, 900);

  prizes.forEach((p, i) => {
    let s = -Math.PI / 2 + i * arc,
      e = s + arc,
      g = ctx.createRadialGradient(c, c, 60, c, c, r);

    g.addColorStop(0, i % 2 ? "#d8a84f" : "#7d571f");
    g.addColorStop(1, i % 2 ? "#5b3911" : "#1c1308");

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, s, e);
    ctx.closePath();

    ctx.fillStyle = g;
    ctx.fill();

    ctx.lineWidth = 7;
    ctx.strokeStyle = "#e3bd67";
    ctx.stroke();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(s + arc / 2);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff0c4";
    ctx.font = `900 ${p === 88 ? 58 : 54}px Arial`;

    ctx.fillText(p + " $", r - 58, 0);

    if (p === 88) {
      ctx.font = "900 22px Arial";
      ctx.fillText("JACKPOT", r - 62, 38);
    }

    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(c, c, 92, 0, Math.PI * 2);

  ctx.fillStyle = "#080604";
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = "#d9ae5a";
  ctx.stroke();

  ctx.fillStyle = "#f2d184";
  ctx.textAlign = "center";
  ctx.font = "900 66px Georgia";
  ctx.fillText("88", c, c + 18);
}

draw();

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": tg?.initData || ""
  };
}

async function load() {
  try {
    let r = await fetch("/api/me", {
      headers: headers()
    });

    let d = await r.json();

    if (!r.ok) throw d;

    if (d.spins_available > 0) {
      statusEl.textContent = "✅ Votre tour a été validé";
      btn.disabled = false;
    } else {
      statusEl.textContent =
        "🔒 Aucun tour disponible — validation requise";
      btn.disabled = true;
    }
  } catch (e) {
    statusEl.textContent =
      "Ouvrez cette roulette depuis le bot Telegram.";
    btn.disabled = true;
  }
}

load();

btn.addEventListener("click", async () => {
  if (busy) return;

  busy = true;
  btn.disabled = true;
  result.textContent = "Bonne chance…";

  try {
    let r = await fetch("/api/spin", {
      method: "POST",
      headers: headers(),
      body: "{}"
    });

    let d = await r.json();

    if (!r.ok) throw d;

    /*
     * Le serveur choisit le gain.
     * Cette partie détermine uniquement où la roue
     * s'arrête VISUELLEMENT.
     */

    const idx = prizes.indexOf(d.prize);

    const slice = 360 / prizes.length;

    /*
     * Chaque secteur fait 60°.
     *
     * La roue dessinée commence à -90°.
     * La flèche est également située à -90°.
     *
     * Centre du secteur gagnant :
     * idx * 60 + 30
     */

    const sectorCenter = idx * slice + slice / 2;

    /*
     * Petite variation aléatoire à l'intérieur du secteur.
     *
     * On garde une marge de 10° de chaque côté
     * afin que la flèche ne tombe jamais sur une séparation.
     */

    const margin = 10;

    const maxJitter = slice / 2 - margin;

    const jitter =
      (Math.random() * 2 - 1) * maxJitter;

    /*
     * Angle final souhaité.
     *
     * On place le point choisi du secteur
     * exactement sous la flèche située en haut.
     */

    const desiredRotation =
      -(sectorCenter + jitter);

    /*
     * Rotation actuelle normalisée.
     */

    const currentRotation =
      ((rotation % 360) + 360) % 360;

    /*
     * Rotation cible normalisée.
     */

    const targetRotation =
      ((desiredRotation % 360) + 360) % 360;

    /*
     * Distance nécessaire jusqu'à la position cible.
     */

    const delta =
      (targetRotation - currentRotation + 360) % 360;

    /*
     * 7 tours complets + déplacement vers
     * la bonne position.
     */

    rotation += 360 * 7 + delta;

    canvas.style.transform =
      `rotate(${rotation}deg)`;

    setTimeout(() => {

      if (d.prize === 88) {
        result.textContent =
          "🏆 JACKPOT — 88 $ !";
      } else {
        result.textContent =
          `🎉 Vous gagnez ${d.prize} $ !`;
      }

      statusEl.textContent =
        "Tour utilisé — en attente d'une nouvelle validation";

      busy = false;

    }, 5750);

  } catch (e) {

    result.textContent =
      e.error === "no_spin_available"
        ? "Aucun tour disponible."
        : "Impossible d'effectuer le tirage.";

    busy = false;
  }
});
