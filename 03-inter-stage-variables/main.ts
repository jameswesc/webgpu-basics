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
    });

    // shader module
    const module = device.createShaderModule({
        label: "03 Inter Stage Variables - Shader module",
        code: shaderCode,
    });

    // pipeline
    const pipeline = device.createRenderPipeline({
        label: "03 Inter Stage Variables - Render pipeline",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    function render() {
        const encoder = device.createCommandEncoder({
            label: "03 Inter Stage Variables - Command encoder",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
            storeOp: "store",
            loadOp: "clear",
        };
        const renderPass = encoder.beginRenderPass({
            label: "03 Inter Stage Variables - Render pass",
            colorAttachments: [colorAttachment],
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(3);
        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render, device.limits.maxTextureDimension2D);
}

main();
