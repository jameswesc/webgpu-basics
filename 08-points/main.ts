import { rand } from "../utils/rand";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { initWebGPU } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

export async function main() {
    const { device, canvas, context, format } = await initWebGPU();

    const module = device.createShaderModule({
        label: "53 Point - 1 pixel points shader",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "53 Points - 1 pixel points pipeline",
        layout: "auto",
        vertex: {
            module,
            buffers: [
                {
                    arrayStride: 3 * 4, // 3 * 4 bytes (3 x f32)
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" }, // position
                        { shaderLocation: 1, offset: 8, format: "float32" }, // size
                    ],
                    stepMode: "instance",
                },
            ],
        },
        fragment: {
            module,
            targets: [{ format }],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    // Vertex

    const numPoints = 1000;
    const vertexData = new Float32Array(numPoints * 3);
    for (let i = 0; i < numPoints; i++) {
        const offset = i * 3;
        vertexData[offset + 0] = rand(-1, 1);
        vertexData[offset + 1] = rand(-1, 1);
        vertexData[offset + 2] = rand(2, 10);
    }

    const vertexBuffer = device.createBuffer({
        label: "53 Points - Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    // Uniform

    const uniformBufferSize = 2 * 4; // resolution: 2 x f32
    const uniformBuffer = device.createBuffer({
        label: "53 Points - Uniform Buffer",
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformBufferValues = new Float32Array(2);

    const uniformBindGroup = device.createBindGroup({
        label: "53 Points - Uniform Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // Render Function

    function render() {
        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
        };
        const renderPass = encoder.beginRenderPass({
            label: "53 Points - 1 pixel point render pass",
            colorAttachments: [colorAttachment],
        });

        // Update Uniform Values
        uniformBufferValues.set([canvas.width, canvas.height], 0);
        device.queue.writeBuffer(uniformBuffer, 0, uniformBufferValues);
        renderPass.setBindGroup(0, uniformBindGroup);

        // Render Pass
        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.draw(6, numPoints);
        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render);
}

main();
