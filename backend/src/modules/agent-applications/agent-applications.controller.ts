import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { agentApplicationsService } from './agent-applications.service';
import {
  AddAgentNoteDto,
  AgentApplicationListQueryDto,
  RejectAgentApplicationDto,
  RequestAgentMoreInfoDto,
  SubmitAgentApplicationDto,
  UpdateAgentProfileDto,
} from './agent-applications.validation';

export const agentApplicationsController = {
  async submitApplication(req: Request, res: Response): Promise<void> {
    const dto = req.body as SubmitAgentApplicationDto;
    const application = await agentApplicationsService.submitApplication(dto);
    sendCreated(res, application, 'Application submitted. We will be in touch shortly.');
  },

  async listApplications(req: Request, res: Response): Promise<void> {
    const { status, ...pagination } = req.query as unknown as AgentApplicationListQueryDto;
    const { data, total } = await agentApplicationsService.listApplications({ status }, pagination);
    sendSuccess(res, data, 'Applications retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getApplication(req: Request, res: Response): Promise<void> {
    const application = await agentApplicationsService.getApplicationDetail(req.params.id);
    sendSuccess(res, application);
  },

  async approveApplication(req: Request, res: Response): Promise<void> {
    const result = await agentApplicationsService.approveApplication(req.params.id, req.user!.id);
    sendSuccess(res, result, 'Agent application approved');
  },

  async rejectApplication(req: Request, res: Response): Promise<void> {
    const dto = req.body as RejectAgentApplicationDto;
    const application = await agentApplicationsService.rejectApplication(req.params.id, dto.reason, req.user!.id);
    sendSuccess(res, application, 'Agent application rejected');
  },

  async requestMoreInfo(req: Request, res: Response): Promise<void> {
    const dto = req.body as RequestAgentMoreInfoDto;
    const application = await agentApplicationsService.requestMoreInfo(req.params.id, dto.message, req.user!.id);
    sendSuccess(res, application, 'More information requested');
  },

  async addNote(req: Request, res: Response): Promise<void> {
    const dto = req.body as AddAgentNoteDto;
    const application = await agentApplicationsService.addInternalNote(req.params.id, dto.note);
    sendSuccess(res, application, 'Note added');
  },

  async listAgents(req: Request, res: Response): Promise<void> {
    const pagination = req.query as unknown as { page: number; limit: number };
    const { data, total } = await agentApplicationsService.listAgents(pagination);
    sendSuccess(res, data, 'Agents retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async getAgent(req: Request, res: Response): Promise<void> {
    const agent = await agentApplicationsService.getAgentDetailForAdmin(req.params.id);
    sendSuccess(res, agent);
  },

  async getMyProfile(req: Request, res: Response): Promise<void> {
    const profile = await agentApplicationsService.getMyProfile(req.user!.id);
    sendSuccess(res, profile);
  },

  async updateMyProfile(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpdateAgentProfileDto;
    const profile = await agentApplicationsService.updateMyProfile(req.user!.id, dto);
    sendSuccess(res, profile, 'Profile updated');
  },
};
