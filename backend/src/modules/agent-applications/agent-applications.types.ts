import { AgentApplicationStatus } from '@prisma/client';

export interface SubmitAgentApplicationInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessAddress: string;
  country: string;
  message?: string;
}

export interface UpdateAgentProfileInput {
  businessName?: string;
  contactName?: string;
  phone?: string;
  businessAddress?: string;
}

export interface AgentApplicationListFilter {
  status?: AgentApplicationStatus;
}

export { AgentApplicationStatus };
