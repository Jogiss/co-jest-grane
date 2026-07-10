interface YTPlayer {
  destroy(): void;
  stopVideo(): void;
  pauseVideo(): void;
  playVideo(): void;
  setVolume(vol: number): void;
}

interface YTPlayerConstructor {
  new (elementId: string, options: any): YTPlayer;
}

interface YTNamespace {
  Player: YTPlayerConstructor;
}

interface Window {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
}
