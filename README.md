# bank.iradgov.org

Site of the Bank of Irad, the currency-board central bank of the Irad Special Economic Zone (Irad ARG; facts from the lore
`canon.md` and the wiki articles *Bank of Irad*, *Iradi som* and *Bank of
Irad Clearing House*). The site itself is fully in-world; this README is not.

Domain: **bank.iradgov.org** (`CNAME`), a subdomain of the Office of the Governor's portal iradgov.org (a quiet hint
that the bank answers to the Governor; never say so on the site). GitHub Pages: branch `main`, root. DNS: a `bank`
CNAME record to `mjsbroadbent.github.io` in the iradgov.org zone. Addresses shown: `info@` and `press@bank.iradgov.org`.

## Structure

No build step. Each page is a plain HTML file with its English text inline; `assets/site.js` draws the header,
menu and footer, switches language and renders the data-driven parts.

- Pages: `index.html` (official rates, the peg, notice to the public, latest notices), `rates.html` (full table and
  converter), `currency-board.html` (rules, rate chart, the 2008 reset, dates, questions), `som.html` (banknote and
  coin facsimiles drawn in SVG by `site.js`), `notices.html`, `notice.html?id=<id>`, `banks.html` (register),
  `publications.html` (deadpan dead ends: print only, "in preparation"), `about.html` (functions, history,
  governance, Clearing House, contact), `404.html`.
- `assets/i18n.js`: `ui` (interface strings, en/ir/ru) and `pages` (Iradi and Russian text for every `data-i18n`
  key in the HTML). Iradi is the Kyrgyz-based Latin orthography (ı ö ü ñ j ch sh), following iradgov.org. Language
  is remembered in `localStorage` `boi_lang`; `?lang=ir` / `?lang=ru` also work.
- `assets/site.css`: colours from the brand package (deep green `#0E4D3A`, gold `#B8902F`, ivory `#F6F0E0`, sage,
  pale gold); PT Serif / PT Sans from Google Fonts. Distinct from iradgov.org's crimson.
- Brand files copied from the lore's `brands/bankofirad/logo/` (logo per language, mark, ram's-horn border; `border-gold.svg` is
  the border recoloured gold) and bank logos from `brands/talasbank`, `brands/akbata`, `brands/chuybank` into
  `assets/logos/`. `state-emblem.svg` / `state-emblem-160.png` are copied from iradgov.
- Favicons (`favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`) are rendered from `bankofirad-mark.svg`;
  `assets/og-image.png` is the 1200×630 share image.
- Analytics: the shared GoatCounter + Google Analytics snippet in every page head.

## Exchange rates

Pages read `https://iradone.com/data/today.json` (GET only, 6-second timeout): `rates.official` (a list of
`{code, units, som}`; an object with `rows` also works) and `date`. Only the official rates are shown; the bazaar
rate in the same file is never displayed. If the file can't be read, the site shows USD 8.40 and "Rates of other
currencies are temporarily unavailable." Currency names are `cur_<CODE>` in `i18n.js` (add one for a new code).

## Adding a notice or press release

Add an object to `notices` in `data/notices.json` (the site sorts by date) and its URL to `sitemap.xml`:

```json
{
  "id": "2026-11-04-short-slug",
  "kind": "notice",
  "date": "2026-11-04",
  "home": true,
  "number":  { "en": "Bank of Irad Notice 2026/7", "ir": "Irad Bankının 2026/7 bildirüüsü", "ru": "Уведомление Банка Ирада 2026/7" },
  "status":  { "en": "In force", "ir": "Küchündö", "ru": "Действует" },
  "title":   { "en": "…", "ir": "…", "ru": "…" },
  "summary": { "en": "…", "ir": "…", "ru": "…" },
  "text":    { "en": ["paragraph", "…"], "ru": ["…"] },
  "signed":  { "en": "For the Bank of Irad: A. Temirov, Chairman. Talas, 4 November 2026.", "ir": "…", "ru": "…" }
}
```

- `kind`: `notice` (numbered `YYYY/N`; 2026/2 and 2026/5 match iradgov.org; 2026/6 is the Clearing House days),
  `statement` or `press`. `home: true` puts it in the home page list (newest four).
- `text` paragraphs may be simple HTML or one `<ol>`. Without the reader's language the English is shown with a note.
- Restate canon only: no new policy, laws or figures beyond what canon or an approved desk card has. Notices that also
  appear on iradgov.org must keep the same number, date and wording there and here.

## Register of licensed institutions

`data/banks.json` → `institutions`: `id`, `class` (`bank` or `mfi`), `licence`, `name`, optional `logo` (per language),
`established`, `head_office`, `chairman`, `branches` (`total`, `talas`, `nurzhan`, `iyik`) or `offices`, `clearing`,
`note` (all text en/ir/ru). Only institutions canon names.

## Banknotes and coins

`data/currency.json`: `banknotes` (`value`, `word`, `ink`, `tint`, optional `portrait` / `added`) and `coins`.
Denominations follow the wiki (*Iradi som*); colours are site-level. The facsimiles are marked "specimen" and never
draw a portrait.

## Checking

`python3 -m http.server` in this folder and look at every page in all three languages at 1366 px and 390 px. The
site makes no requests other than its own files, Google Fonts, the analytics snippet and the GET of the numbers file.
