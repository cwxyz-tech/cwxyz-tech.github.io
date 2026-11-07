// Collision world made of boxes and upright cylinders. Simple shapes keep the
// collision exact and fast, so Fuse never slips through the floor or his cap.

export class Level {
  constructor() { this.solids = []; this.movers = []; }

  addBox(cx, cy, cz, sx, sy, sz, o = {}) {
    const s = { type: "box", x: cx, y: cy, z: cz, hx: sx / 2, hy: sy / 2, hz: sz / 2, dx: 0, dy: 0, dz: 0, ...o };
    this.solids.push(s);
    if (o.path || o.spin) this.movers.push(s);
    return s;
  }
  // upright cylinder from y0 to y1
  addCyl(x, z, r, y0, y1, o = {}) {
    const s = { type: "cyl", x, z, r, y: (y0 + y1) / 2, hy: (y1 - y0) / 2, dx: 0, dy: 0, dz: 0, ...o };
    this.solids.push(s);
    if (o.path) this.movers.push(s);
    return s;
  }
  remove(s) { this.solids = this.solids.filter((q) => q !== s); this.movers = this.movers.filter((q) => q !== s); }

  update(dt, time) {
    for (const s of this.movers) {
      if (!s.path || s.enabled === false) { s.dx = s.dy = s.dz = 0; continue; }
      const p = s.path; // {a:[x,y,z], b:[x,y,z], period, phase}
      const k = 0.5 - 0.5 * Math.cos(((time + (p.phase || 0)) / p.period) * Math.PI * 2);
      const nx = p.a[0] + (p.b[0] - p.a[0]) * k, ny = p.a[1] + (p.b[1] - p.a[1]) * k, nz = p.a[2] + (p.b[2] - p.a[2]) * k;
      s.dx = nx - s.x; s.dy = ny - s.y; s.dz = nz - s.z;
      s.x = nx; s.y = ny; s.z = nz;
      if (s.mesh) s.mesh.position.set(nx + (s.meshOff ? s.meshOff[0] : 0), ny + (s.meshOff ? s.meshOff[1] : 0), nz + (s.meshOff ? s.meshOff[2] : 0));
    }
  }

  top(s) { return s.y + s.hy; }
  bottom(s) { return s.y - s.hy; }

  // horizontal overlap of a circle (px,pz,r) with a solid. returns push vector or null
  pushXZ(s, px, pz, r) {
    if (s.type === "box") {
      const cx = Math.max(s.x - s.hx, Math.min(px, s.x + s.hx));
      const cz = Math.max(s.z - s.hz, Math.min(pz, s.z + s.hz));
      let dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return null;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; return { x: dx * k, z: dz * k, nx: dx / d, nz: dz / d }; }
      // center inside the box: push out along the shallow side
      const ox = s.hx - Math.abs(px - s.x) + r, oz = s.hz - Math.abs(pz - s.z) + r;
      if (ox < oz) { const sg = Math.sign(px - s.x) || 1; return { x: ox * sg, z: 0, nx: sg, nz: 0 }; }
      const sg = Math.sign(pz - s.z) || 1; return { x: 0, z: oz * sg, nx: 0, nz: sg };
    }
    const dx = px - s.x, dz = pz - s.z, d = Math.hypot(dx, dz), rr = s.r + r;
    if (d >= rr) return null;
    if (d < 1e-6) return { x: rr, z: 0, nx: 1, nz: 0 };
    return { x: (dx / d) * (rr - d), z: (dz / d) * (rr - d), nx: dx / d, nz: dz / d };
  }
  overlapXZ(s, px, pz, r) {
    if (s.type === "box") return Math.abs(px - s.x) < s.hx + r && Math.abs(pz - s.z) < s.hz + r &&
      // corner check
      (Math.abs(px - s.x) < s.hx || Math.abs(pz - s.z) < s.hz || (Math.abs(px - s.x) - s.hx) ** 2 + (Math.abs(pz - s.z) - s.hz) ** 2 < r * r);
    return Math.hypot(px - s.x, pz - s.z) < s.r + r;
  }

  // move a body {pos, vel, r, h, grounded, ground} for dt with collisions
  move(b, dt) {
    const steps = Math.max(1, Math.ceil((Math.hypot(b.vel.x, b.vel.z) * dt + Math.abs(b.vel.y * dt)) / 0.25));
    const h = dt / steps;
    b.wall = null; b.bump = false;
    let landed = false;
    // ride the platform we stand on
    if (b.grounded && b.ground) { b.pos.x += b.ground.dx; b.pos.y += b.ground.dy; b.pos.z += b.ground.dz; }
    for (let i = 0; i < steps; i++) {
      // horizontal
      b.pos.x += b.vel.x * h; b.pos.z += b.vel.z * h;
      for (const s of this.solids) {
        if (s.ghost || s.enabled === false) continue;
        const top = s.y + s.hy, bot = s.y - s.hy;
        if (b.pos.y + b.h <= bot + 0.02 || b.pos.y >= top - 0.02) continue;
        const p = this.pushXZ(s, b.pos.x, b.pos.z, b.r);
        if (!p) continue;
        // small ledges: step up instead of stopping
        if (b.grounded && top - b.pos.y < 0.4 && !s.noStep) { b.pos.y = top; continue; }
        b.pos.x += p.x; b.pos.z += p.z;
        const vn = b.vel.x * p.nx + b.vel.z * p.nz;
        if (vn < 0) { b.vel.x -= vn * p.nx; b.vel.z -= vn * p.nz; }
        if (Math.abs(p.nx) + Math.abs(p.nz) > 0.5 && !s.noWall) b.wall = { nx: p.nx, nz: p.nz, s, speed: -vn };
      }
      // vertical
      const prevY = b.pos.y;
      b.pos.y += b.vel.y * h;
      b.grounded = false;
      for (const s of this.solids) {
        if (s.ghost || s.enabled === false) continue;
        if (!this.overlapXZ(s, b.pos.x, b.pos.z, b.r * 0.82)) continue;
        const top = s.y + s.hy, bot = s.y - s.hy;
        if (b.vel.y <= 0 && b.pos.y <= top + 0.0001 && prevY >= top - 0.06 - Math.max(0, -s.dy)) {
          b.pos.y = top; b.vel.y = 0; b.grounded = true; b.ground = s; landed = true;
        } else if (b.vel.y > 0 && b.pos.y + b.h > bot && prevY + b.h <= bot + 0.06) {
          b.pos.y = bot - b.h; b.vel.y = 0; b.bump = true;
        }
      }
    }
    // stay glued to the ground when walking down small steps / on lowering platforms
    if (!b.grounded && b.vel.y <= 0 && b.wasGrounded) {
      const g = this.groundBelow(b.pos.x, b.pos.z, b.pos.y + 0.05, b.r * 0.82);
      if (g && b.pos.y - g.top < 0.3) { b.pos.y = g.top; b.grounded = true; b.ground = g.s; b.vel.y = 0; }
    }
    if (!b.grounded) b.ground = null;
    b.wasGrounded = b.grounded;
    return landed;
  }

  // highest surface under a point (for shadows, snapping, spawning)
  groundBelow(x, z, fromY, r = 0.05) {
    let best = null;
    for (const s of this.solids) {
      if (s.ghost || s.enabled === false || s.noShadow) continue;
      const top = s.y + s.hy;
      if (top > fromY + 0.001) continue;
      if (!this.overlapXZ(s, x, z, r)) continue;
      if (!best || top > best.top) best = { top, s };
    }
    return best;
  }

  // is a point inside any solid (used by the cap and the camera)
  pointInside(x, y, z, r = 0) {
    for (const s of this.solids) {
      if (s.ghost || s.enabled === false || s.camThrough) continue;
      if (y < s.y - s.hy - r || y > s.y + s.hy + r) continue;
      if (this.overlapXZ(s, x, z, r)) return s;
    }
    return null;
  }

  // march a segment and return the first fraction that hits a solid
  segment(ax, ay, az, bx, by, bz, r = 0.2) {
    const d = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(2, Math.ceil(d / 0.25));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (this.pointInside(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k, r)) return (i - 1) / n;
    }
    return 1;
  }
}
