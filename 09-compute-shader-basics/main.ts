import { getAdapter, getDevice } from "../utils/setup";
import shaderCodeRaw from "./shader.wgsl?raw";

async function main() {
    const adapter = await getAdapter();
    const device = await getDevice(adapter);

    const dispatchCount = [4, 3, 2];
    const workgroupSize = [2, 3, 4];

    const numThreadsPerGroup = arrayProduct(workgroupSize);

    const shaderCode = replaceShaderPlaceholders(shaderCodeRaw, {
        __WORKGROUP_SIZE__: workgroupSize.toString(),
        __NUM_THREADS_PER_WORKGROUP__: numThreadsPerGroup.toString(),
    });

    const module = device.createShaderModule({
        label: "09 Compute Shader - Module",
        code: shaderCode,
    });
    const pipeline = device.createComputePipeline({
        label: "09 Compute Shader - Pipeline",
        layout: "auto",
        compute: {
            module,
        },
    });

    const numbWorkgroups = arrayProduct(dispatchCount);
    const numResults = numbWorkgroups * numThreadsPerGroup;
    const size = numResults * 4 * 4; // vec3u = 3 * 4(u32) + 1 * 4bytes for padding

    let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
    const workgroupBuffer = device.createBuffer({ size, usage });
    const localBuffer = device.createBuffer({ size, usage });
    const globalBuffer = device.createBuffer({ size, usage });

    // Buffers to map into JS
    usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
    const workgroupReadBuffer = device.createBuffer({ size, usage });
    const localReadBuffer = device.createBuffer({ size, usage });
    const globalReadBuffer = device.createBuffer({ size, usage });

    const bindGroup = device.createBindGroup({
        label: "09 Compute Shader - Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: workgroupBuffer } },
            { binding: 1, resource: { buffer: localBuffer } },
            { binding: 2, resource: { buffer: globalBuffer } },
        ],
    });

    const encoder = device.createCommandEncoder({
        label: "09 Compute Shader - Encoder",
    });
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(
        workgroupSize[0],
        workgroupSize[1],
        workgroupSize[2],
    );
    computePass.end();

    encoder.copyBufferToBuffer(
        workgroupBuffer,
        0,
        workgroupReadBuffer,
        0,
        size,
    );
    encoder.copyBufferToBuffer(localBuffer, 0, localReadBuffer, 0, size);
    encoder.copyBufferToBuffer(globalBuffer, 0, globalReadBuffer, 0, size);

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    await Promise.all([
        workgroupReadBuffer.mapAsync(GPUMapMode.READ),
        localReadBuffer.mapAsync(GPUMapMode.READ),
        globalReadBuffer.mapAsync(GPUMapMode.READ),
    ]);

    const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange());
    const local = new Uint32Array(localReadBuffer.getMappedRange());
    const global = new Uint32Array(globalReadBuffer.getMappedRange());

    const get3 = (arr: any, i: number) => {
        const off = i * 4;
        return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
    };

    for (let i = 0; i < numResults; ++i) {
        if (i % numThreadsPerGroup === 0) {
            log(`\
   ---------------------------------------
   global                 local     global   dispatch: ${i / numThreadsPerGroup}
   invoc.    workgroup    invoc.    invoc.
   index     id           id        id
   ---------------------------------------`);
        }
        log(
            ` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`,
        );
    }
}

main();

function log(...args: any[]) {
    const elem = document.createElement("pre");
    elem.textContent = args.join(" ");
    document.body.appendChild(elem);
}

function arrayProduct(arr: number[]) {
    return arr.reduce((acc, val) => acc * val);
}

function replaceShaderPlaceholders(
    shaderCode: string,
    replacements: Record<string, string>,
) {
    let code = shaderCode;
    for (const [placeholder, replacement] of Object.entries(replacements)) {
        code = code.replace(placeholder, replacement);
    }
    return code;
}
