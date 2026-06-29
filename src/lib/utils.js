export function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v-20)%10] || s[v] || s[0])
}

export function resizeImage(file, maxPx = 80) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const c = document.createElement('canvas')
      c.width  = Math.round(img.width  * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/webp', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export function defaultPosPoints(pos) {
  const ff = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1]
  return ff[pos - 1] ?? 1
}

// Glass-style CSS variables for the leaderboard (opacity / blur / darkness)
export function lbVars(style = {}) {
  const d = style.darkness ?? 1
  const lo = [44, 52, 88], hi = [8, 11, 28] // light → dark navy
  const ch = i => Math.round(lo[i] + (hi[i] - lo[i]) * d)
  const blur = style.blur ?? 0
  // "Blur" can't blur OBS video below a browser source, so it instead adds a
  // dark frost behind the glass — keeps text readable over busy gameplay.
  const frost = Math.min(0.6, (blur / 20) * 0.6)
  return {
    '--lb-rgb': `${ch(0)}, ${ch(1)}, ${ch(2)}`,
    '--lb-alpha': String(style.opacity ?? 1),
    '--lb-blur': `${blur}px`,
    '--lb-frost': frost.toFixed(3),
  }
}
