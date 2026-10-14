// Public demo entry only. This pair never grants a Supabase session or DB permissions.
export function isDemoAdminLogin(userId:unknown,password:unknown):boolean {
 return typeof userId==="string"&&userId.trim().toLowerCase()==="admin"&&password==="admin";
}
