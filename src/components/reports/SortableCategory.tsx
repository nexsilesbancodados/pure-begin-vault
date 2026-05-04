import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, GripVertical } from 'lucide-react';

interface SortableCategoryProps {
  cat: any;
  activeCategory: string;
  expandedCategories: string[];
  setActiveCategory: (id: string) => void;
  toggleCategory: (id: string) => void;
}

export const SortableCategory: React.FC<SortableCategoryProps> = ({
  cat,
  activeCategory,
  expandedCategories,
  setActiveCategory,
  toggleCategory
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const isExpanded = expandedCategories.includes(cat.id) || (cat.children?.some((c: any) => c.id === activeCategory));
  const isActive = activeCategory === cat.id || (cat.children?.some((c: any) => c.id === activeCategory));

  return (
    <div ref={setNodeRef} style={style} className="space-y-1 group/item">
      <div className="flex items-center gap-1">
        <div 
          {...attributes} 
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button 
          onClick={() => {
            setActiveCategory(cat.id);
            if (cat.children) toggleCategory(cat.id);
          }} 
          className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${isActive ? "bg-[#E8F0FE] text-primary shadow-sm" : "text-slate-500 hover:bg-slate-50/50 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-3">
            <cat.icon className={`h-4.5 w-4.5 ${isActive ? "text-primary" : "text-slate-400"}`} />
            <span className={isActive ? "font-bold" : ""}>{cat.label}</span>
          </div>
          {cat.hasArrow && (
            <ChevronDown 
              className={`h-3.5 w-3.5 opacity-50 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory(cat.id);
              }}
            />
          )}
        </button>
      </div>
      
      {cat.children && isExpanded && (
        <div className="ml-8 space-y-1 animate-in fade-in duration-200">
          {cat.children.map((child: any) => (
            <button 
              key={child.id} 
              onClick={() => setActiveCategory(child.id)} 
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[12.5px] transition-all ${activeCategory === child.id ? "bg-[#537FF1] text-white font-bold shadow-md" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
            >
              <child.icon className={`h-4 w-4 ${activeCategory === child.id ? "text-white" : "text-slate-400"}`} />
              <span>{child.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
