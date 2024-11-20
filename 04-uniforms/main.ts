import "../style.css";
import shaderCode from "./shader.wgsl?raw";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";

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

    const module = device.createShaderModule({
        label: "04 Uniforms - Shader Module",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "04 Uniforms - Render Pipeline",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const uniformBufferSize =
        4 * 4 + // vec4f (4 x float32 = 4 x 4 bytes)
        2 * 4 + // vec2f (2 x float32 = 2 x 4 bytes)
        2 * 4; // vec2f (2 x float32 = 2 x 4 bytes)

    const kOffsets = {
        color: 0,
        scale: 4,
        offset: 6,
    };

    const numberOfObjects = 100;
    const objectData: Array<{
        uniformBuffer: GPUBuffer;
        uniformValues: Float32Array;
        bindGroup: GPUBindGroup;
    }> = [];

    for (let i = 0; i < numberOfObjects; i++) {
        const uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // each element of a float32 array is 4 bytes, so divide by 4
        const uniformValues = new Float32Array(uniformBufferSize / 4);

        uniformValues.set(
            [Math.random(), Math.random(), Math.random(), 1],
            kOffsets.color,
        );
        uniformValues.set([Math.random(), Math.random()], kOffsets.scale);
        uniformValues.set(
            [Math.random() * 2 - 1, Math.random() * 2 - 1],
            kOffsets.offset,
        );

        // can write buffer here or in render function loop
        // here you would write buffers that aren't changing
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

        const bindGroup = device.createBindGroup({
            label: "04 Uniforms - Uniform Bind Group - Object " + i,
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        objectData.push({ uniformBuffer, uniformValues, bindGroup });
    }

    function render() {
        const encoder = device.createCommandEncoder({
            label: "04 Uniforms - Command Encoder",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
        };
        const renderPass = encoder.beginRenderPass({
            label: "04 Uniforms - Render Pass",
            colorAttachments: [colorAttachment],
        });

        renderPass.setPipeline(pipeline);

        for (const { uniformBuffer, uniformValues, bindGroup } of objectData) {
            // and here you would write buffers that are changing
            device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(3);
        }

        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render, device.limits.maxTextureDimension2D);
}

main();
