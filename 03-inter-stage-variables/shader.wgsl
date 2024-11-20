struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> VertexOutput {
    let positions = array(
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
        vec2f(0.0, 0.5),
    );

    let colors = array(
        vec4f(1, 0, 0, 1), // red
        vec4f(0, 1, 0, 1), // green
        vec4f(0, 0, 1, 1), // blue
    );

    var output : VertexOutput;

    output.position = vec4f(positions[vertex_index], 0.0, 1.0);
    output.color = colors[vertex_index];

    return output;
}

@fragment fn fragment_shader(
    frag_input: VertexOutput
) -> @location(0) vec4f {
    return frag_input.color;
}
