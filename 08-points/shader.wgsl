struct Vertex {
    @location(0) position: vec2f,
    @location(1) size: f32,
};

struct Uniforms {
    resolution: vec2f,
}

struct VSOutput {
    @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex fn vs(
    vertex: Vertex,
    @builtin(vertex_index) vertex_index: u32
) -> VSOutput {

    let quad_points = array(
        vec2f(-1, -1),
        vec2f( 1, -1),
        vec2f(-1,  1),
        vec2f(-1,  1),
        vec2f( 1, -1),
        vec2f( 1,  1),
    );

    let quad_position = quad_points[vertex_index];
    let quad_offset = quad_position * vertex.size / uniforms.resolution;

    var vs_out: VSOutput;
    vs_out.position = vec4f(
        vertex.position + quad_offset,
        0,
        1,
    );
    return vs_out;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    return vec4f(1, 1, 0, 1); // yellow
}
