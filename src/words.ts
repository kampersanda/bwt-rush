export type CategoryId = "stringology" | "nlp" | "ir" | "genomics";

export type WordEntry = {
  text: string;
  source: string;
  bwt: string;
  answer: string;
  difficulty: number;
  category: CategoryId;
};

export type CategoryOption = {
  id: CategoryId;
  label: string;
  description: string;
};

const CATEGORY_WORDS: Record<CategoryId, string[]> = {
  stringology: [
    "alphabet",
    "approximate",
    "automaton",
    "suffix",
    "trie",
    "lcp",
    "lcs",
    "wavelet",
    "runs",
    "lyndon",
    "palindrome",
    "border",
    "factor",
    "substring",
    "subsequence",
    "rotation",
    "grammar",
    "sampling",
    "period",
    "prefix",
    "failure",
    "zfunction",
    "suffixarray",
    "suffixtree",
    "fmindex",
    "rankselect",
    "matching",
    "occurrence",
    "partition",
    "compression",
    "repetition",
    "conjugate",
    "dictionary",
    "minimal",
    "maximal",
    "superstring",
    "editdistance",
    "bisimulation",
  ],
  nlp: [
    "acl",
    "ijcnlp",
    "emnlp",
    "naacl",
    "coling",
    "eacl",
    "tacl",
    "findings",
    "token",
    "prompt",
    "decoder",
    "encoder",
    "corpus",
    "embedding",
    "attention",
    "transformer",
    "finetuning",
    "pretraining",
    "alignment",
    "reasoning",
    "incontext",
    "benchmark",
    "tokenizer",
    "sentencepiece",
    "translation",
    "summarization",
    "generation",
    "evaluation",
    "inference",
    "retriever",
    "hallucination",
    "instruction",
    "distillation",
    "multilingual",
    "parsing",
    "tagging",
    "coreference",
    "entailment",
  ],
  ir: [
    "sigir",
    "cikm",
    "ecir",
    "trec",
    "www",
    "wsdm",
    "recsys",
    "query",
    "ranker",
    "session",
    "passage",
    "retrieval",
    "click",
    "index",
    "rerank",
    "corpus",
    "snippet",
    "relevance",
    "bm25",
    "dense",
    "sparse",
    "fusion",
    "judgment",
    "latency",
    "candidate",
    "qrel",
    "runfile",
    "personalization",
    "diversity",
    "novelty",
    "serp",
    "recommendation",
    "navigation",
    "satisfaction",
    "fairness",
    "auction",
    "sponsored",
  ],
  genomics: [
    "genome",
    "read",
    "contig",
    "kmer",
    "minimizer",
    "haplotype",
    "variant",
    "splice",
    "transcript",
    "aligner",
    "coverage",
    "assembly",
    "protein",
    "adapter",
    "reference",
    "overlap",
    "scaffold",
    "chromosome",
    "nanopore",
    "illumina",
    "pacbio",
    "mutation",
    "methylation",
    "exon",
    "intron",
    "primer",
    "barcode",
    "phasing",
    "consensus",
    "graphgenome",
    "seedchain",
    "transposon",
    "annotation",
    "ortholog",
  ],
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: "stringology",
    label: "Stringology",
    description: "suffix arrays, runs, wavelet trees, and related terms",
  },
  {
    id: "nlp",
    label: "NLP",
    description: "ACL-family venues and common NLP terms",
  },
  {
    id: "ir",
    label: "Information Retrieval",
    description: "SIGIR-style conference names and retrieval vocabulary",
  },
  {
    id: "genomics",
    label: "Genomics",
    description: "sequence analysis and assembly terminology",
  },
];

export const WORD_BANK: WordEntry[] = Object.entries(CATEGORY_WORDS).flatMap(
  ([category, words]) =>
    words.map((text) => {
      const source = `${text}$`;
      return {
        text,
        source,
        bwt: burrowsWheelerTransform(source),
        answer: text,
        difficulty: scoreDifficulty(text),
        category: category as CategoryId,
      };
    }),
);

function burrowsWheelerTransform(source: string) {
  const rotations = Array.from({ length: source.length }, (_, index) => {
    return source.slice(index) + source.slice(0, index);
  }).sort();

  return rotations
    .map((rotation) => rotation[rotation.length - 1] ?? "")
    .join("");
}

function scoreDifficulty(text: string) {
  const distinctChars = new Set(text).size;
  return text.length + Math.max(0, text.length - distinctChars);
}
