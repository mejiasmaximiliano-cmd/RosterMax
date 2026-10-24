import test from 'node:test';
import assert from 'node:assert/strict';
import { syncLabel } from '../src/lib/syncPresentation.js';
import { readForm, markFormSaved, formChanged, containerChanged } from '../src/lib/formGuard.js';

const input=(value,extra={})=>({tagName:'INPUT',type:'text',name:'',value,...extra});
test('dirty tracking includes unnamed controlled fields, excludes submit controls and recognizes reverting text',()=>{
  const title=input(''),form={elements:[title,input('Guardar',{type:'submit'})]};
  markFormSaved(form); assert.equal(formChanged(form),false);
  title.value='Pendiente'; assert.equal(formChanged(form),true);
  title.value=''; assert.equal(formChanged(form),false);
});
test('a server acknowledgement preserves a later unsaved edit; disabling fields does not change the snapshot',()=>{
  const value=input('Primero'),form={elements:[value]}; const submitted=readForm(form);
  value.disabled=true; assert.equal(readForm(form),submitted);
  value.value='Edición posterior'; markFormSaved(form,submitted); assert.equal(formChanged(form),true);
});
test('discard inspection is scoped and distinguishes checkbox changes and null roots',()=>{
  const box=input('yes',{type:'checkbox',checked:false}), form={elements:[box],matches:value=>value==='form'};
  markFormSaved(form); assert.equal(containerChanged(form),false); box.checked=true; assert.equal(containerChanged(form),true);
  assert.equal(containerChanged(null),false); assert.equal(containerChanged({querySelectorAll:()=>[]}),false);
});
test('sync messages distinguish confirmed, local, pending and failed without backend mutations',()=>{
  assert.equal(syncLabel({}),'Sincronizado');
  for(const key of ['cached','offline']) assert.match(syncLabel({[key]:true}),/Guardado en este dispositivo.*sin comprobación/);
  assert.match(syncLabel({pending:true}),/Pendiente de sincronizar/);
  assert.match(syncLabel({error:true,pending:true,cached:true}),/^Error/);
  assert.doesNotMatch(syncLabel({offline:true}),/Sincronizado/);
});
