import { Pane } from "tweakpane";
import { rand } from "../utils/rand";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

class RollingAverage {
    #total = 0;
    #samples: number[] = [];
    #cursor = 0;
    #numSamples;
    constructor(numSamples = 30) {
        this.#numSamples = numSamples;
    }
    addSample(v: number) {
        this.#total += v - (this.#samples[this.#cursor] || 0);
        this.#samples[this.#cursor] = v;
        this.#cursor = (this.#cursor + 1) % this.#numSamples;
    }
    get() {
        return this.#total / this.#samples.length;
    }
}

async function main() {
    const adapter = await getAdapter();

    const canTimestamps = adapter.features.has("timestamp-query");

    const device = await getDevice(adapter, {
        requiredFeatures: canTimestamps ? ["timestamp-query"] : [],
    });
    const canvas = getCanvas();
    const context = getContext(canvas);

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
    });

    const module = device.createShaderModule({
        label: "11 Timing Performance - Shader Module",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "11 Timing Performance - Render Pipeline",
        layout: "auto",
        vertex: {
            module,
            buffers: [
                // Vertex Position
                {
                    arrayStride: 3 * 4, // 2 x f32 (position), 1 x 4(u8norm x 4) (perVertexColor)
                    stepMode: "vertex",
                    attributes: [
                        // position
                        { shaderLocation: 0, offset: 0, format: "float32x2" },
                        // perVertexColor
                        { shaderLocation: 4, offset: 8, format: "unorm8x4" },
                    ],
                },
                // Color & Offset (previously static storage buffer)
                {
                    arrayStride: 4, // 1 x 4 (u8norm) (color)
                    stepMode: "instance",
                    attributes: [
                        // color
                        { shaderLocation: 1, offset: 0, format: "unorm8x4" },
                    ],
                },
                // Scale (previously dynamic storage buffer)
                {
                    arrayStride: 4 * 4, // 2 x f32 (scale) + 2 x f32 (offset)
                    stepMode: "instance",
                    attributes: [
                        // offset
                        { shaderLocation: 2, offset: 0, format: "float32x2" },
                        // scale
                        { shaderLocation: 3, offset: 8, format: "float32x2" },
                    ],
                },
            ],
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const totalPossibleObjects = 10_000;

    const settings = {
        numObjects: 1_000,
    };

    const pane = new Pane();

    pane.addBinding(settings, "numObjects", {
        min: 1,
        max: totalPossibleObjects,
        step: 1,
    });

    const objectInfos: {
        scale: number;
        offset: [number, number];
        velocity: [number, number];
    }[] = [];

    const staticUnitSize = 4; // color: u8normx4 (1 byte) mapped to vec4f shader side

    const dynamicUnitSize =
        2 * 4 + // scale: vec2f (2 x float32 = 2 x 4 bytes)
        2 * 4; // offset: vec2f (2 x float32 = 2 x 4 bytes)

    const staticVertexBufferSize = staticUnitSize * totalPossibleObjects;
    const dynamicVertexBufferSize = dynamicUnitSize * totalPossibleObjects;

    const staticVertexBuffer = device.createBuffer({
        label: "11 Timing Performance - Static Storage Buffer",
        size: staticVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const dynamicVertexBuffer = device.createBuffer({
        label: "11 Timing Performance - Dynamic Storage Buffer",
        size: dynamicVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const offsets = {
        color: 0,
        offset: 0,
        scale: 2,
    };

    // Static Storage Buffer Values
    {
        const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);

        for (let i = 0; i < totalPossibleObjects; i++) {
            const staticOffset = i * staticUnitSize;

            staticVertexValuesU8.set(
                [
                    Math.random() * 255,
                    Math.random() * 255,
                    Math.random() * 255,
                    255,
                ],
                staticOffset + offsets.color,
            );

            objectInfos.push({
                scale: rand(0.2, 0.5),
                offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
                velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
            });
        }
        device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesU8);
    }

    const dynamicVertexValues = new Float32Array(dynamicVertexBufferSize / 4);

    // Vertex data in storage buffer
    const { vertexData, numVertices, indexData } = createCircleVertices({
        radius: 0.25,
        innerRadius: 0.1,
    });

    const vertexBuffer = device.createBuffer({
        label: "11 Timing Performance - Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = device.createBuffer({
        label: "11 Timing Performance - Index Buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indexData);

    function euclideanModulo(x: number, a: number) {
        return x - a * Math.floor(x / a);
    }

    let then = 0;

    const infoElem = <HTMLPreElement>document.querySelector("#info");

    const querySet = device.createQuerySet({
        type: "timestamp",
        count: 2,
    });

    const resolveBuffer = device.createBuffer({
        size: querySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    const resultBuffer = device.createBuffer({
        size: resolveBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const fpsAverage = new RollingAverage();
    const jsAverage = new RollingAverage();
    const gpuAverage = new RollingAverage();

    let gpuTime = 0;

    function render(now: number) {
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        then = now;

        const jsStartTime = performance.now();

        const encoder = device.createCommandEncoder({
            label: "11 Timing Performance - Command Encoder",
        });

        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
        };
        const renderPass = encoder.beginRenderPass({
            label: "11 Timing Performance- Render Pass",
            colorAttachments: [colorAttachment],
            timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1,
            },
        });
        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint32");
        renderPass.setVertexBuffer(1, staticVertexBuffer);
        renderPass.setVertexBuffer(2, dynamicVertexBuffer);

        // Update the dynamic storage values
        const aspect = canvas.width / canvas.height;

        for (let ndx = 0; ndx < settings.numObjects; ++ndx) {
            const { scale, offset, velocity } = objectInfos[ndx];

            // -1.5 to 1.5
            offset[0] =
                euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) -
                1.5;
            offset[1] =
                euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) -
                1.5;

            const off = ndx * (dynamicUnitSize / 4);
            dynamicVertexValues.set(offset, off + offsets.offset);
            dynamicVertexValues.set(
                [scale / aspect, scale],
                off + offsets.scale,
            );
        }

        device.queue.writeBuffer(
            dynamicVertexBuffer,
            0,
            dynamicVertexValues,
            0,
            (settings.numObjects * dynamicUnitSize) / 4,
        );

        // renderPass.setBindGroup(0, bindGroup);
        renderPass.drawIndexed(numVertices, settings.numObjects);
        renderPass.end();

        encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
        if (resultBuffer.mapState === "unmapped") {
            encoder.copyBufferToBuffer(
                resolveBuffer,
                0,
                resultBuffer,
                0,
                resultBuffer.size,
            );
        }

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);

        if (resultBuffer.mapState === "unmapped") {
            resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const times = new BigInt64Array(resultBuffer.getMappedRange());
                gpuTime = Number(times[1] - times[0]);
                gpuAverage.addSample(gpuTime / 1000);
                resultBuffer.unmap();
            });
        }

        const jsEndTime = performance.now();
        const jsTime = jsEndTime - jsStartTime;

        fpsAverage.addSample(1 / deltaTime);
        jsAverage.addSample(jsTime);

        infoElem.textContent = `\
fps: ${fpsAverage.get().toFixed(1)}
js: ${jsAverage.get().toFixed(1)}ms
gpu: ${gpuAverage.get().toFixed(1)}µs
`;

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const canvas = <HTMLCanvasElement>entry.target;
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(
                1,
                Math.min(width, device.limits.maxTextureDimension2D),
            );
            canvas.height = Math.max(
                1,
                Math.min(height, device.limits.maxTextureDimension2D),
            );
        }
    });
    observer.observe(canvas);
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
