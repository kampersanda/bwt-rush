import "./styles.css";
import { WORD_BANK } from "./words";

type Screen = "title" | "playing" | "gameover";

type WordEntity = {
  id: number;
  text: string;
  typedIndex: number;
  x: number;
  y: number;
  speed: number;
  width: number;
};

type Stats = {
  score: number;
  combo: number;
  lives: number;
  elapsedMs: number;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Typing Survival Prototype</p>
      <h1>BWT Rush</h1>
      <p class="lede">
        Lock onto a word, finish it before it escapes, and keep the lane clean.
      </p>
    </header>

    <section class="panel hud">
      <div class="metric">
        <span class="label">Score</span>
        <strong id="score">0</strong>
      </div>
      <div class="metric">
        <span class="label">Combo</span>
        <strong id="combo">0</strong>
      </div>
      <div class="metric">
        <span class="label">Lives</span>
        <strong id="lives">5</strong>
      </div>
      <div class="metric">
        <span class="label">Intensity</span>
        <strong id="intensity">1.0x</strong>
      </div>
    </section>

    <section class="panel game-panel">
      <div id="gameArea" class="game-area" aria-label="Game field"></div>
      <div class="input-bar">
        <label for="typingInput">Input</label>
        <input
          id="typingInput"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Start typing to lock a word"
        />
      </div>
      <div class="status-row">
        <p id="statusText" class="status-text">
          Press Start and keep your hands on the keyboard.
        </p>
        <button id="startButton" class="action-button">Start run</button>
      </div>
    </section>

    <section class="panel tips">
      <p>Rules: the first correct keystroke locks a word. Missed words cost one life.</p>
      <p>Tip: target the word closest to the exit when several share the same first letter.</p>
    </section>
  </main>
`;

const scoreEl = requiredById("score");
const comboEl = requiredById("combo");
const livesEl = requiredById("lives");
const intensityEl = requiredById("intensity");
const gameAreaEl = requiredById("gameArea");
const inputEl = requiredById<HTMLInputElement>("typingInput");
const statusEl = requiredById("statusText");
const startButtonEl = requiredById<HTMLButtonElement>("startButton");

class TypingGame {
  private readonly area = gameAreaEl;
  private readonly input = inputEl;
  private readonly status = statusEl;
  private readonly scoreboard = {
    score: scoreEl,
    combo: comboEl,
    lives: livesEl,
    intensity: intensityEl,
  };
  private readonly words = WORD_BANK;

  private screen: Screen = "title";
  private stats: Stats = {
    score: 0,
    combo: 0,
    lives: 5,
    elapsedMs: 0,
  };
  private entities: WordEntity[] = [];
  private activeWordId: number | null = null;
  private animationFrame = 0;
  private lastFrame = 0;
  private nextSpawnMs = 0;
  private spawnCount = 0;
  private entityId = 0;

  constructor() {
    this.input.addEventListener("input", () => this.onInput());
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
      }
    });
    startButtonEl.addEventListener("click", () => {
      if (this.screen === "playing") {
        this.restart();
      } else {
        this.start();
      }
    });

    this.renderHud();
  }

  start() {
    this.restartState();
    this.screen = "playing";
    this.setStatus("Survive as long as you can.");
    startButtonEl.textContent = "Restart run";
    this.input.disabled = false;
    this.input.focus();
    this.lastFrame = performance.now();
    this.animationFrame = window.requestAnimationFrame((time) => this.tick(time));
  }

  restart() {
    window.cancelAnimationFrame(this.animationFrame);
    this.area.replaceChildren();
    this.start();
  }

  private restartState() {
    this.screen = "playing";
    this.stats = {
      score: 0,
      combo: 0,
      lives: 5,
      elapsedMs: 0,
    };
    this.entities = [];
    this.activeWordId = null;
    this.nextSpawnMs = 800;
    this.spawnCount = 0;
    this.entityId = 0;
    this.input.value = "";
    this.renderHud();
  }

  private tick(now: number) {
    if (this.screen !== "playing") {
      return;
    }

    const deltaMs = Math.min(32, now - this.lastFrame);
    this.lastFrame = now;
    this.stats.elapsedMs += deltaMs;

    if (this.stats.elapsedMs >= this.nextSpawnMs) {
      this.spawnWord();
      this.nextSpawnMs += this.spawnDelay();
    }

    this.advanceWords(deltaMs);
    this.renderWords();
    this.renderHud();

    if (this.stats.lives <= 0) {
      this.finish();
      return;
    }

    this.animationFrame = window.requestAnimationFrame((time) => this.tick(time));
  }

  private spawnWord() {
    const text = this.pickWord();
    const intensity = this.currentIntensity();
    const entity: WordEntity = {
      id: this.entityId++,
      text,
      typedIndex: 0,
      x: -120,
      y: 24 + (this.spawnCount % 6) * 54,
      speed: 70 + intensity * 22 + Math.random() * 25,
      width: estimateWordWidth(text),
    };

    this.spawnCount += 1;
    this.entities.push(entity);
    if (this.entities.length > 12) {
      this.entities.sort((a, b) => b.x - a.x);
    }
  }

  private advanceWords(deltaMs: number) {
    const deltaSec = deltaMs / 1000;
    const boundary = this.area.clientWidth + 80;
    const survivors: WordEntity[] = [];

    for (const entity of this.entities) {
      entity.x += entity.speed * deltaSec;

      if (entity.x > boundary) {
        if (this.activeWordId === entity.id) {
          this.activeWordId = null;
          this.input.value = "";
        }
        this.stats.lives -= 1;
        this.stats.combo = 0;
        this.setStatus(`Missed "${entity.text}".`);
        continue;
      }

      survivors.push(entity);
    }

    this.entities = survivors;
  }

  private renderWords() {
    this.area.replaceChildren();

    for (const entity of this.entities) {
      const wordEl = document.createElement("div");
      const isActive = entity.id === this.activeWordId;
      const isDanger = entity.x + entity.width > this.area.clientWidth - 170;

      wordEl.className = "word";
      if (isActive) {
        wordEl.classList.add("active");
      }
      if (isDanger) {
        wordEl.classList.add("danger");
      }

      wordEl.style.transform = `translate(${entity.x}px, ${entity.y}px)`;

      const typed = entity.text.slice(0, entity.typedIndex);
      const rest = entity.text.slice(entity.typedIndex);
      wordEl.innerHTML = `<span class="typed">${escapeHtml(typed)}</span><span>${escapeHtml(rest)}</span>`;
      this.area.appendChild(wordEl);
    }
  }

  private onInput() {
    if (this.screen !== "playing") {
      return;
    }

    const typed = this.input.value.trim().toLowerCase();
    if (!typed) {
      if (this.activeWordId !== null) {
        const entity = this.findActiveWord();
        if (entity) {
          entity.typedIndex = 0;
        }
      }
      this.activeWordId = null;
      this.renderWords();
      return;
    }

    let active = this.findActiveWord();
    if (!active) {
      active = this.acquireTarget(typed);
      if (!active) {
        this.status.textContent = "No visible word matches that prefix.";
        return;
      }
      this.activeWordId = active.id;
    }

    if (!active.text.startsWith(typed)) {
      this.stats.combo = 0;
      this.setStatus(`Broken lock on "${active.text}".`);
      this.input.value = "";
      active.typedIndex = 0;
      this.activeWordId = null;
      this.renderHud();
      this.renderWords();
      return;
    }

    active.typedIndex = typed.length;

    if (typed === active.text) {
      this.completeWord(active.id);
      return;
    }

    this.setStatus(`Locked on "${active.text}".`);
    this.renderWords();
  }

  private acquireTarget(prefix: string) {
    const candidates = this.entities
      .filter((entity) => entity.text.startsWith(prefix))
      .sort((a, b) => b.x - a.x);
    return candidates[0];
  }

  private completeWord(id: number) {
    const entity = this.entities.find((item) => item.id === id);
    if (!entity) {
      return;
    }

    const bonus = 10 + entity.text.length * 3 + this.stats.combo * 2;
    this.stats.score += bonus;
    this.stats.combo += 1;
    this.activeWordId = null;
    this.input.value = "";
    this.entities = this.entities.filter((item) => item.id !== id);
    this.setStatus(`Cleared "${entity.text}" for ${bonus} points.`);
    this.renderHud();
    this.renderWords();
  }

  private finish() {
    this.screen = "gameover";
    this.input.disabled = true;
    this.activeWordId = null;
    window.cancelAnimationFrame(this.animationFrame);
    this.setStatus(`Game over. Final score: ${this.stats.score}.`);
    startButtonEl.textContent = "Play again";
    this.renderHud();
  }

  private currentIntensity() {
    return 1 + this.stats.elapsedMs / 30000;
  }

  private spawnDelay() {
    return Math.max(450, 1150 - this.currentIntensity() * 140);
  }

  private pickWord() {
    const intensity = this.currentIntensity();
    const maxLength = intensity < 1.8 ? 5 : intensity < 2.6 ? 7 : 9;
    const candidates = this.words.filter((word) => word.length <= maxLength);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private findActiveWord() {
    if (this.activeWordId === null) {
      return null;
    }
    return this.entities.find((entity) => entity.id === this.activeWordId) ?? null;
  }

  private renderHud() {
    this.scoreboard.score.textContent = String(this.stats.score);
    this.scoreboard.combo.textContent = String(this.stats.combo);
    this.scoreboard.lives.textContent = String(Math.max(this.stats.lives, 0));
    this.scoreboard.intensity.textContent = `${this.currentIntensity().toFixed(1)}x`;
  }

  private setStatus(message: string) {
    this.status.textContent = message;
  }
}

function requiredById<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element #${id} not found`);
  }
  return element as T;
}

function estimateWordWidth(text: string) {
  return 28 + text.length * 18;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

new TypingGame();
