import * as THREE from 'three';

export type TimeOfDay = 'auto' | 'day' | 'sunset' | 'night';

/** Smoothly blends the city's sky, fog, sun, ambient fill, and exposure across a day/night cycle. */
export class EnvironmentController {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly skyMaterial: THREE.MeshBasicMaterial;
  private readonly fog: THREE.Fog;
  private readonly nightLights: THREE.PointLight[] = [];
  private readonly emissiveWindowMaterials: Array<{ material: THREE.MeshStandardMaterial; baseIntensity: number }> = [];
  private mode: TimeOfDay = 'auto';
  private elapsed = 0;
  private night = 0.15;
  private readonly sunStart = new THREE.Vector3(-28, 48, 22);
  private readonly colors = {
    daySky: new THREE.Color('#e7aa96'),
    sunsetSky: new THREE.Color('#b96679'),
    nightSky: new THREE.Color('#10172f'),
    dayFog: new THREE.Color('#e7aa96'),
    sunsetFog: new THREE.Color('#b96679'),
    nightFog: new THREE.Color('#17213c'),
  };

  constructor(scene: THREE.Scene, root: THREE.Group, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    let sun: THREE.DirectionalLight | undefined;
    let hemi: THREE.HemisphereLight | undefined;
    root.traverse((object) => {
      if (object instanceof THREE.DirectionalLight && !sun) sun = object;
      if (object instanceof THREE.HemisphereLight && !hemi) hemi = object;
      if (object instanceof THREE.PointLight && object.userData.environmentLamp) this.nightLights.push(object);
      if (object instanceof THREE.InstancedMesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0
            && !this.emissiveWindowMaterials.some((entry) => entry.material === material)) {
            this.emissiveWindowMaterials.push({ material, baseIntensity: material.emissiveIntensity });
          }
        }
      }
      if (object instanceof THREE.PointLight && (object.color.getHexString() === 'ff65bb' || object.color.getHexString() === 'ffdda7')) {
        object.userData.baseIntensity = object.intensity;
      }
    });
    if (!sun || !hemi) throw new Error('World lighting rig is missing its sun or hemisphere light.');
    this.sun = sun;
    this.hemisphere = hemi;
    this.fog = new THREE.Fog(this.colors.dayFog, 95, 235);
    this.scene.fog = this.fog;
    const sky = root.children.find((object) => object instanceof THREE.Mesh && object.geometry instanceof THREE.SphereGeometry
      && (object.material as THREE.Material).type === 'MeshBasicMaterial') as THREE.Mesh | undefined;
    if (!sky || !(sky.material instanceof THREE.MeshBasicMaterial)) throw new Error('World sky dome could not be found.');
    this.skyMaterial = sky.material;
    this.update(0);
  }

  setMode(mode: TimeOfDay): void { this.mode = mode; }

  cycleMode(): TimeOfDay {
    const modes: TimeOfDay[] = ['auto', 'day', 'sunset', 'night'];
    this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
    return this.mode;
  }

  get currentMode(): TimeOfDay { return this.mode; }
  get nightAmount(): number { return this.night; }

  update(dt: number): void {
    this.elapsed += dt;
    const phase = this.mode === 'day' ? 0.23
      : this.mode === 'sunset' ? 0.48
        : this.mode === 'night' ? 0.76
          : (this.elapsed / 210 + 0.12) % 1;
    // Daylight is strongest around phase 0.25, sunset near 0.5, and midnight near 0.75.
    const daylight = THREE.MathUtils.clamp(Math.sin((phase + 0.02) * Math.PI * 2) * 0.5 + 0.5, 0.08, 1);
    const sunset = Math.exp(-Math.pow((phase - 0.49) / 0.12, 2));
    const night = 1 - daylight;
    this.night = night;
    const sky = this.colors.nightSky.clone().lerp(this.colors.daySky, daylight).lerp(this.colors.sunsetSky, sunset * 0.86);
    const fog = this.colors.nightFog.clone().lerp(this.colors.dayFog, daylight).lerp(this.colors.sunsetFog, sunset * 0.82);
    this.scene.background = sky;
    this.skyMaterial.color.copy(sky);
    this.fog.color.copy(fog);
    this.fog.near = 78 + daylight * 18;
    this.fog.far = 180 + daylight * 65;
    this.sun.position.set(this.sunStart.x * Math.cos(phase * Math.PI * 2), 8 + daylight * 48, this.sunStart.z);
    this.sun.intensity = 0.18 + daylight * 2.95;
    this.sun.color.set('#fff0d2').lerp(new THREE.Color('#ff8b73'), sunset * 0.7);
    this.hemisphere.intensity = 0.24 + daylight * 1.22;
    this.hemisphere.color.set('#8bbbe9').lerp(new THREE.Color('#ffad9a'), sunset * 0.55);
    this.hemisphere.groundColor.set('#292c49').lerp(new THREE.Color('#bf8d70'), daylight);
    this.renderer.toneMappingExposure = 0.82 + daylight * 0.34;
    // Street lamps and neon accents stay visible after dark without overpowering daytime.
    for (const light of this.nightLights) {
      light.intensity = (light.userData.baseIntensity ?? 0.65) * (0.12 + night * 1.9);
    }
    for (const entry of this.emissiveWindowMaterials) {
      entry.material.emissiveIntensity = entry.baseIntensity * (0.65 + night * 1.8);
    }
  }
}

/** Web Audio ambience synthesized locally: soft surf-like noise plus a distant low coastal hum. */
export class AmbienceAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private started = false;
  private muted = false;
  private nightGain?: GainNode;
  private noiseFilter?: BiquadFilterNode;

  start(): void {
    if (this.started) {
      if (this.context?.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.32;
    master.connect(context.destination);
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < channel.length; i += 1) {
      smooth = smooth * 0.94 + (Math.random() * 2 - 1) * 0.06;
      channel[i] = smooth * 2.6;
    }
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.34;
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 54;
    const lowGain = context.createGain();
    lowGain.gain.value = 0.035;
    oscillator.connect(lowGain).connect(master);
    oscillator.start();
    const nightOscillator = context.createOscillator();
    nightOscillator.type = 'sine';
    nightOscillator.frequency.value = 1650;
    const nightGain = context.createGain();
    nightGain.gain.value = 0;
    nightOscillator.connect(nightGain).connect(master);
    nightOscillator.start();
    this.context = context;
    this.master = master;
    this.nightGain = nightGain;
    this.noiseFilter = filter;
    this.started = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.32, this.context.currentTime, 0.08);
  }

  get isMuted(): boolean { return this.muted; }

  updateNight(amount: number): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.nightGain?.gain.setTargetAtTime(Math.max(0, Math.min(1, amount)) * 0.014, now, 0.6);
    this.noiseFilter?.frequency.setTargetAtTime(420 + amount * 170, now, 0.6);
  }

  dispose(): void {
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = undefined;
    this.started = false;
  }
}
