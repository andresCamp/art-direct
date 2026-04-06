<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { lightenColor } from '../../lib/color-extractor'
  import { cubicOut } from 'svelte/easing'
  import EditView from './EditView.svelte'
  import OutputPanel from './OutputPanel.svelte'
  import Preview from './Preview.svelte'
  import Toggle from './Toggle.svelte'

  const accent = $derived(store.dominantColor ?? '#2563eb')

  type Tab = 'compose' | 'preview'
  let activeTab = $state<Tab>('compose')

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
</script>

<div class="min-h-[100dvh] flex flex-col bg-studio-bg text-studio-text">
  <!-- Subtle gradient accent at top -->
  <div
    class="absolute inset-x-0 top-0 h-64 opacity-15 pointer-events-none"
    style:background="radial-gradient(ellipse at 50% 0%, {accent}, transparent 70%)"
  ></div>

  <!-- Grain -->
  <div class="grain-overlay fixed inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none z-50"></div>

  <!-- Floating top bar -->
  <div class="fixed top-0 inset-x-0 z-20 flex items-center px-5 py-4">
    <button
      type="button"
      class="cursor-pointer relative flex items-center gap-2 text-studio-muted/50 hover:text-studio-text transition-colors duration-200 before:absolute before:-inset-4 before:content-['']"
      onclick={() => store.reset()}
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span class="font-display italic text-base">Art Direct</span>
    </button>

    <div class="absolute left-1/2 -translate-x-1/2">
      <Toggle
        options={['Compose', 'Preview']}
        active={activeTab === 'compose' ? 0 : 1}
        onToggle={() => { activeTab = activeTab === 'compose' ? 'preview' : 'compose' }}
        size="md"
      />
    </div>

    <div class="ml-auto flex items-center">
      {#if store.image}
        <input
          type="text"
          value={store.image.filename}
          size={Math.max(store.image.filename.length, 8)}
          class="relative text-xs font-mono bg-transparent outline-none cursor-pointer transition-colors duration-200 text-studio-muted/40 hover:text-studio-muted focus:text-white underline decoration-studio-border/50 underline-offset-4 before:absolute before:-inset-4 before:content-['']"
          onclick={(e) => {
            const val = e.currentTarget.value
            const dot = val.lastIndexOf('.')
            e.currentTarget.setSelectionRange(0, dot > 0 ? dot : val.length)
          }}
          oninput={(e) => store.setFilename(e.currentTarget.value)}
        />
      {/if}
    </div>
  </div>

  <!-- View mode toggle — below top bar, centered -->
  <div class="fixed top-14 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ease-out {activeTab !== 'compose' ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}">
    <Toggle
      options={['Devices', 'Tailwind']}
      active={store.viewMode === 'device' ? 0 : 1}
      onToggle={() => store.setViewMode(store.viewMode === 'device' ? 'tailwind' : 'device')}
      showUnderline={false}
    />
  </div>

  <!-- Content -->
  <div class="relative z-10 flex-1 flex items-center px-5 pt-14 pb-6 overflow-hidden">
    {#key activeTab}
      <div
        class={['absolute inset-0 flex items-center px-5 pt-14 pb-6 will-change-[opacity]', activeTab === 'compose' ? 'overflow-x-clip overflow-y-visible' : 'overflow-hidden']}
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

  <!-- Output -->
  <OutputPanel />
</div>
