// Equivalent sparse Float32 update to Flyvis PPNeuronIGRSynapses.
// No fast-math or reassociation; preserve source edge accumulation order.
#[no_mangle]
pub extern "C" fn allocate(count: usize) -> *mut f32 {
    let mut data = vec![0.0f32; count];
    let pointer = data.as_mut_ptr();
    std::mem::forget(data);
    pointer
}
#[no_mangle]
pub unsafe extern "C" fn release(pointer: *mut f32, count: usize) {
    drop(Vec::from_raw_parts(pointer,count,count));
}
#[no_mangle]
pub unsafe extern "C" fn step(n: usize, e: usize, source: *const u32, target: *const u32,
    weight: *const f32, bias: *const f32, tau: *const f32, input: *const f32,
    state: *mut f32, current: *mut f32, dt: f32) {
    let src=std::slice::from_raw_parts(source,e);let dst=std::slice::from_raw_parts(target,e);
    let w=std::slice::from_raw_parts(weight,e);let b=std::slice::from_raw_parts(bias,n);
    let t=std::slice::from_raw_parts(tau,n);let x=std::slice::from_raw_parts(input,n);
    let v=std::slice::from_raw_parts_mut(state,n);let sum=std::slice::from_raw_parts_mut(current,n);
    sum.fill(0.0);
    for k in 0..e {sum[dst[k] as usize] += w[k]*v[src[k] as usize].max(0.0);}
    for i in 0..n {v[i] += (1.0/t[i].max(dt))*((-v[i]+b[i])+sum[i]+x[i])*dt;}
}
