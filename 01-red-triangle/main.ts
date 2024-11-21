import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    // Grab basics
    const adapter = await getAdapter();
    const device = await getDevice(adapter);
    const canvas = getCanvas();
    const context = getContext(canvas);

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
    });

    const module = device.createShaderModule({
        label: "Module 01 - Red triangle",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "Pipeline 01 - Red triangle",
        layout: "auto",
        vertex: {
            entryPoint: "vertex_shader",
            module,
        },
        fragment: {
            entryPoint: "fragment_shader",
            module,
            targets: [{ format }],
        },
    });

    function render() {
        const encorder = device.createCommandEncoder({
            label: "Command encoder 01 - Red triangle",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            clearValue: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
            loadOp: "clear",
            storeOp: "store",
        };
        const renderPassDescriptor: GPURenderPassDescriptor = {
            label: "Render pass 01 - Red triangle",
            colorAttachments: [colorAttachment],
        };

        const renderPass = encorder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(pipeline);
        renderPass.draw(3);
        renderPass.end();

        const commandBuffer = encorder.finish();

        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render, device.limits.maxTextureDimension2D);
}

main();
