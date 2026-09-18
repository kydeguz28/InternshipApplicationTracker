import {createClient} from '@supabase/supabase-js';
export function createCloudClient({url,publishableKey}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.supabase.co'))throw Error('Invalid hosted Supabase URL');
 if(!publishableKey?.startsWith('sb_publishable_'))throw Error('A publishable key is required; secret keys must never enter the browser.');
 const client=createClient(url,publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return {auth:client.auth,backend:{
  async read(){const {data,error}=await client.rpc('tracker_read');if(error)throw error;return data;},
  async write(expected,payload){const {data,error}=await client.rpc('tracker_write',{expected_revision:expected,new_payload:payload});if(error)throw error;return data;}
 }};
}
