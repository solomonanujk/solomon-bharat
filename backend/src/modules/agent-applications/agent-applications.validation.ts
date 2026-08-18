import { z } from 'zod';
import { AgentApplicationStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const submitAgentApplicationSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1).max(30),
  businessAddress: z.string().min(1).max(500),
  country: z.string().min(1).max(100),
  message: z.string().max(2000).optional(),
});
export type SubmitAgentApplicationDto = z.infer<typeof submitAgentApplicationSchema>;

export const agentApplicationListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(AgentApplicationStatus).optional(),
});
export type AgentApplicationListQueryDto = z.infer<typeof agentApplicationListQuerySchema>;

export const rejectAgentApplicationSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type RejectAgentApplicationDto = z.infer<typeof rejectAgentApplicationSchema>;

export const requestAgentMoreInfoSchema = z.object({
  message: z.string().min(1).max(1000),
});
export type RequestAgentMoreInfoDto = z.infer<typeof requestAgentMoreInfoSchema>;

export const addAgentNoteSchema = z.object({
  note: z.string().min(1).max(1000),
});
export type AddAgentNoteDto = z.infer<typeof addAgentNoteSchema>;

export const updateAgentProfileSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(30).optional(),
  businessAddress: z.string().min(1).max(500).optional(),
});
export type UpdateAgentProfileDto = z.infer<typeof updateAgentProfileSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
