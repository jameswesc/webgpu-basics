import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { initWebGPU } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    const { device, context, canvas, format } = await initWebGPU();

    const module = device.createShaderModule({
        label: "06 Vertex Buffers - Shader Module",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "06 Vertex Buffers - Render Pipeline",
        layout: "auto",
        vertex: {
            module,
            buffers: [
                // Vertex Position
                {
                    arrayStride: 3 * 4, // 2 x f32 (position), 1 x 4(u8norm x 4) (perVertexColor)
                    stepMode: "vertex",
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" },
                        { shaderLocation: 4, offset: 8, format: "unorm8x4" },
                    ],
                },
                // Color & Offset (previously static storage buffer)
                {
                    arrayStride: 3 * 4, // 1 x 4(u8norm x 4) (color) and 2 x f32 (offset)
                    stepMode: "instance",
                    attributes: [
                        // color
                        { shaderLocation: 1, offset: 0, format: "unorm8x4" },
                        // offset
                        { shaderLocation: 2, offset: 4, format: "float32x2" },
                    ],
                },
                // Scale (previously dynamic storage buffer)
                {
                    arrayStride: 2 * 4, // 2 x f32 (scale)
                    stepMode: "instance",
                    attributes: [
                        { shaderLocation: 3, offset: 0, format: "float32x2" },
                    ],
                },
            ],
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const numberOfObjects = 200;

    const staticUnitSize =
        4 + // color: u8normx4 (1 byte) mapped to vec4f shader side
        2 * 4; // offset: vec2f (2 x float32 = 2 x 4 bytes)

    const dynamicUnitSize = 2 * 4; // scale: vec2f (2 x float32 = 2 x 4 bytes)

    const staticVertexBufferSize = staticUnitSize * numberOfObjects;
    const dynamicVertexBufferSize = dynamicUnitSize * numberOfObjects;

    const staticVertexBuffer = device.createBuffer({
        label: "06 Vertex Buffers - Static Storage Buffer",
        size: staticVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const dynamicVertexBuffer = device.createBuffer({
        label: "06 Vertex Buffers - Dynamic Storage Buffer",
        size: dynamicVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const offsets = {
        color: 0,
        offset: 1,
        scale: 0,
    };

    const scales = new Array(numberOfObjects)
        .fill(0)
        .map((_) => Math.random() * 0.75 + 0.1);

    // Static Storage Buffer Values
    {
        const staticVertexValues = new Float32Array(staticVertexBufferSize / 4);
        const staticVertexColorValues = new Uint8Array(
            staticVertexValues.buffer,
        );

        for (let i = 0; i < numberOfObjects; i++) {
            const staticOffset = i * (staticUnitSize / 4);
            const colorOffset = staticOffset * 4;

            staticVertexColorValues.set(
                [
                    Math.random() * 255,
                    Math.random() * 255,
                    Math.random() * 255,
                    255,
                ],
                colorOffset + offsets.color,
            );
            staticVertexValues.set(
                [Math.random() * 2 - 1, Math.random() * 2 - 1],
                staticOffset + offsets.offset,
            );
        }
        device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValues);
    }

    const dynamicVertexValues = new Float32Array(dynamicVertexBufferSize / 4);

    // Vertex data in storage buffer
    const { vertexData, numVertices, indexData } = createCircleVertices({
        radius: 0.25,
        innerRadius: 0.1,
    });

    const vertexBuffer = device.createBuffer({
        label: "06 Vertex Buffers - Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = device.createBuffer({
        label: "06 Vertex Buffers - Index Buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indexData);

    function render() {
        const encoder = device.createCommandEncoder({
            label: "06 Vertex Buffers - Command Encoder",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
        };
        const renderPass = encoder.beginRenderPass({
            label: "06 Vertex Buffers- Render Pass",
            colorAttachments: [colorAttachment],
        });
        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint32");
        renderPass.setVertexBuffer(1, staticVertexBuffer);
        renderPass.setVertexBuffer(2, dynamicVertexBuffer);

        // Update the dynamic storage values
        const aspect = canvas.width / canvas.height;
        for (let i = 0; i < numberOfObjects; i++) {
            const dynamicOffset = i * (dynamicUnitSize / 4);
            dynamicVertexValues.set(
                [scales[i] / aspect, scales[i]],
                dynamicOffset + offsets.scale,
            );
        }
        device.queue.writeBuffer(dynamicVertexBuffer, 0, dynamicVertexValues);

        // renderPass.setBindGroup(0, bindGroup);
        renderPass.drawIndexed(numVertices, numberOfObjects);
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
    // 2 vertices at each subdivision, + 1 to wrap around the circle.
    const numVertices = (numSubdivisions + 1) * 2;
    // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb)
    // The 32-bit color value will be written/read as 4 8-bit values
    const vertexData = new Float32Array(numVertices * (2 + 1));
    const colorData = new Uint8Array(vertexData.buffer);

    let offset = 0;
    let colorOffset = 8;
    const addVertex = (
        x: number,
        y: number,
        r: number,
        g: number,
        b: number,
    ) => {
        vertexData[offset++] = x;
        vertexData[offset++] = y;
        offset += 1; // skip the color
        colorData[colorOffset++] = r * 255;
        colorData[colorOffset++] = g * 255;
        colorData[colorOffset++] = b * 255;
        colorOffset += 9; // skip extra byte and the position
    };
    const innerColor: [number, number, number] = [1, 1, 1];
    const outerColor: [number, number, number] = [0.1, 0.1, 0.1];

    // 2 triangles per subdivision
    //
    // 0  2  4  6  8 ...
    //
    // 1  3  5  7  9 ...
    for (let i = 0; i <= numSubdivisions; ++i) {
        const angle =
            startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions;

        const c1 = Math.cos(angle);
        const s1 = Math.sin(angle);

        addVertex(c1 * radius, s1 * radius, ...outerColor);
        addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
    }

    const indexData = new Uint32Array(numSubdivisions * 6);
    let ndx = 0;

    // 1st tri  2nd tri  3rd tri  4th tri
    // 0 1 2    2 1 3    2 3 4    4 3 5
    //
    // 0--2        2     2--4        4  .....
    // | /        /|     | /        /|
    // |/        / |     |/        / |
    // 1        1--3     3        3--5  .....
    for (let i = 0; i < numSubdivisions; ++i) {
        const ndxOffset = i * 2;

        // first triangle
        indexData[ndx++] = ndxOffset;
        indexData[ndx++] = ndxOffset + 1;
        indexData[ndx++] = ndxOffset + 2;

        // second triangle
        indexData[ndx++] = ndxOffset + 2;
        indexData[ndx++] = ndxOffset + 1;
        indexData[ndx++] = ndxOffset + 3;
    }

    return {
        vertexData,
        indexData,
        numVertices: indexData.length,
    };
}
