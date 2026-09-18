import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;
if (process.env.APP_ENV === "production") throw new Error("Quote vNext acceptance is disabled in production");
if (!process.argv.includes("QUOTE-VNEXT-0069-ACCEPTANCE")) throw new Error("Explicit acceptance confirmation is required");
const name = "dealerflow_quote_vnext_0069_acceptance";
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL missing");
if (new URL(sourceUrl).pathname.slice(1) !== "dealerflow_staging_nvzi") throw new Error("Not the authorized isolated staging database");
const dbUrl = new URL(sourceUrl); dbUrl.pathname = `/${name}`;
const ssl = process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true };
const admin = new Pool({ connectionString: sourceUrl, ssl, max: 1 });
let temp;
const q = (client, text, params=[]) => client.query(text, params);
const expectFailure = async (client, label, sql, params=[]) => {
  await q(client,"SAVEPOINT expected_failure");
  try { await q(client,sql,params); throw new Error(`${label} unexpectedly succeeded`); }
  catch (error) { await q(client,"ROLLBACK TO SAVEPOINT expected_failure"); return String(error.message).slice(0,180); }
};
async function seedMinimalBase(pool){const c=await pool.connect();try{await q(c,"BEGIN");await q(c,"SELECT set_config('app.user_id','usr_synthetic_operator',true),set_config('app.organization_id','org_demo_first_pilot_v1',true),set_config('app.operator_provision','enabled',true),set_config('app.auth_runtime','enabled',true)");await q(c,"INSERT INTO organizations(id,slug,name,vertical,data_class) VALUES('org_demo_first_pilot_v1','quote-acceptance','Quote Acceptance','automotive','demo')");await q(c,"INSERT INTO locations(id,organization_id,slug,name,timezone) VALUES('loc_quote_acceptance','org_demo_first_pilot_v1','main','Main','America/New_York')");await q(c,"SELECT set_config('app.organization_id','org_other_acceptance',true)");await q(c,"INSERT INTO organizations(id,slug,name,vertical,data_class) VALUES('org_other_acceptance','quote-other','Quote Other','automotive','demo')");await q(c,"INSERT INTO locations(id,organization_id,slug,name,timezone) VALUES('loc_other_acceptance','org_other_acceptance','main','Main','America/New_York')");await q(c,"SELECT set_config('app.organization_id','org_demo_first_pilot_v1',true)");await q(c,"INSERT INTO users(id,email,display_name,email_verified,active) VALUES('usr_quote_owner','quote-owner@example.invalid','Quote Owner',true,true),('usr_quote_manager','quote-manager@example.invalid','Quote Manager',true,true)");for(let i=1;i<=8;i++){const n=String(i);await q(c,`INSERT INTO customers(id,organization_id,location_id,display_name,status,created_by,updated_by) VALUES($1,'org_demo_first_pilot_v1','loc_quote_acceptance',$2,'active','usr_quote_owner','usr_quote_owner')`,[`cus_quote_${n}`,`Synthetic Customer ${n}`]);await q(c,`INSERT INTO leads(id,organization_id,location_id,customer_id,assigned_user_id,source,stage,status,idempotency_key,created_by,updated_by) VALUES($1,'org_demo_first_pilot_v1','loc_quote_acceptance',$2,'usr_quote_owner','Synthetic','Working','working',$3,'usr_quote_owner','usr_quote_owner')`,[`led_quote_${n}`,`cus_quote_${n}`,`quote-lead:${n}`]);await q(c,`INSERT INTO vehicles(id,organization_id,vin,year,make,model,trim,created_by,updated_by) VALUES($1,'org_demo_first_pilot_v1',$2,2026,'Honda','Accord','LX','usr_quote_owner','usr_quote_owner')`,[`veh_quote_${n}`,`TESTACCEPT000000${n}`]);await q(c,`INSERT INTO inventory_units(id,organization_id,location_id,vehicle_id,stock_number,idempotency_key,status,list_price_cents,created_by,updated_by) VALUES($1,'org_demo_first_pilot_v1','loc_quote_acceptance',$2,$3,$4,'available',3200000,'usr_quote_owner','usr_quote_owner')`,[`inv_quote_${n}`,`veh_quote_${n}`,`QTEST${n}`,`quote-inventory:${n}`]);await q(c,`INSERT INTO deals(id,organization_id,location_id,customer_id,lead_id,primary_vehicle_id,inventory_unit_id,owner_user_id,deal_number,status,purchase_type,idempotency_key,created_by,updated_by) VALUES($1,'org_demo_first_pilot_v1','loc_quote_acceptance',$2,$3,$4,$5,'usr_quote_owner',$6,'draft','cash',$7,'usr_quote_owner','usr_quote_owner')`,[`dea_quote_${n}`,`cus_quote_${n}`,`led_quote_${n}`,`veh_quote_${n}`,`inv_quote_${n}`,`QA-${n}`,`quote-deal:${n}`]);}await q(c,"COMMIT");}catch(e){await q(c,"ROLLBACK");throw e;}finally{c.release();}}
const hashQuery = `SELECT q.id,
 md5(to_jsonb(q)::text) quote_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM deal_quote_lines x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) lines_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x))::text FROM quote_commercial_terms x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) commercial_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x))::text FROM quote_finance_terms x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) finance_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x))::text FROM quote_lease_terms x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) lease_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM quote_incentive_applications x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) incentive_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM quote_backend_product_snapshots x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) backend_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM quote_profitability_snapshots x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) profitability_hash,
 md5(COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM deal_quote_approvals x WHERE x.organization_id=q.organization_id AND x.quote_id=q.id),'[]')) approval_hash
 FROM deal_quotes q ORDER BY q.id`;

try {
  const identity=(await admin.query("SELECT current_database() database,current_user username,current_setting('server_version') version")).rows[0];
  if ((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",[name])).rowCount) throw new Error("Authorized temporary database already exists");
  await admin.query(`CREATE DATABASE ${name}`);
  temp = new Pool({ connectionString: dbUrl.toString(), ssl, max: 2 });
  const folder="/tmp/quote-vnext-pre0069"; await mkdir(`${folder}/meta`,{recursive:true});
  const journal=JSON.parse(await readFile("/app/drizzle/meta/_journal.json","utf8")); journal.entries=journal.entries.filter(e=>e.idx<=68);
  await writeFile(`${folder}/meta/_journal.json`,JSON.stringify(journal));
  for (const entry of journal.entries) await cp(`/app/drizzle/${entry.tag}.sql`,`${folder}/${entry.tag}.sql`);
  await migrate(drizzle(temp),{migrationsFolder:folder});
  await seedMinimalBase(temp);
  const client=await temp.connect();
  const org="org_demo_first_pilot_v1";
  try {
    await q(client,"BEGIN"); await q(client,"SELECT set_config('app.organization_id',$1,true)",[org]);
    const base=(await q(client,`SELECT d.id deal_id,d.location_id,d.primary_vehicle_id,d.inventory_unit_id,d.owner_user_id,i.list_price_cents FROM deals d JOIN inventory_units i ON i.organization_id=d.organization_id AND i.id=d.inventory_unit_id WHERE d.organization_id=$1 ORDER BY d.id LIMIT 6`,[org])).rows;
    if(base.length<6) throw new Error("Synthetic seed did not provide six Deals");
    for(let i=0;i<6;i++){
      const id=`quo_acceptance_${i+1}`, status=["draft","presented","accepted","draft","rejected","draft"][i], purchase=["cash","finance","finance","lease","cash","cash"][i];
      await q(client,`INSERT INTO deal_quotes(id,organization_id,deal_id,version,status,purchase_type,subtotal_cents,fee_cents,tax_cents,discount_cents,total_cents,presented_at,accepted_at,idempotency_key,created_by,updated_by) VALUES($1,$2,$3,1,$4,$5,3000000,100000,200000,-100000,3200000,CASE WHEN $4 IN ('presented','accepted') THEN now() END,CASE WHEN $4='accepted' THEN now() END,$6,$7,$7)`,[id,org,base[i].deal_id,status,purchase,`acceptance:${i+1}`,base[i].owner_user_id]);
      await q(client,`INSERT INTO deal_quote_lines(id,organization_id,quote_id,position,category,description,quantity,unit_amount_cents,total_cents) VALUES($1,$2,$3,0,'vehicle','Synthetic acceptance vehicle',1,3000000,3000000)`,[`qli_acceptance_${i+1}`,org,id]);
    }
    await q(client,`INSERT INTO quote_commercial_terms(quote_id,organization_id,cash_down_cents,amount_financed_cents,created_by) VALUES('quo_acceptance_3',$1,500000,2700000,$2),('quo_acceptance_4',$1,300000,NULL,$2)`,[org,base[2].owner_user_id]);
    await q(client,`INSERT INTO quote_finance_terms(quote_id,organization_id,apr_basis_points,term_months,estimated_payment_cents,source_type,source_label,source_reference,captured_by) VALUES('quo_acceptance_3',$1,599,60,52190,'manual-entry','Synthetic reviewed finance terms','acceptance-finance',$2)`,[org,base[2].owner_user_id]);
    await q(client,`INSERT INTO quote_lease_terms(quote_id,organization_id,adjusted_cap_cost_cents,residual_value_cents,money_factor_ppm,term_months,annual_mileage,acquisition_fee_cents,cap_cost_reduction_cents,rebate_cents,base_payment_cents,source_type,source_label,source_reference,captured_by) VALUES('quo_acceptance_4',$1,3000000,1800000,1250,36,10000,65000,300000,100000,42500,'manual-entry','Synthetic reviewed lease terms','acceptance-lease',$2)`,[org,base[3].owner_user_id]);
    const tradeVeh=(await q(client,"SELECT id FROM vehicles WHERE organization_id=$1 AND id<>$2 ORDER BY id LIMIT 1",[org,base[4].primary_vehicle_id])).rows[0].id;
    await q(client,`INSERT INTO trade_appraisals(id,organization_id,deal_id,vehicle_id,version,status,allowance_cents,payoff_cents,equity_cents,idempotency_key,created_by,updated_by) VALUES('tap_acceptance_legacy',$1,$2,$3,1,'accepted',1200000,1400000,-200000,'acceptance-trade',$4,$4)`,[org,base[4].deal_id,tradeVeh,base[4].owner_user_id]);
    await q(client,`INSERT INTO quote_commercial_terms(quote_id,organization_id,trade_appraisal_id,trade_allowance_cents,trade_payoff_cents,trade_equity_cents,cash_down_cents,created_by) VALUES('quo_acceptance_5',$1,'tap_acceptance_legacy',1250000,1400000,-150000,250000,$2)`,[org,base[4].owner_user_id]);
    await q(client,`INSERT INTO deal_quote_lines(id,organization_id,quote_id,position,category,description,quantity,unit_amount_cents,total_cents) VALUES ('qli_acceptance_incentive',$1,'quo_acceptance_5',1,'discount','Synthetic incentive',1,-100000,-100000),('qli_acceptance_product',$1,'quo_acceptance_5',2,'product','Synthetic service contract',1,200000,200000)`,[org]);
    await q(client,`INSERT INTO incentive_programs(id,organization_id,code,name,source_type,source_label) VALUES('inc_acceptance_program',$1,'SYN-1000','Synthetic acceptance incentive','manual-entry','Acceptance fixture')`,[org]);
    await q(client,`INSERT INTO quote_incentive_applications(id,organization_id,quote_id,quote_line_id,program_id,amount_cents,eligibility_status,eligibility_basis,verified_by,verified_at,created_by) VALUES('qia_acceptance',$1,'quo_acceptance_5','qli_acceptance_incentive','inc_acceptance_program',100000,'verified','Synthetic acceptance only',$2,now(),$2)`,[org,base[4].owner_user_id]);
    await q(client,`INSERT INTO backend_product_catalog(id,organization_id,code,name,product_type,quote_line_category,active,default_cost_cents,created_by,updated_by) VALUES('bpc_acceptance',$1,'SYN-SC','Synthetic service contract','service-contract','product',true,80000,$2,$2)`,[org,base[4].owner_user_id]);
    await q(client,`INSERT INTO quote_backend_product_snapshots(id,organization_id,quote_id,quote_line_id,product_id,sell_cents,cost_cents,gross_cents,captured_by) VALUES('qbp_acceptance',$1,'quo_acceptance_5','qli_acceptance_product','bpc_acceptance',200000,80000,120000,$2)`,[org,base[4].owner_user_id]);
    await q(client,`INSERT INTO inventory_cost_snapshots(id,organization_id,location_id,inventory_unit_id,cost_cents,source_type,source_label,source_reference,effective_at,captured_by) VALUES('ics_acceptance',$1,$2,$3,2600000,'manual-documented','Synthetic acceptance cost','acceptance-cost',now(),$4)`,[org,base[4].location_id,base[4].inventory_unit_id,base[4].owner_user_id]);
    await q(client,`INSERT INTO quote_pack_policies(id,organization_id,location_id,enabled,pack_amount_cents,created_by,updated_by) VALUES('qpk_acceptance',$1,$2,true,50000,$3,$3)`,[org,base[4].location_id,base[4].owner_user_id]);
    await q(client,`INSERT INTO quote_profitability_snapshots(id,organization_id,location_id,quote_id,inventory_unit_id,inventory_cost_snapshot_id,pack_policy_id,vehicle_sell_cents,vehicle_cost_cents,pack_cents,front_gross_cents,backend_gross_cents,total_gross_cents,captured_by) VALUES('qpf_acceptance',$1,$2,'quo_acceptance_5',$3,'ics_acceptance','qpk_acceptance',3000000,2600000,50000,350000,120000,470000,$4)`,[org,base[4].location_id,base[4].inventory_unit_id,base[4].owner_user_id]);
    await q(client,`INSERT INTO deal_quote_approvals(id,organization_id,quote_id,status,request_reason,decision_reason,requested_by,decided_by,decided_at,request_idempotency_key,decision_idempotency_key) VALUES('qap_acceptance_approved',$1,'quo_acceptance_3','approved','Synthetic approval','Approved for acceptance',$2,$3,now(),'acceptance-approval-request','acceptance-approval-decision'),('qap_acceptance_declined',$1,'quo_acceptance_5','declined','Synthetic approval','Revise synthetic pencil',$2,$3,now(),'acceptance-decline-request','acceptance-decline-decision')`,[org,base[4].owner_user_id,base[5].owner_user_id]);
    await q(client,"COMMIT");
    const pre=(await q(client,hashQuery)).rows;
    const migration=await readFile("/app/drizzle/0069_quote_vnext_scenarios.sql","utf8");
    await q(client,"BEGIN"); await q(client,migration); await q(client,"COMMIT");
    const post=(await q(client,hashQuery)).rows;
    if(JSON.stringify(pre)!==JSON.stringify(post)) throw new Error("Authority hash delta detected");
    const counts1=(await q(client,`SELECT (SELECT count(*)::int FROM quote_product_scenarios) product,(SELECT count(*)::int FROM quote_payment_scenarios) payment,(SELECT count(*)::int FROM quote_trade_snapshots) trade,(SELECT count(*)::int FROM deal_quotes) quotes,(SELECT count(*)::int FROM quote_trade_snapshots s LEFT JOIN trade_appraisals a ON a.organization_id=s.organization_id AND a.id=s.trade_appraisal_id WHERE a.id IS NULL) orphan_trades`)).rows[0];
    const replay=migration.slice(migration.indexOf('CREATE TEMP TABLE "quote_vnext_legacy_baseline"'),migration.indexOf('CREATE FUNCTION prevent_quote_vnext_child_rewrite'));
    const fp1=(await q(client,"SELECT id,calculation_fingerprint FROM quote_payment_scenarios ORDER BY id")).rows;
    await q(client,"BEGIN"); await q(client,replay); await q(client,"COMMIT");
    const counts2=(await q(client,`SELECT (SELECT count(*)::int FROM quote_product_scenarios) product,(SELECT count(*)::int FROM quote_payment_scenarios) payment,(SELECT count(*)::int FROM quote_trade_snapshots) trade`)).rows[0];
    const fp2=(await q(client,"SELECT id,calculation_fingerprint FROM quote_payment_scenarios ORDER BY id")).rows;
    if(JSON.stringify(counts1)!==JSON.stringify({...counts2,quotes:counts1.quotes,orphan_trades:counts1.orphan_trades})||JSON.stringify(fp1)!==JSON.stringify(fp2)) throw new Error("Replay/idempotency failure");
    await q(client,"CREATE ROLE quote_vnext_acceptance_runtime NOLOGIN"); await q(client,"GRANT quote_vnext_acceptance_runtime TO CURRENT_USER"); await q(client,"GRANT USAGE ON SCHEMA public TO quote_vnext_acceptance_runtime"); await q(client,"GRANT SELECT,INSERT,UPDATE,DELETE ON quote_product_scenarios,quote_payment_scenarios,quote_trade_snapshots TO quote_vnext_acceptance_runtime");
    await q(client,"BEGIN"); await q(client,"SET LOCAL ROLE quote_vnext_acceptance_runtime"); await q(client,"SELECT set_config('app.organization_id',$1,true)",[org]);
    const tenantVisible=Number((await q(client,"SELECT count(*) count FROM quote_product_scenarios")).rows[0].count);
    const crossRead=Number((await q(client,"SELECT count(*) count FROM quote_product_scenarios WHERE organization_id='org_other_acceptance'")).rows[0].count);
    const crossWrite=await expectFailure(client,"cross-tenant write",`INSERT INTO quote_product_scenarios(id,organization_id,quote_id,stable_key,position,product_kind,product_reference,label,source_type) VALUES('qps_cross_write','org_other_acceptance','quo_acceptance_1','cross',9,'generic','x','x','application')`);
    const immutableUpdate=await expectFailure(client,"immutable update",`UPDATE quote_product_scenarios SET label='changed' WHERE organization_id=$1 AND quote_id='quo_acceptance_1'`,[org]);
    const immutableDelete=await expectFailure(client,"immutable delete",`DELETE FROM quote_product_scenarios WHERE organization_id=$1 AND quote_id='quo_acceptance_1'`,[org]);
    const incompleteLease=await expectFailure(client,"incomplete lease",`INSERT INTO quote_payment_scenarios(id,organization_id,quote_id,product_scenario_id,stable_key,position,mode,calculation_status,cash_down_cents,mode_metadata,source_type,source_label,calculation_policy_version,rounding_policy_version,calculation_fingerprint) SELECT 'qpy_incomplete_lease',$1,quote_id,id,'lease:bad',8,'lease','incomplete',0,'{}','manual-entry','Synthetic invalid lease','test','test',repeat('a',64) FROM quote_product_scenarios WHERE organization_id=$1 AND quote_id='quo_acceptance_1'`,[org]);
    await q(client,"ROLLBACK");
    await q(client,"BEGIN"); await q(client,"SELECT set_config('app.organization_id',$1,true)",[org]);
    const p=(await q(client,"SELECT id FROM quote_product_scenarios WHERE organization_id=$1 AND quote_id='quo_acceptance_1'",[org])).rows[0].id;
    const tradeVehicles=(await q(client,"SELECT id FROM vehicles WHERE organization_id=$1 ORDER BY id LIMIT 2",[org])).rows;
    for(let i=0;i<2;i++) await q(client,`INSERT INTO trade_appraisals(id,organization_id,deal_id,vehicle_id,version,status,allowance_cents,payoff_cents,equity_cents,idempotency_key) VALUES($1,$2,$3,$4,1,'accepted',$5,$6,$7,$8)`,[`tap_multi_${i+1}`,org,base[0].deal_id,tradeVehicles[i].id,i?900000:1500000,i?1200000:1000000,i?-300000:500000,`multi:${i}`]);
    for(let i=0;i<2;i++) await q(client,`INSERT INTO quote_trade_snapshots(id,organization_id,quote_id,product_scenario_id,trade_appraisal_id,position,appraisal_version,appraisal_revision_at,appraisal_allowance_cents,quote_allowance_cents,payoff_cents,equity_cents,quote_adjustment_cents,tax_treatment_metadata,source_type) SELECT $1,$2,'quo_acceptance_1',$3,$4,$5,version,updated_at,allowance_cents,allowance_cents,payoff_cents,equity_cents,0,'{}','application' FROM trade_appraisals WHERE organization_id=$2 AND id=$4`,[`qts_multi_${i+1}`,org,p,`tap_multi_${i+1}`,i]);
    const multi=(await q(client,`SELECT sum(equity_cents)::int combined,(SELECT sum(equity_cents)::int FROM trade_appraisals WHERE organization_id=$1 AND id IN ('tap_multi_1','tap_multi_2')) canonical FROM quote_trade_snapshots WHERE organization_id=$1 AND product_scenario_id=$2`,[org,p])).rows[0];
    await q(client,"COMMIT");
    const beforeRecovery=(await q(client,"SELECT count(*)::int count FROM quote_product_scenarios")).rows[0].count;
    await q(client,"BEGIN"); await q(client,"INSERT INTO quote_product_scenarios(id,organization_id,quote_id,stable_key,position,product_kind,product_reference,label,source_type) VALUES('qps_recovery_probe',$1,'quo_acceptance_1','recovery:probe',99,'generic','probe','Recovery probe','application')",[org]); await q(client,"ROLLBACK");
    const afterRecovery=(await q(client,"SELECT count(*)::int count FROM quote_product_scenarios")).rows[0].count;
    console.log(JSON.stringify({status:"PASS",sourceIdentity:identity,tempDatabase:name,migrationBefore:"0068",migrationAfter:"0069",fixtureQuotes:pre.length,authorityHashesUnchanged:true,backfill:counts1,replay:counts2,fingerprintStable:true,rls:{tenantVisible,crossRead,crossWrite},immutability:{update:immutableUpdate,delete:immutableDelete},incompleteLease,multiTrade:{combined:Number(multi.combined),canonical:Number(multi.canonical),matches:Number(multi.combined)===Number(multi.canonical)},recovery:{strategy:"transactional roll-forward and application rollback compatibility",beforeRecovery,afterRecovery,rolledBack:beforeRecovery===afterRecovery}}));
  } finally { client.release(); }
} finally {
  if(temp) await temp.end();
  try { await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND backend_type='client backend' AND pid<>pg_backend_pid()",[name]); await admin.query(`DROP DATABASE IF EXISTS ${name}`); } finally { await admin.end(); }
}
