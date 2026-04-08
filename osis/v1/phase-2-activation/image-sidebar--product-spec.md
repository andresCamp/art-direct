# Image Sidebar — Product Spec

## Purpose

The sidebar is how users manage what image they're working with. It replaces the upload box as the entry point to the tool. It holds gallery examples, upload, and the ability to start new directions. It's the answer to "what image am I working on?" and "how do I switch?"

### The Analogy

Think of a layer panel in Photoshop or a file tree in VS Code — it's the persistent navigation for your working context. In Art Direct's case, each "layer" is a direction: one image with its set of breakpoint compositions.

Where it sits in the pipeline:

```
[Sidebar: select/upload image] -> [Studio: compose frames] -> [Output: copy class string]
```

## Inputs

- Gallery image data (from gallery-data.ts — image paths, labels, pre-configured frames)
- User-uploaded images (from file input or drag-drop)
- Current active direction (from store)

## Interaction Model

- **Open/close:** Button in the top bar (replaces the current "Art Direct" back button). Click to slide panel in from left edge. Click again or click outside to close.
- **Gallery section:** Thumbnail grid of example images (Wave, Adam, Napoleon, Crows). Click to load that image with its pre-configured frames.
- **Upload section:** Drop zone + file picker button. Drag an image or click to browse. Creates a new direction with the uploaded image.
- **New direction:** Button that creates blank frames. Each frame becomes a drop target — drag an image onto any frame to start that direction.
- **Active indicator:** The currently loaded image/direction is highlighted in the sidebar.

## The Flow

### Switching Examples
1. User opens sidebar
2. Clicks a gallery thumbnail
3. Store resets frames to that example's pre-configured state
4. Studio updates immediately — image, frames, class string all reflect the new example
5. Sidebar can stay open or auto-close (TBD — test both)

### Uploading an Image
1. User opens sidebar
2. Drags image onto drop zone OR clicks file picker
3. Image processed (blob URL, dimensions, dominant color — same as current upload.ts flow)
4. New direction created with default frame states
5. Studio loads the new image
6. Background gradient updates to match dominant color

### New Blank Direction
1. User clicks "New"
2. Studio shows 6 frames with no image — each frame displays as a drop target (dashed border, upload icon)
3. User drags an image onto any frame
4. That image becomes the direction's image, loaded into all frames with defaults

## Behavioral Rules

- Sidebar never blocks the studio. It overlays with a semi-transparent backdrop or pushes content — TBD based on feel.
- Switching images is instant — no confirmation dialog. The tool is stateless in this phase (persistence comes later).
- Upload validation: same as current (image MIME types only).
- Gallery examples always available — they're not "uploaded," they're built-in.
- The sidebar button is always visible in the top bar, regardless of sidebar state.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User switches example while mid-composition | All frame states reset to the new example's pre-configured values. No warning (stateless). |
| User uploads non-image file | Rejected silently, same as current behavior |
| User opens sidebar on mobile | Full-width overlay with close button |
| Very large image uploaded | Same handling as current — blob URL, no server |

## Connections

| System | Relationship | What Flows |
|--------|--------------|------------|
| Store | Writes to | Image data, frame states |
| Gallery Data | Reads from | Example images and pre-configured frames |
| Upload Handler | Uses | File processing, blob URL creation |
| Welcome Experience | Coordinates with | Sidebar button shouldn't compete with welcome modal on first visit |
