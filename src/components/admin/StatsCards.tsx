interface Stat {
  label: string;
  value: number | string;
  icon: string;
}

interface Props {
  today: number;
  week: number;
  total: number;
}

export default function StatsCards({ today, week, total }: Props) {
  const stats: Stat[] = [
    { label: "Dnes", value: today, icon: "📅" },
    { label: "Tento týden", value: week, icon: "📆" },
    { label: "Celkem aktivních", value: total, icon: "✅" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm"
        >
          <div className="text-2xl mb-2">{s.icon}</div>
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
          <p className="text-3xl font-semibold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
