import { Pane } from "tweakpane";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { getAdapter, getCanvas, getContext, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";
import { mat3 } from "wgpu-matrix";

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
                    arrayStride: 2 * 4, // (2) floats, 4 bytes each
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" }, // position
                    ],
                },
            ],
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    // Memory Stuff
    const uniformBufferSize =
        4 * 4 + //  color       : vec4f
        2 * 4 + //  resolution  : vec2f
        2 * 4 + //  padding
        4 * 3 * 4; //  matrix   : mat3x3f

    const uniformOffsets = {
        color: 0,
        resolution: 4,
        matrix: 8,
    };

    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const colorValues = uniformValues.subarray(0, uniformOffsets.color + 4);
    const resolutionValues = uniformValues.subarray(
        uniformOffsets.resolution,
        uniformOffsets.resolution + 2,
    );
    const matrixValues = uniformValues.subarray(
        uniformOffsets.matrix,
        uniformOffsets.matrix + 12,
    );

    // Set color once as it wont chage
    colorValues.set([Math.random(), Math.random(), Math.random(), 1]);
    device.queue.writeBuffer(uniformBuffer, 0, colorValues);

    const { vertexData, indexData, numVertices } = createFVertices();
    const vertexBuffer = device.createBuffer({
        label: "vertex buffer vertices",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = device.createBuffer({
        label: "index buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indexData);

    const bindGroup = device.createBindGroup({
        label: "bind group for uniforms",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    const settings = {
        translate: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
    };

    const pane = new Pane();
    pane.addBinding(settings, "translate", {
        x: { min: 0, max: 500 },
        y: { min: 0, max: 500 },
    });
    pane.addBinding(settings, "rotation", {
        min: 0,
        max: 360,
        step: 1,
    });
    pane.addBinding(settings, "scale");

    function render() {
        // Update all the uniform values
        // Resolution
        const dpr = Math.min(devicePixelRatio, 2);
        resolutionValues.set([canvas.width / dpr, canvas.height / dpr]);

        // Matrix
        const translation = mat3.translation([
            settings.translate.x,
            settings.translate.y,
        ]);
        const theta = settings.rotation * (Math.PI / 180);
        const rotation = mat3.rotation(theta);
        const scale = mat3.scaling([settings.scale.x, settings.scale.y]);

        // prettier-ignore
        const projectionMatrix = mat3.create(
            2 / canvas.clientWidth, 0, 0,
            0, -2 / canvas.clientHeight, 0,
            -1, 1, 1,
        );

        let m = mat3.identity();
        m = mat3.multiply(m, projectionMatrix);
        m = mat3.multiply(m, translation);
        m = mat3.multiply(m, rotation);
        m = mat3.multiply(m, scale);
        const moveOrigin = mat3.translation([-50, -75]);
        m = mat3.multiply(m, moveOrigin);

        matrixValues.set(m);

        // Write to uniform buffer
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

        const encoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };
        const pass = encoder.beginRenderPass(renderPassDescriptor);

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, "uint32");
        pass.setBindGroup(0, bindGroup);

        pass.drawIndexed(numVertices);
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
    const vertexData = new Float32Array([
        // left column
        0, 0,
        30, 0,
        0, 150,
        30, 150,

        // top rung
        30, 0,
        100, 0,
        30, 30,
        100, 30,

        // middle rung
        30, 60,
        70, 60,
        30, 90,
        70, 90,
    ]);

    // prettier-ignore
    const indexData = new Uint32Array([
        0,  1,  2,    2,  1,  3,  // left column
        4,  5,  6,    6,  5,  7,  // top run
        8,  9, 10,   10,  9, 11,  // middle run
    ]);

    return {
        vertexData,
        indexData,
        numVertices: indexData.length,
    };
}
