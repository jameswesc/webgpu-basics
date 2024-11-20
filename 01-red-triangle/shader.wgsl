@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> @builtin(position) vec4f {
    let positions = array(
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
        vec2f(0.0, 0.5),
    );

    return vec4f(positions[vertex_index], 0.0, 1.0);
}

@fragment fn fragment_shader() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
