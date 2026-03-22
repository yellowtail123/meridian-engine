// ═══ MERIDIAN AUTH — Shared Supabase Client ═══
// Single point of Supabase client creation, shared by all pages.
// Include after supabase-js SDK, before meridian-supabase.js or admin scripts.

const SUPA_URL='https://wgqfxgxnanvckgqkuqas.supabase.co';
const SUPA_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncWZ4Z3huYW52Y2tncWt1cWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDA0MzEsImV4cCI6MjA4OTYxNjQzMX0.PZ6ATWCJ_qyJVTXgFNmVKzBBxOQlEpa_vXLAhKVdgzg';

let _supaClientInstance=null;

// Returns the singleton Supabase client, creating it on first call.
// Both main app and admin page call this — guarantees identical config
// and a single client per page load.
function _supaGetClient(){
  if(!_supaClientInstance&&typeof window.supabase!=='undefined'){
    try{
      _supaClientInstance=window.supabase.createClient(SUPA_URL,SUPA_ANON,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
    }catch(e){console.warn('Supabase client creation failed:',e)}
  }
  return _supaClientInstance;
}
