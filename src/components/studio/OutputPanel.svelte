<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { renderOutput } from '../../lib/format-renderer'
  import { BREAKPOINTS } from '../../lib/breakpoints'
  import type { BreakpointName, FrameState, OutputFormat } from '../../lib/types'

  const formats: { value: OutputFormat; label: string }[] = [
    { value: 'img', label: '<img>' },
    { value: 'nextjs-image', label: 'Next.js' },
    { value: 'bg-div', label: 'bg-div' },
    { value: 'css', label: 'CSS' },
    { value: 'agent-instruction', label: 'Agent' },
  ]

  let expanded = $state(false)
  let copied = $state(false)
  let panelEl: HTMLDivElement | undefined = $state()
  let panelW = $state(0)
  let panelH = $state(0)
  const accent = $derived(store.dominantColor ?? '#2563eb')

  // --- Debounced display snapshot ---
  // While a drag is in flight, store.classString updates ~60fps. Re-rendering
  // the floating bar at that rate causes constant token reflow churn — each
  // FLIP animation is interrupted by the next one before it can complete, and
  // the bar feels jittery even with the box pinned. Snapshot the inputs and
  // flush them either:
  //   • immediately when isDragging is false (one-shot edits, not a stream)
  //   • DRAG_DEBOUNCE_MS after the last change while dragging (pause or release)
  // All displayed derivations (output, tokens) read from this snapshot — never
  // store.classString directly — so the bar moves as one consistent piece.
  interface DisplaySnapshot {
    classString: string
    modifiedFrames: FrameState[]
    modifiedBreakpoints: ReadonlySet<BreakpointName>
    lastModifiedBreakpoint: BreakpointName | null
  }

  function snapshotFromStore(): DisplaySnapshot {
    return {
      classString: store.classString,
      modifiedFrames: store.frames.filter(f => store.modifiedBreakpoints.has(f.breakpoint)),
      modifiedBreakpoints: store.modifiedBreakpoints,
      lastModifiedBreakpoint: store.lastModifiedBreakpoint,
    }
  }

  const DRAG_DEBOUNCE_MS = 120
  let display = $state<DisplaySnapshot>(snapshotFromStore())

  $effect(() => {
    // Track every input that feeds the snapshot. The reads themselves register
    // the dependencies — the values are then re-pulled inside snapshotFromStore.
    store.classString
    store.frames
    store.modifiedBreakpoints
    store.lastModifiedBreakpoint
    const dragging = store.isDragging

    if (!dragging) {
      display = snapshotFromStore()
      return
    }

    const t = setTimeout(() => {
      display = snapshotFromStore()
    }, DRAG_DEBOUNCE_MS)
    return () => clearTimeout(t)
  })

  const output = $derived(
    store.image
      ? renderOutput(display.classString, store.outputFormat, store.image.filename, display.modifiedFrames)
      : ''
  )

  const outputParts = $derived.by(() => {
    const cls = display.classString
    if (!cls || !output) return null
    const idx = output.indexOf(cls)
    if (idx === -1) return null
    return {
      before: output.slice(0, idx),
      classes: cls,
      after: output.slice(idx + cls.length),
    }
  })

  const MUTED = 'rgba(113,113,122,0.5)'
  const BRIGHT = '#e4e4e7'
  const panelBackdrop = $derived(
    `linear-gradient(180deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.024) 42%, rgba(255,255,255,0.042) 76%, rgba(255,255,255,0.058) 100%),
     radial-gradient(circle at 0% 0%, ${accent}20 0%, transparent 46%),
     radial-gradient(circle at 12% 108%, ${accent}34 0%, transparent 46%),
     radial-gradient(ellipse at 18% 100%, rgba(255,255,255,0.045) 0%, transparent 56%)`
  )

  // Parse a class token into a stable slot key like `md:scale` or `base:translateY`.
  // Used as the keyed-each identity so the same DOM node persists across re-renders
  // when only the token's text content changes (which lets the manual FLIP below
  // measure before/after positions for the same element).
  function tokenToSlotKey(token: string): string {
    const colonIdx = token.indexOf(':')
    let prefix = 'base'
    let body = token
    if (colonIdx > 0) {
      prefix = token.slice(0, colonIdx)
      body = token.slice(colonIdx + 1)
    }
    if (body.startsWith('-')) body = body.slice(1)

    let field = '?'
    if (body.startsWith('scale-')) field = 'scale'
    else if (body.startsWith('translate-x-')) field = 'translateX'
    else if (body.startsWith('translate-y-')) field = 'translateY'
    else if (/^object-(cover|contain|fill|none|scale-down)$/.test(body)) field = 'objectFit'
    else if (body.startsWith('object-')) field = 'objectPosition'
    else if (body.startsWith('origin-')) field = 'transformOrigin'

    return `${prefix}:${field}`
  }

  interface Token {
    text: string      // raw class token, exactly as the generator produced it
    slotKey: string   // stable identity for the keyed each
    bright: boolean   // highlight color
  }

  const tokens = $derived.by<Token[]>(() => {
    const cls = display.classString
    if (!cls) return []

    const rawTokens = cls.split(' ')
    const bp = display.lastModifiedBreakpoint

    let isBright: (raw: string) => boolean
    if (!bp) {
      isBright = () => false
    } else {
      const modifiedNames = BREAKPOINTS
        .filter(b => display.modifiedBreakpoints.has(b.name))
        .map(b => b.name)
      const isFirstModified = modifiedNames[0] === bp
      const bpDef = BREAKPOINTS.find(b => b.name === bp)
      const nominalPrefix = bpDef?.prefix ?? ''
      const effectivePrefix = isFirstModified ? '' : nominalPrefix
      const otherPrefixes = BREAKPOINTS.filter(b => b.prefix).map(b => b.prefix)

      isBright = (raw: string) => {
        if (effectivePrefix === '') {
          return !otherPrefixes.some(p => raw.startsWith(p))
        }
        return raw.startsWith(effectivePrefix)
      }
    }

    return rawTokens.map(raw => ({
      text: raw,
      slotKey: tokenToSlotKey(raw),
      bright: isBright(raw),
    }))
  })

  // --- Manual FLIP for token layout shifts ---
  // The token text is the source of truth (idiomatic Tailwind), so widths *do*
  // change when values shrink/grow or tokens drop. animate:flip won't catch
  // those — Svelte's directive only fires when an item's *index* changes
  // within a keyed each (svelte.dev/docs/svelte/animate), and our slot keys
  // (`base:scale`, `md:translateY`, …) hold their indices while only the text
  // content changes. So we hand-roll FLIP: snapshot every span's position
  // with $effect.pre before Svelte applies the new tokens, then after the
  // DOM updates compute the delta per span and play a transform animation
  // via the Web Animations API.
  //
  // Coordinates are PARENT-RELATIVE (offsetLeft/offsetTop) on purpose. The
  // panel above is fixed-size (`w-3xl`, `min-h-[2lh]` on the pre), so the
  // only thing that should move tokens is internal reflow within the box.
  // Using getBoundingClientRect would also absorb any movement of the panel
  // itself into the deltas, making tokens visibly fight the panel chrome.
  let tokensEl: HTMLElement | undefined = $state()
  const tokenPositions = new Map<Element, { left: number, top: number }>()
  const FLIP_DURATION_MS = 250

  $effect.pre(() => {
    display.classString // track the debounced display string, not the live one
    if (!tokensEl) return
    tokenPositions.clear()
    for (const child of tokensEl.children) {
      const el = child as HTMLElement
      tokenPositions.set(child, { left: el.offsetLeft, top: el.offsetTop })
    }
  })

  $effect(() => {
    display.classString // track
    if (!tokensEl) return
    for (const child of tokensEl.children) {
      const old = tokenPositions.get(child)
      if (!old) continue // newly mounted span — let it appear naturally
      const el = child as HTMLElement
      const dx = old.left - el.offsetLeft
      const dy = old.top - el.offsetTop
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: FLIP_DURATION_MS, easing: 'ease-out', composite: 'replace' }
      )
    }
  })

  async function copyToClipboard(e: MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(output)
    copied = true
    setTimeout(() => { copied = false }, 1500)
    window.posthog?.capture('output_copied', {
      output_format: store.outputFormat,
      class_string_length: store.classString.length,
      modified_breakpoints_count: store.modifiedBreakpoints.size,
    })
  }

  function handleClickOutside(e: MouseEvent) {
    if (!expanded) return
    if (panelEl && !panelEl.contains(e.target as Node)) {
      expanded = false
    }
  }

  $effect(() => {
    if (expanded) {
      const timer = setTimeout(() => {
        window.addEventListener('click', handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('click', handleClickOutside)
      }
    }
  })

  $effect(() => {
    const ts = store.lastModifiedAt
    if (!ts) return
    const breakpoint = store.lastModifiedBreakpoint
    const timer = setTimeout(() => {
      window.posthog?.capture('frame_adjusted', {
        breakpoint,
        output_format: store.outputFormat,
        modified_breakpoints_count: store.modifiedBreakpoints.size,
      })
      store.clearLastModified()
    }, 2000)
    return () => clearTimeout(timer)
  })

</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if store.classString}
<div
  bind:this={panelEl}
  bind:clientWidth={panelW}
  bind:clientHeight={panelH}
  class="absolute bottom-5 left-1/2 z-20 w-3xl max-w-[calc(100%-2.5rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0d]/68 shadow-[0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
  class:cursor-pointer={!expanded}
  onclick={() => {
    const next = !expanded
    expanded = next
    if (next) window.posthog?.capture('output_panel_expanded', { output_format: store.outputFormat })
  }}
>
  <div class="absolute inset-0 bg-[#0a0a0d]/42"></div>
  <div class="absolute inset-0 opacity-[0.96]" style:background={panelBackdrop}></div>
  <div class="grain-overlay absolute inset-0 opacity-[0.06] mix-blend-overlay"></div>
  {#if !expanded}
    <div class="relative z-10 flex items-center gap-4 px-4 py-2.5">
      <pre
        bind:this={tokensEl}
        class="min-h-[2lh] text-[12px] font-mono tabular-nums whitespace-pre-wrap break-words leading-relaxed line-clamp-2"
        >{#each tokens as t (t.slotKey)}<span
            class="inline-block transition-colors duration-300"
            style:color={t.bright ? BRIGHT : MUTED}
          >{t.text}{' '}</span>{/each}</pre>

      <button
        type="button"
        class="cursor-pointer flex-shrink-0 text-[11px] font-mono transition-colors duration-200 relative before:absolute before:-inset-4 before:content-['']
          {copied
            ? 'text-emerald-400'
            : 'text-studio-muted/40 hover:text-studio-text'}"
        onclick={copyToClipboard}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  {:else}
    <div class="relative z-10 flex flex-col gap-3 px-4 py-3">
      <div class="flex items-center gap-3">
        {#each formats as fmt}
          <button
            type="button"
            class="cursor-pointer text-[11px] font-mono transition-colors duration-200
              {store.outputFormat === fmt.value
                ? 'text-studio-text'
                : 'text-studio-muted/40 hover:text-studio-muted'}"
            onclick={(e) => { e.stopPropagation(); store.setOutputFormat(fmt.value); window.posthog?.capture('output_format_changed', { output_format: fmt.value }) }}
          >
            {fmt.label}
          </button>
        {/each}
        <button
          type="button"
          class="cursor-pointer ml-auto rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors duration-200
            {copied
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
              : 'border-white/[0.10] bg-white/[0.06] text-studio-text hover:border-white/[0.18] hover:bg-white/[0.12]'}"
          onclick={copyToClipboard}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div class="h-48 overflow-y-auto studio-scroll border-t border-studio-border/20 pt-3">
        <pre class="text-[12px] font-mono tabular-nums text-studio-muted/50 whitespace-pre-wrap break-all leading-relaxed">{#if outputParts}{outputParts.before}<span class="text-studio-text">{outputParts.classes}</span>{outputParts.after}{:else}{output}{/if}</pre>
      </div>
    </div>
  {/if}

  <!--
    Marching-ants drag indicator. Visible while a Frame drag is in flight.
    stroke-dashoffset is bound directly to store.dragOffset (raw pixel
    accumulator), so dashes advance in lockstep with the cursor.
    SVG paths trace clockwise, so positive offset → -dashoffset → CW march.
    Inset by 0.75 (half stroke-width) so the stroke isn't half-clipped by overflow-hidden.
  -->
  <svg
    class="pointer-events-none absolute inset-0 z-30"
    style:opacity={store.isDragging ? 1 : 0}
    width={panelW}
    height={panelH}
    aria-hidden="true"
  >
    <rect
      x="0.75"
      y="0.75"
      width={Math.max(0, panelW - 1.5)}
      height={Math.max(0, panelH - 1.5)}
      rx="15.25"
      ry="15.25"
      fill="none"
      stroke="white"
      stroke-opacity="0.8"
      stroke-width="1.5"
      stroke-dasharray="6 4"
      stroke-dashoffset={-store.dragOffset}
    />
  </svg>
</div>
{/if}
