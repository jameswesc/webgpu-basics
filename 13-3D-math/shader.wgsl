struct Uniforms {
    color: vec4f,
    resolution: vec2f,
    translation: vec2f,
    rotation: vec2f,
};

struct Vertex {
    @location(0) position: vec2f,
};

struct VSOutput {
    @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
    var vsOut: VSOutput;

    let rotatedPosition = vec2f(
      vert.position.x * uni.rotation.x - vert.position.y * uni.rotation.y,
      vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x
    );

    let position = rotatedPosition + uni.translation;

    let res = uni.resolution;

    // convert the position from pixels to a 0.0 to 1.0 value
    let zeroToOne = position / res;

    // convert from 0 <-> 1 to 0 <-> 2
    let zeroToTwo = zeroToOne * 2.0;

    // covert from 0 <-> 2 to -1 <-> +1 (clip space)
    let flippedClipSpace = zeroToTwo - 1.0;

    // flip Y
    let clipSpace = flippedClipSpace * vec2f(1, -1);

    vsOut.position = vec4f(clipSpace, 0.0, 1.0);
    return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    let color = uni.color;

    return color;
}
