import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell } from "recharts";

interface TypeAwareEDAProps {
  column: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#8dd1e1', '#a4de6c'];

export function TypeAwareEDA({ column }: TypeAwareEDAProps) {
  if (!column) return null;

  const { semantic_type, data_type } = column;

  // NUMERIC TYPES (Integer, Decimal)
  if (['INTEGER', 'DECIMAL'].includes(semantic_type) || (semantic_type === 'UNKNOWN' && column.is_numeric)) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm bg-muted/30 p-3 rounded-lg border border-border">
          <div><div className="text-muted-foreground text-xs">Mean</div><div className="font-semibold">{column.mean !== null ? column.mean?.toFixed(2) : 'N/A'}</div></div>
          <div><div className="text-muted-foreground text-xs">Median</div><div className="font-semibold">{column.median !== null ? column.median?.toFixed(2) : 'N/A'}</div></div>
          <div><div className="text-muted-foreground text-xs">Min</div><div className="font-semibold">{column.min !== null ? column.min?.toFixed(2) : 'N/A'}</div></div>
          <div><div className="text-muted-foreground text-xs">Max</div><div className="font-semibold">{column.max !== null ? column.max?.toFixed(2) : 'N/A'}</div></div>
          <div><div className="text-muted-foreground text-xs">Std Dev</div><div className="font-semibold">{column.std !== null ? column.std?.toFixed(2) : 'N/A'}</div></div>
        </div>
        {/* Placeholder for Histogram if we had bin data */}
        <div className="text-xs text-center text-muted-foreground italic py-2">
          Numeric distribution charts available in detailed Visualization tab.
        </div>
      </div>
    );
  }

  // CATEGORICAL & CHOICE TYPES
  if (['CATEGORY', 'SINGLE_CHOICE', 'ORDINAL_CHOICE', 'BOOLEAN'].includes(semantic_type) || (!column.is_numeric && semantic_type === 'UNKNOWN')) {
    const data = column.top_categories || [];
    if (data.length === 0) return <div className="text-sm italic text-muted-foreground">No distribution data.</div>;
    
    return (
      <div className="space-y-2">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.slice(0, 5)} // top 5
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
              >
                {data.slice(0, 5).map((entry: any, index: number) => (
                  <PieCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 mt-2">
          {data.slice(0, 3).map((cat: any, i: number) => (
            <div key={i} className="flex justify-between items-center text-xs">
              <span className="truncate max-w-[120px]">{cat.name === 'None' ? '(Missing)' : cat.name}</span>
              <span className="font-semibold">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MULTIPLE CHOICE & TAGS
  if (['MULTIPLE_CHOICE', 'TAGS'].includes(semantic_type)) {
    const data = column.top_categories || [];
    if (data.length === 0) return <div className="text-sm italic text-muted-foreground">No tags found.</div>;
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground mb-1">Top Tags/Options Frequency</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // TEXT TYPES
  if (['LONG_TEXT', 'SHORT_TEXT'].includes(semantic_type)) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm bg-muted/30 p-3 rounded-lg border border-border">
          <div><div className="text-muted-foreground text-xs">Avg Length</div><div className="font-semibold">{column.avg_length !== undefined ? column.avg_length?.toFixed(1) + ' chars' : 'N/A'}</div></div>
          <div><div className="text-muted-foreground text-xs">Avg Words</div><div className="font-semibold">{column.avg_words !== undefined ? column.avg_words?.toFixed(1) + ' words' : 'N/A'}</div></div>
        </div>
        <div className="text-xs text-center text-muted-foreground italic py-2">
          Advanced NLP insights available in the text analysis module.
        </div>
      </div>
    );
  }

  // FALLBACK
  return (
    <div className="text-sm italic text-muted-foreground py-4 text-center">
      Type-specific EDA not available for {semantic_type.replace(/_/g, ' ')}.
    </div>
  );
}
