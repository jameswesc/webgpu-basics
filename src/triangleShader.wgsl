struct VertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> VertexShaderOutput {
  let pos = array<vec2f, 6>(
    vec2f( -1,  1), // top left
    vec2f(-1, -1),  // bottom left
    vec2f( 1, -1),  // bottom right
    
    vec2f( -1, 1),  // top left
    vec2f( 1,  1),  // top right
    vec2f( 1, -1)   // bottom right
  );

  var color = array<vec4f, 6>(
    vec4f(1, 0, 0, 1), // r
    vec4f(1, 1, 1, 1), // g
    vec4f(0, 0, 1, 1), // b
    vec4f(1, 0, 0, 1), // r
    vec4f(0, 0, 0, 1), 
    vec4f(0, 0, 1, 1),
  );

  var vsOutput : VertexShaderOutput;
  vsOutput.position = vec4f(pos[vertexIndex], 0, 1);
  vsOutput.color = color[vertexIndex];
  vsOutput.uv = (pos[vertexIndex] + 1) / 2;
  return vsOutput;
}

@fragment fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
  let red = vec4f(1,0,0,1);
  let cyan = vec4f(0,1,1,1);

  let grid = vec2u(fsInput.position.xy) / 100;
  let checker = (grid.x + grid.y) % 2 == 1;

  return select(red, cyan, checker);

  // return vec4(1, 0, 1, 1);
}