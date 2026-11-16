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
    domElement: any;
    context: any;
    alpha: boolean;
    antialias: boolean;
    pixelRatio: number;
    autoClear: boolean;
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
    WebGLRenderer: mockRenderer,
  };
});

afterEach(() => cleanup());