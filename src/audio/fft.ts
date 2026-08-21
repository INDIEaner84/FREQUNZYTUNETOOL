/** In-place radix-2 Cooley–Tukey FFT. Length must be a power of two. */
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  let j = 0
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
    let m = n >> 1
    while (m >= 1 && j >= m) {
      j -= m
      m >>= 1
    }
    j += m
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = (Math.PI * 2) / size
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = step * k
        const wr = Math.cos(angle)
        const wi = -Math.sin(angle)
        const ir = re[i + k + half]
        const ii = im[i + k + half]
        const tr = wr * ir - wi * ii
        const ti = wr * ii + wi * ir
        re[i + k + half] = re[i + k] - tr
        im[i + k + half] = im[i + k] - ti
        re[i + k] += tr
        im[i + k] += ti
      }
    }
  }
}

export function hann(n: number): Float32Array {
  const w = new Float32Array(n)
  if (n <= 1) {
    w[0] = 1
    return w
  }
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  }
  return w
}
