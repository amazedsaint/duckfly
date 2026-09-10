"""Behavioral contract checks for the packaged engine. Run with its private Python."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('worker',ROOT/'Engine/worker.py')
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.world=worker.World(ROOT.parent/'shared/assets')
    def setUp(self): self.world.reset()
    def test_reset_replays_physics(self):
        def run():
            return [self.world.step(.3,0)['position'] for _ in range(60)]
        first=run();self.world.reset();second=run()
        self.assertEqual(first,second)
    def test_forward_is_physical_stepping(self):
        for _ in range(500):state=self.world.step(.3,0)
        self.assertFalse(state['fallen'])
        self.assertGreater(state['distance'],.5)
        self.assertGreater(min(state['onsets']),5)
        print('forward receipt',json.dumps({k:state[k] for k in ['position','heading','distance','tilt','onsets']}))
    def test_command_contract(self):
        self.world.set_command(.9,-2)
        self.assertEqual(self.world.policy.get_observations().shape,(61,))
        self.assertEqual(self.world.vx,.3)
        self.assertEqual(self.world.yaw,-.8)
        with self.assertRaises(ValueError):self.world.set_command(float('nan'),0)
    def test_fallen_body_stops_intent(self):
        self.world.fallen=True
        self.assertEqual(self.world.step(.3,.65)['command'],[0,0])
    def test_visual_poses_match_physics(self):
        import numpy as np
        s=self.world.step(.3,0)
        for gid,p in zip(self.world.visual_ids,s['poses']):
            np.testing.assert_array_equal(p[:3],self.world.data.geom_xpos[gid])
        self.assertGreater(len(s['poses']),10)

if __name__=='__main__':unittest.main()
