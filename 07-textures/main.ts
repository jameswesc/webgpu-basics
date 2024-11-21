// import { Pane } from "tweakpane";
import { initWebGPU } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";
import { createBlendedMipmap, createCheckedMipmap } from "./textureUtils";
import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { mat4 } from "wgpu-matrix";

async function main() {
    // ---- Tweakpane stuff ----
    // const settings = {
    //     addressModeU: "repeat",
    //     addressModeV: "repeat",
    //     magFilter: "linear",
    //     minFilter: "linear",i
    //     scale: 1,
    // };
    // const pane = new Pane({
    //     title: "Parameters",
    //     container: document.getElementById("tweak-container")!,
    // });
    // pane.addBinding(settings, "addressModeU", {
    //     options: {
    //         repeat: "repeat",
    //         clamp: "clamp-to-edge",
    //     },
    // });
    // pane.addBinding(settings, "addressModeV", {
    //     options: {
    //         repeat: "repeat",
    //         clamp: "clamp-to-edge",
    //     },
    // });
    // pane.addBinding(settings, "magFilter", {
    //     options: {
    //         linear: "linear",
    //         nearest: "nearest",
    //     },
    // });
    // pane.addBinding(settings, "minFilter", {
    //     options: {
    //         linear: "linear",
    //         nearest: "nearest",
    //     },
    // });
    // pane.addBinding(settings, "scale", {
    //     min: 0.5,
    //     max: 6,
    // });

    // ---- WebGPU stuff start ----
    const { device, canvas, context, format } = await initWebGPU();

    // shader module
    const module = device.createShaderModule({
        label: "07 Textures - Shader module",
        code: shaderCode,
    });

    // pipeline
    const pipeline = device.createRenderPipeline({
        label: "07 Textures - Render pipeline",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const createTextureWithMips = (
        mips:
            | {
                  data: Uint8Array;
                  width: number;
                  height: number;
              }[]
            | ImageData[],
        label: string,
    ) => {
        const texture = device.createTexture({
            label,
            size: [mips[0].width, mips[0].height],
            mipLevelCount: mips.length,
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        mips.forEach(({ data, width, height }, mipLevel) => {
            device.queue.writeTexture(
                { texture, mipLevel },
                data,
                { bytesPerRow: width * 4 },
                { width, height },
            );
        });
        return texture;
    };

    const textures = [
        createTextureWithMips(createBlendedMipmap(), "blended"),
        createTextureWithMips(createCheckedMipmap(), "checker"),
    ];

    // offsets to the various uniform values in float32 indices
    const kMatrixOffset = 0;

    const objectInfos: {
        bindGroups: GPUBindGroup[];
        matrix: Float32Array;
        uniformValues: Float32Array;
        uniformBuffer: GPUBuffer;
    }[] = [];

    for (let i = 0; i < 8; ++i) {
        const sampler = device.createSampler({
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: i & 1 ? "linear" : "nearest",
            minFilter: i & 2 ? "linear" : "nearest",
            mipmapFilter: i & 4 ? "linear" : "nearest",
        });

        // create a buffer for the uniform values
        const uniformBufferSize = 16 * 4; // matrix is 16 32bit floats (4bytes each)
        const uniformBuffer = device.createBuffer({
            label: "uniforms for quad",
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // create a typedarray to hold the values for the uniforms in JavaScript
        const uniformValues = new Float32Array(uniformBufferSize / 4);
        const matrix = uniformValues.subarray(kMatrixOffset, 16);

        const bindGroups = textures.map((texture) =>
            device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: texture.createView() },
                    { binding: 2, resource: { buffer: uniformBuffer } },
                ],
            }),
        );

        // Save the data we need to render this object.
        objectInfos.push({
            bindGroups,
            matrix,
            uniformValues,
            uniformBuffer,
        });
    }

    let texNdx = 0;

    function render() {
        const fov = 60 * (Math.PI / 180);
        const aspect = canvas.width / canvas.height;
        const zNear = 1;
        const zFar = 2000;

        const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar);

        const cameraPosition = [0, 0, 2];
        const up = [0, 1, 0];
        const target = [0, 0, 0];

        const viewMatrix = mat4.lookAt(cameraPosition, target, up);
        const viewProjectionMatrix = mat4.multiply(
            projectionMatrix,
            viewMatrix,
        );

        const encoder = device.createCommandEncoder({
            label: "07 Textures - Command Encoder",
        });
        const view = context.getCurrentTexture().createView();
        const colorAttachment: GPURenderPassColorAttachment = {
            view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
        };
        const renderPass = encoder.beginRenderPass({
            label: "07 Textures - Render Pass",
            colorAttachments: [colorAttachment],
        });

        renderPass.setPipeline(pipeline);

        objectInfos.forEach(
            ({ bindGroups, matrix, uniformBuffer, uniformValues }, i) => {
                const bindGroup = bindGroups[texNdx];

                const xSpacing = 1.2;
                const ySpacing = 0.7;
                const zDepth = 50;

                const x = (i % 4) - 1.5;
                const y = i < 4 ? 1 : -1;

                mat4.translate(
                    viewProjectionMatrix,
                    [x * xSpacing, y * ySpacing, -zDepth * 0.5],
                    matrix,
                );
                mat4.rotateX(matrix, 0.5 * Math.PI, matrix);
                mat4.scale(matrix, [1, zDepth * 2, 1], matrix);
                mat4.translate(matrix, [-0.5, -0.5, 0], matrix);

                device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

                renderPass.setBindGroup(0, bindGroup);
                renderPass.draw(6); // call our vertex shader 6 times
            },
        );

        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render, device.limits.maxTextureDimension2D);
    canvas.addEventListener("click", () => {
        texNdx = (texNdx + 1) % textures.length;
        render();
    });
}

main();
