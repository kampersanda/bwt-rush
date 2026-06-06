# bwt-rush

A browser game prototype for string processing fans, built with Vite and TypeScript.

Each displayed token is a Burrows-Wheeler transformed string. The player must reconstruct the original word, without typing the terminal `$`.

The prototype also supports category-based runs such as stringology terms, NLP venues, IR venues, and genomics vocabulary.

This prototype was developed with assistance from OpenAI Codex.

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
