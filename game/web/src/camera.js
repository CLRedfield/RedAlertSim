/* Local camera UX. No world commands or network state are produced here.
   Uses CSS pixels, not device pixels, and seconds rather than frame counts. */
(function (G) {
'use strict';
const R = G.RA, clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const DEFAULTS = Object.freeze({
    rightDrag: true, panMode: 'grab', holdMs: 160, dragThreshold: 6,
    dragSensitivity: 1, invertDrag: false, scrollSpeed: 680,
    edgeScroll: true, edgeWidth: 20, edgeDelay: 100, edgeFullscreenOnly: false,
    smoothPan: true, zoomSensitivity: 1, zoomToCursor: true, smoothZoom: true,
    controls: 'classic', quality: 'high', volume: 0.3, showTips: true
});
const RANGES = {
    holdMs: [80, 400], dragThreshold: [3, 18], dragSensitivity: [0.4, 2.5],
    scrollSpeed: [200, 1600], edgeWidth: [6, 48], edgeDelay: [0, 400],
    zoomSensitivity: [0.35, 2.5], volume: [0, 1]
};
function normalize(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    const result = {...DEFAULTS};
    for (const [key, base] of Object.entries(DEFAULTS)) {
        const value = Object.hasOwn(raw,key) ? raw[key] : undefined;
        if (typeof base === 'boolean' && typeof value === 'boolean') result[key] = value;
        if (RANGES[key] && typeof value === 'number' && Number.isFinite(value)) {
            result[key] = clamp(value, ...RANGES[key]);
        }
    }
    for (const [key, values] of Object.entries({panMode:['grab','scroll'], controls:['classic','modern'], quality:['high','medium','low']})) {
        if (Object.hasOwn(raw,key) && values.includes(raw[key])) result[key] = raw[key];
    }
    return result;
}
function wheelPixels(event, height) {
    const delta = Number(event.deltaY);
    if (!Number.isFinite(delta)) return 0;
    // DOM_DELTA_LINE and DOM_DELTA_PAGE are not pixel counts.
    return clamp(delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1), -800, 800);
}
class CameraController {
    constructor(renderer, preferences = {}) {
        this.renderer = renderer;
        this.prefs = normalize(preferences);
        this.gesture = null;
        this.velocity = {x:0, y:0};
        this.edgeKey = ''; this.edgeSince = 0;
        this.zoomGoal = null; this.zoomPoint = null;
    }
    configure(patch) {
        this.prefs = normalize({...this.prefs, ...patch});
        this.cancel();
        return this.prefs;
    }
    begin(button, point, now) {
        this.cancel();
        this.gesture = {
            button, x:point.x, y:point.y, lastX:point.x, lastY:point.y,
            appliedX:point.x, appliedY:point.y, started:now,
            distance:0, active:button === 1
        };
        return this.gesture;
    }
    move(point, now) {
        const g = this.gesture;
        if (!g) return;
        g.lastX = point.x; g.lastY = point.y;
        g.distance = Math.max(g.distance, Math.hypot(point.x-g.x, point.y-g.y));
        this.promote(now);
        this.applyGrab();
    }
    promote(now) {
        const g = this.gesture;
        if (!g || g.active || g.button !== 2 || !this.prefs.rightDrag) return;
        // Either an intentional drag or a hold consumes the eventual release.
        // A long stationary hold must never accidentally give a move order.
        if (g.distance >= this.prefs.dragThreshold || now-g.started >= this.prefs.holdMs) {
            g.active = true;
            this.zoomGoal = null;
            this.velocity.x = this.velocity.y = 0;
        }
    }
    applyGrab() {
        const g = this.gesture;
        if (!g?.active || (g.button !== 1 && this.prefs.panMode !== 'grab')) return;
        const direction = this.prefs.invertDrag ? -1 : 1;
        const gain = this.prefs.dragSensitivity * direction;
        this.renderer.screenPan((g.appliedX-g.lastX)*gain, (g.appliedY-g.lastY)*gain);
        g.appliedX = g.lastX; g.appliedY = g.lastY;
    }
    end(point, now) {
        this.move(point, now);
        const g = this.gesture;
        this.gesture = null;
        this.stopMotion();
        return g;
    }
    stopMotion() {
        this.velocity.x = this.velocity.y = 0;
        this.edgeKey = ''; this.edgeSince = 0;
    }
    cancel() {
        this.gesture = null;
        this.stopMotion();
        this.zoomGoal = null; this.zoomPoint = null;
    }
    get dragging() { return !!this.gesture?.active; }
    zoomBy(pixels, point) {
        if (this.gesture || !Number.isFinite(pixels) || pixels === 0) return;
        const r = this.renderer;
        this.zoomGoal = clamp((this.zoomGoal ?? r.zoom) * Math.exp(pixels*.0015*this.prefs.zoomSensitivity), 14, 78);
        this.zoomPoint = this.prefs.zoomToCursor && point ? {...point} : null;
        if (!this.prefs.smoothZoom) this.finishZoom();
    }
    setZoomAnchored(value, point) {
        const r = this.renderer;
        r.syncCamera();
        const before = point ? r.groundAt(point.x, point.y) : null;
        r.zoom = clamp(value, 14, 78);
        r.syncCamera();
        if (before) {
            const after = r.groundAt(point.x, point.y);
            r.pan(before.x-after.x, before.z-after.z);
        }
    }
    finishZoom() {
        if (this.zoomGoal !== null) this.setZoomAnchored(this.zoomGoal, this.zoomPoint);
        this.zoomGoal = this.zoomPoint = null;
    }
    resetZoom() {
        this.cancel(); this.renderer.zoom = 35; this.renderer.syncCamera();
    }
    focus(point) {
        this.cancel();
        this.renderer.target = {x:clamp(point.x, 1, R.SIZE-1), z:clamp(point.z, 1, R.SIZE-1)};
        this.renderer.syncCamera();
    }
    update(dt, now, input = {}) {
        const r = this.renderer, p = this.prefs;
        dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
        if (!input.allowed) { this.cancel(); return; }
        this.promote(now); this.applyGrab();
        let dx=0, dy=0;
        const g = this.gesture;
        if (g) {
            this.edgeKey = '';
            if (g.active && g.button === 2 && p.panMode === 'scroll') {
                const x=g.lastX-g.x, y=g.lastY-g.y, distance=Math.hypot(x,y);
                const magnitude=clamp((distance-8)/120, 0, 1);
                if (distance>0) { dx=x/distance*magnitude; dy=y/distance*magnitude; }
            }
        } else {
            const keys=input.keys||new Set();
            dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);
            dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
            const keyboard=!!(dx||dy);
            // World rect excludes HUD. UI hover, window blur, and selection drags
            // never generate an edge-scroll vector.
            const m=input.mouse;
            if (!keyboard && input.edgeEnabled !== false && p.edgeScroll && m &&
                (!p.edgeFullscreenOnly || input.fullscreen) &&
                m.x>=0 && m.y>=0 && m.x<=r.width && m.y<=r.height) {
                const w=p.edgeWidth;
                const ex=m.x<w?-(1-m.x/w):m.x>r.width-w?1-(r.width-m.x)/w:0;
                const ey=m.y<w?-(1-m.y/w):m.y>r.height-w?1-(r.height-m.y)/w:0;
                const key=`${Math.sign(ex)},${Math.sign(ey)}`;
                if (ex||ey) {
                    if (this.edgeKey!==key) { this.edgeKey=key; this.edgeSince=now; }
                    if (now-this.edgeSince>=p.edgeDelay) { dx=ex;dy=ey; }
                } else this.edgeKey='';
            } else this.edgeKey='';
            const length=Math.hypot(dx,dy);
            if(length>1){dx/=length;dy/=length;}
            if (keyboard && (keys.has('ShiftLeft') || keys.has('ShiftRight'))) {dx*=1.75;dy*=1.75;}
        }
        if(dx||dy){
            const speed=p.scrollSpeed;
            const mix=p.smoothPan?1-Math.exp(-dt/.045):1;
            this.velocity.x+=(dx*speed-this.velocity.x)*mix;
            this.velocity.y+=(dy*speed-this.velocity.y)*mix;
            r.screenPan(this.velocity.x*dt,this.velocity.y*dt);
        }else{
            // No momentum after release: responsive RTS camera, not a drifting map.
            this.velocity.x=this.velocity.y=0;
        }
        if(this.zoomGoal!==null && !g){
            const next=p.smoothZoom?r.zoom+(this.zoomGoal-r.zoom)*(1-Math.exp(-dt/.065)):this.zoomGoal;
            if(Math.abs(this.zoomGoal-next)<.005)this.finishZoom();
            else this.setZoomAnchored(next,this.zoomPoint);
        }
    }
}
R.CAMERA_DEFAULTS=DEFAULTS;
R.normalizeCameraPrefs=normalize;
R.wheelPixels=wheelPixels;
R.CameraController=CameraController;
})(globalThis);
