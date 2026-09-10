"""Export an editable MJCF template without duplicating render-only mesh data.

Physical collision meshes and source inertials are retained. Three.js continues
to render the original mesh geometry at the compiled visual geometry frames.
Python is needed only to regenerate this committed asset, never to deploy it.
"""
from pathlib import Path
import base64
import copy
import gzip
import hashlib
import importlib.util
import json
import tempfile
import xml.etree.ElementTree as ET
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('worker', ROOT/'mac/Engine/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
w = worker.World(ROOT/'shared/assets')
m, mj = w.model, w.mj
source = ROOT/'shared/assets/Robot'
root = ET.parse(source/'robot_groundcontact.xml').getroot()
world = root.find('worldbody')
ET.SubElement(world, 'geom', name='floor', type='plane', size='0 0 0.05')
ET.SubElement(root, 'option', timestep='0.005')
root.find('compiler').set('meshdir', 'collision')
fmt = lambda a: ' '.join(format(float(v), '.17g') for v in np.ravel(a))

# The source camera's optical axis points into the head. Keep its lens position,
# but orient the optical -Z along the lens' outward -Z and screen up along the
# head's +X. This is a rigid mounting transform, not a stabilized world camera.
camera = next(c for c in world.iter('camera') if c.get('name') == 'head_camera')
camera.set('quat', fmt([np.sqrt(.5), 0, 0, -np.sqrt(.5)]))

visual_names = []
collision_meshes = set()
for body in [world, *world.iter('body')]:
    bid = 0 if body is world else mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY, body.get('name'))
    gids = np.flatnonzero(m.geom_bodyid == bid)
    geoms = body.findall('geom')
    assert len(gids) == len(geoms)
    for gid, geom in zip(gids, geoms):
        if m.geom_group[gid] == 2:
            name = f'visual_{gid}'
            visual_names.append((int(gid), name))
            geom.set('name', name)
            geom.set('type', 'sphere')
            geom.set('size', '.0001')
            geom.set('pos', fmt(m.geom_pos[gid]))
            geom.set('quat', fmt(m.geom_quat[gid]))
            geom.attrib.pop('mesh', None)
        elif 'mesh' in geom.attrib:
            collision_meshes.add(geom.get('mesh'))
        if not geom.get('name'):
            geom.set('name', f'collision_{gid}')

config = json.loads((ROOT/'shared/assets/Simulation/config.json').read_text())
limit = config['bam']['vin'] * config['bam']['kt'] / config['bam']['R']
actuators = root.find('actuator')
for act in actuators:
    act.tag = 'motor'
    act.set('forcelimited', 'true')
    act.set('forcerange', fmt([-limit, limit]))
    act.set('ctrllimited', 'false')
    act.set('gear', '1 0 0 0 0 0')
    joint = next(j for j in world.iter('joint') if j.get('name') == act.get('joint'))
    joint.set('damping', '0')
    joint.set('frictionloss', '0')
    joint.set('armature', str(config['bam']['armature']))
    joint.set('solreffriction', '-50000 -200')
    joint.set('solimpfriction', '.99 .9999 .001 .5 2')

assets = root.find('asset')
files = {}
for asset in list(assets):
    if asset.tag != 'mesh':
        continue
    filename = asset.get('file')
    name = asset.get('name', Path(filename).stem)
    if name not in collision_meshes:
        assets.remove(asset)
    else:
        raw = (source/'assets'/filename).read_bytes()
        files[filename] = base64.b64encode(raw).decode()

# Confirm that removing visual-only meshes has not changed the physical model.
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    (tmp/'collision').mkdir()
    for name, raw in files.items():
        (tmp/'collision'/name).write_bytes(base64.b64decode(raw))
    (tmp/'model.xml').write_text(ET.tostring(root, encoding='unicode'))
    light = mj.MjModel.from_xml_path(str(tmp/'model.xml'))
    checked = {}
    for field in ['body_mass', 'body_inertia', 'body_ipos', 'body_iquat',
                  'body_pos', 'body_quat', 'jnt_pos', 'jnt_axis', 'jnt_range',
                  'dof_armature', 'dof_damping', 'dof_frictionloss',
                  'actuator_gainprm', 'actuator_biasprm', 'actuator_forcerange',
                  'geom_contype', 'geom_conaffinity', 'geom_friction', 'geom_solref']:
        delta = float(np.max(np.abs(getattr(light, field) - getattr(m, field))))
        checked[field] = delta
        assert delta < 1e-12, (field, delta)
    data = mj.MjData(light)
    data.qpos[:] = w.data.qpos
    mj.mj_forward(light, data)
    checked['geom_xpos'] = float(np.max(np.abs(data.geom_xpos-w.data.geom_xpos)))
    checked['geom_xmat'] = float(np.max(np.abs(data.geom_xmat-w.data.geom_xmat)))
    assert checked['geom_xpos'] < 1e-10
    assert checked['geom_xmat'] < 1e-10

body = world.find('body')
world.remove(body)
sensors = root.find('sensor')
root.remove(sensors)
root.remove(actuators)
common = ET.tostring(root, encoding='unicode')
template = dict(version=1, common=common,
    body=ET.tostring(body, encoding='unicode'),
    sensors=''.join(ET.tostring(s, encoding='unicode') for s in sensors),
    actuators=''.join(ET.tostring(a, encoding='unicode') for a in actuators),
    files=files, config=config,
    names=dict(visual=[name for _, name in sorted(visual_names)],
               actuators=[a.get('name') for a in actuators],
               feet=['left_foot_collision', 'right_foot_collision'],
               trunk='trunk_base', head='jaw_soft', camera='head_camera', gyro='imu_ang_vel'))
out = ROOT/'shared/assets/Simulation/lab-template.json.gz'
raw = json.dumps(template, separators=(',', ':')).encode()
out.write_bytes(gzip.compress(raw, mtime=0))
receipt = dict(templateSHA256=hashlib.sha256(raw).hexdigest(),
    compressedBytes=out.stat().st_size, collisionMeshes=len(files),
    retainedVisualFrames=len(visual_names), nativeParity=checked)
receipt_path = ROOT/'docs/implementation/lab-template-evidence.json'
receipt_path.write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt, indent=2))
