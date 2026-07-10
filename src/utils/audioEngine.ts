export type Category = 'Polskie' | 'Zagraniczne' | 'Bajki' | 'Gry';
export type GameMode = 'klasyczny' | 'piano' | 'beat' | 'reverse';

export interface Song {
  id: string;
  title: string;
  artist: string;
  category: Category;
  mode: GameMode;
  audioUrl: string;
  previewStart: number;
  date?: string;
  gatunek?: string;
  youtubeUrl?: string;
}

class AudioEngine {
  public context: AudioContext | null = null;
  private currentSources: AudioBufferSourceNode[] = [];
  public gainNode: GainNode | null = null;
  private volume: number = 0.5;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
        this.gainNode.gain.value = this.volume;
      } catch {}
    }
  }

  private initContext() {
    if (!this.context && typeof window !== 'undefined') {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
      this.gainNode.gain.value = this.volume;
    }
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  }

  async loadFromUrl(url: string): Promise<AudioBuffer> {
    const safeUrl = url.trim();
    if (this.bufferCache.has(safeUrl)) return this.bufferCache.get(safeUrl)!;
    try {
      const response = await fetch(safeUrl);
      if (!response.ok) {
        if (response.status === 400) throw new Error("Błąd 400 (Bad Request).");
        if (response.status === 404) throw new Error("Nie znaleziono pliku (404).");
        if (response.status === 403) throw new Error("Błąd uprawnień (403).");
        throw new Error(`Błąd serwera: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      this.bufferCache.set(safeUrl, audioBuffer);
      return audioBuffer;
    } catch (error: any) {
      console.error('Audio Engine Load Error:', error);
      throw error;
    }
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.gainNode) this.gainNode.gain.value = value;
  }

  getVolume(): number { return this.volume; }

  stopAll() {
    this.currentSources.forEach(source => { try { source.stop(); } catch {} });
    this.currentSources = [];
  }

  async playSimple(url: string, duration: number, startTime: number = 0) {
    this.initContext();
    this.stopAll();
    try {
      const buffer = await this.loadFromUrl(url);
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode!);
      source.start(0, startTime, duration);
      this.currentSources.push(source);
    } catch (error) { throw error; }
  }

  async playFromBuffer(buffer: AudioBuffer, options: { reverse?: boolean; startTime?: number; duration?: number }) {
    this.initContext();
    this.stopAll();
    let finalBuffer = buffer;
    if (options.reverse) {
      finalBuffer = this.cloneBuffer(buffer);
      for (let i = 0; i < finalBuffer.numberOfChannels; i++) {
        finalBuffer.getChannelData(i).reverse();
      }
    }
    const source = this.context!.createBufferSource();
    source.buffer = finalBuffer;
    source.connect(this.gainNode!);
    let offset = options.startTime || 0;
    if (options.reverse) {
      offset = buffer.duration - offset - (options.duration || 0);
      if (offset < 0) offset = 0;
    }
    source.start(0, offset, options.duration);
    this.currentSources.push(source);
  }

  private cloneBuffer(buffer: AudioBuffer): AudioBuffer {
    const clone = this.context!.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      clone.copyToChannel(buffer.getChannelData(i), i);
    }
    return clone;
  }

  playUiClick() {
    if (!this.context || !this.gainNode) return;
    this.initContext();
    try {
      const osc = this.context.createOscillator();
      const clickGain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.context.currentTime + 0.1);
      clickGain.gain.setValueAtTime(this.volume * 0.2, this.context.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
      osc.connect(clickGain);
      clickGain.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + 0.1);
    } catch {}
  }

  playUiSuccess() {
    if (!this.context || !this.gainNode) return;
    this.initContext();
    try {
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = this.context!.createOscillator();
        const g = this.context!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(this.volume * 0.15, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.connect(g);
        g.connect(this.context!.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playNote(523.25, this.context.currentTime, 0.2);
      playNote(659.25, this.context.currentTime + 0.1, 0.3);
    } catch {}
  }

  playUiError() {
    if (!this.context || !this.gainNode) return;
    this.initContext();
    try {
      const osc = this.context.createOscillator();
      const g = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, this.context.currentTime);
      osc.frequency.linearRampToValueAtTime(50, this.context.currentTime + 0.2);
      g.gain.setValueAtTime(this.volume * 0.3, this.context.currentTime);
      g.gain.linearRampToValueAtTime(0.01, this.context.currentTime + 0.2);
      osc.connect(g);
      g.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + 0.2);
    } catch {}
  }
}

export const audioEngine = new AudioEngine();
