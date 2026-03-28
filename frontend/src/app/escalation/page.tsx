'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

export default function EscalationPage() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['escalation-tasks'],
    queryFn: () => api.getTasks('pending'),
    refetchInterval: 10000,
  });

  const { data: escalationView } = useQuery({
    queryKey: ['escalation-view', selectedTask],
    queryFn: () => api.getEscalationView(selectedTask!),
    enabled: !!selectedTask,
  });

  const resolveMutation = useMutation({
    mutationFn: (taskId: string) => api.updateTaskStatus(taskId, 'completed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-tasks'] });
      setSelectedTask(null);
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: (data: { leadId: string; body: string }) => api.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-view', selectedTask] });
    },
  });

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-xl font-display font-bold text-text-primary mb-4">Human Escalation</h1>
        <p className="text-sm text-text-muted mb-6">Leads requiring agent attention. One-tap approve or respond.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Task List */}
          <div className="bg-bg-secondary border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">
                Pending ({tasks?.length || 0})
              </h2>
            </div>
            {isLoading ? (
              <div className="p-6 text-center text-text-muted text-sm">Loading...</div>
            ) : (
              <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
                {tasks?.map((task: any) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedTask === task.id ? 'bg-accent/10' : 'hover:bg-bg-tertiary'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">
                        {task.lead?.fullName || 'Unknown'}
                      </span>
                      <span className="text-xs text-text-muted">{formatRelativeTime(task.createdAt)}</span>
                    </div>
                    <div className="text-xs text-text-secondary truncate">{task.title}</div>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="warning">escalation</Badge>
                      {task.lead?.phone && <span className="text-xs text-text-muted">{task.lead.phone}</span>}
                    </div>
                  </button>
                )) || (
                  <div className="p-6 text-center text-text-muted text-sm">No pending escalations</div>
                )}
              </div>
            )}
          </div>

          {/* Escalation Detail — Mobile-Optimized Single Screen */}
          <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-lg">
            {escalationView ? (
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-text-primary">
                      {escalationView.lead?.fullName}
                    </h2>
                    <div className="text-xs text-text-muted">
                      {escalationView.classification?.classification && (
                        <Badge variant="accent" className="mr-2">
                          {escalationView.classification.classification}
                        </Badge>
                      )}
                      {escalationView.classificationReason}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => resolveMutation.mutate(selectedTask!)}
                  >
                    Resolve
                  </Button>
                </div>

                {/* Thread */}
                <div className="flex-1 p-4 space-y-2 max-h-80 overflow-y-auto">
                  {escalationView.messages?.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-lg text-sm ${
                        msg.direction === 'outbound'
                          ? 'bg-accent/10 border border-accent/20 ml-8'
                          : 'bg-bg-tertiary border border-border mr-8'
                      }`}
                    >
                      <div className="text-text-primary text-xs">{msg.body}</div>
                      <div className="text-xs text-text-muted mt-1">{formatRelativeTime(msg.createdAt)}</div>
                    </div>
                  ))}
                </div>

                {/* AI Suggested Reply */}
                {escalationView.suggestedReply && (
                  <div className="px-4 py-3 border-t border-border bg-bg-tertiary/50">
                    <div className="text-xs text-text-muted mb-1">AI Suggested Reply:</div>
                    <div className="text-sm text-text-primary mb-2">{escalationView.suggestedReply}</div>
                    <Button
                      size="sm"
                      onClick={() =>
                        sendReplyMutation.mutate({
                          leadId: escalationView.lead.id,
                          body: escalationView.suggestedReply,
                        })
                      }
                      disabled={sendReplyMutation.isPending}
                    >
                      Send Suggested Reply
                    </Button>
                  </div>
                )}

                {/* Quick Score */}
                {escalationView.latestScore && (
                  <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-text-muted">
                    <span>Score: <strong className="text-text-primary">{Math.round(escalationView.latestScore.totalScore)}</strong></span>
                    <span>Close: <strong className="text-text-primary">{(escalationView.latestScore.closeProbability * 100).toFixed(0)}%</strong></span>
                    <span>NBA: <strong className="text-accent">{escalationView.latestScore.nextBestAction}</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-text-muted text-sm">
                Select an escalation to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
