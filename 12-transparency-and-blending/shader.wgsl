struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
) -> VertexOutput {
    let positions = array(
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
        vec2f(0.0, 0.5),
    );

    var output : VertexOutput;

    output.position = vec4f(positions[vertex_index], 0.0, 1.0);
    output.texcoord = positions[vertex_index] + 0.5;

    return output;
}

@fragment fn fragment_shader(
    frag_input: VertexOutput
) -> @location(0) vec4f {
    let cyan = vec4f(0, 1, 1, 1);

    let xy = frag_input.texcoord * 10;

    let x = fract(xy.x);

    if x < 0.1 {
        discard;
    }

    return cyan;

}
