"""Development only: freeze the native MuJoCo model and independent port fixtures.
Run using mac/.build/python/.../bin/python3.12 web/scripts/export-reference.py.
Vercel consumes committed outputs; Python is not a web build dependency.
"""
import importlib.util
import json
from pathlib import Path
import hashlib
import gzip
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('worker', ROOT/'mac/Engine/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
w = worker.World(ROOT/'shared/assets')
out = ROOT/'shared/assets/Simulation'
out.mkdir(exist_ok=True)
w.mj.mj_saveModel(w.model, str(out/'microduck.mjb'))
p = w.bam.model
config = dict(version=w.mj.__version__, qpos=w.policy.joint_qpos_indices,
    qvel=w.policy.joint_qvel_indices, joints=[int(v) for v in w.bam.joint_indexes],
    defaultPose=w.policy.default_pose.tolist(), trunk=w.trunk, qa=w.qa,
    gyro=int(w.model.sensor_adr[w.policy.imu_ang_vel_id]), feet=w.foot_ids,
    floor=w.floor_id, visualIds=w.visual_ids, actionScale=w.policy.action_scale,
    bam={**p.get_parameter_values(), 'kp':p.actuator.kp,'vin':p.actuator.vin,
         'errorGain':p.actuator.error_gain,'maxPWM':p.actuator.max_pwm,
         'voltageDrop':w.bam.vin_drop_gain,'voltageMin':w.bam.vin_min},
    modelSHA256=hashlib.sha256((out/'microduck.mjb').read_bytes()).hexdigest())
(out/'config.json').write_text(json.dumps(config,indent=2))
(out/'microduck.mjb.gz').write_bytes(gzip.compress((out/'microduck.mjb').read_bytes(), mtime=0))
(out/'microduck.mjb').unlink()
# Independent numeric vectors exercise saturation, back-EMF and directional friction.
rng=np.random.default_rng(123)
cases=[]
for _ in range(128):
    target,q,dq,mt,ext=rng.uniform(-3,3,5); dq*=5
    voltage=p.actuator.compute_control(target,q,dq,.005)
    torque=p.actuator.compute_torque(voltage,True,q,dq)
    friction,damping=p.compute_frictions(mt,ext,dq)
    cases.append(dict(target=target,q=q,dq=dq,motor=mt,external=ext,
        torque=float(torque),friction=float(friction),damping=float(damping)))
policy=[]
for _ in range(8):
    obs=rng.uniform(-1,1,61).astype(np.float32)
    a=w.policy.walking_session.run(None,{w.policy.input_name:obs.reshape(1,61)})[0][0]
    policy.append(dict(obs=obs.tolist(),action=a.tolist()))
initial=w.state(0)
trajectory=[]
for _ in range(20):
    state=w.step(.3,0)
    trajectory.append(dict(position=state['position'],joints=state['joints']))
(ROOT/'web/tests/fixtures/native.json').write_text(json.dumps(dict(bam=cases,policy=policy,
    initial=initial,trajectory=trajectory),separators=(',',':')))
print('Exported MuJoCo',w.mj.__version__,config['modelSHA256'])
