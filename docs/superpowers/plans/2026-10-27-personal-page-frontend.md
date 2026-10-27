# Personal Page Front End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static front end of Tomáš Sezima's personal page, as described in the design document, runnable locally with `npm run dev`.

**Architecture:** A zero-framework static site. A small Node build script renders the content files (events, posts) into one HTML template and copies CSS, browser ES modules and self-hosted fonts into `dist/`. The canvas animation is split into pure modules (wall generation, layout geometry, scroll phases) that run under `node --test`, plus a drawing module and a thin `main.js` that wires them to the DOM. The reference implementation of every visual behavior is `prototypes/split-layout.html`; port from it, do not reinvent.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node 25 (`node:test`, `node:fs`, `node:http`), npm packages `@fontsource-variable/space-grotesk` and `@fontsource-variable/inter` (dev only, font files).

**Spec:** `docs/superpowers/specs/2026-10-27-personal-page-design.md`

## Global Constraints

- Output is plain static files in `dist/`; no server-side code (spec 4).
- All copy: plain international English, sentences of about 15 words, no idioms, no em dashes or en dashes, numbers as digits (spec 4).
- No invented facts or numbers. Missing content is hidden, never filled (spec 3, 6.2).
- Colors: navy `#1c2030`, clay `#b4634a`, blue `#6e8ba5`, pink `#dcc5ba`, light `#e6d8ce`, muted text `#b4b8c2` (spec 5.1).
- Fonts: Space Grotesk for name, headings, menu, small labels, dates, buttons; Inter for paragraphs and layer sentences; both self-hosted, no request to Google (spec 5.1, 8).
- No analytics, no cookies, no third-party requests at runtime (spec 8).
- The canvas is decorative (`aria-hidden="true"`); all information is HTML text (spec 8).
- No AWS or Databricks logos (spec 2).
- Contact: https://www.linkedin.com/in/sezima and sezimatomas@gmail.com (spec 6.7).

## Review Focus

1. Resize across the 760 px breakpoint in the middle of the page: the wall rebuilds for the new layout, and no tile stays visible outside the panel or the stack. Test: Task 8 smoke test `resize from desktop to phone mid-scroll leaves no stray tiles`.
2. Page opened already scrolled (browser restore, or a link to `#community`): the first frame shows the correct state for that scroll position (stack built, labels visible), with no animation from the top. Test: Task 7 `phases depend only on the scroll position`, Task 8 `first frame deep in the page shows the finished stack`.
3. Event data with missing optional fields or HTML characters (`&`, `<`) in titles: the page shows escaped text and never prints "undefined" or "null". Test: Task 2 `renderEvent escapes text and skips missing optional fields`.
4. A meetup on today's date: it is still the "next event". Test: Task 4 `an event today is still next`.
5. No posts: the Posts section and its menu link are absent, and the layer labels finish at the end of Community. Test: Task 3 `renderPage removes posts section and nav link when there are no posts`, Task 7 `labels finish at the end of the given end section`.

---

## File Structure

```
package.json                 scripts and dev dependencies, "type": "module"
.gitignore                   node_modules, dist
.gitattributes               * text=auto eol=lf
content/events/*.json        one file per meetup (5 files, Task 2)
content/posts/.gitkeep       posts folder, empty for now (Task 3)
src/index.html               page template with static copy and render markers
src/css/site.css             all styles, ported from the prototype
src/css/fonts.css            @font-face rules for the self-hosted fonts
src/js/palette.js            colors, layer definitions, network layout constants
src/js/math.js               clamp, lerp, ease
src/js/wall.js               tile wall generation and idle movement (pure)
src/js/layout.js             panel, leaving tiles, stack geometry (pure)
src/js/progress.js           scroll phases and per-tile progress (pure)
src/js/draw.js               canvas drawing of tiles, slabs and labels
src/js/next-event.js         picks and shows the next meetup at runtime
src/js/main.js               DOM wiring, resize, animation loop, reduced motion
src/build/content.js         load, validate and render events and posts (pure)
scripts/build.mjs            builds dist/
scripts/serve.mjs            local static server for dist/
tests/helpers.js             seeded random generator and canvas stub
tests/*.test.js              one test file per module
```

---

### Task 1: Scaffold, static page and fonts

**Files:**
- Create: `package.json`, `.gitignore`, `.gitattributes`, `src/index.html`, `src/css/site.css`, `src/css/fonts.css`, `scripts/build.mjs`, `scripts/serve.mjs`, `src/build/content.js` (only `renderPage` stub), `tests/build.test.js`

**Interfaces:**
- Produces: `npm run build` writes `dist/index.html`, `dist/css/`, `dist/js/`, `dist/fonts/`. `npm run dev` builds and serves `dist/` at http://localhost:8080. `npm test` runs `node --test`.
- Produces: `renderPage(template: string, data: { events: Event[], posts: Post[], today: string }) -> string` in `src/build/content.js`. In this task it returns the template unchanged; Tasks 2 and 3 fill it in.
- Produces: template markers in `src/index.html`: `<!--@community-->`, `<!--@posts-->` (inside `<section id="posts">`), and the Posts menu link wrapped as `<!--@posts-nav--><a href="#posts">Posts</a><!--/@posts-nav-->`; the whole Posts section wrapped as `<!--@posts-section-->...<!--/@posts-section-->`.

- [ ] **Step 1: Write the failing test** `tests/build.test.js`

```js
test('build writes the page with the hero copy and self-hosted fonts', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');          // build is exported from scripts/build.mjs
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /I build the data platforms that products and AI agents run on\./);
  assert.match(html, /15 years of engineering, 10 of them in data, on AWS and Databricks\./);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('space-grotesk') && f.endsWith('.woff2')));
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('inter') && f.endsWith('.woff2')));
  assert.doesNotMatch(html, /[\u2013\u2014]/);   // no en dash or em dash anywhere
});
```

- [ ] **Step 2: Run** `npm test` (after creating `package.json` with `"type": "module"` and `"test": "node --test"`). Expected: FAIL, `scripts/build.mjs` missing.

- [ ] **Step 3: Install fonts.** `npm install -D @fontsource-variable/space-grotesk @fontsource-variable/inter`. Confirm the file names with `ls node_modules/@fontsource-variable/*/files`; the build copies only the `latin` and `latin-ext` `wght-normal.woff2` files (Czech needs `latin-ext`). `src/css/fonts.css` declares one `@font-face` per file with `font-weight: 300 700` and the `unicode-range` from the package's own CSS.

- [ ] **Step 4: Write `src/index.html` and `src/css/site.css`.** Port the markup and CSS of `prototypes/split-layout.html` (commit `5a4f80b`) with these changes:
  - Remove the Google Fonts links; link `css/fonts.css` and `css/site.css`; load `js/main.js` with `<script type="module">`.
  - `<title>Tomáš Sezima</title>`, `<meta name="description" content="I build the data platforms that products and AI agents run on. Data engineering on AWS and Databricks, Brno.">`, `<html lang="en">`.
  - Canvas gets `aria-hidden="true"`.
  - Menu links: About, Work, Community, Posts (in the posts-nav marker), Contact. Section ids: `about`, `work`, `community`, `posts`, `contact`.
  - Hero: `<h1>Tomáš Sezima</h1>`, then `<p class="claim">I build the data platforms that products and AI agents run on.</p>` (bold, larger than body, Space Grotesk 600), then `<p>Head of Data Engineering at Datamole, Brno. 15 years of engineering, 10 of them in data, on AWS and Databricks. I use AI agents in my daily work, and I am still hands-on.</p>`.
  - About: eyebrow "About", h2 "The engineering side of data.", then the three paragraphs of spec 6.3 verbatim.
  - Work: eyebrow "Selected work", h2 "Selected work.", four items with this exact copy (no result lines, because the results are still missing):
    1. `2022 to 2026 · Datamole` / **A data product for public transport** / "Transport operators needed reliable data to plan and run their services. I led our adoption of Databricks and built a team of 5 data engineers. We adopted Lakeflow early, so the team could focus on what the operators needed from their data." / tags Databricks, Lakeflow, AWS
    2. `2018 to 2022 · Datamole` / **Predictive analytics for electron microscopes** / "Electron microscopes produce large amounts of data. I connected 50+ AWS services into one cloud-native platform for predictive analytics on this data, defined fully in code with CDK. I also hired and grew the first team of 5." / tags AWS, CDK, Python
    3. `2017 to 2018 · Atos` / **An IoT platform where milliseconds counted** / "I helped build one of the first full IoT platforms at Atos. The design was event-driven, with Akka and functional programming, for low latency, fault tolerance and scale." / tags Scala, Akka
    4. `2016 to 2017 · Honeywell` / **Analytics for connected homes** / "I worked with Spark, Cassandra and Kafka behind Honeywell's connected-home platforms, before Spark was mainstream." / tags Spark, Kafka, Cassandra
  - Community: eyebrow "Community", h2 "AWS and Databricks User Groups in Brno.", a `<div class="next-event" hidden></div>`, then the `<!--@community-->` marker.
  - Posts: eyebrow "Posts", h2 "Latest posts.", the `<!--@posts-->` marker, all inside the posts-section marker.
  - Contact: eyebrow "Contact", h2 "Building a product on top of data? Write to me.", p "Tell me what you are building and where your data comes from.", buttons LinkedIn and Email with the Global Constraints links.
  - Footer: "Tomáš Sezima · Brno".
  - Fonts per Global Constraints: Inter on `body`; Space Grotesk on `h1, h2, h3, nav, .eyebrow, .hint, .btn, .when, .claim, .tag`.

- [ ] **Step 5: Write `scripts/build.mjs`** exporting `build(outDir = 'dist', today = localIsoDate())`: empty `outDir`, copy `src/css`, `src/js`, the font files into `outDir/fonts`, read `content/` (Tasks 2 and 3), write `renderPage(...)` output to `outDir/index.html`. Run `build()` when executed directly. `localIsoDate()` returns the local date as `YYYY-MM-DD`.

- [ ] **Step 6: Write `scripts/serve.mjs`**: `node:http` static server for `dist/` on port 8080 with correct `Content-Type` for `.html`, `.css`, `.js` (`text/javascript`), `.woff2`, `.json`, `.svg`, `.png`, `.jpg`. `package.json` scripts: `"build": "node scripts/build.mjs"`, `"dev": "node scripts/build.mjs && node scripts/serve.mjs"`.

- [ ] **Step 7: Run** `npm test`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .gitattributes src scripts tests
git commit -m "Scaffold static page with copy, self-hosted fonts and build"
```

---

### Task 2: Events and the Community section

**Files:**
- Create: `content/events/2026-02-05-aws-brno-1.json`, `2026-04-29-aws-brno-2.json`, `2026-07-29-aws-brno-3.json`, `2026-10-08-aws-brno-4.json`, `2026-10-20-databricks-brno-1.json`, `tests/content-events.test.js`
- Modify: `src/build/content.js`, `scripts/build.mjs`

**Interfaces:**
- Consumes: `renderPage` from Task 1.
- Produces in `src/build/content.js`:
  - `type Talk = { title: string, speaker: string, company: string, mine?: boolean, slides?: string, recording?: string }`
  - `type Event = { date: 'YYYY-MM-DD', group: 'AWS' | 'Databricks', number: number, title: string, venue?: string, url: string, talks: Talk[] }`
  - `loadEvents(dir: string) -> Event[]` sorted newest first; throws with the file name and all errors when `validateEvent` fails.
  - `validateEvent(e: unknown) -> string[]` (empty when valid).
  - `formatDate(iso: string) -> string`, e.g. `'2026-10-20'` gives `'20 Oct 2026'`.
  - `communityIntro(events: Event[], today: string) -> string`
  - `renderEvent(e: Event) -> string` returns `<li class="event" data-date="...">...</li>`.
  - `renderCommunity(events: Event[], today: string) -> string` returns the intro paragraph and `<ol class="events">` with all events, newest first.

- [ ] **Step 1: Create the 5 event files** with the data from spec 6.5. Company names: AWS, SentinelOne, Sage, Kyndryl, Datamole, E.ON. Tomáš's 4 talks have `"speaker": "Tomáš Sezima", "company": "Datamole", "mine": true`. The Databricks event has no `venue`. `url` is the sign-up page from the spec table.

- [ ] **Step 2: Write the failing tests** in `tests/content-events.test.js`:

```js
test('all event files are valid', () => { assert.equal(loadEvents('content/events').length, 5); });
test('validateEvent reports missing fields', () => {
  assert.deepEqual(validateEvent({}).length > 0, true);
  assert.ok(validateEvent({ ...valid, group: 'GCP' }).some(e => e.includes('group')));
  assert.ok(validateEvent({ ...valid, date: '20.10.2026' }).some(e => e.includes('date')));
});
test('formatDate', () => assert.equal(formatDate('2026-10-20'), '20 Oct 2026'));
test('communityIntro counts past meetups and outside companies', () => {
  assert.equal(communityIntro(loadEvents('content/events'), '2026-10-27'),
    'I help organize both groups and speak at them. Since February 2026, we have run 5 meetups, with speakers from AWS, SentinelOne, Sage, Kyndryl and E.ON.');
  assert.match(communityIntro(loadEvents('content/events'), '2026-10-10'), /we have run 4 meetups/);
});
test('renderEvent marks my talks and links the event', () => {
  const html = renderEvent(databricks1);
  assert.match(html, /data-date="2026-10-20"/);
  assert.match(html, /20 Oct 2026 · Databricks Brno #1/);
  assert.equal((html.match(/class="tag">Speaker</g) || []).length, 1);
});
test('renderEvent escapes text and skips missing optional fields', () => {
  const html = renderEvent({ ...databricks1, title: 'A & B <test>' });
  assert.match(html, /A &amp; B &lt;test&gt;/);
  assert.doesNotMatch(html, /undefined|null/);
});
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL, functions not defined.

- [ ] **Step 4: Implement** the functions. `communityIntro`: count events with `date <= today`; month and year of the earliest event; companies from talks of counted events in date order, unique, excluding Datamole; join with ", " and " and " before the last. Mine talks show the title and the `Speaker` tag instead of the speaker name. Slides and recording links render only when present. `renderPage` replaces `<!--@community-->` with `renderCommunity(events, today)`. The build reads `content/events`.

- [ ] **Step 5: Run** `npm test`. Expected: PASS. Run `npm run dev` and check the Community section in the browser.

- [ ] **Step 6: Commit**

```bash
git add content/events src/build/content.js scripts/build.mjs tests/content-events.test.js
git commit -m "Render meetups of both user groups in the Community section"
```

---

### Task 3: Posts

**Files:**
- Create: `content/posts/.gitkeep`, `tests/content-posts.test.js`
- Modify: `src/build/content.js`, `scripts/build.mjs`

**Interfaces:**
- Produces: `type Post = { date: 'YYYY-MM-DD', text: string, url: string, image?: string }` (`image` is a path under `content/posts/`, copied to `dist/posts/`); `loadPosts(dir) -> Post[]` newest first, throws on invalid files; `validatePost(p) -> string[]`; `renderPosts(posts: Post[]) -> string` renders the 3 newest as cards (date, text, optional image, "View on LinkedIn" link).
- `renderPage` with `posts.length === 0` removes everything between `<!--@posts-section-->` and `<!--/@posts-section-->` and between `<!--@posts-nav-->` and `<!--/@posts-nav-->`; otherwise it keeps the content and removes only the markers.

- [ ] **Step 1: Write the failing tests:** `renderPosts shows only the 3 newest posts`, `validatePost requires date, text and a linkedin.com url`, `renderPage removes posts section and nav link when there are no posts` (assert no `id="posts"` and no `href="#posts"`), `renderPage keeps posts when there are some` (assert both present, no `<!--@` markers left).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions; the build reads `content/posts` (empty folder gives `[]`).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add content/posts src/build/content.js scripts/build.mjs tests/content-posts.test.js` then `git commit -m "Render LinkedIn posts and hide the section when there are none"`

---

### Task 4: Next event at runtime

**Files:**
- Create: `src/js/next-event.js`, `tests/next-event.test.js`

**Interfaces:**
- Produces: `pickNextEvent(dates: string[], today: string) -> number` (index of the earliest date `>= today`, or `-1`); `showNextEvent(doc: Document, today: string) -> void` copies the picked `#community li.event` into `.next-event`, adds the heading "Next meetup" and removes `hidden`. With no future event, `.next-event` stays hidden. `main.js` (Task 8) calls `showNextEvent(document, localIsoDate())`.

- [ ] **Step 1: Write the failing tests:** `no future event gives -1` (`pickNextEvent(['2026-10-20'], '2026-10-27') === -1`), `picks the earliest future event` (`(['2026-12-01','2026-11-05','2026-10-20'], '2026-10-27') === 1`), `an event today is still next` (`(['2026-10-27'], '2026-10-27') === 0`).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions. Dates compare as strings.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/js/next-event.js tests/next-event.test.js` then `git commit -m "Show the next meetup at the top of Community"`

---

### Task 5: Tile wall

**Files:**
- Create: `src/js/palette.js`, `src/js/math.js`, `src/js/wall.js`, `tests/helpers.js`, `tests/wall.test.js`

**Interfaces:**
- Produces in `palette.js`: `C = { navy, rust, blue, pink, light }` (values from Global Constraints, `rust` is clay); `MUTED = '#b4b8c2'`; `LAYERS = [{ name: 'Collect', sentence: 'Everything else depends on data that arrives complete and on time.', col: C.rust, dark: '#7e4434' }, { name: 'Refine', sentence: 'AI is only as good as the data it can trust.', col: C.blue, dark: '#4b6378' }, { name: 'Act', sentence: 'Data creates value only when it changes what people and systems do.', col: C.pink, dark: '#ad978d' }]`; `NET_NODES`, `NET_EDGES`, `NET_HUB` copied from the prototype.
- Produces in `math.js`: `clamp(x, a = 0, b = 1)`, `lerp(a, b, t)`, `ease(t)` (the prototype's cubic in-out).
- Produces in `wall.js`:
  - `type Tile = { hx, hy, size, bg, fg, ink, accent, type, rot, rotTarget, solo: boolean, group: number, at: number, nx: number, data: number[8], dataTarget: number[8], bits: boolean[81], net: { nodes, edges } }`
  - `buildWall(W: number, H: number, rand = Math.random) -> { size: number, tiles: Tile[] }`: `size = W < 700 ? 72 : 112`; grid, motif probabilities, colors, rotations and data exactly as the prototype's `build()` up to `solos`.
  - `idleStep(tiles: Tile[], now: number, state: { lastFlip: number, lastData: number }, rand = Math.random) -> void`: the prototype's `idle()`.
- `tests/helpers.js` produces `seeded(seed) -> () => number` (mulberry32) and `canvasStub(log?: string[])` (a Proxy context whose `measureText(s)` returns `{ width: s.length * 7.5 }` and whose `fillText(s)` pushes `s` to `log`).

- [ ] **Step 1: Write the failing tests** with `seeded(1)`: `wall covers the viewport` (every point on a 20 px grid over `1440x900` lies inside some tile square), `tile size depends on width` (72 at 390, 112 at 1440), `tiles of a group share colors and appear together` (same `bg`, `fg`, `at` per `group`), `group tiles never turn` (no group tile has `solo`; after 200 `idleStep` calls with `now` increasing by 800, every non-solo tile still has `rotTarget === rot` from the start), `2x2 groups form a full circle` (the four tiles of a 2x2 `quarter` group sit in a square with rotations `2,3,1,0` times `PI/2` for top-left, top-right, bottom-left, bottom-right), `networks use the fixed layout` (every `network` tile has nodes equal to `NET_NODES` with `x` multiplied by 1 or -1).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** by porting from the prototype; replace every `Math.random()` with `rand()` and add the `group` id.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/js/palette.js src/js/math.js src/js/wall.js tests/helpers.js tests/wall.test.js` then `git commit -m "Generate the mid-century tile wall"`

---

### Task 6: Layout geometry

**Files:**
- Create: `src/js/layout.js`, `tests/layout.test.js`

**Interfaces:**
- Consumes: `Tile`, `buildWall` (Task 5), `clamp` (Task 5).
- Produces:
  - `NAV = 56`, `LABEL_GAP = 46`, `LABEL_W = 220`, `PANEL_MARGIN = 48`, `MOBILE_BREAK = 760`.
  - `panelFor(W, H) -> { x, y, w, h, mobile }`: phone (`W < 760`) `{ 0, 56, W, H * .3 }`, desktop `{ W * .5, 0, W * .5, H }`.
  - `splitTiles(tiles, panel, W, H, rand = Math.random) -> { kept: Tile[], leaving: Tile[] }`; sets `out: [x, y]` and `outDelay` on leaving tiles with the rules of the prototype commit `cc0160d` (right of the panel: right, delay 0; above: up, delay 0; phone or below: down, delay `(1 - below) * .4`; otherwise left, delay `clamp(hx / panel.x) * .4`).
  - `stackLayout(panel, keptCount, H) -> { n, c, Hs, T, cx, cy, tops: [number, number, number] }` per the prototype (`n = max(2, floor(sqrt(keptCount / 3)))`, desktop size limited by `(panel.w - 2 * PANEL_MARGIN - LABEL_GAP - LABEL_W) / (2 * cos 30°)` and `panel.h * .8 / 2.4`, group centered).
  - `assignStack(kept, lay, rand = Math.random) -> { layers: [Tile[], Tile[], Tile[]], extras: Tile[] }`; sets `target` (6-number matrix) and `delay` (`l * .08 + rand() * .15` for layer tiles, `rand() * .1` for extras).
  - `slabPoints(lay, l) -> { T, R, B, L }` (each `[x, y]`).

- [ ] **Step 1: Write the failing tests:** `stack group is centered with equal margins of at least 48 px` (for W in 1024, 1440, 1866 with H 900: `left = cx - Hs * cos30`, `right = cx + Hs * cos30 + LABEL_GAP + LABEL_W`; `left - panel.x >= 48`, `W - right >= 48`, the two margins differ by less than 1), `every leaving tile finishes when the hero has scrolled away` (all `outDelay <= .4` for W in 390, 1440, 1866), `tiles right of the panel fly right` (`out[0] > hx`), `stack never needs more tiles than the panel keeps` (`3 * n * n <= kept.length` and `extras.length === kept.length - 3 * n * n`), `phone panel is a band under the menu` (`panelFor(390, 800)` equals `{ x: 0, y: 56, w: 390, h: 240, mobile: true }`).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** by porting from the prototype's `build()` (after `solos`) and `slabPoints()`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/js/layout.js tests/layout.test.js` then `git commit -m "Compute panel, leaving tiles and stack geometry"`

---

### Task 7: Scroll phases

**Files:**
- Create: `src/js/progress.js`, `tests/progress.test.js`

**Interfaces:**
- Consumes: `clamp`, `ease` (Task 5).
- Produces:
  - `scrollPhases({ sy, H, heroH, startTop, endTop, endHeight }) -> { a, b, build, labels: [number, number, number] }`: `a = clamp(sy / (heroH * .8))`; `b = clamp((sy - (startTop - .4 * H)) / ((endTop + endHeight - .8 * H) - (startTop - .4 * H)))`; `build = clamp(b / .25)`; `labels[l] = ease(clamp((b - .25 - l * .25) / .12))`. `startTop` is the page top of About; `endTop` and `endHeight` belong to Posts, or to Community when Posts is absent.
  - `tileProgress(p, delay) = ease(clamp((p - .05 - delay) / .45))`, `leaveProgress(a, outDelay) = ease(clamp((a - outDelay) / .6))`, `slabAlpha(build) = ease(clamp((build - .55) / .25))`.
  - `reducedPhases({ sy, H, startTop }) -> { stack: boolean }` with `stack = sy >= startTop - .4 * H`.

- [ ] **Step 1: Write the failing tests** (layout `H 900, heroH 765, startTop 765, endTop 3465, endHeight 600`): `nothing moves at the top` (all phases 0 at `sy 0`), `stack is complete before the first label` (at the smallest `sy` with `labels[0] > 0`, `tileProgress(build, .31) === 1` and `slabAlpha(build) === 1`), `labels appear in order` (scan `sy` from 0 to 4000: the first `sy` with `labels[1] > 0` is later than for `labels[0]`, same for 2 after 1), `labels finish at the end of the given end section` (with `endTop 2865, endHeight 600`, `labels[2] === 1` at `sy = 2865 + 600 - 720`), `phases depend only on the scroll position` (two calls with the same input give equal results; at `sy 3400` all labels are 1), `reduced motion shows the stack from About on`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/js/progress.js tests/progress.test.js` then `git commit -m "Map scroll position to animation phases"`

---

### Task 8: Drawing, wiring and reduced motion

**Files:**
- Create: `src/js/draw.js`, `src/js/main.js`, `tests/draw.test.js`, `tests/smoke.test.js`

**Interfaces:**
- Consumes: everything from Tasks 4 to 7.
- Produces in `draw.js` (all take the 2D context `ctx` and `dpr` first): `drawTile(ctx, dpr, tile, m, alpha)`, `drawSides(ctx, dpr, lay, l, alpha)`, `drawTint(ctx, dpr, lay, l, alpha)`, `drawLabel(ctx, dpr, lay, l, alpha)` (title in `600 15px "Space Grotesk"`, sentence in `400 14px Inter`, wrapped to `LABEL_W`, not drawn on a phone), `wrapText(ctx, text, maxW) -> string[]`. Port the shapes, tile clipping, slab polygons and label layout from the prototype.
- Produces in `main.js`: `createScene(canvas, { reducedMotion: boolean, dpr: number }) -> { rebuild(): void, render(now: number, scroll: { sy, H, heroH, startTop, endTop, endHeight }): void, debug(): { leaving: Tile[], extras: Tile[], layers: Tile[][] } }`. `canvas` needs only `clientWidth`, `clientHeight`, `width`, `height` and `getContext('2d')`. The module's top level creates the scene for `#c`, measures section tops with `getBoundingClientRect().top + scrollY`, uses `#posts` or else `#community` as the end section, rebuilds on resize (debounced 150 ms), calls `showNextEvent`, and runs the animation loop.
- Reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`): tiles show at once (no growth), no `idleStep`, wall still; when `reducedPhases(...).stack` becomes true the right half fades in 300 ms from the wall to the finished stack with all 3 labels; nothing flies.

- [ ] **Step 1: Write the failing tests.** `tests/draw.test.js`: `wrapText keeps every line within the width` (with `canvasStub`, every line of the Collect sentence has `length * 7.5 <= 220`, and joining the lines gives the sentence). `tests/smoke.test.js` (uses `createScene` with a fake canvas from `canvasStub`, sizes passed in): for W in 390, 1440, 1866: `full scroll runs without errors` (render 500 frames, `sy` from 0 to 4000), `first frame deep in the page shows the finished stack` (first `render` at `sy 3400` draws the texts `COLLECT`, `REFINE`, `ACT` on a desktop width), `resize from desktop to phone mid-scroll leaves no stray tiles` (render at 1440 to `sy 1500`, switch the fake canvas to 390, `rebuild()`, render to `sy 4000`; assert every leaving tile has `leaveProgress(1, outDelay) === 1` and every extra tile has `tileProgress(1, delay) === 1`), `reduced motion draws no moving tiles` (with `reducedMotion: true`, two renders at the same `sy` and different `now` produce the same draw calls).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `draw.js` and `main.js` by porting `drawTile`, `shape`, `drawLeaving`, `drawFlying`, `poly`, `drawSides`, `drawTint`, `wrapText`, `drawLabel` and `frame` from the prototype, using the pure modules instead of local copies. `createScene` must not read `window` or `document` directly, so the smoke test can run it in Node.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Check in the browser.** `npm run dev`, open http://localhost:8080 at 1440 px and at 390 px (device toolbar). Compare with `prototypes/split-layout.html`: same wall, same opening, same move into the right half, stack built during About, labels one by one, no stray tiles. Turn on "Emulate prefers-reduced-motion: reduce" in the DevTools Rendering panel and check the still version. Open http://localhost:8080/#community directly and check that the stack is complete at once. Check the DevTools Network panel: no request leaves localhost.
- [ ] **Step 6: Commit** `git add src/js/draw.js src/js/main.js tests/draw.test.js tests/smoke.test.js` then `git commit -m "Draw the wall and stack and wire the page"`
