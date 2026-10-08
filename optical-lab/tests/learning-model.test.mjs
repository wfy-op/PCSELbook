import test from 'node:test';
import assert from 'node:assert/strict';
import { componentResult, challengeScene, evaluateChallenge, addExpansionLens } from '../app/training/learning-model.ts';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('single-component lessons compute refraction, reflection, clipping and absorption', () => {
  const positive = componentResult('positive',280,0,100);
  const negative = componentResult('negative',280,0,100);
  const atExit = r => r.result.segments.filter(s => s.event==='escape').map(s=>s.end.y);
  assert.ok(Math.max(...atExit(negative)) > Math.max(...atExit(positive)));
  const mirror = componentResult('mirror',280,0,-45);
  assert.ok(mirror.result.segments.some(s=>Math.abs(s.end.x-s.start.x)<1e-7 && s.end.y>s.start.y));
  const iris = componentResult('iris',280,0,4);
  assert.ok(iris.result.energy.absorbed>0);
  near(componentResult('block',280,0,100).result.energy.absorbed,1);
  near(componentResult('post',280,0,100).result.energy.escaped,1);
  near(componentResult('sensor',280,0,16).result.energy.captured,1);
  assert.ok(componentResult('sensor',280,35,16).result.energy.captured<1);
  for (const id of ['positive','negative','mirror','iris','block','sensor','post','mount','achromat']) {
    const {energy}=componentResult(id,280,0,id==='mirror'?-45:id==='iris'||id==='sensor'?16:100).result;
    near(energy.captured+energy.escaped+energy.absorbed+energy.unresolved,energy.input);
  }
});
test('challenge grade requires calculation, question and actual unblocked trace', () => {
  const focus=challengeScene(0); focus.screen=300;
  assert.equal(evaluateChallenge(0,'100',1,focus).complete,true);
  assert.equal(evaluateChallenge(0,'',1,focus).complete,false);
  assert.equal(evaluateChallenge(0,'100',0,focus).complete,false);
  focus.screen=400; assert.equal(evaluateChallenge(0,'100',1,focus).complete,false);
  const expand=addExpansionLens(challengeScene(1)); expand.elements[1].z=250;
  assert.equal(evaluateChallenge(1,'150',0,expand).complete,true);
  expand.elements[0].aperture=.01;
  assert.equal(evaluateChallenge(1,'150',0,expand).complete,false);
  const collimate=challengeScene(2); collimate.elements[0].z=50;
  assert.equal(evaluateChallenge(2,'50',1,collimate).complete,true);
  collimate.sourceModel='extended';
  assert.equal(evaluateChallenge(2,'50',1,collimate).complete,false);
});
