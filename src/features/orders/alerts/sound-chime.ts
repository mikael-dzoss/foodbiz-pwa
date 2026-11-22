/**
 * Synthesizes a melodic 2-tone chime using the Web Audio API.
 * Operates entirely client-side with zero network/file dependencies.
 */
export function playOrderChime(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Tone 1: 587.33 Hz (D5), Tone 2: 880 Hz (A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    // Smooth envelope: quick attack, pleasant gentle decay
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);

    // Auto-close context after chime ends to free audio resources
    setTimeout(() => {
      try {
        if (ctx.state !== "closed") {
          void ctx.close();
        }
      } catch {
        // Ignore close errors
      }
    }, 600);
  } catch {
    // Gracefully ignore audio policies or browser security blocks
  }
}
