import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock window.matchMedia for jsdom
window.matchMedia = window.matchMedia || function () {
  return {
    matches: false,
    addListener: vi.fn,
    removeListener: vi.fn,
    dispatchEvent: vi.fn,
  };
};

// Mock Three.js entirely to avoid WebGL context error in jsdom
vi.mock("three", () => {
  const mockContext = {
    canvas: {},
    deleteShader: vi.fn,
    deleteProgram: vi.fn,
    createShader: vi.fn,
    shaderSource: vi.fn,
    compileShader: vi.fn,
    attachShader: vi.fn,
    bindAttribLocation: vi.fn,
    bindTexture: vi.fn,
    texImage2D: vi.fn,
    TexImage2D: vi.fn,
    drawArrays: vi.fn,
    DrawArrays: vi.fn,
    createFramebuffer: vi.fn,
    bindFramebuffer: vi.fn,
    framebufferTexture2D: vi.fn,
    checkFramebufferStatus: vi.fn,
    createRenderbuffer: vi.fn,
    renderbufferStorage: vi.fn,
    framebufferRenderbuffer: vi.fn,
    generateMipmap: vi.fn,
    clearColor: vi.fn,
    clear: vi.fn,
    enable: vi.fn,
    disable: vi.fn,
    blendFunc: vi.fn,
    blendFuncSeparate: vi.fn,
    drawBuffer: vi.fn,
    colorMask: vi.fn,
    viewport: vi.fn,
    scissor: vi.fn,
    depthFunc: vi.fn,
    depthMask: vi.fn,
    getParameter: vi.fn,
    readPixels: vi.fn,
    finish: vi.fn,
    flush: vi.fn,
  };

  const mockRenderer = class {
    constructor(options: any = {}) {
      this.domElement = options.canvas || document.createElement("canvas");
      this.context = mockContext;
      this.alpha = options.alpha ?? true;
      this.antialias = options.antialias ?? true;
      this.pixelRatio = 1;
      this.autoClear = true;
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    setClearColor() {}
  };

  const Color = class {
    constructor(value: number) {
      this.r = ((value >> 16) & 255) / 255;
      this.g = ((value >> 8) & 255) / 255;
      this.b = (value & 255) / 255;
    }
  };

  const Fog = class {
    constructor() {}
  };

  const mockVector3 = class {
    constructor(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new mockVector3(this.x, this.y, this.z);
    }
  };

  const mockRendererWithColor = class {
    constructor(options: any = {}) {
      this.domElement = options.canvas || document.createElement("canvas");
      this.context = mockContext;
      this.alpha = options.alpha ?? true;
      this.antialias = options.antialias ?? true;
      this.pixelRatio = 1;
      this.autoClear = true;
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    setClearColor() {}
  };

  return {
    WebGLRenderer: mockRendererWithColor,
    Scene: class {
      constructor() {
        this.background = new Color(0x000000);
        this.fog = new Fog();
      }
    },
    PerspectiveCamera: class {
      constructor(fov: number, aspect: number, near: number, far: number) {
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        this.position = new mockVector3(0, 1.7, 10.5);
      }
    },
    Vector3: class {
      constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    AmbientLight: class {
      constructor(color: number, intensity: number) {
        this.color = new Color(color);
        this.intensity = intensity;
      }
    },
    DirectionalLight: class {
      constructor(color: number, intensity: number) {
        this.color = new Color(color);
        this.intensity = intensity;
      }
    },
    CubeTextureLoader: class {
      load() {
        return { textures: [] };
      }
    },
    FileLoader: class {
      load() {
        return { default: null };
      }
    },
    TextureLoader: class {
      load() {
        return null;
      }
    },
  };
});

afterEach(() => cleanup());
