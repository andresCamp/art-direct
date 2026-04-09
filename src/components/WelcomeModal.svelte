<script lang="ts">
  import { Tween } from 'svelte/motion'
  import { cubicInOut } from 'svelte/easing'
  import { store } from '../lib/store.svelte'
  import { persistPreferencesNow } from '../lib/persistence.svelte'

  // testMode: bypass store/Dexie entirely (always show on mount, don't persist on dismiss).
  // Use on the /modal route so the modal can be tested in isolation.
  let { testMode = false }: { testMode?: boolean } = $props()

  // ─── Demo canvas layout ────────────────────────────────────────────────────
  // The cursor moves within this fixed coordinate system. All children of
  // .demo-canvas (frames, class output, cursor) are absolutely positioned.
  const DEMO_W = 460
  const DEMO_H = 304

  // Mobile frame
  const MOBILE_X = 16
  const MOBILE_Y = 4
  const MOBILE_W = 116
  const MOBILE_H = 200
  const MOBILE_CX = MOBILE_X + MOBILE_W / 2
  const MOBILE_CY = MOBILE_Y + MOBILE_H / 2

  // Desktop frame
  const DESKTOP_X = 156
  const DESKTOP_Y = 26
  const DESKTOP_W = 288
  const DESKTOP_H = 160
  const DESKTOP_CX = DESKTOP_X + DESKTOP_W / 2
  const DESKTOP_CY = DESKTOP_Y + DESKTOP_H / 2

  // Class output area
  const CLASS_X = 8
  const CLASS_Y = 234
  const CLASS_W = 444
  const CLASS_H = 48

  // Copy button visual position (right side of class output)
  const COPY_BTN_W = 68
  const COPY_BTN_H = 30
  const COPY_BTN_RIGHT_PAD = 10
  const COPY_BTN_EXIT_PADDING = 10
  const COPY_BTN_LEFT = CLASS_X + CLASS_W - COPY_BTN_RIGHT_PAD - COPY_BTN_W
  const COPY_BTN_RIGHT = COPY_BTN_LEFT + COPY_BTN_W
  const COPY_BTN_TOP = CLASS_Y + (CLASS_H - COPY_BTN_H) / 2
  const COPY_BTN_BOTTOM = COPY_BTN_TOP + COPY_BTN_H
  const COPY_BTN_X = COPY_BTN_LEFT + COPY_BTN_W / 2
  const COPY_BTN_Y = CLASS_Y + CLASS_H / 2

  // ─── Image crop geometry ───────────────────────────────────────────────────
  const SOURCE_W = 1200
  const SOURCE_H = 1434
  const SOURCE_RATIO = SOURCE_W / SOURCE_H

  const MOBILE_IMAGE_W = Math.round(MOBILE_H * SOURCE_RATIO)
  const MOBILE_IMAGE_H = MOBILE_H
  const MOBILE_MIN_X = MOBILE_W - MOBILE_IMAGE_W
  const MOBILE_MAX_X = 0
  const MOBILE_REST_X = -12
  const MOBILE_CURSOR_START_X = MOBILE_X + 88
  const MOBILE_CURSOR_START_Y = MOBILE_Y + 88
  const MOBILE_CURSOR_END_X = MOBILE_CURSOR_START_X - 26
  const MOBILE_CURSOR_END_Y = MOBILE_CURSOR_START_Y + 4

  const DESKTOP_IMAGE_W = DESKTOP_W
  const DESKTOP_IMAGE_H = Math.round(DESKTOP_W / SOURCE_RATIO)
  const DESKTOP_MIN_Y = DESKTOP_H - DESKTOP_IMAGE_H
  const DESKTOP_MAX_Y = 0
  const DESKTOP_REST_Y = -104
  const DESKTOP_TARGET_SCALE = 1.06
  const DESKTOP_CURSOR_START_X = DESKTOP_X + 152
  const DESKTOP_CURSOR_START_Y = DESKTOP_Y + 70
  const DESKTOP_CURSOR_END_X = DESKTOP_CURSOR_START_X + 4
  const DESKTOP_CURSOR_END_Y = DESKTOP_CURSOR_START_Y + 44

  // ─── Reactive state ─────────────────────────────────────────────────────────
  let show = $state(false)
  let dialog: HTMLDialogElement | undefined = $state()
  let step = $state<0 | 1>(0)
  let running = $state(false)
  let copied = $state(false)
  let cursorPressed = $state(false)
  let cursorCopyHover = $state(false)
  let activeClassFrame = $state<'none' | 'mobile' | 'desktop'>('none')
  let dismissedThisSession = $state(false)
  let hasSeenBefore = $state(false)
  let viewportW = $state(1280)
  let viewportH = $state(800)
  let cursorPosX = $state(40)
  let cursorPosY = $state(280)
  let cursorAngle = $state(-14)
  let mobileDragging = $state(false)
  let desktopDragging = $state(false)
  let mobileDragBaseX = $state(MOBILE_REST_X)
  let mobileDragAnchorX = $state(MOBILE_CURSOR_START_X)
  let desktopDragBaseY = $state(DESKTOP_REST_Y)
  let desktopDragAnchorY = $state(DESKTOP_CURSOR_START_Y)
  let desktopDragBaseScale = $state(1)
  let cursorMoveToken = 0

  // ─── Animation tweens ───────────────────────────────────────────────────────
  const mobileImageX = new Tween(MOBILE_REST_X, { duration: 820, easing: cubicInOut })
  const desktopImageY = new Tween(DESKTOP_REST_Y, { duration: 820, easing: cubicInOut })
  const desktopImageScale = new Tween(1, { duration: 820, easing: cubicInOut })
  // Cursor opacity (motion is manually driven so x/y stay perfectly in sync)
  const cursorOpacity = new Tween(0, { duration: 300 })

  // ─── Derived ────────────────────────────────────────────────────────────────
  const demoScale = $derived.by(() => {
    const horizontal = (viewportW - 92) / DEMO_W
    const vertical = (viewportH - 360) / DEMO_H
    return Math.max(0.62, Math.min(1, horizontal, vertical))
  })
  const demoShellWidth = $derived(Math.round(DEMO_W * demoScale))
  const demoShellHeight = $derived(Math.round(DEMO_H * demoScale))
  const mobileVisualX = $derived(
    mobileDragging
      ? clampNumber(mobileDragBaseX + (cursorPosX - mobileDragAnchorX), MOBILE_MIN_X, MOBILE_MAX_X)
      : mobileImageX.current,
  )
  const desktopVisualY = $derived(
    desktopDragging
      ? clampNumber(
          desktopDragBaseY + (
            (cursorPosY - desktopDragAnchorY) *
            ((DESKTOP_MAX_Y - desktopDragBaseY) /
              (DESKTOP_CURSOR_END_Y - DESKTOP_CURSOR_START_Y))
          ),
          DESKTOP_MIN_Y,
          DESKTOP_MAX_Y,
        )
      : desktopImageY.current,
  )
  const desktopVisualScale = $derived(
    desktopDragging
      ? clampNumber(
          desktopDragBaseScale + (
            (cursorPosY - desktopDragAnchorY) *
            ((DESKTOP_TARGET_SCALE - desktopDragBaseScale) /
              (DESKTOP_CURSOR_END_Y - DESKTOP_CURSOR_START_Y))
          ),
          1,
          DESKTOP_TARGET_SCALE,
        )
      : desktopImageScale.current,
  )
  const mobileFocusX = $derived(percentFromOffset(mobileVisualX, MOBILE_MIN_X))
  const desktopFocusY = $derived(percentFromOffset(desktopVisualY, DESKTOP_MIN_Y))
  const mobileTokens = $derived.by(() => [
    { id: 'mobile-fit', frame: 'mobile', text: 'object-cover', value: false },
    { id: 'mobile-pos', frame: 'mobile', text: `object-[${formatPercent(mobileFocusX)}%_50%]`, value: true },
  ])
  const desktopTokens = $derived.by(() => [
    {
      id: 'desktop-fit',
      frame: 'desktop',
      text: 'xl:object-cover',
      value: false,
    },
    {
      id: 'desktop-pos',
      frame: 'desktop',
      text: `xl:object-[50%_${formatPercent(desktopFocusY)}%]`,
      value: true,
    },
  ])
  const classTokens = $derived.by(() => [...mobileTokens, ...desktopTokens])

  $effect(() => {
    function syncViewport() {
      viewportW = window.innerWidth
      viewportH = window.innerHeight
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)

    return () => window.removeEventListener('resize', syncViewport)
  })

  // ─── First-visit check ─────────────────────────────────────────────────────
  // The store is the source of truth for `welcomeSeen`. On cold load it starts
  // false; persistence.ts hydrateStore() reads the persisted value (and runs
  // the localStorage-→-Dexie migration) before this effect's first read in the
  // common path. To handle the race where this effect runs before hydration,
  // we re-check on every store change and only show after we're confident the
  // hydrated value is `false`.
  $effect(() => {
    if (testMode) {
      // Always show in test mode, no store interaction
      const id = setTimeout(() => { show = true }, 100)
      return () => clearTimeout(id)
    }
    const seen = store.welcomeSeen
    hasSeenBefore = seen
    if (!seen) {
      // small delay so the studio paints first AND any pending Dexie hydration
      // has a chance to flip welcomeSeen to true before we show the modal
      const id = setTimeout(() => {
        if (store.welcomeSeen) return
        show = true
        window.posthog?.capture('welcome_modal_shown', { trigger: 'first_visit' })
      }, 500)
      return () => clearTimeout(id)
    }
  })

  // ─── Sync dialog open/close with `show` state ──────────────────────────────
  $effect(() => {
    if (!dialog) return
    if (show && !dialog.open) {
      dialog.showModal()
      void playLoop()
    } else if (!show && dialog.open) {
      dialog.close()
    }
  })

  // ─── Animation timeline ────────────────────────────────────────────────────
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

  function percentFromOffset(offset: number, minOffset: number): number {
    return clampNumber(((-offset) / (-minOffset)) * 100, 0, 99)
  }

  function formatPercent(value: number): string {
    return String(Math.round(value)).padStart(2, '0')
  }

  function isCursorOverCopyButton(): boolean {
    return (
      cursorPosX >= COPY_BTN_LEFT - COPY_BTN_EXIT_PADDING &&
      cursorPosX <= COPY_BTN_RIGHT + COPY_BTN_EXIT_PADDING &&
      cursorPosY >= COPY_BTN_TOP - COPY_BTN_EXIT_PADDING &&
      cursorPosY <= COPY_BTN_BOTTOM + COPY_BTN_EXIT_PADDING
    )
  }

  function waitForCursorToLeaveCopyButton(): Promise<void> {
    return new Promise((resolve) => {
      function frame() {
        if (!running || !isCursorOverCopyButton()) {
          resolve()
          return
        }

        requestAnimationFrame(frame)
      }

      requestAnimationFrame(frame)
    })
  }

  function quadraticPoint(start: number, control: number, end: number, t: number): number {
    const inv = 1 - t
    return inv * inv * start + 2 * inv * t * control + t * t * end
  }

  function cursorTilt(dx: number, dy: number): number {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return Math.max(-18, Math.min(18, angle * 0.12))
  }

  async function moveCursor(
    x: number,
    y: number,
    {
      duration = 900,
      curve = 0.12,
      jitter = 0.7,
    }: {
      duration?: number
      curve?: number
      jitter?: number
    } = {},
  ): Promise<void> {
    const token = ++cursorMoveToken
    const startX = cursorPosX
    const startY = cursorPosY
    const dx = x - startX
    const dy = y - startY
    const distance = Math.hypot(dx, dy)

    if (distance < 1) {
      cursorPosX = x
      cursorPosY = y
      return
    }

    const normalX = -dy / distance
    const normalY = dx / distance
    const direction = dx >= 0 ? 1 : -1
    const curveOffset = Math.min(22, distance * curve) * direction
    const controlX = startX + dx * 0.52 + normalX * curveOffset
    const controlY = startY + dy * 0.52 + normalY * curveOffset
    const phase = (startX * 0.11) + (startY * 0.07) + (x * 0.05)

    return new Promise((resolve) => {
      let startTime: number | undefined

      function frame(timestamp: number) {
        if (token !== cursorMoveToken || !running) {
          resolve()
          return
        }

        if (startTime === undefined) startTime = timestamp
        const elapsed = timestamp - startTime
        const rawT = Math.min(elapsed / duration, 1)
        const easedT = cubicInOut(rawT)
        const jitterEnvelope = Math.sin(rawT * Math.PI)
        const jitterOffset = Math.sin(rawT * Math.PI * 2 + phase) * jitter * jitterEnvelope

        const baseX = quadraticPoint(startX, controlX, x, easedT)
        const baseY = quadraticPoint(startY, controlY, y, easedT)
        cursorPosX = baseX + normalX * jitterOffset
        cursorPosY = baseY + normalY * jitterOffset

        const lookAheadT = Math.min(1, easedT + 0.025)
        const lookAheadX = quadraticPoint(startX, controlX, x, lookAheadT)
        const lookAheadY = quadraticPoint(startY, controlY, y, lookAheadT)
        cursorAngle = cursorTilt(lookAheadX - baseX, lookAheadY - baseY)

        if (rawT < 1) {
          requestAnimationFrame(frame)
        } else {
          cursorPosX = x
          cursorPosY = y
          cursorAngle = cursorTilt(dx, dy)
          resolve()
        }
      }

      requestAnimationFrame(frame)
    })
  }

  async function playLoop() {
    running = true

    // Step 1: title card — plays once
    step = 0
    await wait(2800)
    if (!running) return

    // Transition to step 2 — sequenced:
    //   0–500ms:    step 1 fades out
    //   500–1100ms: panel grows
    //   1100–1600ms: step 2 fades in
    step = 1
    await wait(1700)
    if (!running) return

    // Step 2: demo — loops indefinitely
    let firstRun = true
    while (running) {
      await playDemo(firstRun)
      firstRun = false
      if (!running) return
    }
  }

  async function playDemo(firstRun = false) {
    cursorPressed = false
    if (firstRun) {
      copied = false
      cursorCopyHover = false
    }
    activeClassFrame = 'none'
    mobileDragging = false
    desktopDragging = false

    if (firstRun) {
      cursorOpacity.set(0, { duration: 0 })
      cursorMoveToken += 1
      cursorPosX = 40
      cursorPosY = 280
      cursorAngle = -14
      await Promise.all([
        mobileImageX.set(MOBILE_REST_X, { duration: 0 }),
        desktopImageY.set(DESKTOP_REST_Y, { duration: 0 }),
        desktopImageScale.set(1, { duration: 0 }),
      ])
      await wait(450)
      if (!running) return

      await cursorOpacity.set(1)
      if (!running) return
      await wait(120)

      await moveCursor(MOBILE_CURSOR_START_X, MOBILE_CURSOR_START_Y, {
        duration: 1040,
        curve: 0.14,
        jitter: 0.55,
      })
      if (!running) return
      await wait(110)
    } else {
      const leaveCopy = moveCursor(MOBILE_CURSOR_START_X, MOBILE_CURSOR_START_Y, {
        duration: 1180,
        curve: 0.12,
        jitter: 0.32,
      })
      const clearCopyState = (async () => {
        await waitForCursorToLeaveCopyButton()
        if (!running) return
        cursorCopyHover = false
        copied = false
      })()

      await Promise.all([
        leaveCopy,
        clearCopyState,
        mobileImageX.set(MOBILE_REST_X, { duration: 760, easing: cubicInOut }),
        desktopImageY.set(DESKTOP_REST_Y, { duration: 760, easing: cubicInOut }),
        desktopImageScale.set(1, { duration: 760, easing: cubicInOut }),
      ])
      if (!running) return
      await wait(100)
    }

    // Mobile drag: start with a tighter cover crop, then drag left to center the subject.
    activeClassFrame = 'mobile'
    cursorPressed = true
    mobileDragging = true
    mobileDragBaseX = mobileImageX.current
    mobileDragAnchorX = cursorPosX
    await wait(110)
    await moveCursor(MOBILE_CURSOR_END_X, MOBILE_CURSOR_END_Y, {
      duration: 880,
      curve: 0.02,
      jitter: 0.04,
    })
    const frozenMobileX = mobileVisualX
    mobileDragging = false
    await mobileImageX.set(frozenMobileX, { duration: 0 })
    cursorPressed = false
    if (!running) return
    await wait(220)
    activeClassFrame = 'none'
    await wait(220)
    if (!running) return

    // Cursor travels across to desktop frame.
    await moveCursor(DESKTOP_CURSOR_START_X, DESKTOP_CURSOR_START_Y, {
      duration: 1100,
      curve: 0.12,
      jitter: 0.42,
    })
    if (!running) return
    await wait(120)

    // Desktop drag: drag the image down so more sky is revealed inside the crop.
    activeClassFrame = 'desktop'
    cursorPressed = true
    desktopDragging = true
    desktopDragBaseY = desktopImageY.current
    desktopDragAnchorY = cursorPosY
    desktopDragBaseScale = desktopImageScale.current
    await wait(110)
    await moveCursor(DESKTOP_CURSOR_END_X, DESKTOP_CURSOR_END_Y, {
      duration: 840,
      curve: 0.026,
      jitter: 0.05,
    })
    const frozenDesktopY = desktopVisualY
    const frozenDesktopScale = desktopVisualScale
    desktopDragging = false
    await Promise.all([
      desktopImageY.set(frozenDesktopY, { duration: 0 }),
      desktopImageScale.set(frozenDesktopScale, { duration: 0 }),
    ])
    cursorPressed = false
    if (!running) return
    await wait(220)
    activeClassFrame = 'none'
    await wait(180)
    if (!running) return

    // Cursor travels to copy button
    await moveCursor(COPY_BTN_X, COPY_BTN_Y, { duration: 980, curve: 0.1, jitter: 0.42 })
    if (!running) return
    await wait(120)
    cursorCopyHover = true
    await wait(60)

    // Click feedback
    cursorPressed = true
    await wait(150)
    copied = true
    await wait(120)
    cursorPressed = false
    await wait(1250)
    if (!running) return
  }

  // ─── Dismiss handlers ──────────────────────────────────────────────────────
  function dismiss(method: 'cta' | 'backdrop' | 'escape') {
    running = false
    activeClassFrame = 'none'
    mobileDragging = false
    desktopDragging = false
    cursorCopyHover = false
    cursorMoveToken += 1
    show = false
    dismissedThisSession = true
    hasSeenBefore = true
    if (!testMode) {
      store.setWelcomeSeen(true)
      // Welcome flag is "immediate" — flush past the 500ms prefs debounce so
      // a tab close right after dismissal still persists.
      persistPreferencesNow().catch(err => console.warn('[welcome] persist failed:', err))
      window.posthog?.capture('welcome_modal_dismissed', {
        step_reached: step,
        method,
      })
    }
  }

  function reopen() {
    step = 0
    copied = false
    activeClassFrame = 'none'
    show = true
    window.posthog?.capture('welcome_modal_shown', { trigger: 'reopen' })
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialog) dismiss('backdrop')
  }

  function handleClose() {
    // fired by the native dialog when Escape is pressed
    if (show) dismiss('escape')
  }
</script>

{#if show}
  <dialog
    bind:this={dialog}
    onclose={handleClose}
    onclick={handleBackdropClick}
    class="welcome-dialog"
  >
    <div class="modal-panel" class:is-step1={step === 0} class:is-step2={step === 1}>
      <!-- Step 1: title card -->
      <div class="step step-1" class:visible={step === 0}>
        <div class="step-1-content">
          <h1 class="step-1-title font-display italic text-5xl md:text-6xl text-ink leading-none">
            Art Direct
          </h1>
          <p class="step-1-body mt-5 text-base md:text-lg text-ink-secondary">
            Visual art direction for responsive images.
          </p>
        </div>
      </div>

      <!-- Step 2: demo -->
      <div class="step step-2" class:visible={step === 1}>
        <div class="step-2-layout">
          <div class="step-2-header">
            <div class="step-2-logo font-display italic">Art Direct</div>
            <p class="step-2-caption">Move the crop. Copy the classes.</p>
          </div>

          <!-- Demo canvas: fixed coordinate system for everything below -->
          <div
            class="demo-shell"
            style:width={`${demoShellWidth}px`}
            style:height={`${demoShellHeight}px`}
          >
            <div
              class="demo-canvas"
              style:width="{DEMO_W}px"
              style:height="{DEMO_H}px"
              style:transform={`scale(${demoScale})`}
            >
            <!-- Mobile frame -->
            <div
              class="frame"
              style:left="{MOBILE_X}px"
              style:top="{MOBILE_Y}px"
              style:width="{MOBILE_W}px"
              style:height="{MOBILE_H}px"
            >
              <span class="frame-label">Mobile</span>
              <div class="frame-inner">
                <div
                  class="mobile-image-stack"
                  class:dragging={mobileDragging}
                  style:width={`${MOBILE_IMAGE_W}px`}
                  style:height={`${MOBILE_IMAGE_H}px`}
                  style:transform={`translate3d(${mobileVisualX}px, 0, 0)`}
                >
                  <img
                    class="frame-image mobile-image"
                    src="/gallery/napoleon.webp"
                    alt=""
                    draggable="false"
                  />
                </div>
              </div>
            </div>

            <!-- Desktop frame -->
            <div
              class="frame"
              style:left="{DESKTOP_X}px"
              style:top="{DESKTOP_Y}px"
              style:width="{DESKTOP_W}px"
              style:height="{DESKTOP_H}px"
            >
              <span class="frame-label">Desktop</span>
              <div class="frame-inner">
                <div
                  class="desktop-image-stack"
                  class:dragging={desktopDragging}
                  style:width={`${DESKTOP_IMAGE_W}px`}
                  style:height={`${DESKTOP_IMAGE_H}px`}
                  style:transform={`translate3d(0, ${desktopVisualY}px, 0) scale(${desktopVisualScale})`}
                >
                  <img
                    class="frame-image desktop-image"
                    src="/gallery/napoleon.webp"
                    alt=""
                    draggable="false"
                  />
                </div>
              </div>
            </div>

            <!-- Class output: stable rows with live values matching the active drag -->
            <div
              class="class-output"
              style:left="{CLASS_X}px"
              style:top="{CLASS_Y}px"
              style:width="{CLASS_W}px"
              style:height="{CLASS_H}px"
            >
              <div class="class-flow">
                {#each classTokens as token}
                  <span
                    class="cls"
                    class:value={token.value}
                    class:active={activeClassFrame === token.frame}
                    class:inactive={activeClassFrame !== 'none' && activeClassFrame !== token.frame}
                  >
                    {token.text}
                  </span>
                {/each}
              </div>
              <div class="copy-btn" class:copied aria-hidden="true">
                {#if copied}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Copied
                {:else}
                  Copy
                {/if}
              </div>
            </div>

            <!-- Cursor — sibling of frames and class output, can travel anywhere in canvas -->
          <div
            class="cursor"
            style:transform={`translate3d(${cursorPosX}px, ${cursorPosY}px, 0) rotate(${cursorAngle}deg)`}
            style:opacity={cursorOpacity.current}
          >
            <div
              class="cursor-glyph"
              class:pressed={cursorPressed && !cursorCopyHover}
              class:copy-hover={cursorCopyHover}
              class:copy-pressed={cursorCopyHover && cursorPressed}
            >
              {#if cursorCopyHover}
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M6.99667 16.6967C6.66321 16.3018 6.25814 15.494 5.53722 14.5136C5.12861 13.9591 4.11533 12.9149 3.81357 12.3845C3.55173 11.9158 3.57992 11.7056 3.64214 11.3172C3.75252 10.6262 4.50866 10.0881 5.3153 10.1608C5.92469 10.2147 6.44131 10.5921 6.90626 10.9486C7.18688 11.1632 7.53209 11.5802 7.7399 11.8157C7.93129 12.0313 7.97826 12.1205 8.18256 12.3757C8.45261 12.7135 8.53715 12.8808 8.43383 12.5089C8.35046 11.9631 8.21426 11.0311 8.01701 10.207C7.86672 9.58199 7.83031 9.48406 7.68707 9.00431C7.5356 8.49376 7.45812 8.13615 7.31604 7.59479C7.21741 7.21187 7.04012 6.42955 6.99198 5.98941C6.92505 5.38753 6.88982 4.40603 7.30195 3.95489C7.62485 3.60169 8.36573 3.49496 8.82481 3.71283C9.42597 3.99781 9.76765 4.81646 9.92382 5.14325C10.2044 5.73083 10.3782 6.40973 10.5297 7.30101C10.7222 8.43544 11.0768 10.01 11.0886 10.3412C11.16 10.824 11.0087 9.08024 11.0839 8.69072C11.152 8.33751 11.469 7.92709 11.8658 7.81595C12.2016 7.72243 12.595 7.68832 12.9414 7.75544C13.3088 7.82587 13.6963 8.07233 13.8408 8.30451C14.2658 8.99112 14.274 10.394 14.2916 10.3192C14.3926 9.90549 14.375 8.96691 14.6251 8.57629C14.7895 8.31881 15.2087 8.08664 15.4318 8.04923C15.7769 7.99201 16.2008 7.9744 16.5636 8.04043C16.8559 8.09434 17.2517 8.42003 17.3585 8.57629C17.6144 8.9548 17.76 10.0254 17.8034 10.4006C17.8211 10.5558 17.8903 9.96931 18.1475 9.59079C18.6242 8.88769 20.3114 8.75124 20.376 10.2939C20.4054 11.0135 20.3995 10.9805 20.3995 11.4647C20.3995 12.0335 20.3855 12.3757 20.3526 12.7872C20.3161 13.2274 20.2152 14.222 20.0684 14.7041C20.0023 14.9208 19.8362 15.3146 19.6368 15.6862C19.4365 16.0595 19.1574 16.3814 18.8863 16.7071C18.5057 17.1643 17.9896 17.8381 17.9045 18.2218C17.7659 18.8401 17.8117 18.8446 17.7847 19.2836C17.7658 19.59 17.8429 19.9643 17.8909 20.1614C17.9084 20.2334 17.8602 20.3059 17.7865 20.3134C17.505 20.3417 16.8649 20.3946 16.4779 20.3366C16.0188 20.2673 15.4505 19.4112 15.3037 19.1494C15.1018 18.7884 14.6708 18.8578 14.503 19.124C14.2388 19.5455 13.6705 20.3014 13.269 20.3488C12.514 20.4377 10.9776 20.3869 9.72746 20.3723C9.65243 20.3714 9.59565 20.3027 9.60515 20.2283C9.64502 19.9157 9.69386 19.1741 9.31679 18.8765C8.95867 18.5915 8.34224 18.0138 7.97357 17.7101L6.99667 16.6967Z"
                    fill="#ffffff"
                    stroke="#111111"
                    stroke-width="0.96"
                  />
                  <path d="M16.68 17.04V13.32" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                  <path d="M14.52 17.04V13.32" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                  <path d="M11.88 13.32V17.04" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                </svg>
              {:else if cursorPressed}
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M7.68 6.33655C8.24671 6.11869 9.36478 6.25209 9.65994 6.9155C9.91142 7.48097 10.8361 9.39161 10.8479 9.18843C10.8762 8.73679 10.8195 7.76005 11.0096 7.24964C11.1478 6.87755 11.4193 6.52749 11.8195 6.40388C12.156 6.29861 12.5515 6.26189 12.901 6.33656C13.2706 6.41488 13.659 6.68783 13.8042 6.94732C14.2316 7.70986 14.2387 9.27166 14.2588 9.18843C14.3344 8.8555 14.3414 7.68416 14.5928 7.24964C14.7594 6.96201 15.1796 6.70497 15.404 6.66335C15.7511 6.59971 16.1785 6.58012 16.5421 6.65356C16.8361 6.71354 17.234 7.07462 17.3414 7.24964C17.6 7.67069 17.7452 8.8604 17.7889 9.27901C17.8078 9.45159 17.8763 8.79797 18.1348 8.37815C18.6142 7.59603 20.3119 7.44425 20.3756 9.16028C20.4064 9.96076 20.3993 9.92404 20.3993 10.4626C20.3993 11.0942 20.3851 11.4761 20.3521 11.9338C20.3166 12.4222 20.2151 13.5299 20.0675 14.066C19.966 14.4344 19.6295 15.263 19.2966 15.76C19.2966 15.76 18.0286 17.29 17.8904 17.9778C17.7523 18.667 17.7983 18.6719 17.77 19.159C17.7504 19.5113 17.8334 19.9432 17.8812 20.1565C17.8969 20.227 17.85 20.2969 17.7782 20.305C17.4988 20.3362 16.849 20.3962 16.456 20.3303C15.9943 20.2544 15.4229 19.3022 15.2753 19.0109C15.0722 18.6095 14.6389 18.6865 14.4701 18.9827C14.2056 19.4515 13.633 20.2924 13.2304 20.345C12.4693 20.444 10.9224 20.3863 9.66472 20.3711C9.59057 20.3701 9.5341 20.3034 9.54294 20.2298C9.58328 19.8941 9.64139 19.0446 9.25519 18.7073C8.8951 18.3892 8.27525 17.7478 7.90453 17.41L6.92224 16.2827C6.58811 15.842 5.73923 15.1456 5.4547 13.853C5.20321 12.7074 5.228 12.1456 5.49838 11.6866C5.77229 11.2202 6.2894 10.9657 6.50665 10.9216C6.75222 10.8702 7.32365 10.8739 7.53971 10.9975C7.803 11.148 7.90925 11.1921 8.11586 11.4761C8.38741 11.8518 8.48423 12.0342 8.36734 11.6242C8.27761 11.3035 7.98718 10.8959 7.85494 10.4369C7.72625 9.99503 6.67291 8.32552 6.6977 7.61194C6.70715 7.34144 6.81931 6.66825 7.68 6.33655Z"
                    fill="#ffffff"
                    stroke="#111111"
                    stroke-width="0.96"
                  />
                  <path d="M16.7797 16.5684V12.6287" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                  <path d="M14.3306 16.5684V12.6287" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                  <path d="M11.9882 12.6287V16.5684" stroke="#111111" stroke-width="0.84" stroke-linecap="round"/>
                </svg>
              {:else}
                <svg viewBox="0 0 396 433" width="27" height="30" aria-hidden="true">
                  <path
                    d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z"
                    fill="#333333"
                  />
                  <path
                    d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z"
                    stroke="#ffffff"
                    stroke-width="19.8759"
                  />
                </svg>
              {/if}
            </div>
          </div>
          </div>
        </div>

          <div class="step-2-actions">
            <button class="cta" onclick={() => dismiss('cta')}>
              Try it out
            </button>
          </div>
        </div>
      </div>
    </div>
  </dialog>
{/if}

<!-- "?" reopen button — appears once the modal has been dismissed (this session or prior) -->
{#if !show && (dismissedThisSession || hasSeenBefore)}
  <button
    class="reopen-btn"
    onclick={reopen}
    aria-label="Show welcome"
    title="What is this?"
  >
    ?
  </button>
{/if}

<style>
  .welcome-dialog {
    border: none;
    padding: 0;
    background: transparent;
    max-width: none;
    max-height: none;
    margin: auto;
    color: inherit;
    overflow: visible;
    outline: none;
  }
  .welcome-dialog:focus,
  .welcome-dialog:focus-visible {
    outline: none;
  }

  .welcome-dialog::backdrop {
    background: rgba(17, 24, 39, 0.16);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  /* Subtle entry animation for the dialog itself */
  .welcome-dialog[open] {
    animation: dialog-in 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .welcome-dialog[open]::backdrop {
    animation: backdrop-in 280ms ease-out;
  }

  @keyframes dialog-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .modal-panel {
    position: relative;
    background: var(--color-surface, #fafbfe);
    border-radius: 20px;
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.5);
    color: #111827;
    font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    overflow: hidden;
    /* Sequenced grow: starts AFTER step 1 finishes fading out (500ms) */
    transition:
      width 600ms cubic-bezier(0.16, 1, 0.3, 1) 500ms,
      height 600ms cubic-bezier(0.16, 1, 0.3, 1) 500ms;
  }
  .modal-panel:focus,
  .modal-panel:focus-visible {
    outline: none;
  }

  /* Panel sizes per step */
  .modal-panel.is-step1 {
    width: min(480px, calc(100vw - 24px));
    height: min(250px, calc(100dvh - 24px));
  }
  .modal-panel.is-step2 {
    width: min(556px, calc(100vw - 24px));
    height: min(524px, calc(100dvh - 24px));
  }

  /* Both steps absolutely positioned. Sequenced opacity crossfade:
     - step 1 fades out:    0–500ms     (no delay)
     - panel grows:         500–1100ms  (CSS rule above)
     - step 2 fades in:     1100–1600ms (delayed) */
  .step {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 500ms ease;
  }
  .step.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .step.step-2.visible {
    transition: opacity 500ms ease 1100ms;
  }

  /* ─── Step 1: title card ─────────────────────────────────────────── */
  .step.step-1 {
    padding: 34px 34px 30px;
  }

  .step-1-content {
    width: min(100%, 26rem);
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    text-align: center;
  }

  .step-1-title {
    text-wrap: balance;
    letter-spacing: -0.04em;
  }

  .step-1-body {
    max-width: 24ch;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.45;
    text-wrap: balance;
  }

  /* ─── Step 2: demo ───────────────────────────────────────────────── */
  .step.step-2 {
    padding: 24px 18px 22px;
  }

  .step-2-layout {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    justify-items: center;
    align-items: start;
    gap: 14px;
  }

  .step-2-header {
    width: min(100%, 492px);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .step-2-logo {
    font-size: 22px;
    line-height: 1;
    color: #111827;
    letter-spacing: -0.01em;
    flex-shrink: 0;
  }

  .step-2-caption {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-ink-secondary, #6b7280);
    text-align: right;
    text-wrap: balance;
  }

  /* Demo canvas — fixed coordinate system; cursor + frames + class output all inside */
  .demo-shell {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
    align-self: center;
  }

  .step-2-actions {
    width: min(100%, 492px);
    display: flex;
    justify-content: center;
  }

  .demo-canvas {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
  }

  .frame {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: stretch;
  }

  .frame-label {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(17, 24, 39, 0.4);
    text-align: center;
  }

  .frame-inner {
    position: relative;
    width: 100%;
    flex: 1;
    border: 1.5px dashed rgba(17, 24, 39, 0.18);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(17, 24, 39, 0.04);
  }

  .frame-image {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    max-height: none;
    will-change: transform;
    backface-visibility: hidden;
    user-select: none;
    -webkit-user-drag: none;
  }

  .mobile-image-stack {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
    backface-visibility: hidden;
  }

  .mobile-image {
    width: 100%;
    height: 100%;
  }

  .mobile-image-stack.dragging {
    transition: none;
  }

  .desktop-image-stack {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top center;
    will-change: transform;
    backface-visibility: hidden;
  }

  .desktop-image {
    width: 100%;
    height: 100%;
  }

  .desktop-image-stack.dragging {
    transition: none;
  }

  .cursor {
    position: absolute;
    pointer-events: none;
    top: 0;
    left: 0;
    z-index: 20;
    will-change: transform, opacity;
  }

  .cursor-glyph {
    transform: translate(-2px, -1px);
    transition: transform 120ms ease, filter 120ms ease;
    filter: drop-shadow(0 3px 8px rgba(17, 24, 39, 0.24));
  }

  .cursor-glyph svg {
    display: block;
  }

  .cursor-glyph.pressed {
    transform: translate(-11px, -7px) scale(0.985);
    filter: drop-shadow(0 3px 8px rgba(17, 24, 39, 0.2));
  }

  .cursor-glyph.copy-hover {
    transform: translate(-10px, -7px);
    filter: drop-shadow(0 3px 8px rgba(17, 24, 39, 0.22));
  }

  .cursor-glyph.copy-pressed {
    transform: translate(-10px, -7px) scale(0.97);
    filter: drop-shadow(0 3px 8px rgba(17, 24, 39, 0.18));
  }

  /* ─── Class output ───────────────────────────────────────────────── */
  .class-output {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(17, 24, 39, 0.05);
    border-radius: 10px;
    padding: 7px 10px 7px 12px;
    border: 1px solid rgba(17, 24, 39, 0.07);
  }

  .class-flow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    gap: 4px 8px;
    overflow: hidden;
    max-height: 30px;
  }

  .cls {
    display: inline-block;
    padding: 0 3px;
    border-radius: 7px;
    color: rgba(17, 24, 39, 0.62);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9.8px;
    line-height: 1.22;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    white-space: nowrap;
    transition:
      background-color 220ms ease,
      color 220ms ease,
      transform 220ms ease,
      opacity 220ms ease;
  }

  .cls.value {
    color: rgba(17, 24, 39, 0.78);
  }

  .cls.inactive {
    opacity: 0.45;
  }

  .cls.active {
    background: rgba(37, 99, 235, 0.12);
    color: rgba(29, 78, 216, 0.96);
    transform: translateY(-1px);
  }

  .copy-btn {
    flex-shrink: 0;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    min-width: 68px;
    height: 30px;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9.5px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(17, 24, 39, 0.55);
    background: white;
    border: 1px solid rgba(17, 24, 39, 0.12);
    border-radius: 6px;
    padding: 0 12px;
    transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
  }
  .copy-btn.copied {
    background: #f0fdf4;
    color: #15803d;
    border-color: rgba(21, 128, 61, 0.25);
  }

  /* ─── CTA ────────────────────────────────────────────────────────── */
  .cta {
    margin-top: 6px;
    background: var(--color-art-500, #2563eb);
    color: white;
    font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    font-size: 14px;
    font-weight: 500;
    padding: 12px 28px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: background-color 200ms ease, transform 200ms ease;
  }
  .cta:hover {
    background: var(--color-art-600, #1d4ed8);
  }
  .cta:active {
    transform: scale(0.98);
  }

  /* ─── Reopen "?" button ──────────────────────────────────────────── */
  .reopen-btn {
    position: fixed;
    bottom: 18px;
    right: 18px;
    z-index: 60;
    background: transparent;
    border: none;
    padding: 4px 8px;
    color: rgba(228, 228, 231, 0.6);
    font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: color 200ms ease;
  }
  .reopen-btn:hover {
    color: rgba(228, 228, 231, 1);
  }

  /* ─── Mobile adaptations ─────────────────────────────────────────── */
  @media (max-width: 560px) {
    .step.step-1 {
      padding: 30px 22px 26px;
    }

    .step.step-2 {
      padding: 20px 10px 18px;
      gap: 12px;
    }

    .step-2-header {
      width: 100%;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .step-2-logo {
      font-size: 20px;
    }

    .step-2-caption {
      text-align: center;
      font-size: 11px;
    }

    .step-2-actions {
      width: 100%;
    }
  }
</style>
