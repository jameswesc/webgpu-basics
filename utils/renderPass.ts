export function createDefaultRenderPass(
    device: GPUDevice,
    context: GPUCanvasContext,
    label: string,
) {
    const commandEncoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
        label,
        colorAttachments: [
            {
                view,
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 },
            },
        ],
    };
    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);

    return { commandEncoder, pass };
}
