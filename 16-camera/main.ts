import { Pane } from "tweakpane";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";
import { mat4, utils } from "wgpu-matrix";
const { degToRad } = utils;

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
            cullMode: "back",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
    });

    // Memory Stuff
    const uniformBufferSize = 4 * 4 * 4; //   matrix  :   mat4x4<f32>

    const uniformOffsets = {
        matrix: 0,
    };

    type ObjectInfo = {
        uniformBuffer: GPUBuffer;
        uniformValues: Float32Array;
        matrixValues: Float32Array;
        bindGroup: GPUBindGroup;
    };

    const numObjects = 5;
    const objectInfos: ObjectInfo[] = [];

    for (let i = 0; i < numObjects; i++) {
        const uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const uniformValues = new Float32Array(uniformBufferSize / 4);
        const matrixValues = uniformValues.subarray(
            uniformOffsets.matrix,
            uniformOffsets.matrix + 16,
        );
        const bindGroup = device.createBindGroup({
            label: "bind group for uniforms",
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });
        objectInfos.push({
            uniformBuffer,
            uniformValues,
            matrixValues,
            bindGroup,
        });
    }

    const { vertexData, numVertices } = createFVertices();
    const vertexBuffer = device.createBuffer({
        label: "vertex buffer vertices",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const settings = {
        fov: 45,
        cameraAngle: 30,
        radius: 200,
    };

    const pane = new Pane();
    pane.addBinding(settings, "fov");
    pane.addBinding(settings, "cameraAngle");
    pane.addBinding(settings, "radius");

    let depthTexture: GPUTexture;

    function render() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const aspect = width / height;

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

        const projection = mat4.perspective(
            degToRad(settings.fov),
            aspect,
            1,
            2000,
        );

        const x =
            Math.sin(degToRad(settings.cameraAngle)) * 5 * settings.radius;
        const z =
            Math.cos(degToRad(settings.cameraAngle)) * 5 * settings.radius;

        const viewMatrix = mat4.lookAt(
            [x, 1 * settings.radius, z],
            [0, 0, 0],
            [0, 1, 0],
        );
        const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

        objectInfos.forEach(
            ({ uniformBuffer, uniformValues, matrixValues, bindGroup }, i) => {
                const angle = (i / numObjects) * Math.PI * 2;
                const x = Math.cos(angle) * settings.radius;
                const z = Math.sin(angle) * settings.radius;

                mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValues);

                // Write to uniform buffer
                device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

                device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

                pass.setBindGroup(0, bindGroup);
                pass.draw(numVertices);
            },
        );

        pass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render);
    pane.on("change", render);
}

main();

function createFVertices() {
    // prettier-ignore
    const positions = [
      // left column
       -50,  75,  15,
       -20,  75,  15,
       -50, -75,  15,
       -20, -75,  15,

      // top rung
       -20,  75,  15,
        50,  75,  15,
       -20,  45,  15,
        50,  45,  15,

      // middle rung
       -20,  15,  15,
        20,  15,  15,
       -20, -15,  15,
        20, -15,  15,

      // left column back
       -50,  75, -15,
       -20,  75, -15,
       -50, -75, -15,
       -20, -75, -15,

      // top rung back
       -20,  75, -15,
        50,  75, -15,
       -20,  45, -15,
        50,  45, -15,

      // middle rung back
       -20,  15, -15,
        20,  15, -15,
       -20, -15, -15,
        20, -15, -15,
    ];

    // prettier-ignore
    const indices = [
       0,  2,  1,    2,  3,  1,   // left column
       4,  6,  5,    6,  7,  5,   // top run
       8, 10,  9,   10, 11,  9,   // middle run

      12, 13, 14,   14, 13, 15,   // left column back
      16, 17, 18,   18, 17, 19,   // top run back
      20, 21, 22,   22, 21, 23,   // middle run back

       0,  5, 12,   12,  5, 17,   // top
       5,  7, 17,   17,  7, 19,   // top rung right
       6, 18,  7,   18, 19,  7,   // top rung bottom
       6,  8, 18,   18,  8, 20,   // between top and middle rung
       8,  9, 20,   20,  9, 21,   // middle rung top
       9, 11, 21,   21, 11, 23,   // middle rung right
      10, 22, 11,   22, 23, 11,   // middle rung bottom
      10,  3, 22,   22,  3, 15,   // stem right
       2, 14,  3,   14, 15,  3,   // bottom
       0, 12,  2,   12, 14,  2,   // left
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
