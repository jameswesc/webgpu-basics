import { getAdapter, getDevice } from "../utils/setup";
import shaderCode from "./shader.wgsl?raw";

async function main() {
    const app = document.querySelector<HTMLDivElement>("#app")!;
    app.innerHTML = `
        <h1>02 Basic Compute</h1>
    `;

    const adapter = await getAdapter();
    const device = await getDevice(adapter);

    const module = device.createShaderModule({
        label: "02 Basic Compute Shader",
        code: shaderCode,
    });

    const pipeline = device.createComputePipeline({
        label: "02 Basic Compute Pipeline",
        layout: "auto",
        compute: {
            module,
        },
    });

    // Input Data
    const dataLength = 20;
    const inputData = new Float32Array(dataLength);
    for (let i = 0; i < dataLength; i++) {
        inputData[i] = i;
    }
    app.innerHTML += `
        <h2>Input Data</h2>
        <pre>${inputData.join(", ")}</pre>
    `;

    const workBuffer = device.createBuffer({
        label: "02 Basic Compute Work Buffer",
        size: inputData.byteLength,
        usage:
            GPUBufferUsage.STORAGE |
            GPUBufferUsage.COPY_DST |
            GPUBufferUsage.COPY_SRC,
    });

    device.queue.writeBuffer(workBuffer, 0, inputData);

    const resultBuffer = device.createBuffer({
        label: "02 Basic Compute Result Buffer",
        size: inputData.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        label: "02 Basic Compute Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: workBuffer } }],
    });

    const encoder = device.createCommandEncoder({
        label: "02 Basic Compute Command Encoder",
    });
    const pass = encoder.beginComputePass({
        label: "02 Basic Compute Pass",
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(inputData.length);
    pass.end();

    encoder.copyBufferToBuffer(
        workBuffer,
        0,
        resultBuffer,
        0,
        inputData.byteLength,
    );

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    await resultBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(resultBuffer.getMappedRange());

    app.innerHTML += `
        <h2>Compute Shader</h2>
        <pre>${shaderCode}</pre>
        <h2>Output Data</h2>
        <pre>${result.join(", ")}</pre>
    `;

    resultBuffer.unmap();
    console.log("Result", result);
}

main();
