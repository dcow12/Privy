---
name: Privy
description: Does the agent respect the rule, or just the test?
colors:
  federal-navy: "#12233f"
  navy-hover: "#1f3a63"
  navy-soft: "#b8c4d8"
  report-ink: "#0f172a"
  ink-secondary: "#475467"
  ink-muted: "#667085"
  axis-grey: "#98a2b3"
  rule: "#d0d5dd"
  rule-light: "#e4e7ec"
  wash: "#f2f4f7"
  cool-ground: "#eef1f5"
  report-page: "#ffffff"
  critical-red: "#b42318"
  caution-amber: "#b54708"
  cleared-green: "#067647"
  running-amber: "#dc6803"
  highlight-mark: "#fde7c3"
  model-1-blue: "#2a78d6"
  model-2-orange: "#eb6834"
  model-3-green: "#1baf7a"
typography:
  display:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "68px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.15
    fontFeature: "tnum"
  statement:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0.05em"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  hairline: "3px"
  control: "4px"
  pill: "10px"
  round: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  row: "14px"
  lg: "16px"
  xl: "24px"
  section: "30px"
  page: "40px"
components:
  button-primary:
    backgroundColor: "{colors.federal-navy}"
    textColor: "{colors.report-page}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.navy-hover}"
    textColor: "{colors.report-page}"
  button-secondary:
    backgroundColor: "{colors.report-page}"
    textColor: "{colors.federal-navy}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.federal-navy}"
  button-ghost:
    textColor: "{colors.federal-navy}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  button-small:
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  input-text:
    backgroundColor: "{colors.report-page}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  tab:
    textColor: "{colors.navy-soft}"
    padding: "3px 16px 0"
    height: "64px"
  tab-active:
    textColor: "{colors.report-page}"
  topbar:
    backgroundColor: "{colors.federal-navy}"
    textColor: "{colors.report-page}"
    padding: "0 32px"
    height: "64px"
  finding-plate:
    backgroundColor: "{colors.federal-navy}"
    textColor: "{colors.report-page}"
    typography: "{typography.display}"
    padding: "26px 30px"
  report-page:
    backgroundColor: "{colors.report-page}"
    textColor: "{colors.report-ink}"
    padding: "30px 32px 40px"
  run-docket-item-active:
    backgroundColor: "{colors.cool-ground}"
    textColor: "{colors.federal-navy}"
    padding: "12px 16px"
  badge:
    backgroundColor: "{colors.report-page}"
    textColor: "{colors.federal-navy}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "20px"
---

# Design System: Privy

## Overview

**Creative North Star: "The Investigation Report"**

Every run is filed as a federal investigation report: a deep navy shell holds white report pages laid on a cool grey ground, and each page reads top to bottom as a dossier. A meta line records when and how the run was filed, a heavy title names it, and one reversed navy plate states the headline finding at poster scale. Below that sit the two arms side by side, then the numbered findings and the numbered figures. The pages are ruled, not carded. Hairlines and short navy rules separate sections the way a printed report does, and colour turns up only where it carries meaning.

The system is built for a projector at the back of a room. Type is large and heavy, figures are tabular, and every gap is printed as a signed delta (true minus sign, "pts") next to both arms. The arms always run sandbox first, then production. Model hues are kept inside figures and their keys. State colours (red, amber, green) are reserved for verdicts and status. The world rejects the grey-card SaaS dashboard and the dark hacker console.

**Key Characteristics:**
- Navy shell, white pages, cool grey ground; one reversed navy plate per screen.
- Public Sans for everything, with tabular figures throughout.
- Ruled tables and section rules instead of boxed cards.
- Numbered findings ("1.1", "1.2") and numbered figures ("Figure 1.") as the reading structure.
- Signed deltas, right-aligned, beside both arms; sandbox always before production.
- Model hues only inside figures and keys; state colours only for meaning.

## Colors

The palette is restrained and institutional: one deep navy carries all brand weight, a cool slate neutral scale handles everything else, and saturated colour appears only as state or as a model key.

### Primary
- **Federal Navy** (federal-navy): the shell bar, the finding plate, primary buttons, the 2px rule under every page head and above every ruled table, the 3-4px rules on the run docket, the run bar and overlays, plus finding numbers, figure numbers, focus rings, checkbox fills and links. It is the system's only structural colour.
- **Navy Hover** (navy-hover): primary button hover only.
- **Navy Soft** (navy-soft): secondary text on navy surfaces, such as the tagline, inactive tabs, the plate's finding number and its confidence interval.

### Secondary (state; meaning only)
- **Critical Red** (critical-red): the arm or delta that came out worse, "execute" actions, error status, and the error toast rule.
- **Caution Amber** (caution-amber): running status text, "simulated" chips and condition tags. Simulated data is always labelled in this colour.
- **Cleared Green** (cleared-green): done status, deltas where the rule held, "escalate" actions.
- **Running Amber** (running-amber): the pulsing status dot of a run in progress, nothing else.

### Tertiary (model keys; figures only)
- **Model 1 Blue** (model-1-blue), **Model 2 Orange** (model-2-orange), **Model 3 Green** (model-3-green): one hue per compared model, in slot order. They appear on chart marks, legend swatches, the slot swatch and the dot beside a model name, and nowhere else. The white-box matplotlib figures use the same three as their colour cycle.

### Neutral
- **Report Ink** (report-ink): all primary text, both on the page and in figures.
- **Ink Secondary** (ink-secondary): intros, meta lines, table headers, captions, notes and tick labels.
- **Ink Muted** (ink-muted): disabled and switched-off rows, the checkbox stroke, the control direction in steering figures.
- **Axis Grey** (axis-grey): the zero line in charts, input strokes, the idle status dot and the shuffled-label baseline in figures.
- **Rule** (rule): table header rules, section rules, the borders of the arm and pair grids, figure image frames.
- **Rule Light** (rule-light): row hairlines, chart gridlines and the progress track.
- **Wash** (wash): button hover, row hover, code and prompt blocks, disabled inputs.
- **Cool Ground** (cool-ground): the page ground behind report pages and the active run in the docket.
- **Report Page** (report-page): every report page, the docket and every control surface.
- **Highlight Mark** (highlight-mark): highlighted phrases inside transcripts.

### Named Rules
**The Quarantine Rule.** Model hues live only inside figures and their keys (chart marks, legends, swatches, the dot beside a model name). Never use them on chrome, buttons, rules or text.

**The Meaning-Only Rule.** Red, amber and green mean worse, caution or simulated, and held or cleared. If a colour does not encode a verdict or status, it is navy or a neutral.

**The One Plate Rule.** A screen has exactly one reversed navy plate, and it holds Finding 1. Everything else sits on white.

## Typography

**Display Font:** Public Sans (self-hosted woff2, weights 400/500/600/700/800; falls back to system-ui)
**Body Font:** Public Sans
**Label/Mono Font:** system monospace stack, for prompts, code, condition examples and logs only

**Character:** a single civic grotesque used at full range, from ExtraBold 800 for numbers and headings down to Regular for reading text. It reads like a government report set for projection. Tabular figures are set on the body, so every number lines up in its column.

### Hierarchy
- **Display** (800, 68px, line-height 1, -0.03em): the signed gap on the finding plate. Used once per screen.
- **Figure** (800, 38px, line-height 1.15): each arm's value under the plate. Ruled data tables use the same weight at 22px for their headline numbers.
- **Headline** (800, 30px, line-height 1.2, -0.015em, balanced wrap): the page and report title.
- **Statement** (600, 20px, line-height 1.4): the finding sentence on the plate.
- **Title** (800, 15px, 0.05em, uppercase): section headings ("What we found", "Figure 2. ...") and the summaries of collapsible panels. The docket heading uses the same style at 14px.
- **Body** (400, 16px, line-height 1.5): reading text and finding rows. Intro paragraphs step up to 17px in ink-secondary, capped at 800px, and panel subtitles cap at 820px.
- **Label** (600-700, 14px): field labels, table headers, meta lines, chips, status and legends. Nothing in the interface is set below 13px.
- **Mono** (400, 13.5px, line-height 1.6): prompt previews, transcripts, condition examples and code.

### Named Rules
**The Tabular Rule.** Every number is set in tabular figures, and every gap carries an explicit sign (+ or a true minus, never a hyphen) with "pts" where it is a headline value.

**The Heavy Number Rule.** Numbers that carry a finding are ExtraBold (800). Sentences that explain them are Regular or SemiBold. Weight separates evidence from commentary.

## Layout

The app is desktop-only, with no breakpoints. A 64px sticky navy bar spans the full width and holds the name, the tagline and four underlined tabs. Content is centred in a 1340px column with a 32px gutter and generous bottom room (120px). Keys, New experiment and Inside the model are each a single white page (40px horizontal padding). Results is a two-column grid: a 280px sticky run docket (topped by a 4px navy rule) and a fluid white report page (32px padding), separated by a 24px gap.

The report runs in a fixed order: meta line, title and actions, then a 2px navy rule, the plate, the arms joined to the plate's lower edge, numbered findings, and numbered figure panels. Panels are separated by 30px of space and a 1px rule. Finding rows use a three-column grid: a 52px number, the text, and a 150px right-aligned delta. Forms are numbered steps ("1." to "6.") divided by rules, with paired options in two equal columns 56px apart. A sticky run bar with a 3px navy top rule pins the main action to the bottom of form pages.

The rhythm is 6/8/12/14/16/24/30/40px. Rows use 10-14px vertical padding, and sections use 26-30px.

## Elevation & Depth

The system is flat, and depth comes from tone and rules. Pages are white on the cool ground with no shadow, and hierarchy is carried by navy rules of increasing weight: 1px for hairlines, 2px under heads and above tables, 3px on the run bar and overlays, 4px on top of the docket. Soft, diffuse shadows appear only on elements that float above the page.

### Shadow Vocabulary
- **Run bar lift** (`box-shadow: 0 -8px 24px -12px rgba(15, 23, 42, 0.18)`): the sticky run bar, separating it from scrolling form content.
- **Tooltip** (`box-shadow: 0 10px 28px -10px rgba(15, 23, 42, 0.3)`): chart tooltips.
- **Toast** (`box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35)`): the status toast.
- **Focus halo** (`box-shadow: 0 0 0 3px rgba(18, 35, 63, 0.22)`): focused inputs and selects.

### Named Rules
**The Ruled, Not Carded Rule.** Sections on a report page are separated by rules and space, never wrapped in shadowed or rounded cards. Shadows are reserved for things that float (the run bar, tooltips, toasts).

## Shapes

The form language is square and printed. Pages, the plate, the arms, tables, figures and the docket have square corners. Controls get a barely-there 4px radius. Code chips, condition tags, the plate's simulated label and checkboxes use 3px. Only the running badge (10px pill), status dots, model dots and radios are round. Borders are hairlines (1px rule or rule-light) with navy rules for structure. Overlays carry a 3px navy top edge, and so does the error toast, where the edge turns critical red.

The arms use a dot language: a **filled dot** marks the sandbox-looking arm and a **hollow ring** marks the production-looking arm. The same grammar appears in the dot-and-ring chart, where the sandbox mark is filled with the model hue and production is a ring in that hue.

## Components

### Buttons
Firm and plain: square-ish, heavy labels, navy-only.
- **Shape:** gently squared (4px radius), 40px tall, Bold 15px label.
- **Primary:** navy fill, white text, 18px side padding. Hover deepens to navy-hover with a 0.15s background and colour transition.
- **Secondary:** white fill with a 1px navy border and navy text. Hover turns to wash.
- **Ghost:** no fill, navy text. Hover turns to wash.
- **Small:** 34px tall, 12px padding, 14px text.
- **Focus / Disabled:** a 3px navy outline offset by 3px (inside the navy bar it turns white, inset). Disabled buttons drop to 45% opacity.

### Inputs / Fields
- **Style:** white field, 1px axis-grey stroke, 4px radius, 40px tall, 15px text. Selects carry a custom navy chevron. Textareas use the mono face.
- **Focus:** the stroke turns navy and a 3px navy halo appears at 22% opacity.
- **Disabled:** wash fill with muted text.
- **Checks and radios:** an 18px custom box with a 2px muted stroke. Checked turns solid navy with a white tick, and a checked radio shows a navy centre dot. Option rows are separated by rule-light hairlines and use a Bold label with a secondary-ink explanation below.

### Navigation
- **Style:** a 64px sticky navy bar. The name is set at 19px/800 over a 14px navy-soft tagline, followed by four text tabs at 15px/600 with 16px line icons.
- **States:** inactive tabs are navy-soft and turn white on hover. The active tab is white with a 3px white underline flush to the bar's bottom edge. The running count is a white pill badge with navy numerals.

### Run Docket
A 280px sticky white column under a 4px navy rule. Each run is a ruled row with a checkbox, a run name clamped to two lines (14.5px Bold) and a meta line with the run kind, a status dot and the time. Hover turns the row to wash. The active run sits on cool-ground with its name in navy ExtraBold. Progress is a 5px navy bar on a rule-light track.

### Finding Plate (signature)
The one reversed navy plate on the screen. On the left: the finding number in 13px uppercase navy-soft, then the signed gap in Display, then the 95% interval in navy-soft. Simulated data adds an outlined amber label ("Simulated agents: not a finding"). On the right: the model's dot (ringed in white) and name, then the finding sentence in Statement and a follow-up line in pale coral. The arms attach directly below as a two-cell ruled grid, sandbox then production. Each cell shows a dot label, a 38px value (critical red when worse) and a note.

### Numbered Findings and Ruled Tables
Findings sit under a 2px navy rule, grouped by model under a dot heading. Each row reads `1.1 | sentence | signed delta`, with the delta right-aligned in ExtraBold, a 14px qualifier below it, red when worse and green when held. Tables have a 2px navy top rule and a 14px secondary-ink Bold header row over a 1px rule, with rule-light hairlines between rows. Rows turn wash on hover and numeric cells are right-aligned.

### Figures
Panels are headed "Figure N." with the number in navy, followed by a secondary-ink subtitle, a legend of model swatches, the chart and an optional "table view" disclosure. In-app SVG charts use Public Sans, rule-light gridlines, an axis-grey zero line and 15px secondary-ink ticks. The white-box matplotlib figures follow the same rules: Public Sans at 16px (ticks 15px), no top or right spines, rule-coloured axes, rule-light gridlines at 0.8 weight, frameless legends, white ground and the three model hues as the colour cycle. In those figures the sandbox or evaluation side is solid navy and the production side is white with navy hatching. Direction lines are navy solid (explicit), navy dashed (implicit) and muted dotted (control), and random baselines are thin pale grey. Raster figures sit in a 1px rule frame with a caption that leads with a navy bold "Figure N."

### Overlays
Tooltips and toasts are white boxes with a 1px rule border, a 3px navy top edge and a soft shadow. A tooltip leads with its value at 16px ExtraBold. An error toast changes its edge to critical red and prefixes its message with a red "Error:".

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one reversed navy plate, holding Finding 1 and its signed gap at 68px ExtraBold.
- **Do** order the arms sandbox first, production second, everywhere: arms, tables, legends, chart marks.
- **Do** print every gap as a signed delta (+ or a true minus) beside both arm values, right-aligned in tabular figures.
- **Do** number findings ("1.1") and figures ("Figure 1.") in navy, and let that numbering structure the page.
- **Do** separate report sections with rules (a 2px navy rule under heads and above tables, 1px rule or rule-light between rows) and space.
- **Do** label simulated data in caution amber, every time it appears.
- **Do** mark sandbox with a filled dot and production with a hollow ring.

### Don't:
- **Don't** use model hues outside figures and their keys: no blue, orange or green chrome, buttons, rules or headings.
- **Don't** use red, amber or green for decoration; they mean worse, caution or simulated, and held.
- **Don't** wrap report sections in rounded, shadowed cards; shadows belong only to the run bar, tooltips and toasts.
- **Don't** add a second reversed navy plate or any dark full-bleed panel beyond the shell bar.
- **Don't** introduce a second typeface for display; Public Sans carries every role except code.
- **Don't** add uppercase labels above headings; the only small uppercase label is the finding number on the plate.
- **Don't** set interface text below 13px; it has to read from the back of the room.
