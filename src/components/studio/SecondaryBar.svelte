<script lang="ts">
  interface Props {
    active: boolean
  }

  let { active }: Props = $props()
</script>

<div
  class={`absolute inset-x-0 top-[3.25rem] z-20 flex justify-center transition-all duration-300 ease-out md:top-[3.75rem] ${
    active
      ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
      : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
  }`}
>
  <div>
    <slot />
  </div>
</div>
