<script lang="ts">
  import { handleFiles } from '../../lib/upload'

  interface Props {
    pageDragging?: boolean
  }

  let { pageDragging = false }: Props = $props()

  let fileInput: HTMLInputElement

  function onClick() {
    fileInput.click()
  }

  function onFileChange(e: Event) {
    const target = e.target as HTMLInputElement
    handleFiles(target.files)
  }
</script>

<div class="flex-1 anim-rise" style="animation-delay: 120ms">
  <button
    class="group w-full border-2 border-dashed rounded-2xl p-20 lg:p-24 text-center cursor-pointer transition-all duration-300
      {pageDragging
        ? 'border-art-500 bg-art-100/60 scale-[1.02]'
        : 'border-art-300/60 bg-white/40 hover:border-art-400 hover:bg-white/60 hover:scale-[1.01]'}"
    onclick={onClick}
    type="button"
  >
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={onFileChange}
    />

    <div class="text-art-400 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
      <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13" />
      </svg>
    </div>

    <p class="text-sm font-medium text-ink-secondary mb-1">
      {#if pageDragging}
        Drop to start
      {:else}
        Drop an image here
      {/if}
    </p>
    <p class="text-xs text-ink-muted">
      or click to browse
    </p>
  </button>
</div>
