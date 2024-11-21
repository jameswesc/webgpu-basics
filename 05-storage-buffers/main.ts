import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { initWebGPU } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    const { device, context, canvas, format } = await initWebGPU();

    const module = device.createShaderModule({
        label: "05 Storage Buffers - Shader Module",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "05 Storage Buffers - Render Pipeline",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const numberOfObjects = 200;

    const staticUnitSize =
        4 * 4 + // color: vec4f (4 x float32 = 4 x 4 bytes)
        2 * 4 + // offset: vec2f (2 x float32 = 2 x 4 bytes)
        2 * 4; // padding: minimum size of 32 bytes (just in this case?)
    const dynamicUnitSize = 2 * 4; // scale: vec2f (2 x float32 = 2 x 4 bytes)

    const staticStorageBufferSize = staticUnitSize * numberOfObjects;
    const dynamicStorageBufferSize = dynamicUnitSize * numberOfObjects;

    const staticStorageBuffer = device.createBuffer({
        label: "05 Storage Buffers - Static Storage Buffer",
        size: staticStorageBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const dynamicStorageBuffer = device.createBuffer({
        label: "05 Storage Buffers - Dynamic Storage Buffer",
        size: dynamicStorageBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const offsets = {
        color: 0,
        offset: 4,
        scale: 0,
    };

    const scales = new Array(numberOfObjects)
        .fill(0)
        .map((_) => Math.random() * 0.75 + 0.1);

    // Static Storage Buffer Values
    {
        const staticStorageValues = new Float32Array(
            staticStorageBufferSize / 4,
        );
        for (let i = 0; i < numberOfObjects; i++) {
            const staticOffset = i * (staticUnitSize / 4);
            staticStorageValues.set(
                [Math.random(), Math.random(), Math.random(), 1],
                staticOffset + offsets.color,
            );
            staticStorageValues.set(
                [Math.random() * 2 - 1, Math.random() * 2 - 1],
                staticOffset + offsets.offset,
            );
        }
        device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
    }

    const dynamicStorageValues = new Float32Array(dynamicStorageBufferSize / 4);

    // Vertex data in storage buffer
    const { vertexData, numberOfVerticies } = createCircleVertices({
        radius: 0.25,
        innerRadius: 0.1,
    });
    const vertexStorageBuffer = device.createBuffer({
        label: "05 Storage Buffers - Vertex Storage Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);

    const bindGroup = device.createBindGroup({
        label: "05 Storage Buffers - Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: staticStorageBuffer } },
            { binding: 1, resource: { buffer: dynamicStorageBuffer } },
            { binding: 2, resource: { buffer: vertexStorageBuffer } },
        ],
    });

    function render() {
        const encoder = device.createCommandEncoder({
            label: "05 Storage Buffers - Command Encoder",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
        };
        const renderPass = encoder.beginRenderPass({
            label: "05 Storage Buffers- Render Pass",
            colorAttachments: [colorAttachment],
        });
        renderPass.setPipeline(pipeline);

        // Update the dynamic storage values

        const aspect = canvas.width / canvas.height;
        for (let i = 0; i < numberOfObjects; i++) {
            const dynamicOffset = i * (dynamicUnitSize / 4);
            dynamicStorageValues.set(
                [scales[i] / aspect, scales[i]],
                dynamicOffset + offsets.scale,
            );
        }
        device.queue.writeBuffer(dynamicStorageBuffer, 0, dynamicStorageValues);

        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(numberOfVerticies, numberOfObjects);
        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render, device.limits.maxTextureDimension2D);
}

main();

function createCircleVertices({
    radius = 1,
    numSubdivisions = 24,
    innerRadius = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
} = {}) {
    // 2 triangles per subdivision, 3 verts per tri.
    const numberOfVerticies = numSubdivisions * 3 * 2;
    // 2 values (x, y) per vert
    const vertexData = new Float32Array(numberOfVerticies * 2);

    let offset = 0;
    const addVertex = (x: number, y: number) => {
        vertexData[offset++] = x;
        vertexData[offset++] = y;
    };

    // 2 triangles per subdivision
    //
    // 0--1 4
    // | / /|
    // |/ / |
    // 2 3--5
    for (let i = 0; i < numSubdivisions; ++i) {
        const angle1 =
            startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions;
        const angle2 =
            startAngle + ((i + 1) * (endAngle - startAngle)) / numSubdivisions;

        const c1 = Math.cos(angle1);
        const s1 = Math.sin(angle1);
        const c2 = Math.cos(angle2);
        const s2 = Math.sin(angle2);

        // first triangle
        addVertex(c1 * radius, s1 * radius);
        addVertex(c2 * radius, s2 * radius);
        addVertex(c1 * innerRadius, s1 * innerRadius);

        // second triangle
        addVertex(c1 * innerRadius, s1 * innerRadius);
        addVertex(c2 * radius, s2 * radius);
        addVertex(c2 * innerRadius, s2 * innerRadius);
    }

    return {
        vertexData,
        numberOfVerticies,
    };
}
