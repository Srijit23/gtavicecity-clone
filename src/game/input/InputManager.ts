export class InputManager {
  readonly keys = new Set<string>();
  lookDeltaX = 0;
  lookDeltaY = 0;
  zoomDelta = 0;
  private readonly element: HTMLElement;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.isTypingTarget(event.target)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.code === 'Escape') this.clear();
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private readonly onBlur = (): void => { this.clear(); };
  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.element) return;
    this.lookDeltaX += event.movementX;
    this.lookDeltaY += event.movementY;
  };
  private readonly onWheel = (event: WheelEvent): void => {
    this.zoomDelta += Math.sign(event.deltaY);
    event.preventDefault();
  };
  private readonly onPointerLockError = (): void => { console.warn('[NEON COAST] Pointer lock could not be acquired.'); };

  constructor(element: HTMLElement) {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('pointerlockerror', this.onPointerLockError);
  }

  requestPointerLock(): void { void this.element.requestPointerLock(); }
  releasePointerLock(): void { if (document.pointerLockElement === this.element) document.exitPointerLock(); this.clear(); }
  consumeMouseDeltas(): void { this.lookDeltaX = 0; this.lookDeltaY = 0; this.zoomDelta = 0; }
  clear(): void { this.keys.clear(); this.consumeMouseDeltas(); }
  dispose(): void {
    this.clear();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.element.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
  }
  private isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  }
}
