import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    const adapter = await getAdapter();
    const device = await getDevice(adapter);

    const canvas = getCanvas();
    const context = getContext(canvas);

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: "premultiplied",
    });

    const module = device.createShaderModule({
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    function getRenderPassDescriptor(
        view: GPUTextureView,
        clearValue = [0, 0, 0, 0],
    ): GPURenderPassDescriptor {
        return {
            label: "our basic canvas renderPass",
            colorAttachments: [
                {
                    view,
                    clearValue,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };
    }

    function render() {
        const encoder = device.createCommandEncoder({ label: "clear encoder" });
        const canvasTexture = context.getCurrentTexture();

        const renderPassDescriptor = getRenderPassDescriptor(
            canvasTexture.createView(),
        );

        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render);
    // pane.on("change", () => void render());
}

main();
