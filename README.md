# Art Direct

Visual art direction for responsive images using Tailwind CSS.

One image. Every breakpoint. A class string you can copy.

## What is this?

Every frontend developer has felt this: a hero image that looks great on desktop, but on mobile the subject gets cropped out. The solutions today are all bad — multiple image crops, `<picture>` with art-directed sources, AI inpainting, or just accepting a bad mobile experience.

Art Direct solves this with CSS transforms. Upload an image, visually compose it per breakpoint, and copy a Tailwind class string. No extra assets, no runtime, no build step.

## How it works

1. Upload an image
2. See it in breakpoint frames (mobile, tablet, desktop)
3. Drag, zoom, and pan the image within each frame
4. Copy the Tailwind class string

The output works with any element that supports `object-fit` — `<img>`, Next.js `<Image>`, `background-image` divs.

## Development

```sh
bun install
bun dev
```

## License

[MIT](LICENSE)
