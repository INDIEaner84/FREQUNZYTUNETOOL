/**
 * In-place radix-2 Cooley–Tukey FFT.
 * `re` and `im` must have equal power-of-two length > 0.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  if (n !== im.length) {
    throw new RangeError(`fft: real (${n}) and imag (${im.length}) lengths must match`)
  }
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new RangeError(`fft: length (${n}) must be a positive power of two`)
  }

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
    const step = (-2 * Math.PI) / size
    const wStepRe = Math.cos(step)
    const wStepIm = Math.sin(step)

    for (let i = 0; i < n; i += size) {
      let wr = 1
      let wi = 0
      for (let k = 0; k < half; k++) {
        const evenIdx = i + k
        const oddIdx = evenIdx + half
        const ir = re[oddIdx]
        const ii = im[oddIdx]
        const tr = wr * ir - wi * ii
        const ti = wr * ii + wi * ir
        re[oddIdx] = re[evenIdx] - tr
        im[oddIdx] = im[evenIdx] - ti
        re[evenIdx] += tr
        im[evenIdx] += ti

        const nextWr = wr * wStepRe - wi * wStepIm
        wi = wr * wStepIm + wi * wStepRe
        wr = nextWr
      }
    }
  }
}

/** Symmetric Hann window for spectral analysis. */
export function hann(n: number): Float32Array {
  if (n <= 0) return new Float32Array(0)
  const w = new Float32Array(n)
  if (n === 1) {
    w[0] = 1
    return w
  }
  const factor = (2 * Math.PI) / (n - 1)
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos(factor * i))
  }
  return w
}

/** Periodic Hann window (exact COLA at 50 % hop overlap). */
export function hannPeriodic(n: number): Float32Array {
  if (n <= 0) return new Float32Array(0)
  const w = new Float32Array(n)
  if (n === 1) {
    w[0] = 1
    return w
  }
  const factor = (2 * Math.PI) / n
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos(factor * i))
  }
  return w
}
