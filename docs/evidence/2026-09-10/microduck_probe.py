"""Read-only feasibility probe of pinned upstream inference code; no training."""
import contextlib, hashlib, importlib.util, json, platform, sys, time
from pathlib import Path
import mujoco
import numpy as np
import onnxruntime as ort
ROOT = Path('/tmp/duckfly-research.wzrXXM')
REPO = ROOT / 'microduck-rl-upstream'
spec = importlib.util.spec_from_file_location('upstream_infer', REPO / 'scripts/infer_policy.py')
ip = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ip)
model_path = ROOT / 'alpha_walking.onnx'
session = ort.InferenceSession(str(model_path), providers=['CPUExecutionProvider'])
report = {'scope': 'Single-body CPU simulation and inference. No fly bridge, rendering, training, or hardware validation. BAM and XML-PD use upstream inference defaults; actuator delay disabled. Fall threshold is a diagnostic, not a certified gate.', 'python':sys.version, 'platform':platform.platform(), 'mujoco':mujoco.__version__, 'onnxruntime':ort.__version__, 'policy_sha256':hashlib.sha256(model_path.read_bytes()).hexdigest(), 'policy_inputs':[(x.name,x.shape) for x in session.get_inputs()], 'policy_outputs':[(x.name,x.shape) for x in session.get_outputs()], 'policy_metadata':session.get_modelmeta().custom_metadata_map, 'trials':[]}
for use_bam in [False, True]:
    for name, command in [('idle',(0.,0.,0.)), ('forward',(0.1,0.,0.)), ('backward',(-0.1,0.,0.)), ('turn',(0.,0.,0.3))]:
        row = {'actuators':'bam' if use_bam else 'xml_pd', 'condition':name, 'command':command}
        report['trials'].append(row)
        try:
            with contextlib.redirect_stdout(sys.stderr):
                if use_bam:
                    b = ip.load_bam_model(ip.BAM_KP_FW, 7.4, ip.BAM_MAX_CURRENT)
                    m,d,ctrl,names=ip.load_mujoco_with_bam(str(REPO/ip.MICRODUCK_XML),b,0.005,0.1,ip.BAM_VIN_MIN)
                else:
                    m=mujoco.MjModel.from_xml_path(str(REPO/ip.MICRODUCK_XML)); m.opt.timestep=.005; d=mujoco.MjData(m); ctrl=None
                p=ip.PolicyInference(m,d,walking_onnx_path=str(model_path),new_cmd_obs=True,bam_ctrl=ctrl,use_projected_gravity=True)
            fj=mujoco.mj_name2id(m,mujoco.mjtObj.mjOBJ_JOINT,'trunk_base_freejoint'); qa=m.jnt_qposadr[fj]
            d.qpos[qa:qa+3]=[0,0,.125]; d.qpos[qa+3:qa+7]=[1,0,0,0]
            d.qpos[p.joint_qpos_indices]=p.default_pose
            if ctrl is not None: ctrl.reset(d.qpos)
            p.set_position_targets(p.default_pose)
            mujoco.mj_forward(m,d)
            p.set_vel_cmd(*command)
            assert np.allclose(p.get_observations()[3:6], [0,0,-1]), "initial gravity frame"
            assert np.allclose(p.get_observations()[48:51], command), "command slots"
            times=[]; first_fall=None; height=[]; tilt=[]; forward=0.; finite=True
            for tick in range(500):
                t=time.perf_counter(); a=p.infer(); p.apply_action(a)
                for _ in range(4):
                    if ctrl is not None: ctrl.update()
                    mujoco.mj_step(m,d)
                times.append((time.perf_counter()-t)*1000)
                g=p.get_projected_gravity(); angle=float(np.degrees(np.arccos(np.clip(-g[2],-1,1))))
                height.append(float(d.qpos[qa+2])); tilt.append(angle)
                finite = finite and bool(np.isfinite(d.qpos).all() and np.isfinite(a).all())
                if first_fall is None and (height[-1]<.055 or angle>60): first_fall=(tick+1)*.02
                if not finite: break
            row.update(simulated_s=float(d.time), wall_compute_s=sum(times)/1000, real_time_factor=float(d.time)/(sum(times)/1000), tick_ms={q:float(np.percentile(times,x)) for q,x in [('p50',50),('p95',95),('p99',99)]}, tick_max_ms=max(times), missed_20ms=sum(t>20 for t in times), first_fall_s=first_fall, finite=finite, minimum_trunk_z=min(height), max_tilt_degrees=max(tilt), final_xyz=d.qpos[qa:qa+3].tolist(), actuator_count=m.nu)
        except Exception as e:
            row['error']=repr(e)
(ROOT/'microduck-probe.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
