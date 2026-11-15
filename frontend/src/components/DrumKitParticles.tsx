
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

const MODEL_PATH = "/drum_kit.glb";

const PARTICLE_COUNT = 100000;
const PARTICLE_SIZE = 0.5;
const MOUSE_RADIUS_PX = 110;

const VERTEX_SHADER = `
  attribute vec3 aHome;
  attribute vec3 aRandom;
  attribute vec3 aColor;
  attribute float aEnergy;

  uniform float uTime;
  uniform float uScatter;
  uniform float uSize;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = aHome;

    // Random 3D scatter direction
    vec3 direction = normalize(aRandom * 2.0 - 1.0);

    float explosion = uScatter * (0.8 + aRandom.x * 2.2);

    pos += direction * explosion;

    // Per-particle activation energy (rises near cursor, decays after).
    float influence = aEnergy;

    // Displace along each particle's random direction.
    pos += direction * influence * 0.35;

    // Per-particle vibration while affected.
    float phase = aRandom.y * 100.0;

    float vibration =
      sin(uTime * 45.0 + phase) * 0.6 +
      sin(uTime * 73.0 + aRandom.z * 60.0) * 0.4;

    pos += direction *
      vibration *
      influence *
      0.07;

    // Subtle ambient particle movement
    float drift = sin(
      uTime * (0.7 + aRandom.x) + aRandom.y * 30.0
    ) * 0.012;

    pos += direction * drift * (1.0 - uScatter);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = uSize * (
      13.0 / max(1.0, -mvPosition.z)
    );

    vColor = aColor;

    vAlpha = 0.8 + aRandom.z * 0.2;
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);

    float distanceFromCenter = length(centered);

    if (distanceFromCenter > 0.5) discard;

    float glow = 1.0 - smoothstep(
      0.12,
      0.5,
      distanceFromCenter
    );

    gl_FragColor = vec4(
      vColor * (0.85 + glow * 0.35),
      glow * vAlpha
    );
  }
`;

type SampleMesh = {
  mesh: THREE.Mesh;
  sampler: MeshSurfaceSampler;
  area: number;
  color: THREE.Color;
};

export function DrumKitParticles() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) return;

    let disposed = false;
    let animationFrame = 0;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // ================================================
    // SCENE SETUP
    // ================================================

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      40,
      1,
      0.1,
      100
    );

    camera.position.set(0, 1.7, 10.5);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.setClearColor(0x000000, 0);

    // ================================================
    // ORBIT CONTROLS
    // ================================================

    const controls = new OrbitControls(
      camera,
      canvas
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    controls.enableZoom = false;

    controls.enablePan = false;

    controls.minDistance = 4;
    controls.maxDistance = 16;

    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.85;

    controls.target.set(0, 0, 0);
    controls.update();

    // ================================================
    // PARTICLE STATE
    // ================================================

    let particleCloud: THREE.Points | null = null;

    let energyAttribute: THREE.BufferAttribute | null = null;
    let homesAttribute: THREE.BufferAttribute | null = null;

    const uniforms = {
      uTime: { value: 0 },
      uScatter: { value: 0 },
      uSize: { value: PARTICLE_SIZE },
    };

    let scatterTarget = 0;
    let mouseActiveTarget = 0;

    let viewWidth = 1;
    let viewHeight = 1;

    // ================================================
    // MODEL NORMALIZATION
    // ================================================

    function normalizeModel(root: THREE.Object3D) {
      root.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(root);

      const dimensions = new THREE.Vector3();
      bounds.getSize(dimensions);

      const center = new THREE.Vector3();
      bounds.getCenter(center);

      const maxDimension = Math.max(
        dimensions.x,
        dimensions.y,
        dimensions.z
      );

      if (!maxDimension) return;

      const scale = 5.5 / maxDimension;

      root.scale.multiplyScalar(scale);

      // Center the scaled model around the origin.
      root.position.sub(center.multiplyScalar(scale));

      root.updateMatrixWorld(true);
    }

    // ================================================
    // WORLD SPACE SURFACE AREA
    // ================================================

    function getWorldSurfaceArea(mesh: THREE.Mesh) {
      const geometry = mesh.geometry;

      const position = geometry.attributes.position;
      const index = geometry.index;

      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();

      const edge1 = new THREE.Vector3();
      const edge2 = new THREE.Vector3();

      const count = index
        ? index.count
        : position.count;

      let area = 0;

      for (let i = 0; i + 2 < count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;

        a.fromBufferAttribute(position, ia);
        b.fromBufferAttribute(position, ib);
        c.fromBufferAttribute(position, ic);

        a.applyMatrix4(mesh.matrixWorld);
        b.applyMatrix4(mesh.matrixWorld);
        c.applyMatrix4(mesh.matrixWorld);

        edge1.subVectors(b, a);
        edge2.subVectors(c, a);

        area += edge1.cross(edge2).length() * 0.5;
      }

      return area;
    }

    // ================================================
    // BUILD PARTICLES FROM GLB
    // ================================================

    function createParticles(root: THREE.Object3D) {
      const meshes: THREE.Mesh[] = [];

      root.updateMatrixWorld(true);

      root.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          object.geometry?.attributes.position
        ) {
          meshes.push(object);
        }
      });

      if (!meshes.length) {
        console.error("No mesh geometry found in drum_kit.glb");
        return;
      }

      const sampleMeshes: SampleMesh[] = [];

      let totalArea = 0;

      // Build surface samplers for all model meshes.
      for (const mesh of meshes) {
        const area = getWorldSurfaceArea(mesh);

        if (area <= 0) continue;

        const sampler = new MeshSurfaceSampler(mesh).build();

        const material = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;

        const color =
          material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshPhongMaterial
            ? material.color.clone()
            : new THREE.Color(0xffffff);

        sampleMeshes.push({
          mesh,
          sampler,
          area,
          color,
        });

        totalArea += area;
      }

      if (!sampleMeshes.length || totalArea <= 0) {
        console.error("Could not sample drum kit geometry.");
        return;
      }

      // Attribute arrays.
      const positions = new Float32Array(
        PARTICLE_COUNT * 3
      );

      const homes = new Float32Array(
        PARTICLE_COUNT * 3
      );

      const randoms = new Float32Array(
        PARTICLE_COUNT * 3
      );

      const colors = new Float32Array(
        PARTICLE_COUNT * 3
      );

      const energies = new Float32Array(
        PARTICLE_COUNT
      );

      const point = new THREE.Vector3();
      const normal = new THREE.Vector3();

      let particleIndex = 0;

      // Distribute particles according to actual surface area.
      for (
        let meshIndex = 0;
        meshIndex < sampleMeshes.length;
        meshIndex++
      ) {
        const item = sampleMeshes[meshIndex];

        const remaining =
          PARTICLE_COUNT - particleIndex;

        const count =
          meshIndex === sampleMeshes.length - 1
            ? remaining
            : Math.min(
                remaining,
                Math.round(
                  PARTICLE_COUNT *
                  (item.area / totalArea)
                )
              );

        for (let i = 0; i < count; i++) {
          if (particleIndex >= PARTICLE_COUNT) break;

          item.sampler.sample(point, normal);

          point.applyMatrix4(item.mesh.matrixWorld);

          const offset = particleIndex * 3;

          // Original position.
          homes[offset] = point.x;
          homes[offset + 1] = point.y;
          homes[offset + 2] = point.z;

          positions[offset] = point.x;
          positions[offset + 1] = point.y;
          positions[offset + 2] = point.z;

          // Deterministic random direction.
          randoms[offset] = Math.random();
          randoms[offset + 1] = Math.random();
          randoms[offset + 2] = Math.random();

          // Mostly white particles with subtle
          // metallic gold and cyan variations.
          const variation = 0.85 + Math.random() * 0.3;

          const tint = Math.random();

          const gold = new THREE.Color(1, 0.78, 0.48);
          const cyan = new THREE.Color(0.55, 0.9, 1);

          const accent = gold.lerp(cyan, tint);

          const finalColor = item.color
            .clone()
            .lerp(new THREE.Color(1, 1, 1), 0.78)
            .multiplyScalar(variation)
            .lerp(accent, Math.random() * 0.13);

          colors[offset] = finalColor.r;
          colors[offset + 1] = finalColor.g;
          colors[offset + 2] = finalColor.b;

          particleIndex++;
        }
      }

      // Create BufferGeometry.
      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      geometry.setAttribute(
        "aHome",
        new THREE.BufferAttribute(homes, 3)
      );

      geometry.setAttribute(
        "aRandom",
        new THREE.BufferAttribute(randoms, 3)
      );

      geometry.setAttribute(
        "aColor",
        new THREE.BufferAttribute(colors, 3)
      );

      geometry.setAttribute(
        "aEnergy",
        new THREE.BufferAttribute(energies, 1)
      );

      energyAttribute = geometry.getAttribute(
        "aEnergy"
      ) as THREE.BufferAttribute;

      homesAttribute = geometry.getAttribute(
        "aHome"
      ) as THREE.BufferAttribute;

      geometry.computeBoundingSphere();

      // Custom GPU particle shader.
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      particleCloud = new THREE.Points(
        geometry,
        material
      );

      scene.add(particleCloud);

      // Original solid model is never rendered.
      root.visible = false;

      console.log(
        `Drum kit loaded: ${meshes.length} meshes, ${PARTICLE_COUNT.toLocaleString()} particles`
      );
    }

    // ================================================
    // LOAD ACTUAL DRUM KIT
    // ================================================

    const loader = new GLTFLoader();

    loader.load(
      MODEL_PATH,
      (gltf) => {
        if (disposed) return;

        const drumKit = gltf.scene;

        normalizeModel(drumKit);

        scene.add(drumKit);

        createParticles(drumKit);
      },
      undefined,
      (error) => {
        console.error(
          "Failed to load drum_kit.glb:",
          error
        );
      }
    );

    // ================================================
    // MOUSE INTERACTION (screen space)
    // ================================================

    const pointer = new THREE.Vector2(0, 0);

    function onPointerEnter() {
      mouseActiveTarget = reduceMotion ? 0 : 1;
    }

    function onPointerLeave() {
      scatterTarget = 0;
      mouseActiveTarget = 0;
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();

      pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

      pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    canvas.addEventListener(
      "pointerenter",
      onPointerEnter
    );

    canvas.addEventListener(
      "pointerleave",
      onPointerLeave
    );

    canvas.addEventListener(
      "pointermove",
      onPointerMove
    );

    // Hard-lock zoom. Stop wheel events before OrbitControls sees
    // them (page still scrolls), and block browser pinch-zoom over
    // the canvas so scrolling never scales the kit.
    function blockWheel(event: WheelEvent) {
      event.stopPropagation();

      if (event.ctrlKey) {
        event.preventDefault();
      }
    }

    stage.addEventListener("wheel", blockWheel, {
      capture: true,
      passive: false,
    });

    // ================================================
    // RESIZE
    // ================================================

    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;

      if (!width || !height) return;

      viewWidth = width;
      viewHeight = height;

      camera.aspect = width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);

    observer.observe(stage);

    resize();

    // ================================================
    // ANIMATION
    // ================================================

    let previousTime = 0;

    // Rise near the cursor quickly, but decay slowly so vibration
    // lingers and particles ease back to their home position.
    const RISE_TAU = 0.05;
    const FALL_TAU = 0.4;

    // Reused scratch vector so the loop allocates nothing.
    const projectedHome = new THREE.Vector3();

    function updateVibrationEnergy(delta: number) {
      if (!energyAttribute || !homesAttribute) return;

      const energies =
        energyAttribute.array as Float32Array;

      const homes =
        homesAttribute.array as Float32Array;

      const active = mouseActiveTarget > 0;

      const riseK = 1 - Math.exp(-delta / RISE_TAU);
      const fallK = 1 - Math.exp(-delta / FALL_TAU);

      // Make sure projection uses the current camera transform.
      camera.updateMatrixWorld();

      const width = viewWidth;
      const height = viewHeight;

      // Mouse position in pixels (NDC -> pixels).
      const mouseX = (pointer.x * 0.5 + 0.5) * width;
      const mouseY = (pointer.y * 0.5 + 0.5) * height;

      const invRadius =
        MOUSE_RADIUS_PX > 0 ? 1 / MOUSE_RADIUS_PX : 0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let target = 0;

        if (active) {
          const offset = i * 3;

          projectedHome.set(
            homes[offset],
            homes[offset + 1],
            homes[offset + 2]
          );

          // Project the world-space home position to NDC.
          projectedHome.project(camera);

          const screenX =
            (projectedHome.x * 0.5 + 0.5) * width;

          const screenY =
            (projectedHome.y * 0.5 + 0.5) * height;

          const dx = screenX - mouseX;
          const dy = screenY - mouseY;

          // 2D pixel distance, independent of particle depth.
          const distance =
            Math.sqrt(dx * dx + dy * dy) * invRadius;

          const t = Math.min(Math.max(distance, 0), 1);

          target = 1 - t * t * (3 - 2 * t);
        }

        const current = energies[i];

        const k = target > current ? riseK : fallK;

        energies[i] = current + (target - current) * k;
      }

      energyAttribute.needsUpdate = true;
    }

    function animate(time: number) {
      if (disposed) return;

      const delta = previousTime
        ? Math.min((time - previousTime) / 1000, 0.05)
        : 0;

      previousTime = time;

      uniforms.uTime.value = time * 0.001;

      // Smooth particle scatter transitions.
      const transition = 1 - Math.exp(-delta * 3);

      uniforms.uScatter.value +=
        (scatterTarget - uniforms.uScatter.value) *
        transition;

      // Keep camera controls responsive, then project with the
      // freshly-updated camera matrices.
      if (!reduceMotion) {
        controls.update();
      }

      updateVibrationEnergy(delta);

      renderer.render(scene, camera);

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    animate(0);

    // ================================================
    // CLEANUP
    // ================================================

    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);

      observer.disconnect();

      controls.dispose();

      canvas.removeEventListener(
        "pointerenter",
        onPointerEnter
      );

      canvas.removeEventListener(
        "pointerleave",
        onPointerLeave
      );

      canvas.removeEventListener(
        "pointermove",
        onPointerMove
      );

      stage.removeEventListener("wheel", blockWheel, {
        capture: true,
      });

      if (particleCloud) {
        particleCloud.geometry.dispose();

        (
          particleCloud.material as THREE.Material
        ).dispose();
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => {
            material.dispose();
          });
        }
      });

      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="drum-stage"
      role="img"
      aria-label="Interactive 3D drum kit formed from particles. Hover to ripple and drag to rotate."
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
      />
    </div>
  );
}
