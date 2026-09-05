// Web Audio API notification sound generator (zero external assets needed)

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('ryzendesk_sound_enabled') !== 'false'
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ryzendesk_sound_enabled', enabled ? 'true' : 'false')
}

/**
 * Play a pleasant upward chime for incoming messages or updates
 */
export function playChimeSound(type: 'message' | 'ticket' | 'success' | 'alert' = 'message'): void {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime

    if (type === 'message') {
      // 2-tone pleasant soft ping
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now) // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
      gain1.gain.setValueAtTime(0.08, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.3)
    } else if (type === 'ticket') {
      // 3-note ascending fanfare chime
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + i * 0.09)
        gain.gain.setValueAtTime(0.07, now + i * 0.09)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.09)
        osc.stop(now + i * 0.09 + 0.25)
      })
    } else if (type === 'success') {
      // Soft high confirmation tone
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, now)
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (type === 'alert') {
      // Urgent double pip
      ;[0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(440, now + offset)
        gain.gain.setValueAtTime(0.05, now + offset)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 0.08)
      })
    }
  } catch (err) {
    console.debug('Audio play failed:', err)
  }
}
