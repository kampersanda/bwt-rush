export type WordEntry = {
  text: string;
  source: string;
  bwt: string;
  difficulty: number;
};

const RAW_WORDS = [
  "amber",
  "arrow",
  "atlas",
  "bamboo",
  "beacon",
  "binary",
  "blaze",
  "bloom",
  "canyon",
  "cipher",
  "comet",
  "copper",
  "crystal",
  "delta",
  "ember",
  "falcon",
  "flux",
  "forest",
  "frozen",
  "galaxy",
  "glimmer",
  "harbor",
  "helium",
  "horizon",
  "jungle",
  "kernel",
  "legend",
  "linen",
  "meteor",
  "midnight",
  "nebula",
  "onyx",
  "orbit",
  "petal",
  "photon",
  "pixel",
  "planet",
  "plasma",
  "puzzle",
  "quantum",
  "quartz",
  "rally",
  "rocket",
  "shadow",
  "signal",
  "silver",
  "spiral",
  "static",
  "storm",
  "summit",
  "talon",
  "tunnel",
  "vector",
  "velvet",
  "voyage",
  "willow",
  "window",
  "zenith",
];

export const WORD_BANK: WordEntry[] = RAW_WORDS.map((text) => {
  const source = `${text}$`;
  return {
    text,
    source,
    bwt: burrowsWheelerTransform(source),
    difficulty: scoreDifficulty(text),
  };
});

function burrowsWheelerTransform(source: string) {
  const rotations = Array.from({ length: source.length }, (_, index) => {
    return source.slice(index) + source.slice(0, index);
  }).sort();

  return rotations.map((rotation) => rotation[rotation.length - 1] ?? "").join("");
}

function scoreDifficulty(text: string) {
  const distinctChars = new Set(text).size;
  return text.length + Math.max(0, text.length - distinctChars);
}
