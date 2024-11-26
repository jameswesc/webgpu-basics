@group(0) @binding(0) var<storage, read_write> workgroup_result: array<vec3u>;
@group(0) @binding(1) var<storage, read_write> local_result: array<vec3u>;
@group(0) @binding(2) var<storage, read_write> global_result: array<vec3u>;

@compute @workgroup_size(__WORKGROUP_SIZE__) fn compute_something(
    @builtin(workgroup_id) workgroup_id: vec3u,
    @builtin(local_invocation_id) local_invocation_id: vec3u,
    @builtin(global_invocation_id) global_invocation_id: vec3u,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3u,
) {

    // workgroup_index is like local_invocation_index except for workgroups,
    // not threads. It's not a builtin
    let workgroup_index =
        workgroup_id.x +
        workgroup_id.y * num_workgroups.x +
        workgroup_id.z * num_workgroups.x * num_workgroups.y;

    // like local_invocation_index but globally. Also not built in
    let global_invocation_index =
        workgroup_index * __NUM_THREADS_PER_WORKGROUP__ +
        local_invocation_index;

    // write results
    workgroup_result[global_invocation_index] = workgroup_id;
    local_result[global_invocation_index] = local_invocation_id;
    global_result[global_invocation_index] = global_invocation_id;
}
