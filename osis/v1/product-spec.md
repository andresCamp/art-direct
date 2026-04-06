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

### 3.1 Upload

User drops or selects an image file. The image is read client-side as a blob URL. No upload to any server. The landing page transitions to studio mode.

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

### What Flows Between Them

Developer uploads image -> Studio UI renders it in frames -> Developer manipulates frames -> Class Generator produces Tailwind string -> Format Renderer wraps it in selected format -> Developer copies output.

---

## 6. The Product Loop

### Primary Loop: Compose and Copy

**Trigger:** Developer has an image that looks bad on mobile.
**Action:** Upload, drag/zoom in breakpoint frames.
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
| Landing | Entry | Light blue theme, dotted upload box, title, GitHub link, description, scroll-to-example |
| Example | Entry (below fold) | Rotating gallery of 5 iconic images (The Great Wave, Rousseau's jungle, Dalí's clocks, etc.) rendered in breakpoint frames, pre-composed, demonstrating the concept |
| Studio | Compose | Breakpoint frames with image, drag/zoom handles, fit toggles, real-time class output |
| Output Panel | Copy | Format pills (img, Next.js, bg-div, agent), class string display, copy button, filename comment |
| Breakpoint Settings | Configure | Customize active breakpoints and widths, reset to Tailwind defaults |

---

## 8. Editorial / Design Philosophy

**Light, technical, confident.** The aesthetic says "developer tool" not "design tool." Clean lines, monospace where appropriate, minimal chrome.

**Light blue as the identity color.** Not Tailwind blue -- Art Direct's own shade. Applied sparingly: backgrounds, accents, the upload box border. Background shifts with the rotating gallery -- each image brings a subtle gradient that matches its palette, with a fine grain texture overlay (like Arc/Dia). The grain adds warmth and texture to what would otherwise be flat color.

**Dashed borders for frames.** Frames are not device mockups. They're compositional containers. Dashed borders communicate "this is a boundary you're working within" without pretending to be a phone or laptop.

**No modals, no onboarding, no tooltips.** The interface should be self-evident. Upload triggers studio. Drag does what drag looks like. The example below the fold is the onboarding.

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

### Phase 2 — Polish and Ecosystem

**Goal:** Refinements based on real usage, plus ecosystem integrations.

| Component | Notes |
|-----------|-------|
| Shareable URLs (encode state in hash) | Share compositions without a backend |
| Config file export (tailwind.config mapping) | Map class strings to semantic names |
| Preset library (common compositions) | Starting points for portrait, landscape, hero |
| VS Code extension | Preview art direction inline |
| CLI tool | Generate classes from a config file |

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
