import { dateTimeLabel, processCatalog, type BomItem, type Part, type PlanData, type Product, type Task } from "@/domain/planning";

type ItemRow = { bom?: BomItem; lots: Part[]; name: string; quantity: number; processes: string[] };

function ProcessStatus({ tasks, completeCoverage }: { tasks: Task[]; completeCoverage: boolean }) {
  if (!tasks.length) return <span className="state-tag">予定未登録</span>;
  if (tasks.some(task => task.status === "running")) return <span className="state-tag running">作業中</span>;
  if (tasks.every(task => task.status === "completed") && completeCoverage) return <span className="state-tag done">完了</span>;
  if (tasks.some(task => task.status === "completed")) return <span className="state-tag partial">一部完了</span>;
  return <span className="state-tag pending">未着手</span>;
}

export default function MoldSummary({ data, product }: { data: PlanData; product: Product }) {
  const parts = data.parts.filter(part => part.productId === product.id && !part.archived);
  const moldParts = new Set(parts.filter(part => part.scope === "mold").map(part => part.id));
  const lots = parts.filter(part => part.scope !== "mold");
  const bom = (data.bom ?? []).filter(item => item.productId === product.id && !item.archived);
  const rows: ItemRow[] = bom.map(item => ({
    bom: item, lots: lots.filter(lot => lot.bomId === item.id),
    name: item.name, quantity: item.quantity, processes: item.processes,
  }));
  for (const lot of lots.filter(lot => !bom.some(item => item.id === lot.bomId))) {
    rows.push({ lots: [lot], name: lot.name, quantity: lot.quantity,
      processes: lot.processes ?? data.tasks.filter(task => task.partId === lot.id).map(task => task.process) });
  }
  const catalog = processCatalog(data);
  const used = new Set(rows.flatMap(row => row.processes));
  const processes = catalog.filter(process => used.has(process.code));
  const moldTasks = data.tasks.filter(task => moldParts.has(task.partId));

  return <>
    <section className="mold-overview" aria-label="金型情報">
      <div><h1>{product.name}</h1><p>{product.customer || "取引先未登録"}</p></div>
      <dl className="milestones">
        <div><dt>納期</dt><dd>{product.dueDate.replaceAll("-", "/")}</dd></div>
        {catalog.filter(process => ["assembly", "trial"].includes(process.code)).map(process => {
          const tasks = moldTasks.filter(task => task.process === process.code);
          return <div key={process.code}><dt>{process.name}</dt><dd>{tasks.length ? tasks.map(task =>
            <span key={task.id}>{task.plannedStart ? dateTimeLabel(task.plannedStart) + " 開始予定" : "日程未確定"}</span>
          ) : "予定未登録"}</dd></div>;
        })}
      </dl>
    </section>
    <h2>プレート・パーツの進捗</h2>
    {rows.length ? <div className="progress-scroll"><table className="management-table progress-matrix">
      <thead><tr><th scope="col">プレート・パーツ名</th><th scope="col">必要数量</th>
        {processes.map(process => <th scope="col" key={process.code}>{process.name}</th>)}
        {!processes.length && <th scope="col">加工工程</th>}
      </tr></thead>
      <tbody>{rows.map(row => {
        const item = row.bom;
        const registered = row.lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const remaining = row.quantity - registered;
        const lotIds = new Set(row.lots.map(lot => lot.id));
        const tasks = data.tasks.filter(task => lotIds.has(task.partId));
        return <tr key={item ? "bom-" + item.id : "lot-" + row.lots[0].id}>
          <th scope="row">{item ? <details className="item-details"><summary>{row.name}</summary>
            <dl><dt>区分</dt><dd>{data.categories?.find(category => category.id === item.categoryId)?.name ?? (item.kind === "plate" ? "プレート" : "パーツ")}</dd>
              <dt>寸法</dt><dd>{item.widthMm && item.lengthMm ? `${item.widthMm} × ${item.lengthMm} mm` : "未登録"}</dd>
              <dt>予定登録済み</dt><dd>{registered}個</dd><dt>未登録</dt><dd>{remaining}個</dd>
              <dt>備考</dt><dd>{item.notes || "—"}</dd>
            </dl></details> : row.name}</th>
          <td>{row.quantity}個{remaining > 0 && row.processes.length > 0 && <small>未登録 {remaining}個</small>}</td>
          {!row.processes.length ? <td colSpan={Math.max(processes.length, 1)}>社内加工なし</td> :
            processes.map(process => {
              const matches = tasks.filter(task => task.process === process.code);
              const coverage = remaining <= 0 && row.lots.every(lot => matches.some(task => task.partId === lot.id));
              return <td key={process.code}>{row.processes.includes(process.code)
                ? <ProcessStatus tasks={matches} completeCoverage={coverage} />
                : <span className="muted-state">対象外</span>}</td>;
            })}
        </tr>;
      })}</tbody>
    </table></div> : <p className="list-empty">プレート・パーツはまだ登録されていません。</p>}
  </>;
}
