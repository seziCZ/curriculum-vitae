# Personal page of Tomáš Sezima: design

Date: 2026-10-27
Reference prototype: `prototypes/split-layout.html` (commit `5a4f80b`). It shows the agreed look, layout and animation. The real page must look and behave the same way, unless this document says otherwise. The prototype code is a throwaway sketch, so the builder may rewrite it.

## 1. Intent

Tomáš is Head of Data Engineering at Datamole in Brno. He wants a personal page that presents him as a strong, confident engineer on the front line of data and AI. He is not looking for a job. The page is his promo.

The main reader is a founder of an ambitious new company who needs a serious data partner. The founder should leave with one thought: "If we are serious about data, we want this person." The second reader is a person who saw his talk at the AWS or Databricks User Group in Brno and wants to know more about him.

The page must show strength through facts, not through self-praise. Research on self-presentation, founder expectations, web reading and the websites of front-line AI companies (Anthropic, Linear, Vercel, Mistral, Databricks and others) points the same way: concrete facts and numbers, proof from others, plain words, and AI described as normal daily work in the present tense.

## 2. Goals, non-goals, anti-goals

Goals:
- A founder understands in about 10 seconds what Tomáš does and why it matters to them.
- The page looks distinctive and current: a dark, mid-century geometric design with a scroll animation.
- The page feels alive: new LinkedIn posts and new meetups appear on it, and adding one takes Tomáš about a minute.
- The page is a static site that is hosted on Amazon S3.

Non-goals:
- A CV. The page does not list every job since 2011.
- A blog. Posts are short excerpts that link to LinkedIn.
- Automatic import from LinkedIn. LinkedIn does not offer an API for personal posts, and scraping breaks its terms.

Anti-goals (the page fails if any of these is true, even if it works technically):
- It reads as a job search ("open to opportunities") or as a CV.
- It brags, uses hype or praises Tomáš with adjectives ("passionate", "expert", "massively", "10x").
- The animation blocks the information. A visitor must never scroll through empty animation to reach text.
- It looks like official AWS or Databricks material. No AWS or Databricks logos.
- It is slow or broken on a phone.

## 3. Scope of this phase

This phase builds the front end only: the page, its content and the data files for events and posts, runnable and viewable locally. The domain, DNS, the Git hosting, the S3 and CloudFront setup and the deployment come in a later phase. The front end must still produce plain static files, so the later deployment to S3 needs no changes to it.

Target for the later phase (decided by Tomáš): a static website on Amazon S3, with all infrastructure defined and deployed with Terraform. The running costs must fit the AWS Free Tier. The only expected cost is the DNS domain.

Content that is still missing (section 10) must not block this phase. Each missing part is hidden until Tomáš adds it: an empty result line is not shown, a work item without a client name describes the domain instead, and the Posts section and its menu link are hidden when there are no posts. When Posts is hidden, the layer labels finish at the end of Community instead.

## 4. Constraints

- Static files only, hosted on Amazon S3. No server-side code.
- Text in plain international English for non-native readers: short sentences (about 15 words), common words, no idioms, no em dashes or en dashes, no decorative sentences. Numbers as digits ("5 engineers", "50+ AWS services").
- Tomáš must be able to add a post or an event by adding one small file and deploying.
- English only.

## 5. Decided design

### 5.1 Look

- Colors (muted): navy `#1c2030`, clay `#b4634a`, blue `#6e8ba5`, pink `#dcc5ba`, light `#e6d8ce`, muted text `#b4b8c2`. The page background is navy.
- A light film grain covers the whole page (SVG noise, `mix-blend-mode: overlay`, opacity about 0.3), as in the prototype.
- Fonts: Space Grotesk for the name, headings, menu, small labels, dates and buttons. Inter for paragraphs and for the sentences next to the stack.

### 5.2 Tile wall

The first screen is a wall of square tiles, as in the prototype. The tiles have no gaps between them.
- Mid-century motifs: quarter circles, half circles, circles, concentric rings, stripes, four-point stars, bullseyes, arches. About 10% of the wall is 2x2 groups (big circles or rings), and about 22% is pairs of tiles that form one shape (pills, ringed circles, stripe blocks). Tiles of one group share colors and appear together.
- Data tiles, about a fifth of the tiles: a grid with one data point, a scatter plot, a dot-matrix diamond, a row of dots where one colored dot moves forward (the "next token"), and a network graph. The network always uses the same balanced layout from the prototype (`NET_NODES`, `NET_EDGES`), sometimes mirrored, with a bigger hub node.
- When the page opens, the tiles appear one by one in random order over about 2 seconds.
- Calm idle movement: from time to time, a single tile turns by 90 degrees, a data point moves to a nearby grid point, a scatter plot gets new values, or the next token moves forward. Tiles that are part of a group never turn, because that would break the shape.
- The panel with the name, the bar of three colors and the hero line sits at the bottom left of the wall, on navy.

### 5.3 Layout and scroll behavior

- A fixed menu at the top: the name on the left, and links to About, Work, Community, Posts and Contact on the right.
- The hero is 85% of the screen height, so the top of the About section is visible below it.
- Desktop: when the visitor scrolls, the text column (left half, opaque navy) slides up over the wall. At the same time, the tiles in the left half leave the screen, each by the shortest way out. The wall stays only in the right half, which is sticky.
- While About passes, the tiles in the right half build an isometric stack of three layers at once. Tiles that are not needed leave. No tile may stay behind outside the stack.
- After the stack is complete, the layer labels appear one by one, spread over the rest of the page down to Posts: first Ingest, then Govern, then Act. Each label stays visible once it appears.
- The stack and its labels are one group, centered in the right half, with a margin of at least 48 pixels on both sides. The labels have a fixed width of 220 pixels.
- Phone: no stack forms. All tiles leave the screen while the hero scrolls away, and the full-width text column scrolls over the wall, so nothing covers the text while the visitor reads. With reduced motion, the still wall fades away when About arrives. (An earlier version built the stack in a band under the menu; on a phone it covered the text without adding anything.)

### 5.4 The three layers

From the bottom to the top. Each label is a title and one sentence.

| Layer | Color | Sentence |
| --- | --- | --- |
| Ingest | clay | Everything you build depends on data that arrives complete and on time. |
| Govern | blue | People trust data only when its meaning, quality and access are clear. |
| Act | pink | Apps, reports and AI agents turn this data into decisions and actions. |

The layers stand for Tomáš's expertise, not for the medallion architecture: Ingest is cloud platforms, IoT and streaming; Govern is data architecture, the lakehouse, quality and access; Act is apps, reports and generative and agentic AI. The titles use the industry verbs: ingestion is a stage of the data engineering lifecycle (Reis and Housley), and Databricks uses "ingest" and "govern" for Lakeflow and Unity Catalog. Governance and clear meaning are the core of "AI-ready data" (Gartner, Forrester, 2025 to 2026). Agents are one of the users in Act, not the only one.

## 6. Content

### 6.1 Hero

> **I build the data platforms that products and AI agents run on.**
> Head of Data Engineering at Datamole, Brno. 15 years of engineering, 10 of them in data, on AWS and Databricks. Agentic AI is my current focus, and the part of my work I enjoy most.

The name "Tomáš Sezima" stays the biggest text on the screen. The bold line comes directly under it.

### 6.2 Rules for all text

These come from the research and are not optional:
1. Facts instead of adjectives. Use numbers, names and systems.
2. Show 3 or 4 strong work items, not the whole career. Weak items lower the impression of strong ones.
3. Start every heading and every item with its most informative words.
4. No comparisons with other engineers or companies. No false modesty.
5. AI is part of daily work in the present tense, paired with control (for example tests and review). No promises about the future, no "revolution".
6. The boundary "engineering side of data, not analytics or data science" appears once, in About, not in the hero.

### 6.3 About

80 to 120 words. Draft:

> I build data platforms: the systems that collect data, make it reliable and deliver it to products and AI agents. I work on the engineering side of data. I do not build dashboards or train models.
>
> I have built data systems since 2016: Spark, Kafka and Cassandra at Honeywell, and an event-driven IoT platform on the actor model at Atos. At Datamole, I build data platforms on AWS and Databricks. I hired and grew two data engineering teams.
>
> Today I lead Data Engineering at Datamole in Brno, and our move into agentic AI. Agents are part of how I build, so I know where they help and where they fail.

### 6.4 Selected work

Newest first. Each item has a date range, a company, a title that starts with the domain, 40 to 60 words in the order problem, what he built, result, and tags. One real number per item where Tomáš has one. Numbers must not be invented. Placeholders are marked [TBD].

1. 2024 to today, Datamole. A data product for public transport. He led the Databricks adoption and built a team of 5 data engineers. The team adopted Lakeflow early, so it could focus on what the transport operators needed from their data. Result: [TBD]. Tags: Databricks, Lakeflow, AWS.
2. 2018 to today, Datamole. Predictive analytics for electron microscopes. He connected 50+ AWS services into one cloud-native platform, defined fully in code with CDK, and hired and grew the first team of 5. Result: [TBD]. Tags: AWS, CDK, Python.
3. 2017 to 2018, Atos. An IoT platform where milliseconds counted. Event-driven design with Akka and functional programming, built for low latency, fault tolerance and scale. Tags: Scala, Akka.
4. 2016 to 2017, Honeywell. Analytics for connected homes. Spark, Cassandra and Kafka behind Honeywell's connected-home platforms. Tags: Spark, Kafka, Cassandra.

### 6.5 Community

This section replaces "Talks". It lists all meetups of the two groups, not only Tomáš's talks.

Text:
> **AWS and Databricks User Groups in Brno.**
> I help organize both groups and speak at them. Since February 2026, our speakers have come from companies such as AWS, SentinelOne, Sage, Kyndryl and E.ON.

The sentence with the count must stay true when events are added. Generate it from the event data, or keep it free of numbers.

- Next event at the top, only if an event with a future date exists: date, group, title, venue, sign-up link.
- Past events below, newest first: date, group and number, title, talks (title, speaker, company), links to slides or recordings if they exist. Tomáš's talks have a small "Speaker" tag.

Known events (from Meetup, Luma and the Databricks user group site):

| Date | Group | Title and venue | Talks (Tomáš's talks in bold) | Sign-up page |
| --- | --- | --- | --- | --- |
| 2026-02-05 | AWS Brno #1 | Building with GenAI & Autonomous Agents, GEN Digital, Vlněna 7 | **The Curious Case of Generative AI**; Accelerating Software Development with Kiro and autonomous agent (Sanjay Kashalkar, AWS) | https://luma.com/m1tedor5 |
| 2026-04-29 | AWS Brno #2 | AI Agents in Ops & Security, GEN Digital | AWS DevOps Agent: Your Always-On Operations Teammate (Jan Zelený, AWS); AWS Security Agent: AI-Powered Security for the Speed of Development (Akshay Kulkarni, SentinelOne); **AWS S3 Files** | https://www.meetup.com/brno-aws-user-group/events/313906682/ |
| 2026-07-29 | AWS Brno #3 | Summer AWS BBQ Meetup, Clubco, Vlněna 5 | **Amazon S3 Vectors**; My Step Functions DAG Was a Lie: Going Agentic on 8,000 Photos (Dmytro Hlotenko, Sage) | https://www.meetup.com/brno-aws-user-group/events/315497981/ |
| 2026-10-08 | AWS Brno #4 | AWS Brno Meetup #4, Clubco, Vlněna 5 | AWS Resilience Engineering (George Palangattil Koshy, Kyndryl); S3 Tables (Gabriel Pajunk, Datamole) | https://luma.com/hvrzjkf0 |
| 2026-10-20 | Databricks Brno #1 | Databricks Brno meetup #1, venue unknown | Setting up Lakeflow Connect Pipelines for Oracle and SQL Servers (Juraj Paluba, Datamole); 5 Layers Instead of 3: How We Expanded the Medallion Architecture for ML in Energy (Michal Mec, E.ON CZ); **Unity Catalog Hide and Seek: Personal Data Protection in Lakeflow Declarative Pipelines** | https://usergroups.databricks.com/events/details/databricks-user-groups-brno-databricks-user-group-presents-databricks-brno-meetup-1/ |

### 6.6 Posts

- Shows the 3 latest LinkedIn posts. Each post has a date, a one-line takeaway or the first lines of the post, an optional image, and a "View on LinkedIn" link.
- Each post is one small file in the repository. The page renders posts in its own style. It does not embed LinkedIn.
- If there are no posts, the section is hidden. If the latest post is very old, Tomáš decides whether to hide the section.

### 6.7 Contact

Founders contact Tomáš personally, not Datamole. This is his own presentation. Links: LinkedIn https://www.linkedin.com/in/sezima and email tomas@sezima.dev, which forwards to his Gmail (see the deployment design).

One clear next step, 1 or 2 sentences, with the LinkedIn and email links. Draft:
> **Building a product on top of data? Write to me.** Tell me what you are building and where your data comes from.

## 7. Data

- Events and posts are data files in the repository, one file per event and one per post. The page renders them in its own style.
- Adding an event or a post is: add one file, then build and deploy. This should take Tomáš about a minute.

## 8. Calls I made (Tomáš did not decide these explicitly)

- The hero says "15 years of engineering, 10 of them in data", because his data work started in 2016. The version he approved said "15 years on the engineering side of data", which was not accurate.
- "Everything above depends on..." became "Everything else depends on...", because the old text only worked next to the picture.
- The section is called "Community", and the menu link "Talks" becomes "Community".
- English only.
- Fonts are self-hosted instead of loaded from Google Fonts. Loading Google Fonts from Google servers has led to GDPR complaints in the EU.
- No analytics and no tracking cookies.
- The canvas is decorative. All information is in normal HTML text.
- When the system setting "reduce motion" is on: the hero shows the full wall at once, as a still picture. There is no tile-by-tile opening and no idle movement. When the About section arrives, the wall in the right half is replaced by the finished stack, with a short fade and with all 3 labels visible at once. Nothing flies.
- Status of the texts in section 6: the hero, the three layer sentences and the Community text are final. The About draft, the work items and the Contact draft are a brief. The builder writes the final text in the first person, following section 6.2. A work item may be shorter than 40 words when there are no more facts. Facts must never be added to reach the length. Tomáš reviews all texts before release.

## 9. Left to the builder

- The tool chain and the repository structure, as long as the output is static files for S3 and adding content stays a one-file change.
- The file format for events and posts.
- Whether the build renders events and posts into the HTML or the page loads them at runtime. Rendering into the HTML is preferred for search engines and link previews.
- Meta tags, the page title, and the image for link previews on LinkedIn.
- How the S3 hosting is set up (for example CloudFront for HTTPS), and the deployment script.
- Exact animation timing, as long as it matches the behavior in section 5.3.

## 10. Content still needed from Tomáš

- One real result or number for each of the work items 1 and 2.
- Which client names he may publish (for example the public transport client).
- Slides or recordings of his 4 talks, if he wants to link them.
- The first LinkedIn posts for the Posts section.
