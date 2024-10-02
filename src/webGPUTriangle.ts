/**
 * Date: 2/10/2024
 *
 * Following allong WebGPU fundamentals.
 * https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html#fn3
 *
 */

import shaderCode from './shader.wgsl?raw'

export default async function main() {
  // Assuming we have an adapter
  const adapter: GPUAdapter = <GPUAdapter>await navigator.gpu?.requestAdapter()
  const device: GPUDevice = await adapter?.requestDevice()

  if (!device) {
    throw new Error('WebGPU not supported.')
  }

  // Configure basics
  const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('gfx-main')
  const context: GPUCanvasContext = <GPUCanvasContext>canvas.getContext('webgpu')
  const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format,
  })

  const module: GPUShaderModule = device.createShaderModule({
    label: 'My first shader: shader.wgsl',
    code: shaderCode,
  })

  const pipeline: GPURenderPipeline = device.createRenderPipeline({
    label: 'Red triangle pipeline',
    layout: 'auto',
    vertex: {
      // entryPoint: 'vs', - not required as only one function
      module,
    },
    fragment: {
      // entryPoint: 'fs', - not required as only one function
      module,
      targets: [{ format }],
    },
  })

  function render() {
    const view: GPUTextureView = context.getCurrentTexture().createView()

    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: 'Red triangle render pass',
      // We have only one color attachment. This corresponds to @location(0)
      // in our wgsl code.
      colorAttachments: [
        {
          view,
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    }

    // a command encoder to start encoding commands
    const encoder: GPUCommandEncoder = device.createCommandEncoder({
      label: 'our triangle encoder',
    })

    // make a render pass encoder to encode render specific commands
    const pass: GPURenderPassEncoder = encoder.beginRenderPass(renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.draw(3) // call shader 3 times (for tirangle list)
    pass.end()

    const commandBuffer = encoder.finish()
    device.queue.submit([commandBuffer])
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = <HTMLCanvasElement>entry.target
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      canvas.width = Math.max(1, Math.min(width * 2, device.limits.maxTextureDimension2D))
      canvas.height = Math.max(1, Math.min(height * 2, device.limits.maxTextureDimension2D))
      // re-render
      render()
    }
  })

  observer.observe(canvas)
}
