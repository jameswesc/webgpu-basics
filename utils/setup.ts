export async function getAdapter() {
    const adapter = await navigator.gpu?.requestAdapter();

    if (!adapter) {
        throw new Error("WebGPU not supported. Could not get adapter");
    }

    return adapter;
}

export async function getDevice(adapter: GPUAdapter) {
    const device = await adapter.requestDevice();

    if (!device) {
        throw new Error("WebGPU not supported. Could not get device");
    }

    return device;
}

export function getCanvas(id?: string) {
    const canvas = document.getElementById(id ?? "canvas");

    if (!canvas) {
        throw new Error("Could not find canvas element");
    }

    if (canvas.tagName.toLowerCase() !== "canvas") {
        throw new Error("Element is not a canvas element");
    }

    return canvas as HTMLCanvasElement;
}

export function getContext(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("webgpu");

    if (!context) {
        throw new Error("Could not get webgpu context");
    }

    return context;
}
