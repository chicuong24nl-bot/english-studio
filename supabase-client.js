const SUPA=window.SUPABASE_CONFIG||{url:'',anonKey:''};
const SUPA_SESSION_KEY='es-supabase-session';
function supaSession(){try{return JSON.parse(localStorage.getItem(SUPA_SESSION_KEY)||'null')}catch{return null}}
function supaConfigured(){return Boolean(SUPA.url&&SUPA.anonKey)}
async function supaRequest(path,{method='GET',body,token}={}){
 if(!supaConfigured())throw Error('Supabase chưa được cấu hình: thêm anon/public key trong supabase-config.js.');
 const headers={'apikey':SUPA.anonKey,'Authorization':`Bearer ${token||supaSession()?.access_token||SUPA.anonKey}`,'Content-Type':'application/json'};
 if(method==='POST'||method==='PATCH'||method==='DELETE')headers.Prefer='return=representation';
 const response=await fetch(`${SUPA.url.replace(/\/$/,'')}/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||data?.msg||data?.error_description||`Supabase error ${response.status}`);
 return data;
}
async function supaLogin(email,password){const data=await supaRequest('auth/v1/token?grant_type=password',{method:'POST',body:{email,password},token:SUPA.anonKey});localStorage.setItem(SUPA_SESSION_KEY,JSON.stringify(data));return data}
function supaLogout(){localStorage.removeItem(SUPA_SESSION_KEY)}
const supaRpc=(name,args)=>supaRequest(`rest/v1/rpc/${name}`,{method:'POST',body:args});
async function supaSelect(table,query='*'){return supaRequest(`rest/v1/${table}?select=${encodeURIComponent(query)}`)}
async function supaInsert(table,body){const value={...body};if(table==='exams')value.admin_id=supaSession()?.user?.id;const data=await supaRequest(`rest/v1/${table}`,{method:'POST',body:value});return Array.isArray(data)?data[0]:data}
