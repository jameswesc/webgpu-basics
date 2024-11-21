struct Vertex {
    @location(0) position: vec4f,
    @location(1) color: vec4f,
    @location(2) offset: vec2f,
    @location(3) scale: vec4f,
    @location(4) perVertexColor: vec4f
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f
}

@vertex fn vertex_shader(
    vert: Vertex,
) -> VertexOutput {

    let offset = vec4f(vert.offset, 0, 0);

    var vs_out : VertexOutput;
    vs_out.position = vert.position * vert.scale + offset;
    vs_out.color = vert.color * vert.perVertexColor;

    return vs_out;
}

@fragment fn fragment_shader(frag_in: VertexOutput) -> @location(0) vec4f {
    return frag_in.color;
}
