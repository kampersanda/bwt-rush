import "./styles.css";
import { CATEGORY_OPTIONS, WORD_BANK, type CategoryId, type WordEntry } from "./words";

type Screen = "title" | "playing" | "gameover";
type CategoryFilter = CategoryId | "all";

type WordEntity = {
  id: number;
  prompt: string;
  answer: string;
  category: CategoryId;
  difficulty: number;
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

const categoryOptionsMarkup = CATEGORY_OPTIONS.map(
  (option) =>
    `<option value="${option.id}">${option.label} - ${option.description}</option>`,
).join("");

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Inverse BWT Arcade</p>
      <h1>BWT Rush</h1>
      <p class="lede">
        Each token is a Burrows-Wheeler transformed string. Reconstruct the original word before it escapes.
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
        <strong id="lives">7</strong>
      </div>
      <div class="metric">
        <span class="label">Intensity</span>
        <strong id="intensity">1.0x</strong>
      </div>
    </section>

    <section class="panel controls-panel">
      <div class="category-bar">
        <label for="categorySelect">Category</label>
        <select id="categorySelect">
          <option value="all">All categories</option>
          ${categoryOptionsMarkup}
        </select>
      </div>
      <p id="categoryHint" class="category-hint">
        Mixed vocabulary. Pick a category if you want more predictable prompts.
      </p>
    </section>

    <section class="panel game-panel">
      <div id="gameArea" class="game-area" aria-label="Game field"></div>
      <div class="input-bar">
        <label for="typingInput">Original</label>
        <input
          id="typingInput"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Type the original word without $"
        />
      </div>
      <div class="status-row">
        <p id="statusText" class="status-text">
          Press Start. Prompts are BWT strings, but your input should be the original word.
        </p>
        <div class="button-row">
          <button id="startButton" class="action-button">Start run</button>
          <button id="stopButton" class="secondary-button" disabled>Stop</button>
        </div>
      </div>
    </section>

    <section class="panel tips">
      <p>Rule: the first correct keystroke locks a prompt whose original string starts with that prefix.</p>
      <p>The sentinel $ stays in the prompt. You do not need to type it in your answer.</p>
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
const stopButtonEl = requiredById<HTMLButtonElement>("stopButton");
const categorySelectEl = requiredById<HTMLSelectElement>("categorySelect");
const categoryHintEl = requiredById("categoryHint");

class TypingGame {
  private readonly area = gameAreaEl;
  private readonly input = inputEl;
  private readonly status = statusEl;
  private readonly categorySelect = categorySelectEl;
  private readonly categoryHint = categoryHintEl;
  private readonly scoreboard = {
    score: scoreEl,
    combo: comboEl,
    lives: livesEl,
    intensity: intensityEl,
  };
  private readonly words = WORD_BANK;

  private screen: Screen = "title";
  private selectedCategory: CategoryFilter = "all";
  private stats: Stats = {
    score: 0,
    combo: 0,
    lives: 7,
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
    this.categorySelect.addEventListener("change", () => this.onCategoryChange());
    startButtonEl.addEventListener("click", () => {
      if (this.screen === "playing") {
        this.restart();
      } else {
        this.start();
      }
    });
    stopButtonEl.addEventListener("click", () => this.stop());

    this.renderHud();
    this.renderCategoryHint();
  }

  start() {
    this.restartState();
    this.screen = "playing";
    this.setStatus("Inverse the BWTs and exploit the category signal.");
    startButtonEl.textContent = "Restart run";
    stopButtonEl.disabled = false;
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

  stop() {
    if (this.screen !== "playing") {
      return;
    }

    this.screen = "title";
    this.activeWordId = null;
    this.input.disabled = true;
    this.input.value = "";
    stopButtonEl.disabled = true;
    window.cancelAnimationFrame(this.animationFrame);
    this.setStatus("Run stopped. Press Start to begin a fresh run.");
    startButtonEl.textContent = "Start run";
    this.renderWords();
  }

  private restartState() {
    this.screen = "playing";
    this.stats = {
      score: 0,
      combo: 0,
      lives: 7,
      elapsedMs: 0,
    };
    this.entities = [];
    this.activeWordId = null;
    this.nextSpawnMs = 1550;
    this.spawnCount = 0;
    this.entityId = 0;
    this.input.value = "";
    this.renderHud();
    stopButtonEl.disabled = false;
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
    const entry = this.pickWord();
    const intensity = this.currentIntensity();
    const entity: WordEntity = {
      id: this.entityId++,
      prompt: entry.bwt,
      answer: entry.answer,
      category: entry.category,
      difficulty: entry.difficulty,
      typedIndex: 0,
      x: -180,
      y: 24 + (this.spawnCount % 5) * 62,
      speed: 36 + intensity * 9 + Math.random() * 8,
      width: estimateWordWidth(entry.bwt),
    };

    this.spawnCount += 1;
    this.entities.push(entity);
    if (this.entities.length > 7) {
      this.entities.sort((a, b) => b.x - a.x);
    }
  }

  private advanceWords(deltaMs: number) {
    const deltaSec = deltaMs / 1000;
    const boundary = this.area.clientWidth + 90;
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
        this.setStatus(`Missed ${entity.prompt}. Original word: ${entity.answer}.`);
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
      const isDanger = entity.x + entity.width > this.area.clientWidth - 190;
      const progress = `${entity.typedIndex}/${entity.answer.length}`;

      wordEl.className = "word";
      if (isActive) {
        wordEl.classList.add("active");
      }
      if (isDanger) {
        wordEl.classList.add("danger");
      }

      wordEl.style.transform = `translate(${entity.x}px, ${entity.y}px)`;

      const prompt = `<span class="prompt">${escapeHtml(entity.prompt)}</span>`;
      const meta = isActive
        ? `<span class="meta">${labelForCategory(entity.category)} · answer progress ${progress}</span>`
        : `<span class="meta">${labelForCategory(entity.category)} · invert this BWT</span>`;

      wordEl.innerHTML = `${prompt}${meta}`;
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
        this.status.textContent = "No visible BWT has an original string with that prefix.";
        return;
      }
      this.activeWordId = active.id;
    }

    if (!active.answer.startsWith(typed)) {
      this.stats.combo = 0;
      this.setStatus(`Broken lock on ${active.prompt}.`);
      this.input.value = "";
      active.typedIndex = 0;
      this.activeWordId = null;
      this.renderHud();
      this.renderWords();
      return;
    }

    active.typedIndex = typed.length;

    if (typed === active.answer) {
      this.completeWord(active.id);
      return;
    }

    this.setStatus(`Locked on ${active.prompt}.`);
    this.renderWords();
  }

  private onCategoryChange() {
    this.selectedCategory = this.categorySelect.value as CategoryFilter;
    this.renderCategoryHint();
    if (this.screen === "playing") {
      this.restart();
    }
  }

  private acquireTarget(prefix: string) {
    const candidates = this.entities
      .filter((entity) => entity.answer.startsWith(prefix))
      .sort((a, b) => b.x - a.x);
    return candidates[0];
  }

  private completeWord(id: number) {
    const entity = this.entities.find((item) => item.id === id);
    if (!entity) {
      return;
    }

    const bonus = 16 + entity.answer.length * 4 + entity.difficulty * 2 + this.stats.combo * 3;
    this.stats.score += bonus;
    this.stats.combo += 1;
    this.activeWordId = null;
    this.input.value = "";
    this.entities = this.entities.filter((item) => item.id !== id);
    this.setStatus(`Cleared ${entity.prompt} -> ${entity.answer} for ${bonus} points.`);
    this.renderHud();
    this.renderWords();
  }

  private finish() {
    this.screen = "gameover";
    this.input.disabled = true;
    this.activeWordId = null;
    stopButtonEl.disabled = true;
    window.cancelAnimationFrame(this.animationFrame);
    this.setStatus(`Game over. Final score: ${this.stats.score}.`);
    startButtonEl.textContent = "Play again";
    this.renderHud();
  }

  private currentIntensity() {
    return 1 + this.stats.elapsedMs / 60000;
  }

  private spawnDelay() {
    return Math.max(1150, 2100 - this.currentIntensity() * 110);
  }

  private pickWord() {
    const intensity = this.currentIntensity();
    const maxDifficulty = intensity < 1.7 ? 6 : intensity < 2.4 ? 8 : 11;
    const pool = this.filteredWords().filter((word) => word.difficulty <= maxDifficulty);
    const candidates = pool.length > 0 ? pool : this.filteredWords();
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private filteredWords() {
    if (this.selectedCategory === "all") {
      return this.words;
    }
    return this.words.filter((word) => word.category === this.selectedCategory);
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

  private renderCategoryHint() {
    if (this.selectedCategory === "all") {
      this.categoryHint.textContent =
        "Mixed vocabulary. Pick a category if you want more predictable prompts.";
      return;
    }

    const option = CATEGORY_OPTIONS.find((item) => item.id === this.selectedCategory);
    this.categoryHint.textContent = option
      ? `${option.label}: ${option.description}.`
      : "Category selected.";
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

function labelForCategory(category: CategoryId) {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? category;
}

function estimateWordWidth(text: string) {
  return 54 + text.length * 20;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

void (WORD_BANK satisfies WordEntry[]);

new TypingGame();
