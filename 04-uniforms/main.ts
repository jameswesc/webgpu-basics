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

    // For the uniforms that don't change
    const staticUniformBufferSize =
        4 * 4 + // color: vec4f (4 x float32 = 4 x 4 bytes)
        2 * 4 + // offset: vec2f (2 x float32 = 2 x 4 bytes)
        2 * 4; // padding: minimum size of 32 bytes (just in this case?)

    // For the uniforms that do change
    const uniformBufferSize = 2 * 4; // scale: vec2f (2 x float32 = 2 x 4 bytes)

    const kOffsets = {
        color: 0,
        offset: 4,
        scale: 0,
    };

    const numberOfObjects = 100;
    const objectData: Array<{
        uniformBuffer: GPUBuffer;
        uniformValues: Float32Array;
        bindGroup: GPUBindGroup;
        scale: number;
    }> = [];

    for (let i = 0; i < numberOfObjects; i++) {
        const staticUniformBuffer = device.createBuffer({
            label: "04 Uniforms - Static Uniform Buffer - Object: " + i,
            size: staticUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Set the static uniforms only once
        {
            const staticUniformValues = new Float32Array(
                staticUniformBufferSize / 4,
            );
            staticUniformValues.set(
                [Math.random(), Math.random(), Math.random(), 1],
                kOffsets.color,
            );
            staticUniformValues.set(
                [Math.random() * 2 - 1, Math.random() * 2 - 1],
                kOffsets.offset,
            );
            device.queue.writeBuffer(
                staticUniformBuffer,
                0,
                staticUniformValues,
            );
        }

        const uniformBuffer = device.createBuffer({
            label: "04 Uniforms - Changing Uniform Buffer - Object: " + i,
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const uniformValues = new Float32Array(uniformBufferSize / 4);

        const scale = Math.random() * 0.5 + 0.1;

        const bindGroup = device.createBindGroup({
            label: "04 Uniforms - Uniform Bind Group 0 - Object " + i,
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: staticUniformBuffer } },
                { binding: 1, resource: { buffer: uniformBuffer } },
            ],
        });

        objectData.push({ uniformBuffer, uniformValues, bindGroup, scale });
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

        const aspect = canvas.width / canvas.height;

        for (const {
            uniformBuffer,
            uniformValues,
            bindGroup,
            scale,
        } of objectData) {
            uniformValues.set([scale / aspect, scale], kOffsets.scale);
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
