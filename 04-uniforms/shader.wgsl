struct TriangleStatic {
    color: vec4f,
    offset: vec2f
}

struct TriangleData {
    scale: vec2f
}

@group(0) @binding(0) var<uniform> triangle_static: TriangleStatic;
@group(0) @binding(1) var<uniform> triangle_data: TriangleData;

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> @builtin(position) vec4f {
    let positions = array(
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
        vec2f(0.0, 0.5),
    );

    return vec4f(
        positions[vertex_index] * triangle_data.scale + triangle_static.offset,
        0.0,
        1.0
    );
}

@fragment fn fragment_shader() -> @location(0) vec4f {
    return triangle_static.color;
}
