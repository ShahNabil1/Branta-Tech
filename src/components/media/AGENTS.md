# Media rules
- Public video sound goes only through useVideoSound + SoundToggle (SoundToggle.tsx): every video mounts muted, one video has sound at a time, nothing persisted; small card previews (PortfolioCard) stay muted with no control.
- Every public video (Vimeo or MP4/WebM) renders through BrantaVideo (BrantaVideo.tsx): poster-first, critical/high/lazy priority, poster fades only after confirmed playback, pause off-screen, Play fallback — never add per-section Vimeo iframes.
