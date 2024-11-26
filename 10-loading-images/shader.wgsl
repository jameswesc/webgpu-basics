struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f
}

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32
) -> VertexOutput {
    let quad_points = array(
        // 1st triangle
        vec2f( 0.0,  0.0),  // center
        vec2f( 1.0,  0.0),  // right, center
        vec2f( 0.0,  1.0),  // center, top

        // 2st triangle
        vec2f( 0.0,  1.0),  // center, top
        vec2f( 1.0,  0.0),  // right, center
        vec2f( 1.0,  1.0),  // right, top
    );

    var vs_out : VertexOutput;

    let quad_point = quad_points[vertex_index];
    vs_out.position = vec4f(quad_point, 0, 1);
    vs_out.texcoord = quad_point;
    return vs_out;
}

@group(0) @binding(0) var tex_sampler: sampler;
@group(0) @binding(1) var texture: texture_2d<f32>;

@fragment fn fragment_shader(fs_in: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, tex_sampler, fs_in.texcoord);
}
