import { logger } from '../utils/logger';
import * as taskModel from '../models/task.model';
import * as projectModel from '../models/project.model';
import * as protocolModel from '../models/protocol.model';
import * as organizationModel from '../models/organization.model';
import * as taskPhotoModel from '../models/taskPhoto.model';
import * as blueprintModel from '../models/blueprint.model';
import { generateProtocolPdf, TaskPhoto, BlueprintData, BlueprintAnnotation, BlueprintMarker } from './pdf.service';
import { buildS3Key, writeFile, readFile } from './storage.service';
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

      // Fetch task photos
      const tasksWithPhotos = tasks.filter((t) => t.photo_count > 0);
      const taskPhotos: TaskPhoto[] = [];

      for (const task of tasksWithPhotos) {
        try {
          const photos = await taskPhotoModel.findPhotosByTask(task.id, params.organizationId);
          for (const photo of photos) {
            try {
              const imageBuffer = await readFile(photo.file_url);
              taskPhotos.push({
                task_id: task.id,
                caption: photo.caption,
                imageBuffer,
              });
            } catch (err) {
              logger.warn({ err, photoId: photo.id }, 'Failed to read photo for protocol PDF');
            }
          }
        } catch (err) {
          logger.warn({ err, taskId: task.id }, 'Failed to fetch photos for task');
        }
      }

      // Fetch blueprints with annotations
      const blueprintRows = await blueprintModel.findBlueprintsByProject(
        params.projectId,
        params.organizationId,
      );
      const blueprints: BlueprintData[] = [];

      for (const bp of blueprintRows) {
        try {
          const pdfBuffer = await readFile(bp.file_url);

          // Gather annotations from tasks that reference this blueprint
          const annotations: BlueprintAnnotation[] = tasks
            .filter(
              (t) =>
                t.blueprint_id === bp.id &&
                t.annotation_x != null &&
                t.annotation_y != null &&
                t.annotation_width != null &&
                t.annotation_height != null &&
                t.annotation_page != null,
            )
            .map((t) => ({
              taskNumber: t.task_number,
              status: t.status,
              x: t.annotation_x!,
              y: t.annotation_y!,
              width: t.annotation_width!,
              height: t.annotation_height!,
              page: t.annotation_page!,
            }));

          // Gather markers from tasks that reference this blueprint
          const bpMarkers: BlueprintMarker[] = tasks
            .filter(
              (t) =>
                t.blueprint_id === bp.id &&
                Array.isArray(t.annotation_markers) &&
                t.annotation_markers.length > 0,
            )
            .map((t) => ({
              taskNumber: t.task_number,
              markers: t.annotation_markers!,
            }));

          blueprints.push({
            name: bp.name,
            pdfBuffer,
            annotations,
            markers: bpMarkers.length > 0 ? bpMarkers : undefined,
          });
        } catch (err) {
          logger.warn({ err, blueprintId: bp.id }, 'Failed to read blueprint for protocol PDF');
        }
      }

      // Generate PDF
      const pdfBuffer = await generateProtocolPdf({
        organizationName: org.name,
        projectName: project.name,
        projectAddress: project.address || undefined,
        projectStatus: project.status,
        projectStartDate: project.start_date || undefined,
        projectTargetCompletion: project.target_completion_date || undefined,
        projectDescription: project.description || undefined,
        responsibleUserName: project.responsible_user_name || undefined,
        generatedAt: new Date().toISOString(),
        generatedBy: params.userId,
        filterSummary,
        tasks,
        taskPhotos: taskPhotos.length > 0 ? taskPhotos : undefined,
        blueprints: blueprints.length > 0 ? blueprints : undefined,
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
