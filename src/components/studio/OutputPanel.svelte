<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { renderOutput } from '../../lib/format-renderer'
  import { BREAKPOINTS } from '../../lib/breakpoints'
  import type { OutputFormat } from '../../lib/types'

  const formats: { value: OutputFormat; label: string }[] = [
    { value: 'img', label: '<img>' },
    { value: 'nextjs-image', label: 'Next.js' },
    { value: 'bg-div', label: 'bg-div' },
    { value: 'css', label: 'CSS' },
    { value: 'agent-instruction', label: 'Agent' },
  ]

  let expanded = $state(false)
  let copied = $state(false)
  let panelEl: HTMLDivElement | undefined = $state()

  const modifiedFrames = $derived(
    store.frames.filter(f => store.modifiedBreakpoints.has(f.breakpoint))
  )

  const output = $derived(
    store.image
      ? renderOutput(store.classString, store.outputFormat, store.image.filename, modifiedFrames)
      : ''
  )

  const outputParts = $derived.by(() => {
    const cls = store.classString
    if (!cls || !output) return null
    const idx = output.indexOf(cls)
    if (idx === -1) return null
    return {
      before: output.slice(0, idx),
      classes: cls,
      after: output.slice(idx + cls.length),
    }
  })

  const MUTED = 'rgba(113,113,122,0.5)'
  const BRIGHT = '#e4e4e7'

  const classHtml = $derived.by(() => {
    const cls = store.classString
    if (!cls) return ''

    const bp = store.lastModifiedBreakpoint
    const tokens = cls.split(' ')

    if (!bp) {
      return tokens.map(t => `<span style="color:${MUTED};transition:color .3s ease">${t}</span>`).join(' ')
    }

    const modifiedNames = BREAKPOINTS
      .filter(b => store.modifiedBreakpoints.has(b.name))
      .map(b => b.name)
    const isFirstModified = modifiedNames[0] === bp

    const bpDef = BREAKPOINTS.find(b => b.name === bp)
    const nominalPrefix = bpDef?.prefix ?? ''
    const effectivePrefix = isFirstModified ? '' : nominalPrefix
    const otherPrefixes = BREAKPOINTS.filter(b => b.prefix).map(b => b.prefix)

    function isBright(token: string): boolean {
      if (effectivePrefix === '') {
        return !otherPrefixes.some(p => token.startsWith(p))
      }
      return token.startsWith(effectivePrefix)
    }

    return tokens.map(t =>
      `<span style="color:${isBright(t) ? BRIGHT : MUTED};transition:color .3s ease">${t}</span>`
    ).join(' ')
  })

  async function copyToClipboard(e: MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(output)
    copied = true
    setTimeout(() => { copied = false }, 1500)
    window.posthog?.capture('output_copied', {
      output_format: store.outputFormat,
      class_string_length: store.classString.length,
      modified_breakpoints_count: store.modifiedBreakpoints.size,
    })
  }

  function handleClickOutside(e: MouseEvent) {
    if (!expanded) return
    if (panelEl && !panelEl.contains(e.target as Node)) {
      expanded = false
    }
  }

  $effect(() => {
    if (expanded) {
      const timer = setTimeout(() => {
        window.addEventListener('click', handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('click', handleClickOutside)
      }
    }
  })

  $effect(() => {
    const ts = store.lastModifiedAt
    if (!ts) return
    const breakpoint = store.lastModifiedBreakpoint
    const timer = setTimeout(() => {
      window.posthog?.capture('frame_adjusted', {
        breakpoint,
        output_format: store.outputFormat,
        modified_breakpoints_count: store.modifiedBreakpoints.size,
      })
      store.clearLastModified()
    }, 2000)
    return () => clearTimeout(timer)
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if store.classString}
<div
  bind:this={panelEl}
  class="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 rounded-sm border border-studio-border/30 bg-studio-bg transition-[width] duration-300 ease-out"
  class:cursor-pointer={!expanded}
  class:w-3xl={expanded}
  class:max-w-[calc(100%-2.5rem)]={expanded}
  onclick={() => {
    const next = !expanded
    expanded = next
    if (next) window.posthog?.capture('output_panel_expanded', { output_format: store.outputFormat })
  }}
>
  {#if !expanded}
    <div class="flex items-center gap-4 px-4 py-2.5">
      <pre class="text-[12px] font-mono whitespace-pre-wrap break-words leading-relaxed line-clamp-2">{@html classHtml}</pre>

      <button
        type="button"
        class="cursor-pointer flex-shrink-0 text-[11px] font-mono transition-colors duration-200 relative before:absolute before:-inset-4 before:content-['']
          {copied
            ? 'text-emerald-400'
            : 'text-studio-muted/40 hover:text-studio-text'}"
        onclick={copyToClipboard}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  {:else}
    <div class="px-4 py-3 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        {#each formats as fmt}
          <button
            type="button"
            class="cursor-pointer text-[11px] font-mono transition-colors duration-200
              {store.outputFormat === fmt.value
                ? 'text-studio-text'
                : 'text-studio-muted/40 hover:text-studio-muted'}"
            onclick={(e) => { e.stopPropagation(); store.setOutputFormat(fmt.value); window.posthog?.capture('output_format_changed', { output_format: fmt.value }) }}
          >
            {fmt.label}
          </button>
        {/each}
        <button
          type="button"
          class="cursor-pointer ml-auto text-[11px] font-mono transition-colors duration-200 relative before:absolute before:-inset-4 before:content-['']
            {copied
              ? 'text-emerald-400'
              : 'text-studio-muted/40 hover:text-studio-text'}"
          onclick={copyToClipboard}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div class="max-h-48 overflow-y-auto studio-scroll border-t border-studio-border/20 pt-3">
        <pre class="text-[12px] font-mono text-studio-muted/50 whitespace-pre-wrap break-all leading-relaxed">{#if outputParts}{outputParts.before}<span class="text-studio-text">{outputParts.classes}</span>{outputParts.after}{:else}{output}{/if}</pre>
      </div>
    </div>
  {/if}
</div>
{/if}
