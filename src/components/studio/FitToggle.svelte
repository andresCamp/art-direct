<script lang="ts">
  import type { ObjectFit } from '../../lib/types'

  interface Props {
    value: ObjectFit
    onChange: (fit: ObjectFit) => void
    isActive?: boolean
  }

  let { value, onChange, isActive = false }: Props = $props()

  const fits: ObjectFit[] = ['cover', 'contain', 'fill']

  function cycle(e: MouseEvent) {
    e.stopPropagation()
    const idx = fits.indexOf(value)
    const next = fits[(idx + 1) % fits.length]
    onChange(next)
  }
</script>

<button
  type="button"
  class="text-[10px] font-mono tracking-wide {isActive ? 'text-art-300/70' : 'text-studio-muted/50'} hover:text-studio-text/70 bg-studio-bg/60 backdrop-blur-sm px-2.5 py-1.5 sm:px-1.5 sm:py-0.5 rounded transition-colors duration-200"
  onclick={cycle}
  onpointerdown={(e) => e.stopPropagation()}
>
  {value}
</button>
