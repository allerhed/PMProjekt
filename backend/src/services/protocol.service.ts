import { logger } from '../utils/logger';
import * as taskModel from '../models/task.model';
import * as projectModel from '../models/project.model';
import * as protocolModel from '../models/protocol.model';
import * as organizationModel from '../models/organization.model';
import { generateProtocolPdf } from './pdf.service';
import { buildS3Key, writeFile } from './storage.service';
import { incrementStorageUsed } from './storageTracking.service';
import { logAuditAction } from './audit.service';

export interface ProtocolGenerationParams {
  projectId: string;
  organizationId: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  ipAddress: string;
}

/**
 * Orchestrate protocol generation: query tasks → generate PDF → upload to S3 → update DB.
 * Runs asynchronously via setImmediate after returning the protocol ID.
 */
export async function startProtocolGeneration(params: ProtocolGenerationParams): Promise<string> {
  // Create protocol record with 'generating' status
  const protocol = await protocolModel.createProtocol({
    projectId: params.projectId,
    name: params.name,
    filters: params.filters,
    generatedBy: params.userId,
  });

  // Run generation in background
  setImmediate(async () => {
    try {
      // Fetch project and org details
      const project = await projectModel.findProjectById(params.projectId, params.organizationId);
      const org = await organizationModel.findOrganizationById(params.organizationId);

      if (!project || !org) {
        await protocolModel.updateProtocolFailed(protocol.id);
        return;
      }

      // Build task filters
      const taskFilters: taskModel.TaskFilters = {};
      if (params.filters.status) taskFilters.status = params.filters.status as string;
      if (params.filters.trade) taskFilters.trade = params.filters.trade as string;
      if (params.filters.priority) taskFilters.priority = params.filters.priority as string;

      // Fetch tasks (no pagination — get all matching tasks)
      const { tasks } = await taskModel.findTasksByProject(
        params.projectId,
        params.organizationId,
        taskFilters,
        { limit: 10000, offset: 0 },
      );

      // Build filter summary string
      const filterParts: string[] = [];
      if (params.filters.status) filterParts.push(`Status: ${params.filters.status}`);
      if (params.filters.trade) filterParts.push(`Trade: ${params.filters.trade}`);
      if (params.filters.priority) filterParts.push(`Priority: ${params.filters.priority}`);
      const filterSummary = filterParts.length > 0 ? filterParts.join(', ') : 'All tasks';

      // Generate PDF
      const pdfBuffer = await generateProtocolPdf({
        organizationName: org.name,
        projectName: project.name,
        projectAddress: project.address || undefined,
        generatedAt: new Date().toISOString(),
        generatedBy: params.userId,
        filterSummary,
        tasks,
      });

      // Upload to S3
      const s3Key = buildS3Key(
        'protocols',
        params.organizationId,
        params.projectId,
        protocol.id,
        `${params.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
      );

      await writeFile(s3Key, pdfBuffer, 'application/pdf');

      // Update protocol record
      await protocolModel.updateProtocolCompleted(protocol.id, s3Key, pdfBuffer.length);

      // Track storage
      await incrementStorageUsed(params.organizationId, pdfBuffer.length);

      // Audit
      logAuditAction({
        organizationId: params.organizationId,
        userId: params.userId,
        action: 'protocol.generated',
        resourceType: 'protocol',
        resourceId: protocol.id,
        metadata: { projectId: params.projectId, taskCount: tasks.length },
        ipAddress: params.ipAddress,
      });

      logger.info({
        protocolId: protocol.id,
        projectId: params.projectId,
        taskCount: tasks.length,
        pdfSize: pdfBuffer.length,
      }, 'Protocol generated successfully');
    } catch (err) {
      logger.error({ err, protocolId: protocol.id }, 'Protocol generation failed');
      await protocolModel.updateProtocolFailed(protocol.id);
    }
  });

  return protocol.id;
}
