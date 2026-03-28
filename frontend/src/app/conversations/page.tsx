'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

export default function ConversationsPage() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const { data: leads } = useQuery({
    queryKey: ['leads-with-conversations'],
    queryFn: () => api.getLeads({ limit: '100' }),
    refetchInterval: 15000,
  });

  const { data: messages } = useQuery({
    queryKey: ['conversation', selectedLeadId],
    queryFn: () => api.getConversation(selectedLeadId!),
    enabled: !!selectedLeadId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.sendMessage({ leadId: selectedLeadId!, body }),
    onSuccess: () => {
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedLeadId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.aiGenerateMessage({ leadId: selectedLeadId! }),
  });

  // Filter to leads that have messages
  const leadsWithActivity = (leads?.leads || []).filter((l: any) => l.scores?.length > 0);

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-display font-bold text-text-primary">Inbox</h1>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span><kbd>A</kbd> Approve</span>
            <span><kbd>S</kbd> Skip</span>
            <span><kbd>R</kbd> Reassign</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Threads List */}
          <div className="lg:col-span-3 bg-bg-secondary border border-border rounded-lg">
            <div className="px-3 py-2 border-b border-border">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full px-3 py-1.5 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/50">
              {leadsWithActivity.length ? (
                leadsWithActivity.map((lead: any) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      selectedLeadId === lead.id ? 'bg-accent/10' : 'hover:bg-bg-tertiary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {lead.fullName || 'Unknown'}
                      </span>
                      {lead.scores?.[0] && (
                        <span className="text-xs font-mono text-text-muted">
                          {Math.round(lead.scores[0].totalScore)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted truncate mt-0.5">
                      {lead.phone || lead.email || 'No contact info'}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-sm text-text-muted text-center">
                  No conversations yet.
                </div>
              )}
            </div>
          </div>

          {/* Thread Detail */}
          <div className="lg:col-span-5 bg-bg-secondary border border-border rounded-lg flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">
                {selectedLeadId ? 'Thread' : 'Select a conversation'}
              </h2>
            </div>

            {selectedLeadId ? (
              <>
                <div className="flex-1 p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                  {messages?.length ? (
                    messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-lg text-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-accent/10 border border-accent/20 ml-8'
                            : 'bg-bg-tertiary border border-border mr-8'
                        }`}
                      >
                        <div className="text-text-primary text-xs">{msg.body}</div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-text-muted">
                            {msg.direction === 'outbound' ? 'Sent' : 'Received'}
                            {msg.aiGenerated && ' · AI'}
                          </span>
                          <span className="text-xs text-text-muted">{formatRelativeTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-text-muted text-sm py-8">No messages yet</div>
                  )}
                </div>

                <div className="p-3 border-t border-border">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (replyBody.trim()) sendMutation.mutate(replyBody.trim());
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Type a reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <Button type="submit" size="sm" disabled={sendMutation.isPending || !replyBody.trim()}>
                      Send
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                Select a lead to view conversation
              </div>
            )}
          </div>

          {/* Ghost Mode Panel */}
          <div className="lg:col-span-4 bg-bg-secondary border border-border-bright rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Ghost Mode</h2>
              <Badge variant="accent">AI Draft</Badge>
            </div>

            {selectedLeadId ? (
              <div className="p-4">
                <p className="text-xs text-text-muted mb-3">
                  AI-generated next messages. Swipe to approve.
                </p>

                {generateMutation.data ? (
                  <div className="space-y-3">
                    <div className="bg-bg-tertiary border border-border rounded-md p-3">
                      <div className="text-xs text-text-muted mb-1">Primary Draft</div>
                      <div className="text-sm text-text-primary">{generateMutation.data.sms_body}</div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={() => sendMutation.mutate(generateMutation.data.sms_body)}
                        >
                          Approve & Send
                        </Button>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </div>
                    <div className="bg-bg-tertiary border border-border rounded-md p-3">
                      <div className="text-xs text-text-muted mb-1">Alternative</div>
                      <div className="text-sm text-text-primary">{generateMutation.data.alternative_sms_body}</div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => sendMutation.mutate(generateMutation.data.alternative_sms_body)}
                        >
                          Use This
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-text-muted">
                      <div>Tone: {generateMutation.data.persona_tone_used}</div>
                      <div>Reason: {generateMutation.data.reason_for_choice}</div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? 'Generating...' : 'Generate AI Drafts'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-text-muted text-sm">
                Select a conversation to activate Ghost Mode
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
