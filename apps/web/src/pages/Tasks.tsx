import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CheckSquare, Plus, Clock, AlertTriangle, User, Calendar, Flag, ChevronRight, Zap, Filter } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assignee?: { firstName: string; lastName: string; };
  lead?: { firstName: string; lastName: string; };
}

const mockTasks: Task[] = [
  { id: '1', title: 'Contact lead ALPHA-7', description: 'Follow up on quantum deal proposal', status: 'TODO', priority: 'HIGH', dueDate: new Date().toISOString(), assignee: { firstName: 'Admin', lastName: 'User' }, lead: { firstName: 'Sarah', lastName: 'Connor' } },
  { id: '2', title: 'Send contract to Tyrell Corp', description: 'Finalize replicant deal documentation', status: 'IN_PROGRESS', priority: 'URGENT', dueDate: new Date(Date.now() + 86400000).toISOString(), lead: { firstName: 'Rick', lastName: 'Deckard' } },
  { id: '3', title: 'Review quarterly metrics', description: 'Analyze Q4 performance data', status: 'TODO', priority: 'MEDIUM', dueDate: new Date(Date.now() + 172800000).toISOString() },
  { id: '4', title: 'Prepare demo for OCP', description: 'Set up product demonstration', status: 'COMPLETED', priority: 'HIGH', lead: { firstName: 'Alex', lastName: 'Murphy' } },
  { id: '5', title: 'Update CRM database', description: 'Sync all lead information', status: 'TODO', priority: 'LOW', dueDate: new Date(Date.now() + 604800000).toISOString() },
  { id: '6', title: 'Schedule meeting with Weyland', description: 'Discuss expansion plans', status: 'IN_PROGRESS', priority: 'MEDIUM', lead: { firstName: 'Ellen', lastName: 'Ripley' } },
];

export function Tasks() {
  const [filter, setFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        return await api.get('/tasks');
      } catch (e) {
        return { tasks: mockTasks };
      }
    },
    retry: false,
  });

  const tasks = data?.tasks || mockTasks;
  const filteredTasks = filter === 'ALL' ? tasks : tasks.filter((t: Task) => t.status === filter);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      URGENT: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
      HIGH: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
      MEDIUM: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
      LOW: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    };
    return colors[priority] || colors.LOW;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { text: string; bg: string }> = {
      TODO: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
      IN_PROGRESS: { text: 'text-purple-400', bg: 'bg-purple-500/10' },
      COMPLETED: { text: 'text-green-400', bg: 'bg-green-500/10' },
    };
    return colors[status] || colors.TODO;
  };

  const stats = {
    total: tasks.length,
    todo: tasks.filter((t: Task) => t.status === 'TODO').length,
    inProgress: tasks.filter((t: Task) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t: Task) => t.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            MISSION CONTROL
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            ACTIVE OBJECTIVES: <span className="text-cyan-400">{stats.total}</span> // TASK MANAGEMENT SYSTEM
          </p>
        </div>
        <button className="cyber-btn px-6 py-3 flex items-center gap-3">
          <Plus className="h-5 w-5" />
          <span>NEW TASK</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'TOTAL TASKS', value: stats.total, icon: CheckSquare, color: 'cyan', filter: 'ALL' },
          { label: 'PENDING', value: stats.todo, icon: Clock, color: 'blue', filter: 'TODO' },
          { label: 'IN PROGRESS', value: stats.inProgress, icon: Zap, color: 'purple', filter: 'IN_PROGRESS' },
          { label: 'COMPLETED', value: stats.completed, icon: Flag, color: 'green', filter: 'COMPLETED' },
        ].map((stat) => {
          const Icon = stat.icon;
          const isActive = filter === stat.filter;
          return (
            <button
              key={stat.label}
              onClick={() => setFilter(stat.filter as any)}
              className={`holo-card rounded-lg p-4 text-left transition-all ${isActive ? `border-${stat.color}-400/50 shadow-[0_0_30px_rgba(0,255,255,0.15)]` : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded bg-${stat.color}-500/10 flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 text-${stat.color}-400 ${isActive ? 'glow-icon' : ''}`} />
                </div>
                <div>
                  <div className={`stat-value text-2xl text-${stat.color}-400`}>{stat.value}</div>
                  <div className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/40 tracking-wider">{stat.label}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tasks List */}
      <div className="holo-card rounded-lg overflow-hidden">
        <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-cyan-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">
              {filter === 'ALL' ? 'ALL OBJECTIVES' : filter.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-400/50" />
            <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">{filteredTasks.length} RECORDS</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">LOADING OBJECTIVES...</div>
          </div>
        ) : (
          <div className="divide-y divide-cyan-500/10">
            {filteredTasks.map((task: Task) => {
              const priorityColors = getPriorityColor(task.priority);
              const statusColors = getStatusColor(task.status);
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="p-4 hover:bg-cyan-500/5 cursor-pointer transition-all group radar-scan"
                >
                  <div className="flex items-center gap-4">
                    {/* Priority Indicator */}
                    <div className={`w-1 h-12 rounded-full ${priorityColors.bg} ${priorityColors.border} border`} />
                    
                    {/* Checkbox */}
                    <div className={`w-6 h-6 rounded border ${task.status === 'COMPLETED' ? 'bg-green-500/20 border-green-400' : 'border-cyan-500/30'} flex items-center justify-center`}>
                      {task.status === 'COMPLETED' && <CheckSquare className="h-4 w-4 text-green-400" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className={`font-['Orbitron'] text-sm ${task.status === 'COMPLETED' ? 'text-cyan-400/50 line-through' : 'text-cyan-400'} group-hover:neon-text truncate`}>
                          {task.title}
                        </h4>
                        <span className={`cyber-badge ${priorityColors.text}`}>
                          {task.priority}
                        </span>
                        <span className={`cyber-badge ${statusColors.text}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      {task.description && (
                        <p className="font-['Rajdhani'] text-sm text-cyan-400/50 truncate">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-cyan-400/40">
                            <Calendar className="h-3 w-3" />
                            <span className="font-['Share_Tech_Mono'] text-[10px]">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {task.lead && (
                          <div className="flex items-center gap-1 text-cyan-400/40">
                            <User className="h-3 w-3" />
                            <span className="font-['Share_Tech_Mono'] text-[10px]">
                              {task.lead.firstName} {task.lead.lastName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-cyan-400/30 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="p-12 text-center">
                <CheckSquare className="h-16 w-16 mx-auto text-cyan-400/20 mb-4" />
                <div className="font-['Orbitron'] text-lg text-cyan-400/50 mb-2">NO OBJECTIVES FOUND</div>
                <p className="font-['Rajdhani'] text-cyan-400/30">All tasks in this category have been completed</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 cyber-modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div 
            className="holo-card rounded-lg w-full max-w-lg relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="energy-bar" />
            
            <div className="p-6 border-b border-cyan-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`cyber-badge ${getPriorityColor(selectedTask.priority).text}`}>
                      {selectedTask.priority}
                    </span>
                    <span className={`cyber-badge ${getStatusColor(selectedTask.status).text}`}>
                      {selectedTask.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="font-['Orbitron'] text-xl text-cyan-400 neon-text">
                    {selectedTask.title}
                  </h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-cyan-400/50 hover:text-cyan-400">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedTask.description && (
                <div className="data-panel rounded p-4">
                  <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50 mb-2">DESCRIPTION</div>
                  <p className="font-['Rajdhani'] text-cyan-400/80">{selectedTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedTask.dueDate && (
                  <div className="data-panel rounded p-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">DUE DATE</div>
                        <div className="font-['Rajdhani'] text-sm">{new Date(selectedTask.dueDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedTask.lead && (
                  <div className="data-panel rounded p-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <User className="h-4 w-4" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">RELATED LEAD</div>
                        <div className="font-['Rajdhani'] text-sm">{selectedTask.lead.firstName} {selectedTask.lead.lastName}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button className="cyber-btn flex-1 py-2 text-xs">EDIT</button>
                {selectedTask.status !== 'COMPLETED' && (
                  <button className="cyber-btn flex-1 py-2 text-xs" style={{ borderColor: 'rgb(34, 197, 94)', color: 'rgb(34, 197, 94)' }}>
                    MARK COMPLETE
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;
