import { Request, Response } from 'express';
import { buildPaginationMeta } from '../../utils/pagination';
import { sendSuccess } from '../../utils/response';
import { BulkMessagesService, bulkMessagesService } from './bulk-messages.service';
import {
  CampaignInputDto,
  CampaignListQueryDto,
  RecipientListQueryDto,
  ReplyListQueryDto,
  TemplateInputDto,
  TemplateListQueryDto,
  TestSendDto,
} from './bulk-messages.validation';

export class BulkMessagesController {
  constructor(private readonly service: BulkMessagesService = bulkMessagesService) {}

  // ── templates ───────────────────────────────────────────────────────────────────────────
  listTemplates = async (req: Request, res: Response): Promise<void> => {
    const { status, ...pagination } = req.query as unknown as TemplateListQueryDto;
    const { data, total } = await this.service.listTemplates({ status }, pagination);
    sendSuccess(res, data, 'Templates retrieved', 200, buildPaginationMeta(total, pagination));
  };

  getTemplate = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getTemplate(req.params.id));
  };

  createTemplate = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.createTemplate(req.user!.id, req.body as TemplateInputDto), 'Template saved as a draft', 201);
  };

  updateTemplate = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.updateTemplate(req.params.id, req.body as TemplateInputDto), 'Template updated');
  };

  submitTemplate = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.submitTemplate(req.user!.id, req.params.id), 'Template submitted to Meta for review');
  };

  refreshTemplate = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.refreshTemplate(req.params.id), 'Template status refreshed');
  };

  syncTemplates = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.syncTemplates(req.user!.id), 'Templates synced from Meta');
  };

  deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteTemplate(req.params.id);
    sendSuccess(res, null, 'Template deleted');
  };

  // ── audience ────────────────────────────────────────────────────────────────────────────
  previewAudience = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.previewAudience(req.body.audience));
  };

  // ── campaigns ───────────────────────────────────────────────────────────────────────────
  listCampaigns = async (req: Request, res: Response): Promise<void> => {
    const { status, ...pagination } = req.query as unknown as CampaignListQueryDto;
    const { data, total } = await this.service.listCampaigns({ status }, pagination);
    sendSuccess(res, data, 'Campaigns retrieved', 200, buildPaginationMeta(total, pagination));
  };

  getCampaign = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getCampaign(req.params.id));
  };

  createCampaign = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.createCampaign(req.user!.id, req.body as CampaignInputDto), 'Campaign created', 201);
  };

  listRecipients = async (req: Request, res: Response): Promise<void> => {
    const { status, ...pagination } = req.query as unknown as RecipientListQueryDto;
    const { data, total } = await this.service.listRecipients(req.params.id, { status }, pagination);
    sendSuccess(res, data, 'Recipients retrieved', 200, buildPaginationMeta(total, pagination));
  };

  start = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.start(req.user!.id, req.params.id), 'Campaign started');
  };

  pause = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.pause(req.user!.id, req.params.id), 'Campaign paused');
  };

  resume = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.resume(req.user!.id, req.params.id), 'Campaign resumed');
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.cancel(req.user!.id, req.params.id), 'Campaign cancelled');
  };

  exportCampaign = async (req: Request, res: Response): Promise<void> => {
    const { csv, filename } = await this.service.exportCampaign(req.user!.id, req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  };

  testSend = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.testSend(req.body as TestSendDto), 'Test message sent');
  };

  // ── replies ─────────────────────────────────────────────────────────────────────────────
  listReplies = async (req: Request, res: Response): Promise<void> => {
    const { campaignId, unread, ...pagination } = req.query as unknown as ReplyListQueryDto;
    const { data, total } = await this.service.listReplies({ campaignId, unread }, pagination);
    sendSuccess(res, data, 'Replies retrieved', 200, buildPaginationMeta(total, pagination));
  };

  summary = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, { unreadReplies: await this.service.unreadReplyCount() });
  };

  markReplyRead = async (req: Request, res: Response): Promise<void> => {
    await this.service.markReplyRead(req.params.id);
    sendSuccess(res, null, 'Reply marked as read');
  };

  markAllRead = async (req: Request, res: Response): Promise<void> => {
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    sendSuccess(res, { marked: await this.service.markAllRepliesRead(campaignId) }, 'Replies marked as read');
  };
}

export const bulkMessagesController = new BulkMessagesController();
