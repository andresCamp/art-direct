<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { getDevicesByCategory, type DeviceCategory } from '../../lib/devices'

  interface Props {
    category: DeviceCategory
    deviceId: string
  }

  let { category, deviceId }: Props = $props()
  let open = $state(false)

  const devices = $derived(getDevicesByCategory(category))
  const current = $derived(devices.find(d => d.id === deviceId) ?? devices[0])
  const orientation = $derived(store.orientations[category])

  function select(id: string) {
    store.setDevice(category, id)
    open = false
  }
</script>

<div data-studio-control class="flex items-center gap-2">
  <!-- Device name dropdown -->
  <div class="relative">
    <button
      type="button"
      class="text-[11px] font-medium text-studio-muted hover:text-studio-text transition-colors duration-200 flex items-center gap-1"
      onclick={() => { open = !open }}
      onpointerdown={(e) => e.stopPropagation()}
    >
      {current.name}
      <svg class="w-3 h-3 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if open}
      <button
        type="button"
        class="fixed inset-0 z-40"
        onclick={(e: MouseEvent) => { e.stopPropagation(); open = false }}
        aria-label="Close device picker"
      ></button>

      <div class="absolute top-full left-0 mt-1 z-50 bg-studio-surface border border-studio-border rounded-lg shadow-xl py-1 min-w-[160px]">
        {#each devices as device}
          <button
            type="button"
            class="w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors duration-150
              {device.id === deviceId
                ? 'text-art-300 bg-art-500/10'
                : 'text-studio-muted hover:text-studio-text hover:bg-studio-bg/50'}"
            onclick={() => select(device.id)}
            onpointerdown={(e) => e.stopPropagation()}
          >
            <span>{device.name}</span>
            <span class="text-studio-muted/40 ml-2">{device.width}x{device.height}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Orientation toggle -->
  <button
    type="button"
    class="text-studio-muted/40 hover:text-studio-muted transition-colors duration-200"
    onclick={() => store.toggleOrientation(category)}
    onpointerdown={(e) => e.stopPropagation()}
    aria-label="Toggle orientation"
    title="{orientation === 'portrait' ? 'Portrait' : 'Landscape'}"
  >
    <svg
      class="w-3.5 h-3.5 transition-transform duration-200 {orientation === 'landscape' ? 'rotate-90' : ''}"
      fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  </button>
</div>
