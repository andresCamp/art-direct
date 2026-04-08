<script lang="ts">
  import { handleFiles } from '../lib/upload'

  let dragCounter = $state(0)
  const isDragging = $derived(dragCounter > 0)

  $effect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragCounter++
    }

    function onDragLeave() {
      dragCounter--
      if (dragCounter < 0) dragCounter = 0
    }

    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
    }

    function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounter = 0
      handleFiles(e.dataTransfer?.files ?? null)
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)

    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  })
</script>

{#if isDragging}
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(77,142,255,0.1),transparent_55%)] backdrop-blur-[2px]"
  >
    <div class="pointer-events-none relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.055] px-10 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div class="grain-overlay absolute inset-0 opacity-[0.08] mix-blend-overlay"></div>
      <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]"></div>

      <div class="relative flex flex-col items-center gap-4">
        <div class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.4rem] border border-art-300/30 bg-art-400/10">
          <svg class="h-8 w-8 text-art-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
        <div>
          <p class="font-display text-[1.65rem] italic leading-none text-studio-text">Create a new art direction thread</p>
          <p class="mt-2 text-sm text-studio-muted">Drop your image anywhere in the studio.</p>
        </div>
      </div>
    </div>
  </div>
{/if}
