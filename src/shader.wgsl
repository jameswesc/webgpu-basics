@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.8),  // top center
    vec2f(-0.8, -0.8),  // bottom left
    vec2f( 0.8, -0.8)   // bottom right
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 1.0, 1.0);
}