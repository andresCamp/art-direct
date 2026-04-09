<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { handlePasteEvent } from '../../lib/upload'
  import { hydrateStore, startPersistence } from '../../lib/persistence.svelte'
  import { cubicOut } from 'svelte/easing'
  import EditView from './EditView.svelte'
  import OutputPanel from './OutputPanel.svelte'
  import Preview from './Preview.svelte'
  import PreviewToolbar from './PreviewToolbar.svelte'
  import SecondaryBar from './SecondaryBar.svelte'
  import Toggle from './Toggle.svelte'
  import Sidebar from './Sidebar.svelte'

  const accent = $derived(store.dominantColor ?? '#2563eb')
  const DESKTOP_SIDEBAR_WIDTH = 296
  const DESKTOP_SURFACE_RADIUS = 32
  const desktopSidebarWidth = $derived(store.sidebarOpen ? `${DESKTOP_SIDEBAR_WIDTH}px` : '0px')
  const desktopStudioOffset = $derived(
    store.sidebarOpen ? `${DESKTOP_SIDEBAR_WIDTH - DESKTOP_SURFACE_RADIUS}px` : '0px'
  )
  const desktopStudioWidth = $derived(
    store.sidebarOpen ? `calc(100% - ${DESKTOP_SIDEBAR_WIDTH - DESKTOP_SURFACE_RADIUS}px)` : '100%'
  )
  const sidebarBackdrop = $derived(
    `linear-gradient(180deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.024) 42%, rgba(255,255,255,0.042) 76%, rgba(255,255,255,0.058) 100%),
     radial-gradient(circle at 0% 0%, ${accent}20 0%, transparent 46%),
     radial-gradient(circle at 12% 108%, ${accent}34 0%, transparent 46%),
     radial-gradient(ellipse at 18% 100%, rgba(255,255,255,0.045) 0%, transparent 56%)`
  )
  const studioContentInsetClass = $derived(
    store.classString
      ? 'px-5 pb-24 pt-20 md:px-6 md:pb-28 md:pt-[5.5rem]'
      : 'px-5 pb-6 pt-20 md:px-6 md:pt-[5.5rem]'
  )

  // Compose / Preview tab is now persisted via store.studioTab so it
  // survives a refresh. Read through the store; write via setStudioTab.
  const activeTab = $derived(store.studioTab)

  // Hidden until persistence hydration completes (or fails). Avoids the
  // "Napoleon flashes then swaps to your last-active direction" effect on
  // return visits — we render a skeleton during the brief Dexie open + read
  // window instead.
  let hydrated = $state(false)

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)
  const sidebarShortcutLabel = isMac ? '⌘B' : 'Ctrl B'

  function recede(_node: Element, { duration = 200, easing = cubicOut }: { duration?: number, easing?: (t: number) => number } = {}) {
    return {
      duration, easing,
      css: (t: number) => `opacity: ${t}; transform: scale(${0.97 + 0.03 * t}); filter: blur(${(1 - t) * 2}px)`,
    }
  }

  function emerge(_node: Element, { duration = 250, delay = 150, easing = cubicOut }: { duration?: number, delay?: number, easing?: (t: number) => number } = {}) {
    return {
      duration, delay, easing,
      css: (t: number) => `opacity: ${t}; transform: scale(${0.97 + 0.03 * t})`,
    }
  }

  // Persistence: open Dexie, hydrate the store from IndexedDB, then wire up
  // reactive write subscriptions. Failures degrade silently to ephemeral mode.
  // Either path flips `hydrated` so the skeleton clears.
  $effect(() => {
    let cleanup: (() => void) | undefined
    hydrateStore()
      .then(() => {
        cleanup = startPersistence()
        hydrated = true
      })
      .catch(err => {
        console.warn('[persistence] disabled:', err)
        hydrated = true
      })
    return () => cleanup?.()
  })

  // Global clipboard paste handler
  $effect(() => {
    function onPaste(e: ClipboardEvent) {
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
      const files = e.clipboardData?.files
      if (files?.length && files[0].type.startsWith('image/')) {
        e.preventDefault()
        handlePasteEvent(e)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  })

  $effect(() => {
    if (!store.sidebarOpen) return

    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') store.setSidebar(false)
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

  // Cmd/Ctrl+B toggles the sidebar from anywhere in the studio.
  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key !== 'b' && event.key !== 'B') return
      const mod = isMac ? event.metaKey : event.ctrlKey
      if (!mod || event.altKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      event.preventDefault()
      store.toggleSidebar()
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

  function focusBlankDirection() {
    store.setStudioTab('compose')
    store.setViewMode('device')
  }

  function handleNewDirection() {
    const directionId = store.addDirection(null)
    store.setSidebar(false)
    focusBlankDirection()
    window.posthog?.capture('new_direction_created', {
      source: 'topbar_new_direction',
      direction_id: directionId,
    })
  }
</script>

<div
  class="relative min-h-[100dvh] overflow-hidden bg-[#09090c] text-studio-text"
  style:--desktop-sidebar-width={desktopSidebarWidth}
  style:--desktop-studio-offset={desktopStudioOffset}
  style:--desktop-studio-width={desktopStudioWidth}
>
  <div class="grain-overlay fixed inset-0 z-50 pointer-events-none opacity-[0.045] mix-blend-overlay"></div>
  <div
    class="pointer-events-none fixed inset-0 opacity-[0.14]"
    style:background="radial-gradient(ellipse at top left, {accent}, transparent 42%), radial-gradient(circle at 100% 0%, rgba(255,255,255,0.06), transparent 28%)"
  ></div>

  {#if hydrated}
  <div class="hidden md:block">
    <div
      class="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style:width={desktopSidebarWidth}
    >
      <div class="absolute inset-0" style:background={sidebarBackdrop}></div>
      <div class="grain-overlay absolute inset-0 opacity-[0.06] mix-blend-overlay"></div>
      <div
        class="h-full w-[296px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        class:translate-x-0={store.sidebarOpen}
        class:opacity-100={store.sidebarOpen}
        class:pointer-events-none={!store.sidebarOpen}
        class:-translate-x-6={!store.sidebarOpen}
        class:opacity-0={!store.sidebarOpen}
      >
        <Sidebar onBlankThreadOpen={focusBlankDirection} />
      </div>
    </div>
  </div>

  <div
    class="relative z-10 min-h-[100dvh] min-w-0 transition-[margin-left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:ml-[var(--desktop-studio-offset)] md:w-[var(--desktop-studio-width)]"
  >
    <div
      class={`relative flex min-h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-bg transition-[border-radius,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${store.sidebarOpen ? 'md:rounded-l-[2rem] md:shadow-[-24px_0_80px_rgba(0,0,0,0.28)]' : ''}`}
    >
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-[0.17]"
          style:background="radial-gradient(ellipse at 24% 0%, {accent}, transparent 62%)"
        ></div>
        <div
          class="pointer-events-none absolute inset-y-0 right-0 w-[26rem] opacity-[0.07]"
          style:background="radial-gradient(circle at 100% 50%, {accent}, transparent 65%)"
        ></div>

        <div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center px-5 py-3 md:px-6 md:py-4">
          <div class="pointer-events-auto flex items-center gap-5">
            <button
              type="button"
              class="group cursor-pointer relative flex items-center gap-2.5 px-0 py-0 text-sm text-studio-muted/72 transition-colors duration-200 before:absolute before:-inset-3 before:content-[''] hover:text-studio-text"
              onclick={() => store.toggleSidebar()}
              aria-label="{store.sidebarOpen ? 'Close sidebar' : 'Open sidebar'} ({sidebarShortcutLabel})"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                {#if store.sidebarOpen}
                  <path d="M14 2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/>
                  <path d="M3 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
                {:else}
                  <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm5-1v12h9a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM4 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2z"/>
                {/if}
              </svg>
              <span class="font-display text-base italic leading-none">Art Direct</span>
              <span
                class="pointer-events-none absolute left-0 top-full mt-2 hidden whitespace-nowrap rounded-md border border-white/[0.08] bg-[#0a0a0d]/92 px-2 py-1 font-mono text-[10px] text-studio-muted/80 shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-md group-hover:block"
                aria-hidden="true"
              >
                {store.sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                <span class="ml-1.5 text-studio-muted/50">{sidebarShortcutLabel}</span>
              </span>
            </button>

            <button
              type="button"
              class="group relative hidden cursor-pointer items-center gap-1.5 px-0 py-0 font-mono text-[11px] uppercase tracking-[0.14em] text-studio-muted/66 transition-colors duration-200 before:absolute before:-inset-3 before:content-[''] hover:text-studio-text md:inline-flex"
              onclick={handleNewDirection}
              aria-label="Create new direction"
            >
              <span class="transition-colors duration-200">+</span>
              <span>New direction</span>
            </button>
          </div>

          <div class="pointer-events-auto absolute left-1/2 -translate-x-1/2">
            <Toggle
              options={['Compose', 'Preview']}
              active={activeTab === 'compose' ? 0 : 1}
              onToggle={() => {
                const next = activeTab === 'compose' ? 'preview' : 'compose'
                store.setStudioTab(next)
                window.posthog?.capture('studio_tab_switched', { tab: next })
              }}
              size="md"
            />
          </div>

          <div class="pointer-events-auto ml-auto hidden items-center md:flex">
            {#if store.image}
              <input
                type="text"
                value={store.image.filename}
                size={Math.max(store.image.filename.length, 8)}
                class="relative rounded-full border border-transparent bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-studio-muted/50 outline-none transition-all duration-200 hover:border-white/[0.06] hover:text-studio-muted focus:border-white/[0.14] focus:bg-white/[0.06] focus:text-white"
                onclick={(e) => {
                  const val = e.currentTarget.value
                  const dot = val.lastIndexOf('.')
                  e.currentTarget.setSelectionRange(0, dot > 0 ? dot : val.length)
                }}
                oninput={(e) => store.setFilename(e.currentTarget.value)}
                onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
            {/if}
          </div>
        </div>

        <SecondaryBar active={activeTab === 'compose'}>
          <Toggle
            options={['Devices', 'Tailwind']}
            active={store.viewMode === 'device' ? 0 : 1}
            onToggle={() => {
              const next = store.viewMode === 'device' ? 'tailwind' : 'device'
              store.setViewMode(next)
              window.posthog?.capture('view_mode_changed', { view_mode: next })
            }}
            showUnderline={false}
          />
        </SecondaryBar>

        <SecondaryBar active={activeTab === 'preview'}>
          <PreviewToolbar />
        </SecondaryBar>

        <div class={`relative z-10 flex flex-1 items-center overflow-hidden ${studioContentInsetClass}`}>
          {#key activeTab}
            <div
              class={[`absolute inset-0 flex items-center will-change-[opacity] ${studioContentInsetClass}`, activeTab === 'compose' ? 'overflow-x-clip overflow-y-visible' : 'overflow-hidden']}
              in:emerge
              out:recede
            >
              {#if activeTab === 'compose'}
                <EditView />
              {:else}
                <Preview />
              {/if}
            </div>
          {/key}
        </div>

        <OutputPanel />
    </div>
  </div>
  {:else}
  <!-- Skeleton during Dexie hydration. Replaces the studio chrome to avoid the
       "Napoleon flashes then swaps to your last-active direction" effect on
       return visits. The outer container's bg + grain + gradient stay visible
       underneath so the transition into the real chrome is seamless. -->
  <div class="relative z-10 min-h-[100dvh] min-w-0">
    <div class="relative flex min-h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-bg">
      <div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center px-5 py-3 md:px-6 md:py-4">
        <div class="flex items-center gap-2.5">
          <div class="h-4 w-4 rounded-sm bg-white/[0.05] animate-pulse"></div>
          <div class="h-3 w-20 rounded-sm bg-white/[0.05] animate-pulse"></div>
        </div>
        <div class="absolute left-1/2 -translate-x-1/2">
          <div class="h-7 w-36 rounded-full bg-white/[0.05] animate-pulse"></div>
        </div>
      </div>

      <div class="relative z-10 flex flex-1 items-center justify-center px-5 pb-24 pt-20 md:px-6 md:pb-28 md:pt-[5.5rem]">
        <div class="flex items-end gap-4 md:gap-6">
          <div class="h-40 w-24 rounded-2xl bg-white/[0.04] animate-pulse md:h-48 md:w-28"></div>
          <div class="h-44 w-36 rounded-2xl bg-white/[0.05] animate-pulse md:h-52 md:w-44"></div>
          <div class="h-40 w-48 rounded-2xl bg-white/[0.04] animate-pulse md:h-48 md:w-56"></div>
        </div>
      </div>

      <div class="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center md:bottom-8">
        <div class="h-10 w-72 rounded-full bg-white/[0.04] animate-pulse md:w-96"></div>
      </div>
    </div>
  </div>
  {/if}

  {#if store.sidebarOpen}
    <div
      class="fixed inset-0 z-40 overflow-hidden bg-[#09090c] md:hidden"
    >
      <div class="absolute inset-0 bg-[#09090c]/92 backdrop-blur-2xl"></div>
      <div class="absolute inset-0 opacity-[0.96]" style:background={sidebarBackdrop}></div>
      <div class="grain-overlay absolute inset-0 opacity-[0.06] mix-blend-overlay"></div>

      <div class="relative flex h-full flex-col overflow-hidden">
        <div class="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 pb-3 pt-5">
          <div class="pt-1">
            <p class="font-display text-[1.05rem] italic leading-none text-studio-text">Art Direct</p>
            <p class="mt-2 text-[10px] font-mono uppercase tracking-[0.24em] text-studio-muted/44">Image Threads</p>
          </div>

          <button
            type="button"
            class="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-studio-muted/72 transition-colors duration-200 hover:text-studio-text"
            onclick={() => store.setSidebar(false)}
            aria-label="Close thread picker"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden pb-4 pt-2">
          <Sidebar onBlankThreadOpen={focusBlankDirection} />
        </div>
      </div>
    </div>
  {/if}
</div>
