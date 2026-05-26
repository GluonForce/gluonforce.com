import * as THREE from 'three';

const BG_COLOR = 0x070e1a;

let postprocessingModules;
function loadPostprocessing() {
  if (!postprocessingModules) {
    postprocessingModules = Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
    ]).then(([composer, renderPass, bloom]) => ({
      EffectComposer: composer.EffectComposer,
      RenderPass: renderPass.RenderPass,
      UnrealBloomPass: bloom.UnrealBloomPass,
    }));
  }
  return postprocessingModules;
}
const ACCENT = 0x4a9ece;

/** Logo-mark torus knot: (3,5) — hexagonal 6-lobe interlace (vs trefoil 2,3) */
const LOGO_KNOT = {
  p: 3,
  q: 5,
  radius: 1.0,
  tube: 0.28,
  tubularSegments: 320,
  radialSegments: 24,
};

/**
 * Centerline curve matching Three.js TorusKnotGeometry (no TorusKnot Curve in r170).
 */
class LogoKnotCurve extends THREE.Curve {
  constructor(radius, p, q) {
    super();
    this.radius = radius;
    this.p = p;
    this.q = q;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const u = t * this.p * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const quOverP = (this.q / this.p) * u;
    const cs = Math.cos(quOverP);

    target.x = this.radius * (2 + cs) * 0.5 * cu;
    target.y = this.radius * (2 + cs) * su * 0.5;
    target.z = this.radius * Math.sin(quOverP) * 0.5;
    return target;
  }
}

function createLogoKnotCurve() {
  return new LogoKnotCurve(LOGO_KNOT.radius, LOGO_KNOT.p, LOGO_KNOT.q);
}

function buildFiberField(curve, options) {
  const {
    tubularSamples,
    fibersPerRing,
    bundleRadius,
    isMobile,
  } = options;

  const total = tubularSamples * fibersPerRing;
  const positions = new Float32Array(total * 3);
  const uCoords = new Float32Array(total);
  const phases = new Float32Array(total);
  const sizes = new Float32Array(total);
  const alphas = new Float32Array(total);
  const ringAngles = new Float32Array(total);

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const offset = new THREE.Vector3();

  let idx = 0;
  for (let i = 0; i < tubularSamples; i++) {
    const u = i / tubularSamples;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent).normalize();

    normal.set(0, 1, 0).cross(tangent);
    if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
    normal.normalize();
    binormal.crossVectors(tangent, normal).normalize();

    for (let f = 0; f < fibersPerRing; f++) {
      const ringAngle = (f / fibersPerRing) * Math.PI * 2;
      const wobble = Math.sin(u * Math.PI * 2 * LOGO_KNOT.q * 2 + ringAngle * 3) * 0.12;
      const radial = bundleRadius * (0.45 + (f / fibersPerRing) * 0.55 + wobble * 0.15);

      offset
        .copy(normal)
        .multiplyScalar(Math.cos(ringAngle) * radial)
        .addScaledVector(binormal, Math.sin(ringAngle) * radial);

      const i3 = idx * 3;
      positions[i3] = point.x + offset.x;
      positions[i3 + 1] = point.y + offset.y;
      positions[i3 + 2] = point.z + offset.z;

      uCoords[idx] = u;
      phases[idx] = Math.random() * Math.PI * 2;
      ringAngles[idx] = ringAngle;
      sizes[idx] = isMobile ? 1.2 + Math.random() * 2 : 1.6 + Math.random() * 2.8;
      alphas[idx] = 0.35 + Math.random() * 0.55;
      idx++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aU', new THREE.BufferAttribute(uCoords, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aRing', new THREE.BufferAttribute(ringAngles, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aU;
      attribute float aPhase;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aRing;
      uniform float uTime;
      varying float vAlpha;
      varying float vGlow;
      void main() {
        vAlpha = aAlpha;
        float flow = sin(aU * 62.0 - uTime * 5.5 + aPhase) * 0.5 + 0.5;
        float strand = sin(aRing * 8.0 + uTime * 3.0) * 0.5 + 0.5;
        vGlow = flow * strand;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (1.0 + vGlow * 0.6) * (155.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vGlow;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.28, d);
        float halo = 1.0 - smoothstep(0.18, 0.5, d);
        vec3 deep = vec3(0.12, 0.38, 0.78);
        vec3 mid = vec3(0.28, 0.62, 0.98);
        vec3 hot = vec3(0.72, 0.9, 1.0);
        vec3 color = mix(deep, mid, core);
        color = mix(color, hot, core * vGlow * 0.85);
        float alpha = (core * 0.75 + halo * 0.25) * vAlpha * (0.65 + vGlow * 0.35);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return {
    points: new THREE.Points(geometry, material),
    geometry,
    material,
    tubularSamples,
    fibersPerRing,
    curve,
    bundleRadius,
  };
}

function buildPlasmaEffects(plasmaGroup, knotCurve, isMobile) {
  const outerFibers = buildFiberField(knotCurve, {
    tubularSamples: isMobile ? 160 : 300,
    fibersPerRing: isMobile ? 10 : 14,
    bundleRadius: LOGO_KNOT.tube * 0.92,
    isMobile,
  });
  plasmaGroup.add(outerFibers.points);

  const innerFibers = buildFiberField(knotCurve, {
    tubularSamples: isMobile ? 110 : 200,
    fibersPerRing: isMobile ? 6 : 8,
    bundleRadius: LOGO_KNOT.tube * 0.45,
    isMobile,
  });
  plasmaGroup.add(innerFibers.points);

  const shellCount = isMobile ? 900 : 1800;
  const shellPositions = new Float32Array(shellCount * 3);
  const shellSizes = new Float32Array(shellCount);
  const shellAlphas = new Float32Array(shellCount);
  const shellDirs = new Float32Array(shellCount * 3);
  const shellPhases = new Float32Array(shellCount);

  const dir = new THREE.Vector3();
  const shellRadius = 2.1;

  for (let i = 0; i < shellCount; i++) {
    dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    shellDirs[i * 3] = dir.x;
    shellDirs[i * 3 + 1] = dir.y;
    shellDirs[i * 3 + 2] = dir.z;
    shellPhases[i] = Math.random() * Math.PI * 2;
    shellSizes[i] = 0.6 + Math.random() * 1.4;
    shellAlphas[i] = 0.05 + Math.random() * 0.14;
    shellPositions[i * 3] = dir.x * shellRadius;
    shellPositions[i * 3 + 1] = dir.y * shellRadius;
    shellPositions[i * 3 + 2] = dir.z * shellRadius;
  }

  const shellGeometry = new THREE.BufferGeometry();
  shellGeometry.setAttribute('position', new THREE.BufferAttribute(shellPositions, 3));
  shellGeometry.setAttribute('aSize', new THREE.BufferAttribute(shellSizes, 1));
  shellGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(shellAlphas, 1));

  const shellPoints = new THREE.Points(
    shellGeometry,
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (120.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.2, 0.5, d);
          gl_FragColor = vec4(0.2, 0.55, 0.92, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  plasmaGroup.add(shellPoints);

  const sparkCount = isMobile ? 35 : 70;
  const sparkPositions = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.6 + Math.random() * 1.8;
    sparkPositions[i * 3] = Math.cos(angle) * r;
    sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
    sparkPositions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const sparks = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3)),
    new THREE.PointsMaterial({
      color: ACCENT,
      size: 0.035,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  plasmaGroup.add(sparks);

  return {
    outerFibers,
    innerFibers,
    shellGeometry,
    shellPoints,
    sparks,
    shellCount,
    shellDirs,
    shellPhases,
    shellRadius,
  };
}

function updateFiberPositions(fiberField, time) {
  const {
    geometry,
    curve,
    tubularSamples,
    fibersPerRing,
    bundleRadius,
  } = fiberField;

  const positions = geometry.attributes.position.array;
  const uCoords = geometry.attributes.aU.array;
  const ringAngles = geometry.attributes.aRing.array;

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const offset = new THREE.Vector3();

  let idx = 0;
  for (let i = 0; i < tubularSamples; i++) {
    const u = i / tubularSamples;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent).normalize();

    normal.set(0, 1, 0).cross(tangent);
    if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
    normal.normalize();
    binormal.crossVectors(tangent, normal).normalize();

    const flow = Math.sin(u * Math.PI * 2 * LOGO_KNOT.q - time * 2.2) * 0.04;

    for (let f = 0; f < fibersPerRing; f++) {
      const ringAngle = ringAngles[idx];
      const wobble = Math.sin(u * Math.PI * 2 * LOGO_KNOT.q * 2 + ringAngle * 3 + time * 1.5) * 0.1;
      const radial = bundleRadius * (0.45 + (f / fibersPerRing) * 0.55 + wobble * 0.15) + flow;

      offset
        .copy(normal)
        .multiplyScalar(Math.cos(ringAngle) * radial)
        .addScaledVector(binormal, Math.sin(ringAngle) * radial);

      const i3 = idx * 3;
      positions[i3] = point.x + offset.x + tangent.x * flow * 0.5;
      positions[i3 + 1] = point.y + offset.y + tangent.y * flow * 0.5;
      positions[i3 + 2] = point.z + offset.z + tangent.z * flow * 0.5;
      idx++;
    }
  }

  geometry.attributes.position.needsUpdate = true;
}

function initPlasmaField() {
  const container = document.getElementById('heroPlasma');
  if (!container) return null;

  try {
    return initPlasmaFieldScene(container);
  } catch (err) {
    console.error('[plasma-field] Failed to initialize:', err);
    return null;
  }
}

function initPlasmaFieldScene(container) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const isMobile = window.innerWidth < 768 || isCoarse;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('[plasma-field] WebGL unavailable:', err);
    return null;
  }

  document.body.classList.add('has-plasma-hero');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.1);

  function getLayoutForWidth(width) {
    const mobile = width < 768 || window.matchMedia('(pointer: coarse)').matches;
    return {
      isMobile: mobile,
      fov: mobile ? 50 : 48,
      cameraZ: mobile ? 8.2 : 6,
      groupScale: mobile ? 0.52 : 0.86,
      groupY: mobile ? 0.35 : 0,
    };
  }

  let layout = getLayoutForWidth(window.innerWidth);
  const camera = new THREE.PerspectiveCamera(layout.fov, 1, 0.1, 50);
  camera.position.set(0, 0, layout.cameraZ);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setClearColor(BG_COLOR, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);

  const plasmaGroup = new THREE.Group();
  scene.add(plasmaGroup);

  const knotCurve = createLogoKnotCurve();
  loadPostprocessing();

  const knotUniforms = { uTime: { value: 0 } };
  const knotVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const knotFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.4);

      float ribs = sin(vUv.x * 72.0) * 0.5 + 0.5;
      float along = sin(vUv.y * 110.0 + uTime * 2.8) * 0.5 + 0.5;
      float weave = pow(ribs * along, 0.7);

      vec3 deep = vec3(0.08, 0.32, 0.72);
      vec3 mid = vec3(0.22, 0.58, 0.95);
      vec3 core = vec3(0.55, 0.82, 1.0);
      vec3 color = mix(deep, mid, weave);
      color = mix(color, core, fresnel * 0.65 + weave * 0.25);

      float brightness = 0.28 + weave * 0.42 + fresnel * 0.3;
      gl_FragColor = vec4(color * brightness, 0.5 + fresnel * 0.35);
    }
  `;

  const knotMesh = new THREE.Mesh(
    new THREE.TorusKnotGeometry(
      LOGO_KNOT.radius,
      LOGO_KNOT.tube,
      isMobile ? 160 : LOGO_KNOT.tubularSegments,
      LOGO_KNOT.radialSegments,
      LOGO_KNOT.p,
      LOGO_KNOT.q
    ),
    new THREE.ShaderMaterial({
      uniforms: knotUniforms,
      vertexShader: knotVertexShader,
      fragmentShader: knotFragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  plasmaGroup.add(knotMesh);

  plasmaGroup.scale.setScalar(layout.groupScale);
  plasmaGroup.position.y = layout.groupY;
  plasmaGroup.rotation.x = 0.1;
  plasmaGroup.rotation.z = -0.02;

  let composer = null;
  let outerFibers = null;
  let innerFibers = null;
  let shellGeometry = null;
  let shellPoints = null;
  let sparks = null;
  let shellCount = 0;
  let shellDirs = null;
  let shellPhases = null;
  let shellRadius = 2.1;

  let targetRotX = 0;
  let targetRotY = 0;
  let elapsed = 0;
  let animationId = null;
  let isVisible = true;

  function onMouseMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    targetRotY = x * 0.22;
    targetRotX = y * 0.1;
  }

  function applyLayout() {
    layout = getLayoutForWidth(window.innerWidth);
    camera.fov = layout.fov;
    camera.position.set(0, 0, layout.cameraZ);
    plasmaGroup.scale.setScalar(layout.groupScale);
    plasmaGroup.position.y = layout.groupY;
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    applyLayout();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
  }

  function renderFrame() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function updateShell(time) {
    if (!shellGeometry) return;
    const pos = shellGeometry.attributes.position.array;
    for (let i = 0; i < shellCount; i++) {
      const i3 = i * 3;
      const wobble = Math.sin(time * 0.5 + shellPhases[i]) * 0.05;
      const r = shellRadius + wobble;
      pos[i3] = shellDirs[i3] * r;
      pos[i3 + 1] = shellDirs[i3 + 1] * r;
      pos[i3 + 2] = shellDirs[i3 + 2] * r;
    }
    shellGeometry.attributes.position.needsUpdate = true;
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const dt = prefersReducedMotion ? 0 : 0.016;
    elapsed += dt;

    knotUniforms.uTime.value = elapsed;

    if (outerFibers) outerFibers.material.uniforms.uTime.value = elapsed;
    if (innerFibers) innerFibers.material.uniforms.uTime.value = elapsed;

    if (!prefersReducedMotion) {
      if (outerFibers) updateFiberPositions(outerFibers, elapsed);
      if (innerFibers) updateFiberPositions(innerFibers, elapsed * 1.15);
      updateShell(elapsed);
      plasmaGroup.rotation.y += 0.0018;
      plasmaGroup.rotation.x += (0.12 + targetRotX - plasmaGroup.rotation.x) * 0.04;
      plasmaGroup.rotation.y += (targetRotY - plasmaGroup.rotation.y) * 0.04;
    }

    renderFrame();
  }

  function attachPlasmaEffects() {
    if (outerFibers) return;
    const effects = buildPlasmaEffects(plasmaGroup, knotCurve, isMobile);
    outerFibers = effects.outerFibers;
    innerFibers = effects.innerFibers;
    shellGeometry = effects.shellGeometry;
    shellPoints = effects.shellPoints;
    sparks = effects.sparks;
    shellCount = effects.shellCount;
    shellDirs = effects.shellDirs;
    shellPhases = effects.shellPhases;
    shellRadius = effects.shellRadius;
  }

  async function attachBloom() {
    if (composer) return;
    const { EffectComposer, RenderPass, UnrealBloomPass } = await loadPostprocessing();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        isMobile ? 0.42 : 0.62,
        0.4,
        0.88
      )
    );
    resize();
  }

  function scheduleAfterPaint(callback) {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  }

  function scheduleWhenIdle(callback, timeoutMs) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: timeoutMs });
    } else {
      setTimeout(callback, 32);
    }
  }

  resize();
  renderFrame();
  container.classList.add('is-ready');

  if (isMobile) {
    scheduleAfterPaint(attachPlasmaEffects);
    scheduleWhenIdle(() => {
      attachPlasmaEffects();
      attachBloom();
    }, 1200);
  } else {
    scheduleAfterPaint(attachPlasmaEffects);
    attachBloom();
  }

  window.addEventListener('resize', resize);
  if (!prefersReducedMotion) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    observer.observe(hero);
  }

  animate();

  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    document.body.classList.remove('has-plasma-hero');
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    resizeObserver.disconnect();
    knotMesh.geometry.dispose();
    knotMesh.material.dispose();
    if (outerFibers) {
      outerFibers.geometry.dispose();
      outerFibers.material.dispose();
    }
    if (innerFibers) {
      innerFibers.geometry.dispose();
      innerFibers.material.dispose();
    }
    if (shellGeometry) {
      shellGeometry.dispose();
      shellPoints.material.dispose();
    }
    if (sparks) {
      sparks.geometry.dispose();
      sparks.material.dispose();
    }
    if (composer) composer.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}

initPlasmaField();
