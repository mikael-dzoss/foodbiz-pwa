import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { playOrderChime } from "../alerts/sound-chime";

describe("sound-chime Web Audio Synthesizer", () => {
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalAudioContext = window.AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.AudioContext = originalAudioContext as typeof window.AudioContext;
    vi.restoreAllMocks();
  });

  it("creates AudioContext, oscillator, gain node and schedules chime tones", () => {
    const mockSetValueAtTime = vi.fn();
    const mockExponentialRamp = vi.fn();
    const mockConnect = vi.fn();
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    const mockClose = vi.fn();

    const mockOscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: mockSetValueAtTime,
      },
      connect: mockConnect,
      start: mockStart,
      stop: mockStop,
    };

    const mockGain = {
      gain: {
        setValueAtTime: mockSetValueAtTime,
        exponentialRampToValueAtTime: mockExponentialRamp,
      },
      connect: mockConnect,
    };

    const mockCreateOscillator = vi.fn(() => mockOscillator);
    const mockCreateGain = vi.fn(() => mockGain);
    const mockDestination = {};

    class MockAudioContext {
      currentTime = 10;
      state = "running";
      createOscillator = mockCreateOscillator;
      createGain = mockCreateGain;
      destination = mockDestination;
      close = mockClose;
    }

    window.AudioContext = MockAudioContext as unknown as typeof window.AudioContext;

    playOrderChime();
    expect(mockCreateOscillator).toHaveBeenCalledTimes(1);
    expect(mockCreateGain).toHaveBeenCalledTimes(1);

    // Tone frequency scheduled
    expect(mockSetValueAtTime).toHaveBeenCalledWith(587.33, 10);
    expect(mockSetValueAtTime).toHaveBeenCalledWith(880, 10 + 0.12);

    // Envelope scheduled
    expect(mockExponentialRamp).toHaveBeenCalledWith(0.25, 10 + 0.04);
    expect(mockExponentialRamp).toHaveBeenCalledWith(0.001, 10 + 0.5);

    // Connects
    expect(mockConnect).toHaveBeenCalledWith(mockGain);
    expect(mockConnect).toHaveBeenCalledWith(mockDestination);

    // Playback scheduled
    expect(mockStart).toHaveBeenCalledWith(10);
    expect(mockStop).toHaveBeenCalledWith(10.5);

    // Fast forward timer to verify auto-close
    vi.advanceTimersByTime(650);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("gracefully exits if AudioContext is not supported by environment", () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;

    expect(() => playOrderChime()).not.toThrow();
  });

  it("catches and ignores autoplay or security policy errors", () => {
    window.AudioContext = vi.fn().mockImplementation(function () {
      throw new Error("Autoplay is not allowed");
    }) as unknown as typeof window.AudioContext;

    expect(() => playOrderChime()).not.toThrow();
  });
});
