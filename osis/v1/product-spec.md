# Art Direct — Product Spec

Last updated: April 2026

> See [Vision](vision.md) for the "why." This is the "what" and "when."

---

## 1. What We're Building

A web-based visual tool where developers upload an image, see it rendered inside breakpoint frames, drag/zoom/pan the image per breakpoint to get the composition right, and copy a Tailwind CSS class string that reproduces that composition. No backend, no accounts, no image processing. A static site that runs entirely in the browser.

### The Analogy

Think of what a DJ mixer does for audio -- letting you manipulate a single track differently across channels with knobs and faders -- but for image composition across responsive breakpoints. The source material stays the same; you're just tuning how it presents in each context.

The gap between the analog and what we're building: no tool today lets you visually author per-breakpoint CSS transforms for a single image and get a copy-pasteable class string.

**The test:** A developer uploads an image, adjusts composition across breakpoints in under a minute, copies a class string, pastes it into their project, and the image looks intentional on every screen size.

**The constraint:** Solo developer. OSS. No backend infrastructure. Ship fast, stay simple.

---

## 2. Core Concepts

**Frame** — A dashed-border container representing a Tailwind breakpoint width (e.g., sm at 640px, md at 768px). The image renders inside it. The developer manipulates the image within the frame.

**Composition** — The combination of zoom (scale), position (translate/object-position), and fit (object-fit) applied to an image within a single frame.

**Class String** — The Tailwind utility class output. Base classes (mobile-first) plus breakpoint-prefixed overrides. This is the product's primary artifact.

**Format** — The output shape: raw `<img>` tag, Next.js `<Image>` component, `background-image` div, or agent instruction. Selected via pills in the output panel.

**Agent Instruction** — A natural language prompt describing the art direction, designed to be pasted into a CLI agent context so it can apply the classes to the right element.

**Studio Mode** — The full working interface that appears after uploading an image. Replaces the landing state.

---

## 3. The Pipeline

### 3.0 Entry

User arrives at artdirect.dev and lands directly in the studio. A randomly selected example image (Wave, Adam, Napoleon, or Crows) is pre-loaded with configured frames and a visible class string. On first visit, a welcome modal auto-plays a brief animated walkthrough (3-4 steps, ~10 seconds, dismissable). The user can start dragging immediately.

### 3.1 Upload

Upload moves from the landing page to the image sidebar — a left-edge panel accessible from the top bar. The sidebar holds gallery examples (click to switch), an upload drop zone (drag-drop + file picker), and a "New" button that creates blank frames as drop targets. The image is read client-side as a blob URL. No upload to any server.

### 3.2 Compose

The image appears in all breakpoint frames simultaneously. The user selects a frame and manipulates the image:
- **Drag** to reposition (maps to `object-position` or `translate`)
- **Scroll/pinch** to zoom (maps to `scale`)
- **Fit toggle** to switch between `object-cover`, `object-contain`, `object-fill`

Each frame stores its own composition state independently. Changes in one frame do not affect others.

### 3.3 Generate

As the user manipulates, the class string updates in real time. The smallest breakpoint is the base; larger breakpoints contribute prefixed overrides only where they differ from the base.

### 3.4 Copy

The user selects an output format via pills and copies the result. The output includes a comment with the source filename for traceability.

---

## 4. The Data Model (Conceptual)

**Image** — A client-side blob URL + original filename. Never persisted. Lost on page refresh (v1).

**FrameState** — Per-breakpoint composition values:
- `breakpoint`: string (base, sm, md, lg, xl, 2xl)
- `scale`: number
- `translateX`: number
- `translateY`: number
- `objectFit`: cover | contain | fill
- `objectPosition`: string
- `transformOrigin`: string

**OutputConfig** — Selected format (img, nextjs-image, bg-div, agent-instruction).

**BreakpointConfig** — The set of active breakpoints and their pixel widths. Defaults to Tailwind's standard breakpoints. Customizable.

Nothing persists to disk or server in v1. The product is stateless -- the class string is the artifact.

---

## 5. The Actors

| Actor | Role | Faces User? | The Job |
|-------|------|-------------|---------|
| Developer | Primary user | Yes | Upload image, compose per breakpoint, copy class string |
| Studio UI | Application | Yes | Render frames, handle gestures, generate classes |
| Class Generator | Engine | No | Map frame states to minimal Tailwind class string |
| Format Renderer | Engine | No | Adapt class string to output format (img, Next.js, bg, agent) |
| Image Sidebar | Navigation | Yes | Switch between gallery examples, upload new images, manage directions |
| Welcome Modal | Onboarding | Yes | First-time context: what Art Direct is and how to use it |

### What Flows Between Them

Developer uploads image -> Studio UI renders it in frames -> Developer manipulates frames -> Class Generator produces Tailwind string -> Format Renderer wraps it in selected format -> Developer copies output.

---

## 6. The Product Loop

### Primary Loop: Compose and Copy

**Trigger:** Developer arrives at artdirect.dev and sees a pre-composed example image ready to manipulate.
**First Contact:** Studio loads with example. Welcome modal provides 10-second context (first visit only). User starts dragging.
**Action:** Drag/zoom in breakpoint frames, switch examples, or upload own image.
**Reward:** A class string that makes the image look intentional everywhere.
**Investment:** Zero -- no account, no config, no persistence needed.
**Next Trigger:** Next image, next project.

### Secondary Loop: Share the Technique

**Trigger:** Developer discovers that single-image art direction via CSS transforms works.
**Reward:** Shares the tool/technique with team.
**Next Trigger:** Team adopts it as standard practice for responsive images.

### The Crossover

Each successful use reinforces the mental model that responsive image composition is a CSS problem, not an asset pipeline problem. This makes developers reach for Art Direct earlier in the workflow.

---

## 7. Screens

| Screen | Stage | Key Elements |
|--------|-------|--------------|
| Studio (/) | Entry + Compose | Pre-loaded example image, breakpoint frames, drag/zoom, real-time class output. Welcome modal on first visit. |
| /about | Reference | Current landing page content — hero, value prop, example gallery. Linked for SEO and sharing. |
| Image Sidebar | Navigation | Left-edge panel — gallery examples, upload zone, new direction button |
| Welcome Modal | First Visit | 3-4 step animated walkthrough, auto-advances, dismissable, re-openable via "?" |
| Output Panel | Copy | Format pills (img, Next.js, bg-div, agent), class string display, copy button, filename comment |
| Breakpoint Settings | Configure | Customize active breakpoints and widths, reset to Tailwind defaults |

---

## 8. Editorial / Design Philosophy

**Light, technical, confident.** The aesthetic says "developer tool" not "design tool." Clean lines, monospace where appropriate, minimal chrome.

**Light blue as the identity color.** Not Tailwind blue -- Art Direct's own shade. Applied sparingly: backgrounds, accents, the upload box border. Background shifts with the rotating gallery -- each image brings a subtle gradient that matches its palette, with a fine grain texture overlay (like Arc/Dia). The grain adds warmth and texture to what would otherwise be flat color. **In studio mode, the background adapts to the uploaded image** -- extract dominant color, compute a complementary shade, blend into the gradient. The studio feels bespoke to whatever image you're working with.

**Dashed borders for frames.** Frames are not device mockups. They're compositional containers. Dashed borders communicate "this is a boundary you're working within" without pretending to be a phone or laptop.

**Studio-first.** The studio is the product. Users land in the studio, not on a landing page. An example image is pre-loaded so the first interaction is manipulation, not upload. The landing page pitch lives at /about for reference and SEO. The welcome modal handles first-time context — brief, animated, non-blocking.

**Modals only for first contact.** The welcome modal is the one exception to minimal chrome — it exists because users arrive directly into the studio without landing page context. After first visit, the studio is self-evident.

**The class string is always visible.** It updates live. It's not hidden behind a "generate" button. The developer sees the output changing as they manipulate.

---

## 9. Roadmap

### Phase 1 — Ship It (April 2026)

**Goal:** A working tool at artdirect.dev that solves single-image responsive art direction with Tailwind output.

| Component | Tier | Notes |
|-----------|------|-------|
| Landing page (upload box, title, GitHub link, description) | T1 | Light blue theme, dotted border upload |
| Below-fold example (rotating gallery) | T1 | 5 iconic images cycling (The Great Wave, Rousseau's tiger, Dalí's clocks, etc.) — each pre-composed with different art direction to show range |
| Image upload (client-side blob) | T1 | Drag-and-drop + file picker |
| Studio mode with breakpoint frames | T1 | All Tailwind default breakpoints |
| Drag to reposition | T1 | Maps to object-position / translate |
| Scroll to zoom | T1 | Maps to scale |
| Object-fit toggle (cover/contain/fill) | T1 | Per-frame toggle |
| Real-time class string generation | T1 | Mobile-first, minimal overrides |
| Format pills (img, Next.js Image, bg-div, agent instruction) | T1 | Switch output format |
| Copy to clipboard | T1 | With filename comment |
| Custom breakpoints | T2 | Edit widths, add/remove breakpoints |
| Transform origin control | T2 | Visual control for origin point |
| Keyboard shortcuts for fine adjustment | T3 | Arrow keys for pixel-level positioning |

**Does not ship:** Persistence/save, image processing, config file export, multi-image sessions, accounts.

**Success looks like:** A developer can go from image upload to copied class string in under 60 seconds. The tool is usable without documentation.

### Phase 2 — Activation Pivot (April 2026)

**Goal:** Remove the upload barrier. Make the studio the first thing users experience.

**Signal:** 10 screen recordings from Reddit launch — zero users uploaded an image. The tool needs to show its value before asking for investment.

| Component | Tier | Notes |
|-----------|------|-------|
| Studio as homepage with pre-loaded example | T1 | Random selection from gallery, configured frames |
| Welcome modal (animated first-time walkthrough) | T1 | Auto-advances, clickable, dismissable, re-openable |
| Left sidebar (image management) | T1 | Gallery examples, upload, new direction |
| Landing content moves to /about | T1 | SEO and sharing preserved |

**Does not ship:** Persistence (ships immediately after), shareable URLs, custom breakpoints.

**Success looks like:** Users interact with frames within 10 seconds of landing. Upload rate improves from Reddit baseline. Ready for HN/X launch.

### Phase 2.5 — Persistence (April 2026)

**Goal:** Images and directions persist across sessions via Dexie.js (IndexedDB).

| Component | Notes |
|-----------|-------|
| Dexie.js integration | Store images and frame states in IndexedDB |
| Sidebar shows persisted directions | Recent images available across sessions |
| Welcome modal flag moves to Dexie | Consistent with persistence layer |

### Phase 3 — Beyond Images

**Goal:** Extend the visual-first responsive authoring model to other CSS properties.

| Component | Notes |
|-----------|-------|
| Responsive typography studio | Visual per-breakpoint type scales |
| Responsive spacing studio | Visual per-breakpoint spacing |
| Plugin architecture | Let others build responsive visual tools on the same foundation |

### The Long Horizon

Art Direct becomes the visual authoring layer for responsive Tailwind -- the place developers go when they need to see what their responsive utilities will look like before writing them. Not a design tool, not a code generator, but a direct manipulation interface over the CSS they were going to write anyway.

---

*artdirect.dev — April 2026*
