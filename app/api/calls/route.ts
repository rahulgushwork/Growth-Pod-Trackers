import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    const result = await client.query(`
      WITH date_spine AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS date
      ),
      monthly_targets AS (
        SELECT DATE_TRUNC('month', CURRENT_DATE)::date AS month, 100000 AS target
      ),
      daily_calls AS (
        SELECT
          date,
          SUM(total_calls) AS total_calls,
          SUM(CASE WHEN source = 'sales_dialer' THEN total_calls ELSE 0 END) AS sales_dialer_calls,
          SUM(CASE WHEN source = 'justcall' THEN total_calls ELSE 0 END) AS justcall_calls
        FROM gist.justcall_daily_call_stats
        GROUP BY date
      ),
      filled_data AS (
        SELECT
          ds.date,
          COALESCE(dc.total_calls, 0) AS total_calls,
          COALESCE(dc.sales_dialer_calls, 0) AS sales_dialer_calls,
          COALESCE(dc.justcall_calls, 0) AS justcall_calls
        FROM date_spine ds
        LEFT JOIN daily_calls dc ON ds.date = dc.date
      ),
      with_target AS (
        SELECT
          fd.date,
          fd.total_calls,
          fd.sales_dialer_calls,
          fd.justcall_calls,
          mt.target
        FROM filled_data fd
        LEFT JOIN monthly_targets mt
          ON DATE_TRUNC('month', fd.date) = mt.month
      )
      SELECT
        date,
        total_calls,
        SUM(total_calls) OVER (
          PARTITION BY DATE_TRUNC('month', date)
          ORDER BY date
        ) AS calls_mtd,
        target,
        ROUND(
          SUM(total_calls) OVER (
            PARTITION BY DATE_TRUNC('month', date)
            ORDER BY date
          )::numeric / NULLIF(target, 0) * 100, 2
        ) AS attainment,
        sales_dialer_calls,
        justcall_calls
      FROM with_target
      ORDER BY date
    `);

    const rows = result.rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
      total_calls: Number(r.total_calls),
      calls_mtd: Number(r.calls_mtd),
      target: Number(r.target),
      attainment: r.attainment ? Number(r.attainment) : 0,
      sales_dialer_calls: Number(r.sales_dialer_calls),
      justcall_calls: Number(r.justcall_calls),
    }));

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
