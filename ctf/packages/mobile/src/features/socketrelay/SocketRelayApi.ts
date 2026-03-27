// Local mock for SocketRelay behaviors: create request, claim request, list public requests.

const MEM: { requests: any[] } = { requests: [] };

function genId() {
  return 'sr-' + Math.random().toString(36).slice(2,10);
}

export async function listRequests(){
  // return a shallow copy
  return MEM.requests.slice().sort((a,b)=>b.created_at - a.created_at);
}

export async function createRequest(payload:{owner_user_id:string,title:string,details:string,category?:string,is_public?:boolean}){
  const now = Date.now();
  const r = { id: genId(), owner_user_id: payload.owner_user_id, title: payload.title, details: payload.details, category: payload.category||'general', is_public: !!payload.is_public, status:'open', created_at: now };
  MEM.requests.push(r);
  return r;
}

export async function claimRequest(id:string, fulfiller_user_id:string){
  const idx = MEM.requests.findIndex(x=>x.id===id);
  if(idx===-1) throw new Error('not found');
  MEM.requests[idx].status='claimed';
  MEM.requests[idx].claimed_by = fulfiller_user_id;
  MEM.requests[idx].updated_at = Date.now();
  return MEM.requests[idx];
}
