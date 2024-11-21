struct TriangleStatic {
    color: vec4f,
    offset: vec2f
}

struct TriangleData {
    scale: vec2f
}

struct Vertex {
    position: vec2f
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f
}

@group(0) @binding(0) var<storage, read> triangle_static_arr: array<TriangleStatic>;
@group(0) @binding(1) var<storage, read> triangle_data_arr: array<TriangleData>;
@group(0) @binding(2) var<storage, read> vertex_arr: array<Vertex>;

@vertex fn vertex_shader(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {

    let triangle_static = triangle_static_arr[instance_index];
    let triangle_data = triangle_data_arr[instance_index];
    let position = vertex_arr[vertex_index].position;

    var vs_out : VertexOutput;
    vs_out.position = vec4f(
        position * triangle_data.scale + triangle_static.offset,
        0.0,
        1.0
    );
    vs_out.color = triangle_static.color;

    return vs_out;
}

@fragment fn fragment_shader(frag_in: VertexOutput) -> @location(0) vec4f {
    return frag_in.color;
}
