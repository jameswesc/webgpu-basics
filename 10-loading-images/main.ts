import { renderOnResizeObserver } from "../utils/renderOnResizeObserver";
import { createDefaultRenderPass } from "../utils/renderPass";
import { initWebGPU } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    const { device, canvas, context, format } = await initWebGPU();

    const module = device.createShaderModule({
        label: "10 Loading Images - Module",
        code: shaderCode,
    });

    const pipeline = device.createRenderPipeline({
        label: "10 Loading Images - Pipeline",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    const source = await loadImageBitmap("/f-texture.png");
    const texture = device.createTexture({
        label: "f-texture.png",
        format: "rgba8unorm",
        size: [source.width, source.height],
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
        { source, flipY: true },
        { texture },
        {
            width: source.width,
            height: source.height,
        },
    );

    const sampler = device.createSampler();
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView() },
        ],
    });

    function render() {
        const { commandEncoder, pass } = createDefaultRenderPass(
            device,
            context,
            "10 Loading Images - Render pass",
        );

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);
    }

    renderOnResizeObserver(canvas, render);
}

async function loadImageBitmap(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: "none" });
}

main();
