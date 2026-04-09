import { store } from './store.svelte'
import { extractDominantColor } from './color-extractor'
import { persistDirectionNow } from './persistence.svelte'
import type { ImageState } from './types'

interface ProcessedImage {
  image: ImageState
  blob: Blob
}

function processImageFile(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    const blobUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({
        image: {
          blobUrl,
          filename: file.name,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        },
        // File extends Blob — pass it through as-is for IndexedDB storage.
        blob: file,
      })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = blobUrl
  })
}

async function applyDominantColor(blobUrl: string) {
  const color = await extractDominantColor(blobUrl)
  store.setDominantColor(color)
}

/** Create a new direction from dropped/browsed files */
export async function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  const file = files[0]
  if (!file.type.startsWith('image/')) return

  const { image, blob } = await processImageFile(file)
  const id = store.addDirection(image)
  persistDirectionNow(id, blob).catch(err => console.warn('[upload] persist failed:', err))
  applyDominantColor(image.blobUrl)

  window.posthog?.capture('image_uploaded', {
    file_type: file.type,
    file_size_kb: Math.round(file.size / 1024),
    natural_width: image.naturalWidth,
    natural_height: image.naturalHeight,
  })
}

/** Load an image into the current active direction (for empty-frame browse/drop) */
export async function handleFilesForActiveDirection(files: FileList | null) {
  if (!files || files.length === 0) return
  const file = files[0]
  if (!file.type.startsWith('image/')) return

  const { image, blob } = await processImageFile(file)
  store.loadImageIntoActiveDirection(image)
  const activeId = store.activeDirectionId
  if (activeId) {
    persistDirectionNow(activeId, blob).catch(err => console.warn('[upload] persist failed:', err))
  }
  applyDominantColor(image.blobUrl)

  window.posthog?.capture('image_uploaded', {
    file_type: file.type,
    file_size_kb: Math.round(file.size / 1024),
    natural_width: image.naturalWidth,
    natural_height: image.naturalHeight,
    target: 'active_direction',
  })
}

/** Create a new direction from clipboard image via paste event */
export async function handlePasteEvent(e: ClipboardEvent): Promise<boolean> {
  const files = e.clipboardData?.files
  if (!files?.length || !files[0].type.startsWith('image/')) return false

  const { image, blob } = await processImageFile(files[0])
  const id = store.addDirection(image)
  persistDirectionNow(id, blob).catch(err => console.warn('[upload] persist failed:', err))
  applyDominantColor(image.blobUrl)

  window.posthog?.capture('image_pasted', {
    file_type: files[0].type,
    natural_width: image.naturalWidth,
    natural_height: image.naturalHeight,
  })
  return true
}

/** Load clipboard image into active direction (for empty-frame paste button) */
export async function handleClipboardPasteForActiveDirection(): Promise<boolean> {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'))
      if (imageType) {
        const blobFromClipboard = await item.getType(imageType)
        const file = new File([blobFromClipboard], 'pasted-image.png', { type: imageType })
        const { image, blob } = await processImageFile(file)
        store.loadImageIntoActiveDirection(image)
        const activeId = store.activeDirectionId
        if (activeId) {
          persistDirectionNow(activeId, blob).catch(err => console.warn('[upload] persist failed:', err))
        }
        applyDominantColor(image.blobUrl)
        return true
      }
    }
  } catch {
    // Clipboard API not available or permission denied — silent fail
  }
  return false
}
