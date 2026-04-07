import { store } from './store.svelte'
import { extractDominantColor } from './color-extractor'

export function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  const file = files[0]
  if (!file.type.startsWith('image/')) return

  const blobUrl = URL.createObjectURL(file)
  const img = new Image()
  img.onload = async () => {
    store.setImage({
      blobUrl,
      filename: file.name,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    })
    const color = await extractDominantColor(blobUrl)
    store.setDominantColor(color)
    window.posthog?.capture('image_uploaded', {
      file_type: file.type,
      file_size_kb: Math.round(file.size / 1024),
      natural_width: img.naturalWidth,
      natural_height: img.naturalHeight,
    })
  }
  img.src = blobUrl
}
