import { Pane } from "tweakpane";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";
import { mat4 } from "wgpu-matrix";

function projection(
    width: number,
    height: number,
    depth: number,
    dst?: Float32Array,
) {
    dst = dst ?? mat4.create();
    dst[0] = 2 / width;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = 0;
    dst[5] = -2 / height;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 0;
    dst[9] = 0;
    dst[10] = 0.5 / depth;
    dst[11] = 0;
    dst[12] = -1;
    dst[13] = 1;
    dst[14] = 0.5;
    dst[15] = 1;
    return dst;
}

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

    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module,
            buffers: [
                {
                    arrayStride: 4 * 4, // vec3<f32> + unorm8x4
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" }, // position, read as vec4f
                        {
                            shaderLocation: 1,
                            offset: 3 * 4,
                            format: "unorm8x4",
                        },
                    ],
                },
            ],
        },
        fragment: {
            module,
            targets: [{ format }],
        },
        primitive: {
            cullMode: "front",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
    });

    // Memory Stuff
    const uniformBufferSize =
        4 * 4 + //      color   :   vec4<f32>
        4 * 4 * 4; //   matrix  :   mat4x4<f32>

    const uniformOffsets = {
        color: 0,
        matrix: 4,
    };

    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const colorValues = uniformValues.subarray(0, uniformOffsets.color + 4);
    const matrixValues = uniformValues.subarray(
        uniformOffsets.matrix,
        uniformOffsets.matrix + 16,
    );

    // Set color once as it wont chage
    colorValues.set([Math.random(), Math.random(), Math.random(), 1]);
    device.queue.writeBuffer(uniformBuffer, 0, colorValues);

    const { vertexData, numVertices } = createFVertices();
    const vertexBuffer = device.createBuffer({
        label: "vertex buffer vertices",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const bindGroup = device.createBindGroup({
        label: "bind group for uniforms",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    const settings = {
        translate: { x: 100, y: 100, z: 0 },
        rotation: { x: 30, y: 30, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
    };

    const pane = new Pane();
    pane.addBinding(settings, "translate");
    pane.addBinding(settings, "rotation");
    pane.addBinding(settings, "scale");

    let depthTexture: GPUTexture;

    function render() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        // projection(width, height, 400, matrixValues);
        mat4.ortho(0, width, height, 0, 400, -400, matrixValues);
        mat4.translate(
            matrixValues,
            [settings.translate.x, settings.translate.y, settings.translate.z],
            matrixValues,
        );
        mat4.rotateX(
            matrixValues,
            (settings.rotation.x * Math.PI) / 180,
            matrixValues,
        );
        mat4.rotateY(
            matrixValues,
            (settings.rotation.y * Math.PI) / 180,
            matrixValues,
        );
        mat4.rotateZ(
            matrixValues,
            (settings.rotation.z * Math.PI) / 180,
            matrixValues,
        );
        mat4.scale(
            matrixValues,
            [settings.scale.x, settings.scale.y, settings.scale.z],
            matrixValues,
        );

        // Write to uniform buffer
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

        const encoder = device.createCommandEncoder();
        const canvasTexture = context.getCurrentTexture();

        if (
            !depthTexture ||
            depthTexture.width !== canvasTexture.width ||
            depthTexture.height !== canvasTexture.height
        ) {
            if (depthTexture) {
                depthTexture.destroy();
            }
            depthTexture = device.createTexture({
                size: [canvasTexture.width, canvasTexture.height],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: canvasTexture.createView(),
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        };
        const pass = encoder.beginRenderPass(renderPassDescriptor);

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setBindGroup(0, bindGroup);

        pass.draw(numVertices);
        pass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render);
    pane.on("change", render);
}

main();

function createFVertices() {
    const positions = [
        // left column
        0, 0, 0, 30, 0, 0, 0, 150, 0, 30, 150, 0,

        // top rung
        30, 0, 0, 100, 0, 0, 30, 30, 0, 100, 30, 0,

        // middle rung
        30, 60, 0, 70, 60, 0, 30, 90, 0, 70, 90, 0,

        // left column back
        0, 0, 30, 30, 0, 30, 0, 150, 30, 30, 150, 30,

        // top rung back
        30, 0, 30, 100, 0, 30, 30, 30, 30, 100, 30, 30,

        // middle rung back
        30, 60, 30, 70, 60, 30, 30, 90, 30, 70, 90, 30,
    ];

    // prettier-ignore
    const indices = [
        // front
        0,  1,  2,    2,  1,  3,  // left column
        4,  5,  6,    6,  5,  7,  // top run
        8,  9, 10,   10,  9, 11,  // middle run

        // back
        12,  14,  13,   14, 15, 13,  // left column back
        16,  18,  17,   18, 19, 17,  // top run back
        20,  22,  21,   22, 23, 21,  // middle run back

        0, 12, 5,   12, 17, 5,   // top
        5, 17, 7,   17, 19, 7,   // top rung right
        6, 7, 18,   18, 7, 19,   // top rung bottom
        6, 18, 8,   18, 20, 8,   // between top and middle rung
        8, 20, 9,   20, 21, 9,   // middle rung top
        9, 21, 11,  21, 23, 11,  // middle rung right
        10, 11, 22, 22, 11, 23,  // middle rung bottom
        10, 22, 3,  22, 15, 3,   // stem right
        2, 3, 14,   14, 3, 15,   // bottom
        0, 2, 12,   12, 2, 14,   // left
    ];

    const quadColors = [
        200,
        70,
        120, // left column front
        200,
        70,
        120, // top rung front
        200,
        70,
        120, // middle rung front

        80,
        70,
        200, // left column back
        80,
        70,
        200, // top rung back
        80,
        70,
        200, // middle rung back

        70,
        200,
        210, // top
        160,
        160,
        220, // top rung right
        90,
        130,
        110, // top rung bottom
        200,
        200,
        70, // between top and middle rung
        210,
        100,
        70, // middle rung top
        210,
        160,
        70, // middle rung right
        70,
        180,
        210, // middle rung bottom
        100,
        70,
        210, // stem right
        76,
        210,
        100, // bottom
        140,
        210,
        80, // left
    ];

    const numVertices = indices.length;
    const vertexData = new Float32Array(numVertices * 4); // xyz + color
    const colorData = new Uint8Array(vertexData.buffer);

    for (let i = 0; i < indices.length; ++i) {
        const positionNdx = indices[i] * 3;
        const position = positions.slice(positionNdx, positionNdx + 3);
        vertexData.set(position, i * 4);

        const quadNdx = ((i / 6) | 0) * 3;
        const color = quadColors.slice(quadNdx, quadNdx + 3);
        colorData.set(color, i * 16 + 12); // set RGB
        colorData[i * 16 + 15] = 255; // set A
    }

    return {
        vertexData,
        numVertices,
    };
}
