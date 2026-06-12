# BWT Rush!

A browser game for string processing fans, built with Vite and TypeScript.

Each displayed token is a Burrows-Wheeler transformed string. The player must reconstruct the original word, without typing the terminal `$`.

This game supports category-based runs such as easy everyday words, stringology terms, NLP vocabulary, IR vocabulary, and genomics vocabulary.

This program was developed with assistance from OpenAI Codex.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite `base` path is configured for GitHub Pages project hosting at `/bwt-rush/`.
