/**
 * Date: 2/10/2024
 *
 * Following allong WebGPU fundamentals.
 * https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html#fn3
 *
 */

import './style.css'
import webGPUTriangle from './webGPUTriangle'
// import webGPUCompute from './webGPUComputation'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="gfx-main"></canvas>
`

webGPUTriangle()
// webGPUCompute()
