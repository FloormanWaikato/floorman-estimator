const state = {};
let currentStep = 1;
const stepNames = ["What do you want done?","Tell us about the floor","What result are you after?","A few job details","Photos, comments and contact details"];

const intro = document.getElementById('introScreen');
const wizard = document.getElementById('wizard');
const result = document.getElementById('resultScreen');
const form = document.getElementById('estimateForm');

function showStep(step){
  currentStep = step;
  document.querySelectorAll('.step').forEach(s=>s.classList.toggle('active', Number(s.dataset.step)===step));
  document.getElementById('stepLabel').textContent = `Step ${step} of 5`;
  document.getElementById('stepName').textContent = stepNames[step-1];
  document.getElementById('progressFill').style.width = `${step*20}%`;
  document.getElementById('backBtn').style.visibility = step===1 ? 'hidden' : 'visible';
  document.getElementById('nextBtn').textContent = step===5 ? 'Show prototype estimate' : 'Continue';
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('startBtn').addEventListener('click',()=>{
  intro.classList.add('hidden'); wizard.classList.remove('hidden'); showStep(1);
});

document.querySelectorAll('.single-choice').forEach(group=>{
  group.addEventListener('click',e=>{
    const btn=e.target.closest('[data-value]'); if(!btn) return;
    group.querySelectorAll('[data-value]').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    state[group.dataset.name]=btn.dataset.value;
    if(group.dataset.name==='service') document.getElementById('serviceOtherWrap').classList.toggle('hidden',btn.dataset.value!=='Other / Not sure');
    if(group.dataset.name==='measure_mode') updateMeasureMode(btn.dataset.value);
    if(group.dataset.name==='cleared') document.getElementById('clearedNote').classList.toggle('hidden',btn.dataset.value==='Yes');
  });
});

function updateMeasureMode(value){
  document.getElementById('knownAreaWrap').classList.toggle('hidden',value!=='Known area');
  document.getElementById('roomCalcWrap').classList.toggle('hidden',value!=='Room calculator');
  if(value==='Room calculator' && document.querySelectorAll('.room-row').length===0) addRoom();
}

document.querySelector('[name="timber_type"]').addEventListener('change',e=>{
  document.getElementById('timberOther').classList.toggle('hidden',e.target.value!=='Other');
});

document.getElementById('coveringSelect').addEventListener('change',e=>{
  document.getElementById('carpetQuestions').classList.toggle('hidden',e.target.value!=='Carpet');
});

document.getElementById('projectType').addEventListener('change',e=>{
  document.getElementById('projectStage').classList.toggle('hidden',!e.target.value.startsWith('Yes'));
});

function enforceExclusiveCheckboxes(name, exclusiveValues){
  const boxes=[...form.querySelectorAll(`input[name="${name}"]`)];
  boxes.forEach(box=>box.addEventListener('change',()=>{
    if(!box.checked) return;
    if(exclusiveValues.includes(box.value)){
      boxes.forEach(other=>{if(other!==box) other.checked=false;});
    } else {
      boxes.forEach(other=>{if(exclusiveValues.includes(other.value)) other.checked=false;});
    }
  }));
}
enforceExclusiveCheckboxes('access',['Straightforward access','Not sure']);
enforceExclusiveCheckboxes('condition',['Nothing obvious','Not sure']);

let photoInput=null;
let photoList=null;
function setupPhotoPicker(){
  const placeholder=document.querySelector('.upload-placeholder');
  if(!placeholder) return;
  placeholder.innerHTML=`<strong>Add photos</strong><span>Overall floor, close-up of timber, and any damaged areas</span><input id="photos" name="photos" type="file" accept="image/*" multiple><span class="muted">Optional — up to 5 photos. They are selected on your device but are not uploaded yet.</span><div id="photoList" class="muted"></div>`;
  photoInput=document.getElementById('photos');
  photoList=document.getElementById('photoList');
  photoInput.addEventListener('change',()=>{
    const files=[...photoInput.files];
    if(files.length>5){
      alert('Please select up to 5 photos.');
      photoInput.value='';
      photoList.textContent='';
      return;
    }
    photoList.innerHTML=files.length ? files.map(f=>`<div>${escapeHtml(f.name)}</div>`).join('') : '';
  });
}
setupPhotoPicker();

function addRoom(){
  const wrap=document.getElementById('roomRows');
  const row=document.createElement('div'); row.className='room-row';
  row.innerHTML=`<select class="room-name"><option>Kitchen</option><option>Dining</option><option>Lounge / Living</option><option>Hallway</option><option>Bedroom</option><option>Entrance / Foyer</option><option>Other</option></select><input class="room-length" type="number" min="0" step="0.1" placeholder="Length m"><input class="room-width" type="number" min="0" step="0.1" placeholder="Width m"><button class="remove-room" type="button" title="Remove">×</button>`;
  wrap.appendChild(row);
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calcRooms));
  row.querySelector('.remove-room').addEventListener('click',()=>{row.remove();calcRooms();});
}
function calcRooms(){
  let total=0; document.querySelectorAll('.room-row').forEach(r=>{total+=(Number(r.querySelector('.room-length').value)||0)*(Number(r.querySelector('.room-width').value)||0)});
  document.getElementById('roomTotal').textContent=total.toFixed(1);
}
document.getElementById('addRoomBtn').addEventListener('click',addRoom);

document.getElementById('backBtn').addEventListener('click',()=>{if(currentStep>1) showStep(currentStep-1)});
document.getElementById('nextBtn').addEventListener('click',()=>{
  if(currentStep<5){showStep(currentStep+1);return;}
  if(!form.reportValidity()) return;
  buildSummary(); wizard.classList.add('hidden'); result.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'});
});

document.getElementById('restartBtn').addEventListener('click',()=>{
  result.classList.add('hidden'); intro.classList.remove('hidden'); form.reset();
  document.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));
  document.querySelectorAll('#roomRows .room-row').forEach(e=>e.remove());
  if(photoList) photoList.textContent='';
  Object.keys(state).forEach(k=>delete state[k]);
});

function roomSummary(){
  if(state.measure_mode==='Known area') return `${form.elements.known_area.value||'Not entered'} m²`;
  if(state.measure_mode==='Not sure') return 'Not sure';
  if(state.measure_mode==='Room calculator'){
    const parts=[]; document.querySelectorAll('.room-row').forEach(r=>{
      const n=r.querySelector('.room-name').value, l=Number(r.querySelector('.room-length').value)||0, w=Number(r.querySelector('.room-width').value)||0;
      if(l&&w) parts.push(`${n} ${(l*w).toFixed(1)} m²`);
    });
    return parts.length?`${parts.join(', ')} — total ${document.getElementById('roomTotal').textContent} m²`:'No measurements entered';
  }
  return 'Not selected';
}

function checked(name){return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value).join(', ')||'None selected'}
function value(name){return form.elements[name]?.value||'Not entered'}

function buildSummary(){
  const timber=value('timber_type')==='Other' ? value('timber_other') : value('timber_type');
  const rows=[
    ['Service',state.service||'Not selected'],['Area',roomSummary()],['Timber',timber],['Current floor covering',value('covering')],['Desired appearance',state.appearance||'Not selected'],['Floor condition',checked('condition')],['Areas cleared',state.cleared||'Not selected'],['Access',checked('access')],['Project type',value('project_type')],['Timeframe',value('timeframe')],['Photos',photoInput?.files?.length ? `${photoInput.files.length} selected` : 'None selected'],['Customer',value('name')],['Phone',value('phone')],['Email',value('email')],['Job address',value('address')],['Comments',value('comments')]
  ];
  document.getElementById('summary').innerHTML=rows.map(([k,v])=>`<div class="summary-row"><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`).join('');
}
function escapeHtml(str){return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
