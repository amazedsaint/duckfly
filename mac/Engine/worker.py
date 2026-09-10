"""DuckFly physics worker: 50 Hz policy, 200 Hz MuJoCo/BAM, JSON over private pipes."""
from __future__ import annotations
import argparse
import base64
import contextlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import time


def load_reference(resources):
    vendor = resources / 'ThirdParty'
    if not vendor.exists():
        vendor = Path(__file__).resolve().parents[1] / 'ThirdParty'
    sys.path.insert(0, str(vendor / 'BAM'))
    spec = importlib.util.spec_from_file_location('microduck_reference', vendor / 'Microduck/infer_policy.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class World:
    def __init__(self, resources):
        import mujoco
        import numpy as np
        self.mj, self.np = mujoco, np
        self.ref = load_reference(resources)
        with contextlib.redirect_stdout(sys.stderr):
            b = self.ref.load_bam_model(self.ref.BAM_KP_FW, 7.4, None)
            self.model, self.data, self.bam, _ = self.ref.load_mujoco_with_bam(
                str(resources / 'Robot/scene.xml'), b, .005, .1, self.ref.BAM_VIN_MIN)
            self.policy = self.ref.PolicyInference(self.model, self.data,
                walking_onnx_path=str(resources / 'Policies/alpha_walking.onnx'),
                bam_ctrl=self.bam, new_cmd_obs=True, use_projected_gravity=True)
        m = self.model
        self.visual_ids = [i for i in range(m.ngeom) if m.geom_group[i] == 2 and m.geom_rgba[i,3] > 0]
        self.foot_ids = [mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, n)
                         for n in ('left_foot_collision', 'right_foot_collision')]
        self.floor_id = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, 'floor')
        self.trunk = self.policy.trunk_base_id
        self.qa = int(m.jnt_qposadr[mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, 'trunk_base_freejoint')])
        assert m.nu == 14
        assert self.policy.walking_session.get_inputs()[0].shape == [1,61]
        assert self.policy.walking_session.get_outputs()[0].shape == [1,14]
        self.reset()

    def reset(self):
        m,d,p,np = self.model,self.data,self.policy,self.np
        self.mj.mj_resetData(m,d)
        d.qpos[self.qa:self.qa+3] = [0,0,.125]
        d.qpos[self.qa+3:self.qa+7] = [1,0,0,0]
        d.qpos[p.joint_qpos_indices] = p.default_pose
        self.bam.reset(d.qpos)
        p.last_action[:] = 0
        self.set_command(0,0)
        p.set_position_targets(p.default_pose)
        self.mj.mj_forward(m,d)
        self.distance = 0.
        self.last_position = d.qpos[self.qa:self.qa+2].copy()
        self.fallen = False
        self.contacts = [False,False]
        self.contact_onsets = [0,0]
        self.push_ticks = 0
        assert np.allclose(p.get_observations()[3:6], [0,0,-1])
        return self.state(0)

    def set_command(self, vx, yaw):
        if not math.isfinite(vx) or not math.isfinite(yaw):
            raise ValueError('Non-finite command')
        self.vx = min(.3,max(0.,vx))
        self.yaw = min(.8,max(-.8,yaw))
        self.policy.vel_cmd[:] = [self.vx,0,self.yaw]
        self.policy._update_command()

    def step(self, vx, yaw):
        start = time.perf_counter()
        np,m,d,p = self.np,self.model,self.data,self.policy
        self.set_command(0 if self.fallen else vx, 0 if self.fallen else yaw)
        a = p.infer()
        if not np.isfinite(a).all():
            raise ValueError('Non-finite policy action')
        p.apply_action(a)
        d.xfrc_applied[:] = 0
        if self.push_ticks:
            d.xfrc_applied[self.trunk,1] = .8
            self.push_ticks -= 1
        for _ in range(4):
            self.bam.update()
            self.mj.mj_step(m,d)
            contacts = [False,False]
            for c in d.contact:
                for side,gid in enumerate(self.foot_ids):
                    if gid in (c.geom1,c.geom2) and self.floor_id in (c.geom1,c.geom2):
                        contacts[side] = True
            for side in range(2):
                self.contact_onsets[side] += int(contacts[side] and not self.contacts[side])
            self.contacts = contacts
        if not np.isfinite(d.qpos).all():
            raise ValueError('Non-finite physics state')
        xy=d.qpos[self.qa:self.qa+2]
        self.distance += float(np.linalg.norm(xy-self.last_position))
        self.last_position=xy.copy()
        return self.state((time.perf_counter()-start)*1000)

    def state(self, cost):
        d,p,np = self.data,self.policy,self.np
        gravity=p.get_projected_gravity()
        tilt=float(np.degrees(np.arccos(np.clip(-gravity[2],-1,1))))
        self.fallen = self.fallen or tilt>60 or d.qpos[self.qa+2]<.055
        q=d.qpos[self.qa+3:self.qa+7]
        heading=math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]**2+q[3]**2))
        poses=[]
        for gid in self.visual_ids:
            rotation=np.zeros(4)
            self.mj.mju_mat2Quat(rotation,d.geom_xmat[gid])
            poses.append([*d.geom_xpos[gid].tolist(),*rotation.tolist()])
        jp=p.get_joint_pos_relative(); jv=p.get_joint_vel()
        # A measured joint phase proxy, not a generated gait oscillator.
        phase=(math.atan2(float(jv[2]-jv[11])*.05,float(jp[2]-jp[11]))/(2*math.pi))%1
        return dict(kind='state',time=float(d.time),poses=poses,position=d.qpos[self.qa:self.qa+3].tolist(),
            heading=heading,speed=float(np.linalg.norm(d.qvel[:2])),tilt=tilt,distance=self.distance,
            contacts=self.contacts,onsets=self.contact_onsets,joints=d.qpos[p.joint_qpos_indices].tolist(),
            phase=phase,fallen=bool(self.fallen),cost=cost,command=[self.vx,self.yaw])

    def scene(self):
        m,np=self.model,self.np
        meshes={}; geometries=[]
        for gid in self.visual_ids:
            mid=int(m.geom_dataid[gid])
            if int(m.geom_type[gid]) != int(self.mj.mjtGeom.mjGEOM_MESH):
                raise ValueError('Expected mesh visuals')
            if mid not in meshes:
                va,vc=int(m.mesh_vertadr[mid]),int(m.mesh_vertnum[mid])
                fa,fc=int(m.mesh_faceadr[mid]),int(m.mesh_facenum[mid])
                verts=m.mesh_vert[va:va+vc].astype(float)
                faces=m.mesh_face[fa:fa+fc]
                na,nc=int(m.mesh_normaladr[mid]),int(m.mesh_normalnum[mid])
                normals=m.mesh_normal[na:na+nc]
                face_normals=m.mesh_facenormal[fa:fa+fc]
                pairs=np.stack((faces.reshape(-1),face_normals.reshape(-1)),axis=1)
                unique,indices=np.unique(pairs,axis=0,return_inverse=True)
                def encode(array,dtype):
                    return base64.b64encode(np.ascontiguousarray(array,dtype=dtype).tobytes()).decode('ascii')
                meshes[mid]=dict(vertices=encode(verts[unique[:,0]],'<f4'),
                    normals=encode(normals[unique[:,1]],'<f4'),indices=encode(indices,'<u4'))
            material=int(m.geom_matid[gid])
            rgba=m.mat_rgba[material] if material>=0 else m.geom_rgba[gid]
            geometries.append(dict(id=gid,mesh=mid,color=rgba.astype(float).tolist()))
        return dict(meshes=meshes,geometries=geometries)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--resources',type=Path,required=True)
    parser.add_argument('--export-scene',type=Path)
    args=parser.parse_args()
    world=World(args.resources)
    if args.export_scene:
        args.export_scene.write_text(json.dumps(world.scene(),separators=(',',':')))
        return
    def send(x):
        print(json.dumps(x,separators=(',',':'),allow_nan=False),flush=True)
    send(world.state(0))
    for line in sys.stdin:
        try:
            request=json.loads(line)
            op=request.get('op')
            if op=='reset': result=world.reset()
            elif op=='step': result=world.step(float(request.get('vx',0)),float(request.get('yaw',0)))
            elif op=='push': world.push_ticks=10; result=world.state(0)
            elif op=='quit': break
            else: raise ValueError('Unknown operation')
            send(result)
        except Exception as e:
            send(dict(kind='error',message=str(e)))

if __name__=='__main__':
    main()
