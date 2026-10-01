import WorkspaceScreen from "@/components/business/workspace-screen";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{section:string[]}>;searchParams:Promise<{product?:string}>}){const {section}=await params;const {product}=await searchParams;return <WorkspaceScreen section={section} productQuery={product} />;}
