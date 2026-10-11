/* Privacy choices: withdrawal code never enters the address bar, analytics or storage. */
(()=>{'use strict';
 const form=document.getElementById('private-record-withdrawal');
 if(!form)return;
 const status=document.getElementById('withdrawal-status');
 const input=document.getElementById('withdrawal-code');
 const button=document.getElementById('withdrawal-submit');
 const endpoint=String(window.CG_CONFIG?.scannerEndpoint||'').trim().replace(/\/$/,'');
 const local=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='8000'&&endpoint==='http://127.0.0.1:8787';
 const production=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(endpoint);
 if(!local&&!production){form.hidden=true;return;}
 fetch(endpoint+'/capabilities',{credentials:'omit',referrerPolicy:'no-referrer'})
  .then(r=>r.ok?r.json():null)
  .then(data=>{form.hidden=!data?.withdrawal;})
  .catch(()=>{form.hidden=true;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const code=input.value.trim().toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(code)){
    status.textContent='Enter the 64-character deletion code you received after sharing.';return;
  }
  button.disabled=true;status.textContent='Processing your request…';
  try{
   const r=await fetch(endpoint+'/withdraw',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
   if(!r.ok) throw Error('Could not process the request. Please email the privacy contact address below.');
   status.textContent='Request processed. If a matching active record existed, it was deleted. This does not delete separate correspondence or third-party security logs.';
   input.value='';
  }catch(err){status.textContent=err.message;}
  finally{button.disabled=false;}
 });
})();
