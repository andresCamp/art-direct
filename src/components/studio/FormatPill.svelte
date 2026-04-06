<script lang="ts">
  interface Props {
    label: string
    isActive: boolean
    onClick: () => void
  }

  let { label, isActive, onClick }: Props = $props()
</script>

<button
  type="button"
  class="cursor-pointer text-[11px] font-mono px-2.5 py-1 rounded-md transition-all duration-200 border
    {isActive
      ? 'bg-art-500/15 text-art-300 border-art-500/30'
      : 'bg-transparent text-studio-muted/60 border-transparent hover:text-studio-muted hover:border-studio-border/50'}"
  onclick={onClick}
>
  {label}
</button>
