export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 64
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)

      const data = ctx.getImageData(0, 0, size, size).data
      const buckets = new Map<string, number>()

      for (let i = 0; i < data.length; i += 4) {
        // Quantize to reduce color space (group into 32-unit buckets)
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i + 1] / 32) * 32
        const b = Math.round(data[i + 2] / 32) * 32
        const key = `${r},${g},${b}`
        buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }

      let maxCount = 0
      let dominant = '128,128,128'
      for (const [key, count] of buckets) {
        if (count > maxCount) {
          maxCount = count
          dominant = key
        }
      }

      const [r, g, b] = dominant.split(',').map(Number)
      resolve(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`)
    }
    img.onerror = () => resolve('#b8dbff')
    img.src = imageUrl
  })
}

export function lightenColor(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.min(255, Math.round(r + (255 - r) * amount))
  const lg = Math.min(255, Math.round(g + (255 - g) * amount))
  const lb = Math.min(255, Math.round(b + (255 - b) * amount))
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}
