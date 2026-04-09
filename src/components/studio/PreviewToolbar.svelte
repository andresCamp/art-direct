<script lang="ts">
  import { previewState, PREVIEW_PRESETS } from '../../lib/preview-state.svelte'
</script>

<div class="flex flex-col items-center gap-2.5">
  <div class="w-full overflow-x-auto px-4">
    <div class="mx-auto flex w-max items-center gap-3">
      {#each PREVIEW_PRESETS as preset}
        <button
          type="button"
          class="cursor-pointer whitespace-nowrap py-2 font-mono text-[11px] transition-colors duration-200 sm:py-0
            {previewState.activePreset === preset.id
              ? 'text-studio-text'
              : 'text-studio-muted/50 hover:text-studio-muted'}"
          onclick={() => previewState.selectPreset(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="flex items-center gap-3">
    <button
      type="button"
      class="cursor-pointer p-2 text-studio-muted/40 transition-colors duration-200 hover:text-studio-muted sm:p-0"
      onclick={() => previewState.toggleOrientation()}
      aria-label="Toggle orientation"
      title={previewState.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
    >
      <svg
        class="h-3.5 w-3.5 transition-transform duration-200 {previewState.orientation === 'landscape' ? 'rotate-90' : ''}"
        fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
      </svg>
    </button>
    <span class="font-mono text-[10px] text-studio-muted/40">{previewState.width} &times; {previewState.height}</span>
  </div>
</div>
