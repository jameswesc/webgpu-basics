struct TriangleData {
    color: vec4f,
    scale: vec2f,
    offset: vec2f
}

@group(0) @binding(0) var<uniform> triangle_data: TriangleData;

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> @builtin(position) vec4f {
    let positions = array(
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
        vec2f(0.0, 0.5),
    );

    let colors = array(
        vec4f(1, 1, 0, 1), // red
        vec4f(0, 1, 1, 1), // green
        vec4f(1, 0, 1, 1), // blue
    );


    return vec4f(
        positions[vertex_index] * triangle_data.scale + triangle_data.offset,
        0.0,
        1.0
    );
}

@fragment fn fragment_shader() -> @location(0) vec4f {
    return triangle_data.color;
}
