import type { OutputFormat } from './types'

export function renderOutput(classString: string, format: OutputFormat, filename: string): string {
  switch (format) {
    case 'img':
      return `<!-- art-direction: ${filename} -->\n<img src="${filename}" alt="" class="${classString}" />`

    case 'nextjs-image':
      return `<!-- art-direction: ${filename} -->\n<Image src={${toCamelCase(filename)}} alt="" fill className="${classString}" />`

    case 'bg-div':
      return `<!-- art-direction: ${filename} -->\n<div class="bg-[url('/${filename}')] bg-no-repeat ${classString}" />`

    case 'agent-instruction': {
      return `Apply the following responsive art direction to the image ${filename}:\n\nTailwind classes: ${classString}\n\nPaste these classes onto the image element's class attribute. The classes handle responsive behavior across all breakpoints using Tailwind's mobile-first approach.`
    }
  }
}

function toCamelCase(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '')
  return name.replace(/[-_.](\w)/g, (_, c) => c.toUpperCase())
}
