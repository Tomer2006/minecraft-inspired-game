export class PlayerSettings {
  constructor(player) {
    this.player = player;
  }

  load() {
    const saved = localStorage.getItem('minecraft_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.keybinds) this.player.keybinds = settings.keybinds;
      if (settings.sensitivity) this.player.sensitivity = settings.sensitivity;
      if (settings.renderDistance) this.player.terrain.renderDistance = settings.renderDistance;
      if (settings.enableShadows !== undefined) this.player.enableShadows = settings.enableShadows;
      if (settings.showPerformanceChart !== undefined) this.player.showPerformanceChart = settings.showPerformanceChart;
      if (settings.maxFps !== undefined) this.player.maxFps = settings.maxFps;
      if (settings.enableFrustumCulling !== undefined) this.player.terrain.cullingManager.setFrustumCulling(settings.enableFrustumCulling);
      if (settings.enableOcclusionCulling !== undefined) this.player.terrain.cullingManager.setOcclusionCulling(settings.enableOcclusionCulling);
    }
  }

  save() {
    const settings = {
      keybinds: this.player.keybinds,
      sensitivity: this.player.sensitivity,
      renderDistance: this.player.terrain.renderDistance,
      enableShadows: this.player.enableShadows,
      showPerformanceChart: this.player.showPerformanceChart,
      maxFps: this.player.maxFps
    };
    localStorage.setItem('minecraft_settings', JSON.stringify(settings));
  }
}

