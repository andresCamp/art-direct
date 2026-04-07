<script lang="ts">
  interface Props {
    options: [string, string]
    active: number
    onToggle: () => void
    size?: 'sm' | 'md'
    showUnderline?: boolean
  }

  let { options, active, onToggle, size = 'sm', showUnderline = true }: Props = $props()

  let leftEl: HTMLSpanElement | undefined = $state()
  let rightEl: HTMLSpanElement | undefined = $state()

  const activeEl = $derived(active === 0 ? leftEl : rightEl)

  let indicatorX = $state(0)
  let indicatorW = $state(0)

  $effect(() => {
    if (activeEl) {
      indicatorX = activeEl.offsetLeft
      indicatorW = activeEl.offsetWidth
    }
  })
</script>

<button
  type="button"
  class="cursor-pointer relative flex items-center gap-1.5 {size === 'md' ? 'text-sm' : 'text-[11px]'} font-mono before:absolute before:-inset-6 before:content-['']"
  onclick={onToggle}
>
  <!-- Sliding indicator -->
  {#if showUnderline}
    <span
      class="absolute -bottom-1 h-px bg-studio-text rounded-full transition-all duration-300 ease-out"
      style:left="{indicatorX}px"
      style:width="{indicatorW}px"
    ></span>
  {/if}

  <span
    bind:this={leftEl}
    class="transition-colors duration-200 {active === 0 ? 'text-studio-text' : 'text-studio-muted/40'}"
  >{options[0]}</span>
  <span
    bind:this={rightEl}
    class="transition-colors duration-200 {active === 1 ? 'text-studio-text' : 'text-studio-muted/40'}"
  >{options[1]}</span>
</button>
