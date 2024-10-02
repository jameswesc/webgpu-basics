import computeShader from './computeShader.wgsl?raw'

export default async function main() {
  // Assuming we have an adapter
  const adapter: GPUAdapter = <GPUAdapter>await navigator.gpu?.requestAdapter()
  const device: GPUDevice = await adapter?.requestDevice()

  if (!device) {
    throw new Error('WebGPU not supported.')
  }

  const module: GPUShaderModule = device.createShaderModule({
    label: 'compute module',
    code: computeShader,
  })

  const pipeline: GPUComputePipeline = device.createComputePipeline({
    label: 'Doubling compute pipeline',
    layout: 'auto',
    compute: {
      module,
    },
  })

  const input = new Float32Array([1, 17, 4])

  const workBuffer: GPUBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    // Allow storage, allow copying data to the GPU, allowing copying data from the GPU
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  })

  device.queue.writeBuffer(workBuffer, 0, input)

  const resultBuffer: GPUBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  // Setup a bind group to tell the shader which buffer to use
  // for the computation
  const bindGround: GPUBindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: workBuffer } }],
  })

  const encoder: GPUCommandEncoder = device.createCommandEncoder({
    label: 'doubling encoder',
  })

  const pass: GPUComputePassEncoder = encoder.beginComputePass({
    label: 'doubling compute pass',
  })

  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGround)
  // Note, length, note byteLength
  pass.dispatchWorkgroups(input.length)
  pass.end()

  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

  const commandBuffer: GPUCommandBuffer = encoder.finish()
  device.queue.submit([commandBuffer])

  await resultBuffer.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(resultBuffer.getMappedRange())

  console.log('Input: ', input)
  console.log('Result: ', result)

  // After this, the result buffer has its length set to 0
  // This may get triggered in HMR
  resultBuffer.unmap()
}
