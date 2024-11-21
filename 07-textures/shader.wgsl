struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texcoord: vec2<f32>,
}

struct Uniforms {
    matrix: mat4x4<f32>
}

@group(0) @binding(2) var<uniform> uniforms : Uniforms;

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> VertexOutput {
    let positions = array(
        // 1st triangle
        vec2f( 0.0,  0.0),  // center
        vec2f( 1.0,  0.0),  // right, center
        vec2f( 0.0,  1.0),  // center, top

        // 2nd triangle
        vec2f( 0.0,  1.0),  // center, top
        vec2f( 1.0,  0.0),  // right, center
        vec2f( 1.0,  1.0),  // right, top
    );

    let xy = positions[vertex_index];

    var vs_out : VertexOutput;
    vs_out.position = uniforms.matrix * vec4f(xy, 0.0, 1.0);
    vs_out.texcoord = xy * vec2f(1, 50);


    return vs_out;
}

@group(0) @binding(0) var my_sampler: sampler;
@group(0) @binding(1) var my_texture: texture_2d<f32>;

@fragment fn fragment_shader(
    vs_out: VertexOutput
) -> @location(0) vec4f {

    return textureSample(my_texture, my_sampler, vs_out.texcoord);
}
