<script lang="ts">
  import * as Pretext from '@chenglou/pretext'
  import { materializeRichInlineLineRange, measureRichInlineStats, prepareRichInline, walkRichInlineLineRanges } from '@chenglou/pretext/rich-inline'
  import { BREAKPOINTS } from '../../lib/breakpoints'
  import { buildClassTokens } from '../../lib/class-generator'
  import { renderOutput } from '../../lib/format-renderer'
  import { store } from '../../lib/store.svelte'
  import type { ClassToken } from '../../lib/class-generator'
  import type { OutputFormat } from '../../lib/types'

  const formats: { value: OutputFormat; label: string }[] = [
    { value: 'img', label: '<img>' },
    { value: 'nextjs-image', label: 'Next.js' },
    { value: 'bg-div', label: 'bg-div' },
    { value: 'css', label: 'CSS' },
    { value: 'agent-instruction', label: 'Agent' },
  ]

  const MUTED = 'rgba(113,113,122,0.52)'
  const FOCUS_HIGHLIGHT = 'rgba(245,245,245,0.96)'
  const FOCUS_TRANSITION_MS = 520
  const PRETEXT_FONT = '400 12px "JetBrains Mono"'
  const PRETEXT_LINE_HEIGHT = 17.4
  const COPY_WIDTH_FALLBACK = 38
  const COLLAPSED_PANEL_FIXED_WIDTH = 768
  const COLLAPSED_PANEL_VIEWPORT_GUTTER = 40
  const COLLAPSED_PANEL_PADDING_X = 32
  const COLLAPSED_PANEL_GAP = 16
  const COLLAPSED_LINE_LIMIT = 2
  const TOKEN_REMOVAL_LINGER_MS = 300
  const TOKEN_WIDTH_LINGER_MS = 300
  const SCALE_PREVIEW_SETTLE_MS = 300
  const TOKEN_FIELD_ORDER = ['scale', 'translateX', 'translateY', 'objectFit', 'objectPosition', 'transformOrigin'] as const
  const WIDTH_LATCH_FIELDS = ['scale', 'translateX', 'translateY'] as const

  interface SourceItem {
    kind: 'token' | 'space'
    slotKey?: string
    focused: boolean
    text: string
    extraWidth?: number
  }

  interface PreviewRenderToken extends ClassToken {
    displayText: string
    measuredWidth: number
    extraWidth: number
  }

  interface CollapsedLine {
    text: string
    focusText: string
  }

  interface CollapsedLayout {
    panelWidth: number
    lineCount: number
    truncated: boolean
    lines: CollapsedLine[]
  }

  let expanded = $state(false)
  let copied = $state(false)
  let panelEl: HTMLDivElement | undefined = $state()
  let panelW = $state(0)
  let panelH = $state(0)
  let collapsedBaseLine0El: HTMLDivElement | undefined = $state()
  let collapsedBaseLine1El: HTMLDivElement | undefined = $state()
  let collapsedFocusLine0El: HTMLSpanElement | undefined = $state()
  let collapsedFocusLine1El: HTMLSpanElement | undefined = $state()
  let copyButtonW = $state(COPY_WIDTH_FALLBACK)
  let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 0)
  let fontEpoch = $state(0)
  let previewTokens = $state<ClassToken[]>([])
  let latchedTokenWidths = $state<Record<string, number>>({})
  let scalePreviewKeys = $state<Record<string, true>>({})

  const removalTimers = new Map<ClassToken['slotKey'], ReturnType<typeof setTimeout>>()
  const widthLatchTimers = new Map<ClassToken['slotKey'], ReturnType<typeof setTimeout>>()
  const scalePreviewTimers = new Map<ClassToken['slotKey'], ReturnType<typeof setTimeout>>()
  let previewSnapshot: ClassToken[] = []
  let renderTokenSnapshot: PreviewRenderToken[] = []

  const accent = $derived(store.dominantColor ?? '#2563eb')
  const hasLiveOutput = $derived(!!store.image && store.modifiedBreakpoints.size > 0 && !!store.classString)
  const liveTokens = $derived.by(() => hasLiveOutput ? buildClassTokens(store.frames) : [])
  const liveTokensByKey = $derived.by(() => new Map(liveTokens.map(token => [token.slotKey, token])))
  const collapsedLineSlots = [0, 1] as const

  function canMeasureInBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  }

  function commitPreviewTokens(next: ClassToken[]) {
    previewSnapshot = next
    previewTokens = next
  }

  function tokenRank(token: ClassToken) {
    const breakpointIndex = BREAKPOINTS.findIndex(bp => bp.name === token.breakpoint)
    const fieldIndex = TOKEN_FIELD_ORDER.indexOf(token.field)
    return breakpointIndex * TOKEN_FIELD_ORDER.length + fieldIndex
  }

  function sortCanonical(tokens: ClassToken[]) {
    return [...tokens].sort((a, b) => tokenRank(a) - tokenRank(b))
  }

  function breakpointPrefix(breakpoint: ClassToken['breakpoint']) {
    return BREAKPOINTS.find(bp => bp.name === breakpoint)?.prefix ?? ''
  }

  function clearScalePreviewTimer(slotKey: ClassToken['slotKey']) {
    const timer = scalePreviewTimers.get(slotKey)
    if (!timer) return
    clearTimeout(timer)
    scalePreviewTimers.delete(slotKey)
  }

  function clearAllScalePreviewTimers() {
    for (const timer of scalePreviewTimers.values()) clearTimeout(timer)
    scalePreviewTimers.clear()
  }

  function keepScalePreviewAlive(slotKey: ClassToken['slotKey']) {
    if (!scalePreviewKeys[slotKey]) {
      scalePreviewKeys = { ...scalePreviewKeys, [slotKey]: true }
    }

    clearScalePreviewTimer(slotKey)
    scalePreviewTimers.set(slotKey, setTimeout(() => {
      scalePreviewTimers.delete(slotKey)
      if (!(slotKey in scalePreviewKeys)) return
      const next = { ...scalePreviewKeys }
      delete next[slotKey]
      scalePreviewKeys = next
    }, SCALE_PREVIEW_SETTLE_MS))
  }

  function measureTokenTextWidth(text: string) {
    return Pretext.measureNaturalWidth(Pretext.prepareWithSegments(text, PRETEXT_FONT))
  }

  function isWidthLatchedField(field: ClassToken['field']) {
    return (WIDTH_LATCH_FIELDS as readonly ClassToken['field'][]).includes(field)
  }

  function shouldLatchTokenWidth(token: ClassToken) {
    return !!store.isDragging && token.breakpoint === store.activeBreakpoint && isWidthLatchedField(token.field)
  }

  function setLatchedTokenWidth(slotKey: ClassToken['slotKey'], width: number) {
    if (latchedTokenWidths[slotKey] === width) return
    latchedTokenWidths = { ...latchedTokenWidths, [slotKey]: width }
  }

  function clearWidthLatchTimer(slotKey: ClassToken['slotKey']) {
    const timer = widthLatchTimers.get(slotKey)
    if (!timer) return
    clearTimeout(timer)
    widthLatchTimers.delete(slotKey)
  }

  function dropLatchedTokenWidth(slotKey: ClassToken['slotKey']) {
    if (!(slotKey in latchedTokenWidths)) return
    const next = { ...latchedTokenWidths }
    delete next[slotKey]
    latchedTokenWidths = next
  }

  function clearAllWidthLatchTimers() {
    for (const timer of widthLatchTimers.values()) clearTimeout(timer)
    widthLatchTimers.clear()
  }

  function resetLatchedTokenWidths() {
    clearAllWidthLatchTimers()
    if (Object.keys(latchedTokenWidths).length > 0) latchedTokenWidths = {}
  }

  function scheduleWidthLatchShrink(slotKey: ClassToken['slotKey']) {
    clearWidthLatchTimer(slotKey)

    const timer = setTimeout(() => {
      widthLatchTimers.delete(slotKey)
      if (!store.isDragging) {
        dropLatchedTokenWidth(slotKey)
        return
      }

      const token = renderTokenSnapshot.find(candidate => candidate.slotKey === slotKey)
      if (!token || !shouldLatchTokenWidth(token)) {
        dropLatchedTokenWidth(slotKey)
        return
      }

      setLatchedTokenWidth(slotKey, token.measuredWidth)
    }, TOKEN_WIDTH_LINGER_MS)

    widthLatchTimers.set(slotKey, timer)
  }

  function formatPreviewTokenText(token: ClassToken) {
    if (token.breakpoint !== store.activeBreakpoint) return token.text
    if (token.field !== 'scale') return token.text
    if (!scalePreviewKeys[token.slotKey]) return token.text
    if (!liveTokensByKey.has(token.slotKey)) return token.text

    const frame = store.frames.find(candidate => candidate.breakpoint === token.breakpoint)
    if (!frame || frame.scale === 1) return token.text
    return `${breakpointPrefix(token.breakpoint)}scale-[${frame.scale.toFixed(1)}]`
  }

  function mergePreviewTokens(previous: ClassToken[], nextLive: ClassToken[]) {
    const previousByKey = new Map(previous.map(token => [token.slotKey, token]))
    const nextLiveByKey = new Map(nextLive.map(token => [token.slotKey, token]))
    const merged: ClassToken[] = previous.map(token => nextLiveByKey.get(token.slotKey) ?? token)

    for (const token of nextLive) {
      if (!previousByKey.has(token.slotKey)) merged.push(token)
    }

    return sortCanonical(merged)
  }

  function clearRemovalTimer(slotKey: ClassToken['slotKey']) {
    const timer = removalTimers.get(slotKey)
    if (!timer) return
    clearTimeout(timer)
    removalTimers.delete(slotKey)
  }

  function clearAllRemovalTimers() {
    for (const timer of removalTimers.values()) clearTimeout(timer)
    removalTimers.clear()
  }

  function scheduleTokenRemoval(slotKey: ClassToken['slotKey']) {
    if (removalTimers.has(slotKey)) return

    const timer = setTimeout(() => {
      removalTimers.delete(slotKey)
      if (!store.isDragging) return
      if (liveTokens.some(token => token.slotKey === slotKey)) return
      commitPreviewTokens(previewSnapshot.filter(token => token.slotKey !== slotKey))
    }, TOKEN_REMOVAL_LINGER_MS)

    removalTimers.set(slotKey, timer)
  }

  const previewRenderTokens = $derived.by<PreviewRenderToken[]>(() => {
    fontEpoch

    return previewTokens.map(token => {
      const displayText = formatPreviewTokenText(token)
      const measuredWidth = measureTokenTextWidth(displayText)
      const latchedWidth = shouldLatchTokenWidth(token)
        ? latchedTokenWidths[token.slotKey] ?? measuredWidth
        : measuredWidth

      return {
        ...token,
        displayText,
        measuredWidth,
        extraWidth: Math.max(0, latchedWidth - measuredWidth),
      }
    })
  })

  function syncCollapsedLineDom(layout: CollapsedLayout | null, activeBreakpoint: string) {
    const baseEls = [collapsedBaseLine0El, collapsedBaseLine1El]
    const focusEls = [collapsedFocusLine0El, collapsedFocusLine1El]

    for (let index = 0; index < collapsedLineSlots.length; index++) {
      const line = layout?.lines[index]
      const nextText = line?.text ?? ''
      const nextFocusText = line?.focusText ?? ''
      const nextOpacity = activeBreakpoint && nextFocusText.trim().length > 0 ? '1' : '0'

      const baseEl = baseEls[index]
      if (baseEl) {
        if (baseEl.textContent !== nextText) baseEl.textContent = nextText
      }

      const focusEl = focusEls[index]
      if (focusEl) {
        if (focusEl.textContent !== nextFocusText) focusEl.textContent = nextFocusText
        if (focusEl.style.opacity !== nextOpacity) focusEl.style.opacity = nextOpacity
      }
    }
  }

  const output = $derived(
    store.image && hasLiveOutput
      ? renderOutput(store.classString, store.outputFormat, store.image.filename, store.frames)
      : ''
  )

  const outputParts = $derived.by(() => {
    const cls = store.classString
    if (!cls || !output) return null
    const idx = output.indexOf(cls)
    if (idx === -1) return null
    return {
      before: output.slice(0, idx),
      classes: cls,
      after: output.slice(idx + cls.length),
    }
  })

  const panelBackdrop = $derived(
    `linear-gradient(180deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.024) 42%, rgba(255,255,255,0.042) 76%, rgba(255,255,255,0.058) 100%),
     radial-gradient(circle at 0% 0%, ${accent}20 0%, transparent 46%),
     radial-gradient(circle at 12% 108%, ${accent}34 0%, transparent 46%),
     radial-gradient(ellipse at 18% 100%, rgba(255,255,255,0.045) 0%, transparent 56%)`
  )

  const collapsedLayout = $derived.by<CollapsedLayout | null>(() => {
    fontEpoch
    if (!hasLiveOutput || !canMeasureInBrowser() || viewportWidth <= 0) return null

    const safeViewportWidth = Math.max(320, viewportWidth - COLLAPSED_PANEL_VIEWPORT_GUTTER)
    const panelWidth = Math.max(320, Math.min(COLLAPSED_PANEL_FIXED_WIDTH, safeViewportWidth))
    const chromeWidth = COLLAPSED_PANEL_PADDING_X + COLLAPSED_PANEL_GAP + Math.max(copyButtonW, COPY_WIDTH_FALLBACK)
    const textWidth = Math.max(1, Math.floor(panelWidth - chromeWidth))

    const items: SourceItem[] = []
    for (let i = 0; i < previewRenderTokens.length; i++) {
      const token = previewRenderTokens[i]!
      if (i > 0) {
        items.push({
          kind: 'space',
          focused: false,
          text: ' ',
        })
      }
      items.push({
        kind: 'token',
        slotKey: token.slotKey,
        focused: token.breakpoint === store.activeBreakpoint,
        text: token.displayText,
        extraWidth: token.extraWidth,
      })
    }

    const prepared = prepareRichInline(items.map(item => ({
      text: item.text,
      font: PRETEXT_FONT,
      break: 'normal',
      extraWidth: item.kind === 'token' ? item.extraWidth : 0,
    })))

    const stats = measureRichInlineStats(prepared, textWidth)
    const lines: CollapsedLine[] = []

    walkRichInlineLineRanges(prepared, textWidth, range => {
      if (lines.length >= COLLAPSED_LINE_LIMIT) return
      const line = materializeRichInlineLineRange(prepared, range)
      let text = ''
      let focusText = ''

      for (const fragment of line.fragments) {
        const item = items[fragment.itemIndex]
        if (!item) continue

        if (fragment.gapBefore > 0) {
          text += ' '
          focusText += ' '
        }

        text += fragment.text
        focusText += item.kind === 'token' && item.focused
          ? fragment.text
          : ' '.repeat(fragment.text.length)
      }

      lines.push({
        text,
        focusText,
      })
    })

    return {
      panelWidth: Math.ceil(panelWidth),
      lineCount: stats.lineCount,
      truncated: stats.lineCount > COLLAPSED_LINE_LIMIT,
      lines,
    }
  })

  $effect(() => {
    if (!canMeasureInBrowser()) return

    function onResize() {
      viewportWidth = window.innerWidth
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  $effect(() => {
    if (!canMeasureInBrowser() || !('fonts' in document)) return

    let cancelled = false
    const fontSet = document.fonts

    function refreshMeasurements() {
      Pretext.clearCache()
      fontEpoch += 1
    }

    fontSet.ready.then(() => {
      if (!cancelled) refreshMeasurements()
    })

    const handleDone = () => refreshMeasurements()
    fontSet.addEventListener?.('loadingdone', handleDone)

    return () => {
      cancelled = true
      fontSet.removeEventListener?.('loadingdone', handleDone)
    }
  })

  $effect(() => {
    const dragging = store.isDragging
    const nextLiveTokens = liveTokens

    if (!hasLiveOutput) {
      clearAllRemovalTimers()
      commitPreviewTokens([])
      return
    }

    if (!dragging) {
      clearAllRemovalTimers()
      commitPreviewTokens(nextLiveTokens)
      return
    }

    const merged = mergePreviewTokens(previewSnapshot, nextLiveTokens)
    commitPreviewTokens(merged)

    const liveKeys = new Set(nextLiveTokens.map(token => token.slotKey))
    for (const slotKey of [...removalTimers.keys()]) {
      if (liveKeys.has(slotKey)) clearRemovalTimer(slotKey)
    }

    for (const token of merged) {
      if (!liveKeys.has(token.slotKey)) scheduleTokenRemoval(token.slotKey)
    }
  })

  $effect(() => {
    const dragging = store.isDragging
    const activeBreakpoint = store.activeBreakpoint
    const frame = store.frames.find(candidate => candidate.breakpoint === activeBreakpoint)

    if (!hasLiveOutput || !activeBreakpoint || !frame || frame.scale === 1) return
    if (!dragging) return

    keepScalePreviewAlive(`${activeBreakpoint}:scale`)
  })

  $effect(() => {
    const dragging = store.isDragging
    const renderTokens = previewRenderTokens
    renderTokenSnapshot = renderTokens

    if (!dragging) {
      resetLatchedTokenWidths()
      return
    }

    const activeKeys = new Set<ClassToken['slotKey']>()
    let nextLatchedWidths: Record<string, number> | null = null

    for (const token of renderTokens) {
      if (!shouldLatchTokenWidth(token)) continue
      activeKeys.add(token.slotKey)

      const currentWidth = token.measuredWidth
      const latchedWidth = latchedTokenWidths[token.slotKey] ?? 0

      if (currentWidth >= latchedWidth) {
        clearWidthLatchTimer(token.slotKey)
        if (currentWidth !== latchedWidth) {
          if (!nextLatchedWidths) nextLatchedWidths = { ...latchedTokenWidths }
          nextLatchedWidths[token.slotKey] = currentWidth
        }
      } else {
        scheduleWidthLatchShrink(token.slotKey)
      }
    }

    for (const slotKey of Object.keys(latchedTokenWidths)) {
      if (activeKeys.has(slotKey as ClassToken['slotKey'])) continue
      clearWidthLatchTimer(slotKey as ClassToken['slotKey'])
      if (!nextLatchedWidths) nextLatchedWidths = { ...latchedTokenWidths }
      delete nextLatchedWidths[slotKey]
    }

    if (nextLatchedWidths) latchedTokenWidths = nextLatchedWidths
  })

  $effect(() => {
    if (!canMeasureInBrowser()) return

    const layout = collapsedLayout
    const activeBreakpoint = store.activeBreakpoint
    let raf = window.requestAnimationFrame(() => {
      syncCollapsedLineDom(layout, activeBreakpoint)
    })

    return () => window.cancelAnimationFrame(raf)
  })

  async function copyToClipboard(e: MouseEvent) {
    e.stopPropagation()
    if (!output) return
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

  $effect(() => () => {
    clearAllRemovalTimers()
    clearAllWidthLatchTimers()
    clearAllScalePreviewTimers()
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if hasLiveOutput}
  <div
    bind:this={panelEl}
    bind:clientWidth={panelW}
    bind:clientHeight={panelH}
    class={`absolute bottom-5 left-1/2 z-20 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0d]/68 shadow-[0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl ${
      expanded ? 'w-3xl max-w-[calc(100%-2.5rem)]' : ''
    }`}
    style:width={expanded ? undefined : collapsedLayout ? `${collapsedLayout.panelWidth}px` : 'min(48rem, calc(100vw - 2.5rem))'}
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
      <div class="relative z-10 flex items-start gap-4 px-4 py-2.5">
        <div
          class="relative min-w-0 flex-1 overflow-hidden font-mono text-[12px] tabular-nums"
          style:height={`${PRETEXT_LINE_HEIGHT * COLLAPSED_LINE_LIMIT}px`}
        >
          <div
            bind:this={collapsedBaseLine0El}
            class="absolute left-0 right-0 overflow-hidden whitespace-pre"
            style:top="0px"
            style:height={`${PRETEXT_LINE_HEIGHT}px`}
            style:color={MUTED}
          ></div>
          <div
            bind:this={collapsedBaseLine1El}
            class="absolute left-0 right-0 overflow-hidden whitespace-pre"
            style:top={`${PRETEXT_LINE_HEIGHT}px`}
            style:height={`${PRETEXT_LINE_HEIGHT}px`}
            style:color={MUTED}
          ></div>

          <span
            bind:this={collapsedFocusLine0El}
            class="pointer-events-none absolute left-0 whitespace-pre"
            style:top="0px"
            style:height={`${PRETEXT_LINE_HEIGHT}px`}
            style:color={FOCUS_HIGHLIGHT}
            style:opacity="0"
            style:transition={`opacity ${FOCUS_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`}
          ></span>
          <span
            bind:this={collapsedFocusLine1El}
            class="pointer-events-none absolute left-0 whitespace-pre"
            style:top={`${PRETEXT_LINE_HEIGHT}px`}
            style:height={`${PRETEXT_LINE_HEIGHT}px`}
            style:color={FOCUS_HIGHLIGHT}
            style:opacity="0"
            style:transition={`opacity ${FOCUS_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`}
          ></span>
        </div>

        <button
          bind:clientWidth={copyButtonW}
          type="button"
          class={`relative mt-[1px] flex-shrink-0 cursor-pointer text-[11px] font-mono transition-colors duration-200 before:absolute before:-inset-4 before:content-[''] ${
            copied
              ? 'text-emerald-400'
              : 'text-studio-muted/40 hover:text-studio-text'
          }`}
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
              class={`cursor-pointer text-[11px] font-mono transition-colors duration-200 ${
                store.outputFormat === fmt.value
                  ? 'text-studio-text'
                  : 'text-studio-muted/40 hover:text-studio-muted'
              }`}
              onclick={(e) => {
                e.stopPropagation()
                store.setOutputFormat(fmt.value)
                window.posthog?.capture('output_format_changed', { output_format: fmt.value })
              }}
            >
              {fmt.label}
            </button>
          {/each}
          <button
            type="button"
            class={`ml-auto cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors duration-200 ${
              copied
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-white/[0.10] bg-white/[0.06] text-studio-text hover:border-white/[0.18] hover:bg-white/[0.12]'
            }`}
            onclick={copyToClipboard}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div class="h-48 overflow-y-auto border-t border-studio-border/20 pt-3 studio-scroll">
          <pre class="whitespace-pre-wrap break-all text-[12px] font-mono leading-relaxed tabular-nums text-studio-muted/50">{#if outputParts}{outputParts.before}<span class="text-studio-text">{outputParts.classes}</span>{outputParts.after}{:else}{output}{/if}</pre>
        </div>
      </div>
    {/if}

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
