import Link from "next/link";
import LogoutButton from "@/app/workspace/logout-button";
import {pilotReadiness} from "@/domain/pilot-readiness";
import type {PlanData} from "@/domain/planning";

export default function PilotStatus({data,role}:{data:PlanData;role:"admin"|"operator"}){
 if(!data.today)return <main className="management-page"><h1>運用確認</h1><p role="alert">DBから基準日を取得できませんでした。read_planningの追加SQLを確認してください。</p><Link href="/workspace">ガントへ戻る</Link></main>;
 const checks=pilotReadiness(data,data.today);
 const blocked=checks.filter(check=>check.status==="blocked").length;
 return <main className="management-page"><header className="management-header"><Link href="/workspace">← ガントへ戻る</Link><Link href="/workspace/calendar">会社カレンダー</Link><Link href="/workspace/users">ユーザー設定</Link><LogoutButton /></header><h1>運用確認</h1><p role="status">{blocked?`確認が必要な項目が ${blocked}件あります。` : "データの基本チェックで運用を妨げる問題は見つかりませんでした。"} 再読み込みすると最新の状態を確認できます。</p><p>この画面では予定の再計算や自動保存を行いません。未登録の予定やログイン操作まで保証する診断ではありません。</p><table className="management-table"><thead><tr><th>項目</th><th>状態</th><th>確認内容</th></tr></thead><tbody>{checks.map(check=><tr key={check.id}><th scope="row">{check.label}</th><td><span className={check.status==="ok"?"state-tag enabled":check.status==="blocked"?"state-tag holiday":"state-tag pending"}>{check.status==="ok"?"確認済み":check.status==="blocked"?"要対応":"注意"}</span></td><td>{check.message}</td></tr>)}</tbody></table><section className="entity-card"><h2>業務データを控える</h2><p>操作前に、現在の金型・BOM・予定・作業実績をJSONファイルで保存できます。パスワードや接続キーは含めません。DB全体のバックアップや自動復元用ファイルではありません。</p>{role==="admin"?<a className="button" href="/api/business/export" download>業務データを書き出す</a>:<p>書き出しは管理者が行えます。</p>}</section><section className="entity-card"><h2>最初の確認手順</h2><ol><li>管理者で試験用の金型を1件登録し、BOM・寸法・会社カレンダーを設定する。</li><li>予定登録・機械変更・加工順変更・保存を行い、再読み込み後にも残ることを確認する。</li><li>作業実績を登録し、完了時刻と金型詳細の進捗を確認する。</li><li>担当者でログインし、実績は編集でき、予定・設定は編集できないことを確認する。</li></ol><p>型組用／予備用の用途別分割は未実装です。試験中は予備部品を含む金型で型組開始を自動判断しないでください。</p></section></main>;
}
