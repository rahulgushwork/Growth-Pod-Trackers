import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const TARGETS: Record<string, number> = {
  "2025-03-30": 100000, "2025-03-31": 101000,
  "2025-04-01": 102010, "2025-04-02": 103030, "2025-04-03": 104060,
  "2025-04-06": 105101, "2025-04-07": 106152, "2025-04-08": 137998,
  "2025-04-09": 142138, "2025-04-10": 143559, "2025-04-13": 144995,
  "2025-04-14": 146444, "2025-04-15": 147909, "2025-04-16": 149388,
  "2025-04-17": 149388, "2025-04-20": 149388, "2025-04-21": 149388,
  "2025-04-22": 149388, "2025-04-23": 149388, "2025-04-24": 149388,
  "2025-04-27": 149388, "2025-04-28": 149388, "2025-04-29": 149388,
  "2025-04-30": 149388, "2025-05-01": 149388, "2025-05-04": 149388,
  "2025-05-05": 149388, "2025-05-06": 149388, "2025-05-07": 149388,
  "2025-05-08": 149388, "2025-05-11": 149388, "2025-05-12": 149388,
  "2025-05-13": 149388, "2025-05-14": 149388, "2025-05-15": 149388,
  "2025-05-18": 149388, "2025-05-19": 149388, "2025-05-20": 149388,
  "2025-05-21": 149388, "2025-05-22": 149388, "2025-05-25": 149388,
  "2025-05-26": 149388, "2025-05-27": 149388, "2025-05-28": 149388,
  "2025-05-29": 149388, "2025-06-01": 149388, "2025-06-02": 149388,
  "2025-06-03": 149388, "2025-06-04": 149388, "2025-06-05": 149388,
  "2025-06-08": 149388, "2025-06-09": 149388, "2025-06-10": 149388,
  "2025-06-11": 149388, "2025-06-12": 149388, "2025-06-15": 149388,
  "2025-06-16": 149388, "2025-06-17": 149388, "2025-06-18": 149388,
  "2025-06-19": 149388, "2025-06-22": 149388, "2025-06-23": 149388,
  "2025-06-24": 149388, "2025-06-25": 149388, "2025-06-26": 149388,
  "2025-06-29": 149388, "2025-06-30": 149388, "2025-07-01": 149388,
  "2025-07-02": 149388, "2025-07-03": 149388, "2025-07-06": 149388,
  "2025-07-07": 149388, "2025-07-08": 149388, "2025-07-09": 149388,
  "2025-07-10": 149388, "2025-07-13": 149388, "2025-07-14": 149388,
  "2025-07-15": 149388, "2025-07-16": 149388, "2025-07-17": 149388,
  "2025-07-20": 149388, "2025-07-21": 149388, "2025-07-22": 149388,
  "2025-07-23": 149388, "2025-07-24": 149388, "2025-07-27": 149388,
  "2025-07-28": 149388, "2025-07-29": 149388, "2025-07-30": 149388,
  "2025-07-31": 149388, "2025-08-03": 149388, "2025-08-04": 149388,
  "2025-08-05": 149388, "2025-08-06": 149388, "2025-08-07": 149388,
};
for (const [k, v] of Object.entries({ ...TARGETS })) {
  TARGETS[k.replace("2025-", "2026-")] = v;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || "2026-01-05";
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  const client = await pool.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    // 1) Campaign stats per day
    const statsResult = await client.query(
      `
      WITH base AS (
        SELECT
          stats_id,
          LOWER(TRIM(lead_email)) AS lead_email,
          sent_time, open_count, reply_time, is_bounced
        FROM gist.gtm_email_campaign_stats
        WHERE sent_time IS NOT NULL
          AND sent_time >= $1::date
          AND sent_time <  $2::date + INTERVAL '1 day'
      )
      SELECT
        date_trunc('day', sent_time)::date AS date,
        COUNT(DISTINCT stats_id) AS total_sends,
        COUNT(DISTINCT stats_id) FILTER (WHERE is_bounced = true) AS total_bounced,
        ROUND(100.0 * COUNT(DISTINCT stats_id) FILTER (WHERE is_bounced = true)
          / NULLIF(COUNT(DISTINCT stats_id), 0), 2) AS bounce_rate,
        COUNT(DISTINCT lead_email) FILTER (WHERE open_count >= 2) AS emails_2plus_opens,
        ROUND(100.0 * COUNT(DISTINCT lead_email) FILTER (WHERE open_count >= 2)
          / NULLIF(COUNT(DISTINCT lead_email), 0), 2) AS open_2plus_rate
      FROM base
      GROUP BY 1
      ORDER BY 1 DESC
      `,
      [from, to]
    );

    // 2) Unique contacts with 2+ opens who have NOT received a call
    //    Date = the day the email was sent; lead had open_count >= 2 on any sequence
    //    Excludes leads already in JustCall
    const noCallResult = await client.query(
      `
      WITH opened_leads AS (
        SELECT
          LOWER(TRIM(lead_email)) AS norm_email,
          date_trunc('day', sent_time)::date AS date
        FROM gist.gtm_email_campaign_stats
        WHERE lead_email IS NOT NULL
          AND TRIM(lead_email) <> ''
          AND COALESCE(open_count, 0) >= 2
          AND sent_time >= $1::date
          AND sent_time <  $2::date + INTERVAL '1 day'
      )
      SELECT
        o.date,
        COUNT(DISTINCT o.norm_email) AS unique_2plus_no_call
      FROM opened_leads o
      JOIN gist.gtm_smartlead_leads sl
        ON LOWER(TRIM(sl.lead_email)) = o.norm_email
      WHERE (sl.in_justcall IS NULL OR sl.in_justcall = false)
        AND sl.lead_phone_number IS NOT NULL
        AND TRIM(sl.lead_phone_number) <> ''
      GROUP BY o.date
      ORDER BY o.date DESC
      `,
      [from, to]
    );

    // 3) Email health snapshot
    const healthResult = await client.query(`
      WITH base AS (
        SELECT * FROM gist.burner_email_health
        WHERE custom_tracking_domain NOT LIKE '%gush%'
      ),
      inbox_metrics AS (
        SELECT custom_tracking_domain,
          CASE WHEN daily_sent_count >= message_per_day AND message_per_day IS NOT NULL THEN 1 ELSE 0 END AS is_at_capacity,
          warmup_reputation
        FROM base
      ),
      domain_metrics AS (
        SELECT custom_tracking_domain, COUNT(*) AS total_inboxes,
          SUM(is_at_capacity) AS inboxes_at_capacity, AVG(warmup_reputation) AS avg_reputation
        FROM inbox_metrics GROUP BY custom_tracking_domain
      )
      SELECT
        (SELECT SUM(is_at_capacity) FROM inbox_metrics) AS inboxes_at_capacity,
        (SELECT COUNT(*) FROM domain_metrics WHERE inboxes_at_capacity > 0) AS domains_at_capacity,
        (SELECT COUNT(*) FROM domain_metrics WHERE avg_reputation >= 90) AS domains_above_reputation
    `);

    // 4) Burner calls per day (from justcall_burner_email_call_logs)
    const burnerCallsResult = await client.query(
      `SELECT call_date AS date, COUNT(*) AS burner_calls
       FROM gist.justcall_burner_email_call_logs
       WHERE call_date >= $1::date AND call_date <= $2::date
       GROUP BY call_date ORDER BY call_date DESC`,
      [from, to]
    );

    // 5) Total calls per day (from justcall_daily_call_stats)
    const totalCallsResult = await client.query(
      `SELECT date, SUM(total_calls) AS total_calls
       FROM gist.justcall_daily_call_stats
       WHERE date >= $1::date AND date <= $2::date
       GROUP BY date ORDER BY date DESC`,
      [from, to]
    );

    // 6) Demo bookings per day — burner vs non-burner
    //    Burner = attendee had a >2 open in campaign stats
    //    Excludes Meta Ads leads and campaigns with "Meta" in name
    const demosResult = await client.query(
      `
      WITH meta_emails AS (
        SELECT DISTINCT LOWER(TRIM(prospect_email)) AS email
        FROM gist.gtm_meta_ads_leads
        WHERE prospect_email IS NOT NULL
      ),
      burner_leads AS (
        SELECT DISTINCT LOWER(TRIM(lead_email)) AS email
        FROM gist.gtm_email_campaign_stats
        WHERE open_count >= 2 AND sent_time IS NOT NULL
      )
      SELECT
        d.call_date AS date,
        COUNT(*) AS total_demos,
        COUNT(CASE WHEN b.email IS NOT NULL THEN 1 END) AS burner_demos,
        COUNT(CASE WHEN b.email IS NULL THEN 1 END) AS non_burner_demos
      FROM gist.gtm_demo_bookings d
      LEFT JOIN burner_leads b ON LOWER(TRIM(d.attendee_email)) = b.email
      WHERE d.call_date >= $1::date AND d.call_date <= $2::date
        AND LOWER(TRIM(d.attendee_email)) NOT IN (SELECT email FROM meta_emails)
      GROUP BY d.call_date
      ORDER BY d.call_date DESC
      `,
      [from, to]
    );

    const health = healthResult.rows[0];

    // Build lookup maps
    const noCallMap: Record<string, number> = {};
    for (const r of noCallResult.rows) {
      noCallMap[r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date)] = Number(r.unique_2plus_no_call);
    }

    const burnerCallsMap: Record<string, number> = {};
    for (const r of burnerCallsResult.rows) {
      burnerCallsMap[r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date)] = Number(r.burner_calls);
    }

    const totalCallsMap: Record<string, number> = {};
    for (const r of totalCallsResult.rows) {
      totalCallsMap[r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date)] = Number(r.total_calls);
    }

    const demosMap: Record<string, { burner: number; non_burner: number }> = {};
    for (const r of demosResult.rows) {
      const d = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
      demosMap[d] = { burner: Number(r.burner_demos), non_burner: Number(r.non_burner_demos) };
    }

    const rows = statsResult.rows.map((r) => {
      const dateStr = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
      const totalSends = Number(r.total_sends);
      const target = TARGETS[dateStr] ?? null;
      const attainment = target ? Number(((totalSends / target) * 100).toFixed(1)) : null;

      const callsBurner = burnerCallsMap[dateStr] ?? 0;
      const totalCalls = totalCallsMap[dateStr] ?? 0;
      const callsNonBurner = Math.max(totalCalls - callsBurner, 0);

      const demosBurner = demosMap[dateStr]?.burner ?? 0;
      const demosNonBurner = demosMap[dateStr]?.non_burner ?? 0;

      const demoCallRateBurner = callsBurner > 0
        ? Number(((demosBurner / callsBurner) * 100).toFixed(2)) : 0;
      const demoCallRateNonBurner = callsNonBurner > 0
        ? Number(((demosNonBurner / callsNonBurner) * 100).toFixed(2)) : 0;

      // Lift from Burner Email = Burner demo:call rate - Non-burner demo:call rate
      const liftFromBurner = Number((demoCallRateBurner - demoCallRateNonBurner).toFixed(2));

      // If Burner Email Was Not There = Demos that would have happened at non-burner rate
      const ifNoBurner = callsBurner > 0
        ? Number(((demoCallRateNonBurner / 100) * callsBurner).toFixed(1)) : 0;

      // Difference = Actual burner demos - hypothetical at non-burner rate
      const difference = Number((demosBurner - ifNoBurner).toFixed(1));

      // Cost Lift = Difference as % of total demos
      const totalDemos = demosBurner + demosNonBurner;
      const costLift = totalDemos > 0
        ? Number(((difference / totalDemos) * 100).toFixed(2)) : 0;

      return {
        date: dateStr,
        emails_sent: totalSends,
        target_emails_sent: target,
        attainment,
        bounce_rate: Number(r.bounce_rate),
        inboxes_at_capacity: Number(health.inboxes_at_capacity) || 0,
        domains_at_capacity: Number(health.domains_at_capacity) || 0,
        domains_above_reputation: Number(health.domains_above_reputation) || 0,
        emails_2plus_opens: Number(r.emails_2plus_opens),
        open_2plus_rate: Number(r.open_2plus_rate),
        unique_2plus_no_call: noCallMap[dateStr] ?? 0,
        calls_burner: callsBurner,
        demos_burner: demosBurner,
        demo_call_rate_burner: demoCallRateBurner,
        calls_non_burner: callsNonBurner,
        demos_non_burner: demosNonBurner,
        demo_call_rate_non_burner: demoCallRateNonBurner,
        lift_from_burner: liftFromBurner,
        if_no_burner: ifNoBurner,
        difference,
        cost_lift: costLift,
      };
    });

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
