import { supabaseConfig } from "@/lib/supabase/config";
import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export default function LoginPage() { return <LoginForm configured={Boolean(supabaseConfig())} />; }
