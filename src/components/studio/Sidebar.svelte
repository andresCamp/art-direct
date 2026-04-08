<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import type { Direction } from '../../lib/types'

  interface Props {
    onBlankThreadOpen?: () => void
  }

  let { onBlankThreadOpen = () => {} }: Props = $props()

  const userDirections = $derived(store.directions.filter(direction => direction.kind !== 'example'))

  function handleNewDirection() {
    store.addDirection(null)
    store.setSidebar(false)
    onBlankThreadOpen()
    window.posthog?.capture('new_direction_created', { source: 'sidebar' })
  }

  function handleExample(id: string) {
    store.loadExampleDirection(id)
    closeSidebarOnMobile()
    window.posthog?.capture('direction_switched', { source: 'examples', direction_id: `example:${id}` })
  }

  function handleSelect(direction: Direction) {
    store.setActiveDirection(direction.id)
    if (direction.kind === 'blank') {
      store.setSidebar(false)
      onBlankThreadOpen()
    } else {
      closeSidebarOnMobile()
    }
    window.posthog?.capture('direction_switched', { source: 'sidebar', direction_id: direction.id })
  }

  function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation()
    store.removeDirection(id)
    window.posthog?.capture('direction_deleted', { direction_id: id })
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      store.setSidebar(false)
    }
  }

  function getDirectionMeta(direction: Direction) {
    if (direction.kind === 'blank') return 'Empty frames ready for upload'
    if (!direction.image) return 'Waiting for image'
    return `${direction.image.naturalWidth}×${direction.image.naturalHeight}`
  }

  function canDelete(direction: Direction) {
    return direction.kind !== 'example' && store.directions.length > 1
  }

  function getImageFilename(path: string) {
    return path.split('/').pop() ?? path
  }
</script>

<aside class="relative h-full pl-5 pr-5 pb-4 pt-4 text-studio-text md:pr-[3.25rem]">
  <div class="relative flex h-full flex-col">
    <div>
      <button
        type="button"
        class="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.05]"
        onclick={handleNewDirection}
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-studio-muted/78 transition-colors duration-150 group-hover:text-studio-text">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <p class="text-[12px] font-mono text-studio-text">New direction</p>
          <p class="mt-0.5 text-[11px] text-studio-muted/58">Blank studio thread</p>
        </div>
      </button>
    </div>

    <div class="mt-5">
      <p class="px-3 text-[10px] font-mono uppercase tracking-[0.22em] text-studio-muted/42">Examples</p>
      <div class="mt-2 flex flex-col gap-0.5">
        {#each store.curatedExamples as example}
          {@const isActiveExample = store.activeDirection?.kind === 'example' && store.activeDirection.exampleId === example.id}
          <button
            type="button"
            class="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150
              {isActiveExample
                ? 'bg-white/[0.085] text-studio-text'
                : 'text-studio-muted/80 hover:bg-white/[0.045] hover:text-studio-text'}"
            onclick={() => handleExample(example.id)}
          >
            <div class="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <img
                src={example.image}
                alt={example.label}
                class="h-full w-full object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[12px] font-mono leading-none">{getImageFilename(example.image)}</p>
              <p class="mt-1 truncate text-[11px] text-studio-muted/56">{example.label}</p>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <div class="mt-6 min-h-0 flex-1">
      <div class="flex items-center justify-between px-3">
        <p class="text-[10px] font-mono uppercase tracking-[0.22em] text-studio-muted/42">Threads</p>
        <p class="text-[10px] font-mono text-studio-muted/36">{userDirections.length}</p>
      </div>

      <nav class="studio-scroll mt-2 flex h-full flex-col gap-0.5 overflow-y-auto">
        {#if userDirections.length === 0}
          <div class="rounded-2xl px-3 py-3 text-[11px] leading-relaxed text-studio-muted/52">
            Your uploaded and blank threads will appear here.
          </div>
        {/if}

        {#each userDirections as direction (direction.id)}
          {@const isActive = direction.id === store.activeDirectionId}
          <div
            class="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150
              {isActive
                ? 'bg-white/[0.085] text-studio-text'
                : 'text-studio-muted/80 hover:bg-white/[0.045] hover:text-studio-text'}"
            role="button"
            tabindex="0"
            onclick={() => handleSelect(direction)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') handleSelect(direction)
            }}
          >
            <div
              class="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
              style:background={direction.image ? undefined : 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'}
            >
              {#if direction.image}
                <img
                  src={direction.image.blobUrl}
                  alt=""
                  class="h-full w-full object-cover"
                />
              {:else}
                <svg class="h-4 w-4 text-studio-muted/48" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              {/if}
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-[12px] font-mono leading-none">{direction.name}</p>
              <p class="mt-1 truncate text-[11px] text-studio-muted/56">{getDirectionMeta(direction)}</p>
            </div>

            {#if canDelete(direction)}
              <button
                type="button"
                class="cursor-pointer rounded-full p-1.5 text-studio-muted/34 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-red-300"
                onclick={(e) => handleDelete(e, direction.id)}
                aria-label="Delete direction"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </nav>
    </div>
  </div>
</aside>
