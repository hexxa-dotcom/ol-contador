"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#0f172a", "#f97316", "#94a3b8"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label || payload[0]?.name}</strong>{payload.map((item, index) => <span key={`${item.name}-${index}`}><i style={{ background: item.color }}/>{item.name}: {item.value}</span>)}</div>;
}

type SeriesPoint = { name: string; value: number; secondary?: number };
type PiePoint = { name: string; value: number };

export function InsightChart({ variant, data, pieData }: { variant: number; data?: SeriesPoint[]; pieData?: PiePoint[] }) {
  const series = data || [];
  const pie = pieData || [];
  const activeData = variant % 3 === 2 ? pie : series;
  if (!activeData.length) {
    return <div className="chart-empty">Sem dados reais para este período.</div>;
  }
  if (variant % 3 === 2) {
    return <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="78%" paddingAngle={4} stroke="transparent" isAnimationActive animationDuration={650}>{pie.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]}/>)}</Pie><Tooltip content={<ChartTooltip/>}/></PieChart></ResponsiveContainer><div className="chart-legend">{pie.map((item,index)=><span key={item.name}><i style={{background:colors[index % colors.length]}}/>{item.name} <strong>{item.value}</strong></span>)}</div></div>;
  }

  if (variant % 3 === 1) {
    return <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(148,163,184,.22)"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#64748b"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#94a3b8"}}/><Tooltip cursor={{fill:"rgba(148,163,184,.08)"}} content={<ChartTooltip/>}/><Bar dataKey="value" name="Total" fill="#0f172a" radius={[7,7,2,2]} isAnimationActive animationDuration={650}/><Bar dataKey="secondary" name="Concluídos" fill="#f97316" radius={[7,7,2,2]} isAnimationActive animationDuration={750}/></BarChart></ResponsiveContainer></div>;
  }

  return <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id={`area-${variant}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={.3}/><stop offset="95%" stopColor="#f97316" stopOpacity={.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(148,163,184,.22)"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#64748b"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#94a3b8"}}/><Tooltip content={<ChartTooltip/>}/><Area type="monotone" dataKey="value" name="Atendimentos" stroke="#f97316" strokeWidth={2} fill={`url(#area-${variant})`} isAnimationActive animationDuration={700}/></AreaChart></ResponsiveContainer></div>;
}
