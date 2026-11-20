---
framework_version: 1.5.0
---

# CV Templates and Tailoring Guide

<!-- SETUP: Profile statements and section ordering are personalized by running /setup -->

## Template: LaTeX moderncv (Banking Style)

All CVs use the moderncv LaTeX package with the "banking" style and "blue" color scheme.

**Output file:** `cv/main_<company>_<role>.tex`
**Compile with:** **lualatex** on MiKTeX/TeX Live. pdflatex often fails on modern MiKTeX installs with `fontawesome5` font-expansion errors; lualatex handles the same sources cleanly.
**Master reference:** `cv/main_example.tex` (comprehensive CV with all competencies, experience, and achievements - use as source when building targeted CVs)

### Compile command

```bash
cd cv && lualatex -interaction=nonstopmode main_<company>_<role>.tex
```

Expected output: `Output written on main_<company>_<role>.pdf (2 pages, ...)`. Any page count other than 2 is a failure that must be fixed before presenting to the user.

## Document Structure

```latex
\documentclass[11pt,a4paper,sans]{moderncv}
\moderncvstyle{banking}
\moderncvcolor{blue}

% Force the name and section headings to render in moderncv blue (color1).
% Default banking leaves them black: moderncvstylebanking.sty's \colorlet
% copies (not aliases) the pre-scheme accent colour, so the name colours are
% frozen before \moderncvcolor runs. Re-let them after. \namefont is the hook
% every name-style macro routes through, so this also works on moderncv 2.3.1
% (Debian/Ubuntu apt), which has no \firstnamestyle/\lastnamestyle at all.
\renewcommand*{\namefont}{\fontsize{34}{36}\bfseries\upshape}
\colorlet{firstnamecolor}{color1}
\colorlet{lastnamecolor}{color1}
\colorlet{namecolor}{color1}
\renewcommand*{\sectionstyle}[1]{{\sectionfont\color{color1}#1}}

\usepackage[utf8]{inputenc}
% pdflatex fallback only (the documented engine is lualatex, which skips this
% branch). Without T1 font encoding pdflatex builds accented letters with
% \accent, and the PDF text layer stores them decomposed - `e` + U+0300 rather
% than U+00E8 - so an ATS keyword match on "Genève" fails while the page looks
% right. moderncv 2.5 loads T1 itself under pdflatex; 2.3.1 (Debian/Ubuntu apt)
% does not. \ifpdftex comes from iftex, which every moderncv version loads.
\ifpdftex\usepackage[T1]{fontenc}\fi
% moderncv loads hyperref itself in an \AtEndPreamble hook, so \hypersetup
% must go in an \AtEndPreamble of our own: on moderncv < 2.4 a top-level
% \usepackage{hyperref} clashes with the class's own
% \RequirePackage[unicode]{hyperref}. From 2.4.0 the class passes its options
% through \PassOptionsToPackage instead, which is what removes that clash.
\AtEndPreamble{\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,
    urlcolor=blue,
    pdftitle={[YOUR_NAME] - CV},
    % Keep pdfpagemode=UseNone: this block runs after moderncv's own
    % \AtEndPreamble (moderncv.cls sets pdfpagemode there), so a FullScreen
    % value here would win and open every CV in fullscreen presentation mode.
    pdfpagemode=UseNone,
}}
\usepackage[scale=0.80]{geometry}
\usepackage{import}

% ATS: no icon glyphs in the text layer.
% moderncvstylebanking.sty:64 loads \moderncvicons{symbols}; under XeTeX/LuaTeX
% that resolves to moderncviconsawesome.sty, which redefines \labelitemi as
% \faIcon[regular]{circle} (line 64) and the contact symbols as \faIcon (74-76).
% Those are real characters in the PDF's text layer - an ATS reading it sees
% "🖂oscaremilio@gmail.com" and the email is not a token, and every bullet line
% starts with an icon glyph. Re-define the markers with glyphs from the text
% fonts: the bullet becomes a typographic • of the same colour (a deliberate
% visual change), and the contact symbols disappear.
\renewcommand*{\labelitemi}{\strut\textcolor{color1}{\large\rmfamily\textbullet}}
\renewcommand*{\labelitemii}{\strut\textcolor{color1}{\large\bfseries-}}
\renewcommand*{\emailsymbol}{}
\renewcommand*{\mobilephonesymbol}{}

% ATS: never hyphenate. A word broken across lines ("transac-/ciones") is not a
% keyword match, and the hyphen survives into the extracted text.
\hyphenpenalty=10000
\exhyphenpenalty=10000

% Personal data
\name{[FIRST_NAME]}{[LAST_NAME]}
% If you have no address to list, DELETE this whole line. \address{}{}{} fails
% with "There's no line here to end" on every moderncv version.
\address{[YOUR_ADDRESS]}{}{}
\phone[mobile]{[YOUR_PHONE]}
\email{[YOUR_EMAIL]}
\extrainfo{\href{[YOUR_LINKEDIN_URL]}{LinkedIn}, \href{[YOUR_GITHUB_URL]}{GitHub}}

\begin{document}
\makecvtitle

% 1. Profile statement (1-3 sentences, tailored per role)
% 2. Skills section
% 3. Education section
% 4. Professional Experience section
% 5. Selected Publications (if applicable)
% 6. Honors and Awards (if applicable)
% 7. References

\end{document}
```

### Color overrides

The `\renewcommand*` on `\namefont` and the three `\colorlet` lines in the preamble are required on lualatex+MiKTeX. Without them the name and section headings render in black even though `\moderncvcolor{blue}` is set, which looks inconsistent with the rest of the blue accent scheme (links, bullet markers, contact icons). The cause: `moderncvstylebanking.sty` defines the name colours with `\colorlet`, which *copies* the accent colour as it is before the scheme is applied, so the name colours are frozen to the pre-scheme value; re-assigning them with `\colorlet` after `\moderncvcolor{blue}` (as the preamble does) re-pins them to `color1`. `\namefont` is the shared hook every name-style macro routes through, so the block is version-agnostic - including moderncv 2.3.1 from Debian/Ubuntu apt, which has no `\firstnamestyle`/`\lastnamestyle` at all. Both names render bold; if you prefer regular weight, change `\bfseries` to `\mdseries` in the `\namefont` line (the weight now lives there, so it applies to the whole name). Don't drop the overrides - on most modern installs the defaults render visibly wrong.

### Icon glyphs must not reach the text layer (ATS)

The chain is not obvious, so read it before "simplifying" the block:

1. `moderncvstylebanking.sty:64` calls `\moderncvicons{symbols}`.
2. `moderncviconssymbols.sty:17` (under `\ifxetexorluatex` - i.e. under
   **lualatex**, the documented engine) loads `moderncviconsawesome`.
3. `moderncviconsawesome.sty:64` redefines `\labelitemi` as
   `\faIcon[regular]{circle}`, and lines 74-76 give `\emailsymbol` /
   `\mobilephonesymbol` FontAwesome glyphs.

Under pdflatex the same selector loads `moderncviconsmarvosym` instead, so the
glyphs differ - but the defect (a non-text character in the layer) is the same.

Those glyphs are real characters in the PDF's text layer, outside the BMP:

```
MOBILE-ANDROID-ALT +58 424-109-4447 • 🖂 oscaremiliolugo@gmail.com
```

The email is no longer a token of its own (pypdf keeps it attached to the icon
name; pymupdf drops the separating space), and every bullet line starts with an
icon glyph. The rendered page looks correct, which is why this survives visual
inspection.

The preamble above re-defines all four markers with glyphs from the text fonts.
**This is a visual change, not a no-op:** the bullet goes from a FontAwesome
circle to a typographic `•` in the same accent colour. That is the accepted
trade - a machine-read document beats a decorative bullet.

**`tools/verify_pdf.py` does not catch this.** It does not scan for the
`0x1F000-0x1FAFF` range, nor for an icon glued to the email, so a clean run of
the repo's checker proves nothing here. Run this instead:

```bash
python3 - <<'PY'
import pymupdf
from collections import Counter
d = pymupdf.open("cv/main_<company>_<role>.pdf")
t = "\n".join(p.get_text() for p in d)
bad = {hex(ord(c)): n for c, n in Counter(t).items()
       if 0x1F000 <= ord(c) <= 0x1FAFF or 0x2600 <= ord(c) <= 0x27BF}
print("icon glyphs:", bad or "none")
print("FontAwesome:", [f[3] for p in d for f in p.get_fonts(full=False) if "FontAwesome" in f[3]] or "none")
print("email token:", "your.email@example.com" in t.split())
PY
```

Require `icon glyphs: none`, `FontAwesome: none`, and the email present as a
standalone token. Do **not** whitelist `0x2013/0x2014/0x2022`: a correct CV also
carries `0x2019` (apostrophes) and `0x201C/0x201D` (quotes), and a whitelist
would fail good documents.

### No hyphenation

`\hyphenpenalty=10000` / `\exhyphenpenalty=10000` turn off automatic hyphenation.
Without them a long word breaks across lines and the hyphen is part of the
extracted text (`transac-` + newline + `ciones`), so a keyword search for
"transacciones" fails on a CV that plainly contains it. The trade-off is looser
inter-word spacing on some lines; that is the correct trade for a machine-read
document.

### Entry order: the job title must precede the employer (ATS)

`moderncvstylebanking.sty` loads body style 3, whose `\cventry` prints the
**employer** (`#4`) on the first line and the **job title** (`#3`) on the
second. The rendered page looks plausible, but the text layer an ATS reads
comes out inverted:

```
🟤 Moneva Part-timeSenior Back End Developer 2025-02 - 2026-02
```

A parser that assigns the line under the dates to the title field records the
employer there and the title as the organization - and a human skimming the
PDF sees the same inversion. Every tailored CV therefore carries this override,
placed just before `\begin{document}`:

```latex
\makeatletter
\renewcommand*{\cventry}[7][.25em]{%
  \begin{tabular*}{\maincolumnwidth}{@{}l@{\extracolsep{\fill}}r@{}}%
    {\bfseries #3} & {\itshape #2}%
  \end{tabular*}%
  \ifboolexpr{%
    test {\ifstrempty{#4}}
    and
    test {\ifstrempty{#5}}}%
    {}%
    {\par\noindent{\itshape #4\ifstrempty{#5}{}{, #5}}}%
  \ifx&#7&%
  \else{\\%
    \begin{minipage}{\maincolumnwidth}%
      \small#7%
    \end{minipage}}\fi%
  \par\addvspace{#1}}
\makeatother
```

Two details are load-bearing:

- **The employer line is a `\par`, not a second tabular row.** In a second row
  the dates sit in the right cell and the employer in the left cell of the
  *same* row, so the two strings run together in the text layer
  (`2023-12 - PresentDlocs, Remote`) and no parser can split them.
- **`#3` keeps `\bfseries` and `#4` becomes `\itshape`**, matching the visual
  weight the banking style used before, so the page reads the same and only the
  order changes.

Verify it on the extracted text, not on the rendered page:

```bash
python3 tools/verify_pdf.py cv/main_<company>_<role>.pdf --dump-text cv/main_<company>_<role>.txt
grep -A1 '🟤' cv/main_<company>_<role>.txt | head
```

The line after each bullet marker must be the title, and the line after that
the employer.

### Profile links must be printed, not only linked

`\extrainfo{\href{...}{LinkedIn}}` renders the word "LinkedIn" as the link
text, and the URL itself lives only in the PDF's link annotation - **not in the
text layer**. An ATS reading the layer sees the label and no address, so the
profile is unreachable from the parsed record. Print the URL as the link text
instead:

```latex
\extrainfo{\href{https://www.linkedin.com/in/<handle>}{linkedin.com/in/<handle>},
           \href{https://github.com/<handle>}{github.com/<handle>}}
```

The email is already printed as literal text by `\email`, so it needs nothing.

### Spacing inside itemize lists (important)

**Do not place `\vspace{...}` between `\item` entries in an `itemize` list.** Even though the source looks symmetric, this pattern occasionally produces a noticeably oversized gap before a single item: the inter-item `\vspace` creates a paragraph break that interacts unpredictably with the list's internal `\itemsep`, so LaTeX renders one of the gaps wider than the rest. Remove the inter-item `\vspace` and let `itemize` use its native uniform spacing.

```latex
% WRONG - intermittently produces an oversized gap before one bullet
\begin{itemize}
\item \textbf{Foo}: ...
\vspace{1pt}
\item \textbf{Bar}: ...
\vspace{1pt}
\item \textbf{Baz}: ...
\end{itemize}

% RIGHT - uniform spacing using the list's native itemsep
\begin{itemize}
\item \textbf{Foo}: ...
\item \textbf{Bar}: ...
\item \textbf{Baz}: ...
\end{itemize}
```

Two related patterns are fine and should be kept:
- `\vspace{1pt}` immediately after `\section{...}` (between section heading and first item) - this is between the heading and the list, not between list items.
- `\vspace{3pt}` between top-level `\cventry` blocks in Professional Experience or Education - this gives breathing room between roles and renders consistently.

### Section headings must match the CV's language (important)

Section headings such as `\section{Core Competencies}`, `Professional Experience`, `Education`, `Languages`, `Publications`, `Honors and Awards`, `References` (and any others your template defines), plus the `Available upon request.` line under References, are all **literal English text baked into the template** - they do not translate themselves. Whenever the CV language (see `CV language` in the candidate profile) is not English, translate every one of these too, whatever they are, not just the body prose - a CV with a fully localized profile statement and bullets sitting under untouched English section headers reads as sloppy and inconsistent, and it's an easy thing to forget precisely because the prose translation is the obvious, visible part of the job. Worked example for Spanish: `Competencias Clave`, `Experiencia Profesional`, `Educaci\'on`, `Idiomas`, `Publicaciones`, `Distinciones y Premios`, `Referencias`, `Disponibles a solicitud.` The same rule applies for any other target language - check this explicitly during the verification pass. It covers the Professional Experience context line too (the `\noindent{\small Contract and part-time engagements run in parallel...}` sentence): that is literal CV text, not a heading, so it is translated with the rest.

## Section-by-Section Tailoring

### Profile Statement / Elevator Pitch (Best Practice)
This is the most important section to customize. It appears right after `\makecvtitle`.

Write 5-7 lines that function as an "elevator pitch": a concise, compelling introduction explaining why you're qualified for *this specific role*. Focus on what the employer gains from hiring you.

When the role sits outside your home domain, **lead with the domain-transfer argument** - the one or two sentences connecting your background to their problem (e.g. wave physics to radar signal processing) belong in the profile statement's opening, not buried in the cover letter. It is the strongest card a domain-changer holds; play it first.

**Create 2-3 profile statement templates for your main role types:**

<!-- SETUP: These are populated based on your background -->
**For [YOUR_PRIMARY_ROLE_TYPE] roles:**
> [YOUR_PROFILE_STATEMENT_TEMPLATE_1]

**For [YOUR_SECONDARY_ROLE_TYPE] roles:**
> [YOUR_PROFILE_STATEMENT_TEMPLATE_2]

Statements labeled *[Used for: <company>_<role>]* were extracted from archived application drafts by `/setup` Path A. They are **phrasing references, never fact sources**: when drafting from one, every factual claim still comes from `01-candidate-profile.md` - a past tailored draft does not vouch for its own accuracy.

### Core Competencies / Skills Section (Best Practice)
Reorder and emphasize based on the role. Use bold category labels.

List **5-7 key competencies** in bullet format, tailored to the specific job. For each competency, briefly explain how it adds value to the position.

Use the posting's own core term in the matching bullet's bold label when it truthfully applies - ATS and skim-reading hiring managers match literally, and "MLOps" in a heading outperforms a paraphrase like "ML Deployment".

### Education
- Always include your highest degrees
- For senior roles, keep education brief (dates and titles only)
- Include thesis topics when relevant to the target role

#### In-progress qualifications must say so explicitly

**A bare year range is not enough.** An entry reading `2025–2026`, seen partway through 2026, looks like a *finished* degree, because a reader skimming a CV treats a closed range as closed. A profile statement that says "currently completing…" does not fix it: the education entry is where a reader checks the credential, so it has to stand on its own.

State completion inside the entry itself:

```latex
\item{\cventry{2025-2026}{[Degree], [Field]}{[Institution]}{[Location]}{}{\vspace{1pt}
In progress, expected [Month Year]. [Relevant topics]
}}
```

Any consistent form works: `In progress, expected <Month Year>.` / `Expected completion <Month Year>.` / a date field of `2025-present`.

Claiming a credential not yet held is a factual misstatement, and it is the kind discovered at transcript or reference check rather than at interview. It costs nothing to prevent. The same applies to in-progress certifications and courses.

**Check for agreement:** for a current student, the profile statement, the education entry, and any availability or work-permit note must all give the same completion date. Contradiction between them is worse than any single version.

### Professional Experience
- Rewrite bullet points to emphasize aspects most relevant to the target role
- Use 4-6 bullets for most recent role, 3-4 for previous, 2-3 for older
- **Emphasize measurable results** where possible: "Reduced processing time by X%", "Model adopted by the team"

#### Client projects and overlapping engagements nest under their employer

An engagement that ran **inside another employment** — a client project delivered through a contractor or software factory, an internal project, a secondment — must not appear as a sibling `\cventry`. Two entries with overlapping dates read as job-hopping to a human, and an ATS that fills a title field per date range records two simultaneous full-time roles. Nest it as a sub-entry inside the employer that contained it:

```latex
\item{\cventry{2021-05 - 2024-02}{Javascript FullStack Developer}{EYSS}{Full-time}{}{\vspace{1pt}
\begin{itemize}
    \item {<employer-level bullet>}
    \item {\textbf{AllianceBlock} --- \emph{FullStack-Blockchain Developer (client)}, 2022-07 - 2024-02
        \begin{itemize}
            \item {<client-project bullet>}
            \item {\textbf{NexeraID} --- \emph{Blockchain Developer (AllianceBlock team)}, 2023-03 - 2024-02: <team bullet>}
        \end{itemize}}
    \item {\textbf{CUB3} --- \emph{Blockchain Developer (client)}, 2022-05 - 2022-06
        \begin{itemize}
            \item {<client-project bullet>}
        \end{itemize}}
    \item {\textbf{Leaderdao.AI} --- \emph{Senior Team Lead (side project)}, 2022-12 - 2023-11
        \begin{itemize}
            \item {<side-project bullet>}
        \end{itemize}}
\end{itemize}}}
```

Rules that make this survive both readers:

- **The sub-entry carries its own date range**, so the overlap is stated rather than hidden. The employer's range stays the outer one.
- **`\textbf{Name} --- \emph{Title}, dates` on one line.** The title comes before any employer-ish string, same as the `\cventry` override above: a parser reading the line gets the role first.
- **Nest on containment, never on a date overlap alone.** The test is whether the outer employer actually ran the engagement (contractor, client account, secondment); a shared date range on its own proves nothing. Two **independent** contracts that happen to overlap — a part-time job alongside a full-time one — stay as sibling top-level entries, each stating its contract type (see the next section); nesting those would claim a reporting line that never existed. An engagement whose range falls outside the outer entry cannot be nested at all — state it as its own top-level entry.
- **A team inside a company nests too, and is not an engagement of its own.** A second product team, an internal squad or a rebranded business unit the candidate worked in is part of that employer, not a separate employer and not a client engagement: it nests one level deeper, inside the employer's `itemize`, and its title carries the qualifier (`Blockchain Developer (AllianceBlock team)`). It is *not* an EYSS engagement — do not promote it to a sibling of the client account it lived in.
- **Do not add `\vspace` between the sub-entries** (see the itemize spacing note above); the nested `itemize` already separates them.
- **Confirm the employment relationship before nesting, and never infer it from the dates.** A client engagement and a direct hire look identical on a CV; only the candidate knows which it was. Ask before writing `(client)` or nesting, because the two produce opposite readings: a long client engagement through a contractor is one employer with a good account, while the same span as a direct hire is a normal job. Getting it wrong is a factual misstatement a reference check exposes.
- **The umbrella entry must span the whole engagement, not just its first phase.** A contractor or software factory that kept the candidate on a client account until 2024-02 must read `2021-05 - 2024-02`; writing the date the first assignment ended (`2022-07`) makes every nested entry after that point a factual claim that cannot be true, and it manufactures an overlap with whatever came next. The profile must record the umbrella's real end date (the last client-account date), not the end of the first assignment; if it is missing, ask rather than infer it from the nested entries. Check the outer range against the last nested end date before finalizing.
- **The employer must still exist as a top-level entry.** If the CV never mentioned the containing employer (e.g. the project was the only thing listed), add the employer entry first — otherwise the sub-entry has no parent and reads as an orphan.

This is a content rule, not a formatting one: it changes what the CV asserts about who employed whom, so it applies to every tailored CV, not just the ones where the layout was tight.

#### State the contract type on every entry, and defuse the overlap up front

Two full-time entries with overlapping dates read as job-hopping to a human and as
two simultaneous full-time roles to an ATS. Nesting solves the case where one
engagement lived inside another; when the engagements were genuinely **independent
and parallel** (a part-time contract running alongside a full-time job), nesting
would claim a reporting line that never existed, so the fix is different:

- **Every entry carries its contract type in the `\cventry` location field** —
  `Full-time`, `Part-time`, `Remote, Part-time`, `Contract`. A bare `Remote` tells
  the reader nothing about capacity, which is exactly what makes an overlap look
  suspicious. `Remote, Part-time` says "this ran in parallel on purpose".
- **One line of context at the top of Professional Experience**, before the first
  entry, stating the rule the reader is about to see:

  ```latex
  \section{Professional Experience}
  \vspace{3pt}

  \noindent{\small Contract and part-time engagements run in parallel with full-time roles; each entry states its contract type.}
  \vspace{3pt}

  \begin{itemize}
  ```

  It costs one line and disarms the bias before it forms. Keep it factual — a
  defensive phrasing ("not job-hopping") draws attention to the thing it denies.
- **A short project delivered inside another employment nests**, even when it is
  only a few months: a three-month engagement listed as its own employer reads as
  a failed probation, while the same work nested under the employer that ran it
  reads as a project.

The test for both readers: list the top-level employers only. If that list shows
more employers than the candidate actually had, the CV is overstating the churn.

#### Check tenure against visible output

Before finalizing, look at each role the way a stranger will: **date span versus how much work is shown.** A two-year role represented by a single project reads as low output, whether or not that is fair. The reader cannot know what filled the time, so they guess, and the guess is unflattering.

This bites hardest on **career changers** (part of the tenure went into learning the new field), on **long-cycle work** (industrial deployment, clinical or regulatory projects, research — one delivery genuinely takes quarters), and on anyone whose employer kept them on a single account or product.

Three honest fixes, in order of preference:

1. **Surface more real work.** Ask what else the period contained. There are often real secondary projects, internal tooling, or support work that never reached the CV because it felt minor. Best fix when the material exists.
2. **Make the phases within the role explicit.** If the span genuinely had stages, say so — an initial period learning the domain or supporting the team, then ownership of the named work through to delivery. A phased arc reads as a growth curve; an undifferentiated multi-year block reads as stagnation.
3. **Name what made the cycle long.** Data collection from a live environment, validation with domain experts, deployment and iteration against real output. Reviewers who know the domain accept this immediately.

**Never** pad with invented projects, and **never** quietly shorten the employment dates so the ratio looks better. Both are discoverable, and both are worse than the perception problem being solved.

**Prepare the interview answer too.** If a long span against little visible output survives these fixes, the question is coming. The candidate needs a ready two-part answer — what actually filled the time, and what the outcome was — recorded in their interview prep rather than improvised in the room.

### Handling Employment Gaps (Best Practice)
If there is a gap in your employment history:
- The gap should be explained matter-of-factly if needed
- Describe how professional development continued during the gap
- Frame as deliberate skill-building and career repositioning

### Publications
- Include Google Scholar link if applicable
- Select 3-4 most relevant publications (not always all of them)
- For non-academic roles, keep brief

### Evidence Links
Wherever the CV names a verifiable artifact - a public project, a hackathon entry, a publication - carry its link (`\href`) so a reader can verify the claim in one click. A CV whose strongest claims are checkable reads as more credible everywhere else too.

### Honors and Awards
- Keep format brief, one line each

### References
- List 2-4 references with name, title, company, and contact
- End with: "More references are available upon request."
- **Do not attach reference letters** - employers typically contact references directly

### LaTeX Special Characters (important)

Postings and profile data arrive as plain text; the CV is LaTeX. Escape these wherever they land in body text - company names, achievement bullets, skill lists:

| Character | Write | Typical trigger |
|---|---|---|
| `&` | `\&` | company names: Bang \& Olufsen, Brüel \& Kjær, H\&M |
| `%` | `\%` | quantified achievements: "cut latency by 40\%" |
| `$` | `\$` | salary and cost figures |
| `#` | `\#` | "ranked \#1", C\# |
| `_` | `\_` | file names, code identifiers |
| `~` | `\textasciitilde{}` | URLs, "approx. 5 years" tildes |
| `^` | `\textasciicircum{}` | version strings, math |

Two failure modes deserve special care:

- **`%` fails silently.** An unescaped `%` starts a LaTeX comment: the compile succeeds with zero errors, and everything after the `%` on that line vanishes from the PDF. `Cut inference latency by 40% and saved DKK 2M annually` renders as "Cut inference latency by 40" - the bullet keeps its impressive-looking fragment and loses the actual result. Quantified achievement bullets are exactly where the guidance steers you ("use numbers where possible"), so check every `%` in every bullet before compiling.
- **`&` fails loudly** inside `\cventry` (alignment-tab errors, `Missing } inserted`). The compile loop catches it, but escape employer names up front rather than debugging the compile.

Related trap: a bullet whose text begins with a literal `[` must be braced - `\item {[text]}` - or LaTeX parses the bracketed text as `\item`'s optional label and renders it clipped off the left page edge with a clean compile. The example CV's placeholder bullets are braced for exactly this reason.

## Compile-and-Inspect Loop (MANDATORY)

After writing the CV and before presenting to the user, always compile and visually inspect the PDF. Iterate until the layout is clean. Workflow:

1. Run `lualatex -interaction=nonstopmode main_<company>_<role>.tex`
2. Check the output page count: must be exactly 2
3. Read the PDF via the Read tool and visually inspect both pages
4. Check for **orphaned entries**: a `\cventry` title line must never sit alone at the bottom of page 1 with its bullets on page 2

### Fixing common page-break problems

**Problem: entry title on page 1, bullets orphaned to page 2**
Add `\needspace{5\baselineskip}` immediately before the problematic `\cventry`:
```latex
\needspace{5\baselineskip}
\item{\cventry{YEAR-YEAR}{Role Title}{Organization}{Location}{}{...}}
```
Include `\usepackage{needspace}` in the preamble.

**Caveat - use `\needspace` before entries, never before `\section` headings.** A section-level `\needspace` pushes the entire section (heading plus content) to the next page whenever the request does not fit, stranding empty space above and typically *adding* a page instead of saving one. Apply it only to the individual `\cventry` that actually orphans, and only after a compile shows the orphan.

**Problem: one trailing section spills to page 3 (e.g., References alone on page 3)**
Add `\enlargethispage{2-3\baselineskip}` before a late section (e.g., before `\section{Honors and Awards}`) to stretch page 2 by a few lines. This is the standard LaTeX rescue for near-miss overflows.

**Problem: 3 pages with significant content on page 3**
Cut content — do not compress geometry or `\vspace`. See "Relevance-weighted cutting" below for the rule.

**Problem: content finishes early on page 2 (feels thin)**
Restore the highest-relevance item that was previously cut — a CV that ends mid-page 2 looks incomplete.

## ATS Parseability

Most employers run CVs through an ATS before a human sees them, and the ATS reads the PDF's embedded **text layer**, not the rendered page. A CV can pass visual inspection and still extract as garbage. After the layout passes the compile-and-inspect loop, verify the text layer:

> **Windows:** run these tools as `python`, not `python3`. A python.org install ships no `python3`, so that name reaches the Microsoft Store alias, which either exits 49 with no output (#669) or starts a separate Store Python without the packages `pip` installed (such as pypdf). `.claude/settings.json` allows both spellings.

```bash
python3 tools/verify_pdf.py cv/main_<company>_<role>.pdf --dump-text cv/main_<company>_<role>.txt
```

Extraction tries **pypdf** first (`pip install pypdf`, BSD license), then Poppler `pdftotext`. If a fallback still uses `pdftotext -layout`, it must also pass `-enc UTF-8`: Xpdf-based builds default to Latin-1, which makes every non-ASCII character in a perfectly good CV read back as a replacement character. If neither extractor is available, skip the mechanical check with a warning and rely on the visual PDF read for keyword coverage.

What to check in the extraction:

- **Contact details as literal text.** The stock template's fontawesome contact icons extract as glyph names (`MOBILE-ALT`, `Envelope`) - harmless noise, because the actual address and number are printed beside them. The failure mode is a contact detail carried *only* by an icon or a hyperlink (like the `LinkedIn` link text, whose URL is not in the text layer): invisible to an ATS. The email address must always appear as printed text.
- **No garbled output.** `(cid:NNN)` markers or `�` characters mean a font is embedded without a Unicode mapping - an ATS sees the same garbage. This shows up with unusual fonts in custom templates, not with the stock moderncv setup under lualatex.
- **Reading order.** The stock banking style is single-column, so extraction order matches visual order. Custom templates (via `/add-template`) with sidebars or multi-column layouts can interleave unrelated lines; if extraction order is scrambled, the user is trading ATS compatibility for looks and should be told.
- **Keyword coverage.** Match the posting's required/preferred terms against the extracted text, in the posting's language. Prefer the posting's exact term over a synonym when it is truthfully applicable - ATS matching is often literal. Never add a keyword the profile does not support. `verify_pdf.py --contains` folds both sides for whitespace, Unicode normalization (NFC) and LaTeX's typographic substitutions before comparing - `'` reaches the text layer as U+2019 and `--` as U+2013, so `--contains "Master's degree"` and `--contains "2016-2024"` match what the template actually renders. The dumped `.txt` is never folded: it is the raw layer the ATS sees, which is why the date-range check below reads the dump, not `--contains`.
- **Accents intact (pdflatex fallback).** Under pdflatex without T1 font encoding the text layer stores accented letters decomposed (`e` + combining grave instead of `è`); pypdf reads that as `Gen` `eve` with a stray spacing accent, and neither form matches a typed keyword. The stock template guards this with `\ifpdftex\usepackage[T1]{fontenc}\fi`; keep the line in tailored CVs and custom templates that may be compiled with pdflatex. It is a no-op under lualatex.

### Date fields must be ASCII ranges (confirmed ATS import failure)

This one is worth knowing about because it fails **silently**. A CV that passes every other check in this section - clean extraction, no `(cid:)` markers, contact details intact, correct reading order - can still have its dates dropped on import. In a real Workday resume import, a CV built from this template lost the end date of a short contract role and failed to import **any** education entry at all, forcing manual re-entry. Nothing about the PDF or its text layer looked wrong.

Two independent causes, both easy to avoid:

1. **`--` in a `\cventry` date renders as an en-dash (U+2013), not a hyphen.** LaTeX ligatures `--` (two ASCII hyphens, U+002D) into a single en-dash glyph, so `2016--2024` reaches the PDF text layer as `2016<U+2013>2024`. Many parsers split date ranges only on an ASCII hyphen and see no range at all. Write the date argument with a **single hyphen**:

   ```latex
   \item{\cventry{2016-2024}{Role Title}{Organization}{Location}{}{...}}   % parses
   \item{\cventry{2016--2024}{Role Title}{Organization}{Location}{}{...}}  % en-dash, may not
   ```

   This applies to the **date argument only**. Keep `--` everywhere it is typographically correct in prose, for example a numeric range like `EUR 600k--1M`.

2. **A bare single year gives the parser no end date.** A short contract, mandate or internship written as `\cventry{2016}` imports as a start date with nothing to close it. Use an explicit range, with months where the role ran under a year:

   ```latex
   \item{\cventry{Mar 2016 - Jul 2016}{Contract Role}{Client}{Location}{}{...}}
   ```

   Where a genuine range exists, use it even when a single year would be factually accurate - a degree written `1995` is true but imports worse than `1992-1995`. Do not invent a start date you do not have; a lone graduation year is fine, just expect it to be typed in by hand.

**Cause 1 is mechanical in step 5d**: `python3 tools/verify_pdf.py cv/main_<company>_<role>.pdf --ascii-dates` scans the raw text layer for a year joined to a Unicode dash and exits 1 naming each hit with its code point (`U+2013 in 'Role Title 2016–2024'`). It deliberately reads the raw layer: the fold that lets `--contains "2016-2024"` match what the template renders maps that same en-dash back to `-`, so `--contains` can never see this. A year on either side of the dash is enough, so `Mar 2016 – Jul 2016` and `2016 – Present` are caught too; a numeric range with no year (`EUR 600k–1M`) is left alone. **Cause 2 stays a read-through check**: after extracting the text layer, confirm every experience entry shows a start *and* an end. Because both failures are silent and invisible in the PDF, the candidate otherwise discovers them only while filling in the application form.

## Page Budget - Hard 2-Page Limit

The CV **must** fit on exactly 2 pages when compiled. Use these content limits as a guide:

| Section | Max budget |
|---------|-----------|
| Profile statement | 3-4 lines |
| Skills | 5 items, each 1-2 lines |
| Most recent role | 4-5 bullets |
| Previous role | 2-3 bullets |
| Older roles | 2 bullets (1 line each) |
| Education | 2-3 entries |
| Publications | 2-3 entries |
| Awards | 3 entries, single line each |
| References | "Available upon request." (single line) |

**If in doubt, cut rather than squeeze.** Reducing `\vspace` or geometry scale to force-fit content makes the CV look cramped.

## Relevance-weighted cutting (the right way to shrink a CV)

**Cut by signal, not by section.** Static priority lists ("remove oldest education first, then shorten the earliest role...") are wrong when a relevant "lower-priority" item is competing with an irrelevant "higher-priority" item. An older-role bullet that speaks directly to the posting is worth more than a recent-role bullet that does not.

For every candidate line, score three things:

1. **Relevance to THIS posting** — does the line hit a named tool, keyword, or stated responsibility in the job ad?
2. **Uniqueness** — is it the only place this claim appears, or is it duplicated elsewhere in the CV?
3. **Narrative load** — does the cover letter depend on it? If cutting the line would force you to rewrite a cover-letter paragraph, it is load-bearing.

Cut the lowest-total-score line first, regardless of which section it sits in.

### Practical order of cuts (easiest → last resort)

1. **Redundancy.** If an achievement appears in both Core Competencies AND a role bullet, the Core Competencies version is usually the cleaner cut (the experience bullet is more concrete evidence).
2. **Profile-statement fluff.** A sentence that just restates what Publications or Skills will show. ("Peer-reviewed publications on X..." is already a Publications entry — profile can claim it once and stop.)
3. **Low-relevance experience bullets.** A bullet about work that does not touch posting keywords, wherever it sits. This cuts across sections before touching the structural list.
4. **Low-relevance supporting content.** An older-role bullet that does not speak to the target role. A certification that does not touch the posting's stack. A language entry that can be condensed to one line.
5. **Low-relevance publications.** Keep 1-2 publications that best match the posting. Cut the rest before touching experience bullets.
6. **Last-resort structural cuts.** Oldest education entry, tightening an older role to 2 bullets, collapsing Certifications into a single line. These only happen if the relevance-weighted cuts above have already been exhausted.

### Pitfalls to avoid

- Do not mechanically cut from the bottom of a static section list without checking relevance. "Cut the oldest role first" is wrong if that role is literally about the skill the posting asks for.
- Do not cut the one concrete example the cover letter leans on. Relevance is measured against the cover letter you wrote, not just the job posting — interviewers will have read both.
- Do not cut to fit if the fit is borderline (2.02 pages). Prefer `\enlargethispage{2-3\baselineskip}` on a late section for near-misses; reserve content cuts for genuine overflow (content on page 3 that is more than a single trailing section).

## Recommended Section Order

The section order varies by role type:

**For technical / data science / ML roles:**
1. Profile statement / elevator pitch
2. Core competencies / Skills
3. Professional Experience (reverse chronological)
4. Education (reverse chronological)
5. Languages
6. Publications & Awards
7. References

**For domain-specific / specialist roles:**
1. Profile statement / elevator pitch
2. Core competencies / Skills
3. Education (reverse chronological) - credentials are a key qualifier
4. Professional Experience (reverse chronological)
5. Publications & Awards
6. References
